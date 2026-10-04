// Same-origin CORS-bypass proxy. Browser clients prefix an approved target url
// with this app's own origin and get it back with CORS headers attached, so the
// browser never has to pass the target's own CORS check.
//
//   GET|POST|PUT|PATCH|DELETE /api/proxy?url=<absolute-url>
//   GET|POST|PUT|PATCH|DELETE /.netlify/functions/proxy?url=<absolute-url>
//   ...or the same routes with the target in an `x-proxy-url` header (browsers
//   may set it after the 204 preflight; the Cloudflare Worker route keeps the
//   query string out of the event, so this is the form that always works).
//
// DESTINATION ALLOWLIST — two modes behind one flag. Default is "xpart" and it
// can only be changed through the password-gated control endpoint below; an
// unset store, an unknown value or a failed store read all resolve to "xpart",
// never to "universal".
//
// The flag lives in a Durable Object on the Worker (strongly consistent: one
// global instance serialises every read and write, so a flip is visible to the
// very next request from every isolate) and falls back to the shared store
// (`proxy-mode` in KV/Blobs/.data file) on Netlify and `node server.js`, which
// are single-instance runtimes with no cross-isolate staleness. There is
// deliberately NO cache of the value in any runtime: a cached flag is exactly
// what let "universal" keep working after it had been switched off.
//
//   "xpart" (default) — the allowlist is closed, not open. Every destination is
//     matched against a stored list of bare hostnames; a target is allowed when
//     its hostname equals one of them or is a label-anchored subdomain of one.
//     The list always starts with `xpart.netlify.app` (the unconditional floor,
//     persisted or not) and is extended at runtime through the password-gated
//     hosts-add/hosts-remove actions below, up to 50 entries. The match is on
//     whole DNS labels off `URL.hostname` (userinfo already stripped by the
//     parser), so `xpart.netlify.app.evil.com`, `evilxpart.netlify.app`,
//     `xpart.netlify.app%2eevil.com`, `xpart.netlify.app@evil.com` and the
//     trailing-dot FQDN `xpart.netlify.app.` are all rejected with 403 before a
//     socket is opened — and the same holds for every other stored host.
//   "universal" — the site admin has deliberately widened the proxy to any
//     public host, so the xpart allowlist check is skipped. Every other guard
//     below is unchanged, and checkTarget is still the single choke point.
//
// In BOTH modes: `http:`/`https:` only, default ports only (80/443 — the parser
// already normalises those away, so any surviving `u.port` is refused), and two
// SSRF guards stay layered on top of the allowlist, invisible to normal use and
// free: no private/loopback/link-local destinations (.local/.internal/
// .localhost, RFC1918, CGNAT, 169.254.169.254 cloud metadata). Every redirect
// hop is re-validated through the same checkTarget. A universal-mode request to
// a private address is still 403 — widening the allowlist does not open the
// runtime's own network.
//
// CONTROL ENDPOINT (never a proxy request):
//   GET  /api/proxy?action=mode                                  -> { ok, mode }
//   POST /api/proxy  { action:"mode", mode:"xpart"|"universal", password }
//   GET  /api/proxy?action=hosts                                 -> { ok, hosts }
//   POST /api/proxy  { action:"hosts-add",    host, password }
//   POST /api/proxy  { action:"hosts-remove", host, password }
// A POST is only a control request when the body declares one of those three
// actions at the TOP level, so a chat POST carrying {"model":…,"messages":[…]}
// is always forwarded, never swallowed. Reading the flag or the host list needs
// no password; writing either uses the same checkPassword as api-keys.js.
// `xpart.netlify.app` is the permanent first entry and hosts-remove on it is a
// no-op that still answers 200 with the unchanged list, so the UI can simply
// re-render. There is deliberately NO rate limiting of any kind here.
const { cors, storeGet, storeSet } = require('./_shared');
const { checkPassword } = require('./auth');

const MAX_BODY = 4 * 1024 * 1024; // 4 MB of request body forwarded, hard stop
const TIMEOUT_MS = 60000;          // per hop: fetch + the streamed body
const MAX_HOPS = 3;                // redirect hops followed
const METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
const WITH_BODY = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// The unconditional floor of the allowlist: always allowed in xpart mode, never
// stored, never removable. A failed or unreadable store therefore degrades the
// allowlist to "xpart only" — closed, never locked out and never widened.
const DEFAULT_HOST = 'xpart.netlify.app';
const MAX_HOSTS = 50;                // total entries incl. the floor
const SHARED_CACHE = 'public, max-age=60';  // default for cacheable GET/HEAD
const NO_CACHE = 'no-cache, no-transform';  // event streams must never be cached

const MODE_KEY = 'proxy-mode';          // shared store key (Netlify/local fallback)
const HOSTS_KEY = 'hosts';              // Durable Object storage key AND shared store key
const MODE_XPART = 'xpart';
const MODE_UNIVERSAL = 'universal';
const DEFAULT_MODE = MODE_XPART;        // fail closed: never default to universal
// Cheap pre-filter, see bodyControlAction: an ordinary chat body is never even
// parsed, let alone diverted.
const CONTROL_ACTION_RE = /"action"\s*:\s*"(?:mode|hosts-add|hosts-remove)"/;
const MODE_DO_NAME = 'proxy-mode';      // the one global Durable Object instance
const MODE_DO_URL = 'https://do/mode'; // its internal control URL

// Hop-by-hop, host-bound, cookie and edge headers that must never be replayed
// onto the target. accept-encoding/content-encoding are dropped as well so the
// runtime negotiates and decodes the body for us instead of shipping a
// client-gzipped payload we would then mislabel.
const STRIP = new Set([
  'host', 'origin', 'referer', 'connection', 'content-length', 'transfer-encoding',
  'keep-alive', 'upgrade', 'cookie', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'accept-encoding', 'content-encoding', 'expect',
]);
const stripHeader = (k) => STRIP.has(k) || k.startsWith('cf-') || k.startsWith('access-control-request-');

// Hoisted: constant patterns, never rebuilt per request.
const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;
const V4_TAIL_RE = /(\d{1,3}(?:\.\d{1,3}){3})$/;
const V6_LINKLOCAL_RE = /^fe[89ab]/;
const V6_UNIQUE_LOCAL_RE = /^f[cd]/;
const EVENT_STREAM_RE = /^text\/event-stream\b/i;
const HOST_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const HOST_TLD_RE = /^[a-z]{2,}$/;
// Anything that would turn a "bare hostname" into a url fragment: scheme
// separators, userinfo, path, query, fragment, wildcard, whitespace.
const HOST_FORBIDDEN_RE = /[/\\:@?#*\s]/;

// Can this runtime hand a ReadableStream to the client? The Cloudflare Worker
// pipes result.stream into a Response (worker/index.js runFn) and any other
// fetch runtime can too. Netlify Functions v1 serialises its return value as
// JSON, so a stream would be dropped there — that runtime buffers instead.
const CAN_STREAM = (() => {
  if (typeof ReadableStream === 'undefined' || typeof TextDecoder === 'undefined') return false;
  try {
    const env = (typeof process !== 'undefined' && process && process.env) || {};
    return !(env.NETLIFY || env.LAMBDA_TASK_ROOT || env.AWS_LAMBDA_FUNCTION_NAME);
  } catch {
    return true;
  }
})();

function jsonOut(status, payload, reqHeaders) {
  return {
    statusCode: status,
    headers: { ...cors(reqHeaders), 'Content-Type': 'application/json' },
    body: typeof payload === 'string' ? payload : JSON.stringify(payload),
  };
}

function err(status, message, reqHeaders) {
  // Error envelopes never carry caching headers, so a shared cache cannot pin
  // a 403/502/504 (or a rate-limit page) for the next visitor.
  return jsonOut(status, { ok: false, error: message }, reqHeaders);
}

// Control responses (mode read/write) are never cacheable: a cached flag would
// keep telling the UI about a mode it just changed, and a cached 401/400 would
// outlive the password that fixes it. Same { ok, error } envelope as api-keys.js.
function modeOut(status, payload, reqHeaders) {
  return {
    statusCode: status,
    headers: { ...cors(reqHeaders), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(payload),
  };
}

function modeTag(mode) {
  return ' (proxy mode: ' + mode + ')';
}

// Anything that is not literally "universal" is "xpart" — a garbled, missing or
// half-written store value fails closed rather than silently opening the proxy.
function normalizeMode(raw) {
  const v = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw.mode : raw;
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return s === MODE_UNIVERSAL ? MODE_UNIVERSAL : MODE_XPART;
}

// A candidate allowlist entry: a bare, lowercase, publicly-routable hostname.
// Trim, lowercase, drop ONE trailing dot, then require only LDH labels under an
// alphabetic TLD. That rejects schemes ("http://x.com"), ports ("x.com:8080"),
// paths ("a/b"), userinfo ("u@x.com"), wildcards ("*.x.com"), spaces, IP
// literals and single-label names in one pass. Returns '' when unusable.
function cleanHost(raw) {
  if (typeof raw !== 'string') return '';
  let h = raw.trim().toLowerCase();
  if (h.endsWith('.')) h = h.slice(0, -1);
  if (!h || h.length > 253) return '';
  if (HOST_FORBIDDEN_RE.test(h)) return '';
  const labels = h.split('.');
  if (labels.length < 2) return '';
  for (const label of labels) {
    if (!label || label.length > 63 || !HOST_LABEL_RE.test(label)) return '';
  }
  // An alphabetic TLD also rules out bare IPv4 literals such as 1.2.3.4.
  if (!HOST_TLD_RE.test(labels[labels.length - 1])) return '';
  return h;
}

// The effective allowlist, always with DEFAULT_HOST first and never longer than
// MAX_HOSTS. Unusable, duplicate and out-of-order entries in the store are
// dropped here rather than being trusted, so a garbled or hostile store value
// can neither widen the proxy past the cap nor produce duplicates in the UI.
// Reads a bare array or a { hosts } envelope; anything else degrades to the
// floor alone.
function normalizeHosts(raw) {
  const list = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw.hosts : raw;
  const out = [DEFAULT_HOST];
  if (Array.isArray(list)) {
    for (const item of list) {
      const h = cleanHost(item);
      if (!h || h === DEFAULT_HOST || out.indexOf(h) !== -1) continue;
      out.push(h);
      if (out.length >= MAX_HOSTS) break;
    }
  }
  return out;
}

// Only the additions are ever persisted — the floor is implicit, so a store
// wipe or a failed write can never remove xpart.netlify.app.
function hostAdditions(hosts) {
  return hosts.filter((h) => h !== DEFAULT_HOST);
}

// The Durable Object namespace, when this runtime binds one (Cloudflare Worker).
// Absent on Netlify Functions and `node server.js`, which use the shared store.
function modeDo() {
  try {
    const ns = globalThis && globalThis.PROXY_MODE;
    if (ns && typeof ns.get === 'function' && typeof ns.idFromName === 'function') return ns;
  } catch { /* no DO binding */ }
  return null;
}

// One round trip to a single-threaded object in the same region. Intentionally
// NOT wrapped in a cache: this is the read that has to be strongly consistent,
// and a same-region DO call is far cheaper than the upstream request it guards.
async function callModeDo(ns, init) {
  const stub = ns.get(ns.idFromName(MODE_DO_NAME));
  const res = await stub.fetch(MODE_DO_URL, init);
  let payload = null;
  try { payload = await res.json(); } catch { payload = null; }
  return { ok: !!(res && res.ok), status: res && res.status, payload };
}

// Both settings for this request, read fresh every time — on the Worker in ONE
// Durable Object round trip (the object returns mode and hosts together), and on
// Netlify/local from the shared store. There is deliberately NO cache: a cached
// allowlist is exactly what would let a revoked host keep working, and a
// completed write is already visible to the very next read. A failed or
// unreadable source degrades to { xpart, [xpart.netlify.app] }: closed
// allowlist, default host still reachable.
async function currentSettings() {
  const ns = modeDo();
  if (ns) {
    try {
      const payload = (await callModeDo(ns)).payload;
      return { mode: normalizeMode(payload), hosts: normalizeHosts(payload) };
    } catch {
      return { mode: DEFAULT_MODE, hosts: normalizeHosts(null) };
    }
  }
  try {
    const mode = normalizeMode(await storeGet(MODE_KEY, null));
    let stored = null;
    try { stored = await storeGet(HOSTS_KEY, null); } catch { stored = null; }
    return { mode, hosts: normalizeHosts(stored) };
  } catch {
    return { mode: DEFAULT_MODE, hosts: normalizeHosts(null) };
  }
}

// Query lookup across the three shapes the runtimes hand us: Netlify's parsed
// map, the Worker's rawQuery, and `node server.js`, which only has a path.
function queryParam(event, name) {
  const q = event.queryStringParameters;
  if (q && typeof q === 'object' && q[name] != null && String(q[name]) !== '') return String(q[name]);
  const raw = event.rawQuery ? String(event.rawQuery) : '';
  if (raw) {
    const v = new URLSearchParams(raw).get(name);
    if (v) return v;
  }
  const withQuery = String(event.path || '');
  const at = withQuery.indexOf('?');
  if (at !== -1) {
    const v = new URLSearchParams(withQuery.slice(at + 1)).get(name);
    if (v) return v;
  }
  return '';
}

// A control write is opted into by the literal field pair at the top level. The
// regex pre-filter means an ordinary chat body ({model, messages, …}) is never
// even parsed, let alone diverted; a body that merely mentions "action" deeper
// down parses and then fails the top-level check, so it still proxies. Returns
// the declared action, or null.
function bodyControlAction(event) {
  const raw = event.body == null ? '' : String(event.body);
  if (!CONTROL_ACTION_RE.test(raw)) return null;
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const a = parsed.action;
  return a === 'mode' || a === 'hosts-add' || a === 'hosts-remove' ? a : null;
}

function controlIntent(event, method) {
  const q = queryParam(event, 'action');
  if (q === 'mode' && (method === 'GET' || method === 'HEAD')) return 'read-mode';
  if (q === 'hosts' && (method === 'GET' || method === 'HEAD')) return 'read-hosts';
  // Query-side intent on a mode write counts only when the body is empty; a JSON
  // body always has to declare its own action.
  if (q === 'mode' && method === 'POST' && !String(event.body == null ? '' : event.body).trim()) return 'write-mode';
  if (method === 'POST') {
    const a = bodyControlAction(event);
    if (a === 'mode') return 'write-mode';
    if (a === 'hosts-add') return 'write-hosts-add';
    if (a === 'hosts-remove') return 'write-hosts-remove';
  }
  return null;
}

// The write half of the control endpoint. Password first (same checkPassword and
// same { ok:false, error:"Wrong password" } envelope as api-keys.js), then the
// mode value, then the store. A 200 is only returned after the write has landed,
// so a caller that flips the mode and immediately re-reads sees the new value.
async function setMode(event, reqHeaders) {
  let body;
  try {
    body = JSON.parse(String(event.body == null ? '' : event.body) || '{}');
  } catch {
    return modeOut(400, { ok: false, error: 'Bad request' }, reqHeaders);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return modeOut(400, { ok: false, error: 'Bad request' }, reqHeaders);
  if (!checkPassword(body.password)) return modeOut(401, { ok: false, error: 'Wrong password' }, reqHeaders);
  // Strict on the way in: only the two known modes are storable, so a typo can
  // never leave a garbage value in the store to be interpreted later.
  const mode = typeof body.mode === 'string' ? body.mode.trim().toLowerCase() : '';
  if (mode !== MODE_XPART && mode !== MODE_UNIVERSAL) {
    return modeOut(400, { ok: false, error: 'Invalid mode — use "xpart" or "universal"' }, reqHeaders);
  }
  const ns = modeDo();
  try {
    if (ns) {
      const r = await callModeDo(ns, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      if (!r.ok) {
        const why = (r.payload && typeof r.payload.error === 'string' && r.payload.error) || ('durable object returned ' + r.status);
        return modeOut(502, { ok: false, error: 'Could not store proxy mode: ' + why.slice(0, 200) }, reqHeaders);
      }
    } else {
      await storeSet(MODE_KEY, mode);
    }
  } catch (e) {
    return modeOut(502, { ok: false, error: 'Could not store proxy mode: ' + String((e && e.message) || e).slice(0, 200) }, reqHeaders);
  }
  return modeOut(200, { ok: true, mode }, reqHeaders);
}

// The read-modify-write half of the hosts endpoint. Password first (same
// checkPassword and same { ok:false, error:"Wrong password" } envelope as the
// mode write), then the host, then the store. The Durable Object performs the
// read-modify-write itself inside a storage transaction, so two concurrent
// adds cannot lose one another and the response list is the authoritative one;
// the shared-store path (Netlify/local, single instance) does the same maths
// inline. A 200 is only returned after the write has landed, so a caller that
// adds a host and immediately proxies to it sees the new allowlist.
// `op` is 'add' or 'remove'. NO rate limiting here or anywhere in this file.
async function editHosts(event, reqHeaders, op) {
  let body;
  try {
    body = JSON.parse(String(event.body == null ? '' : event.body) || '{}');
  } catch {
    return modeOut(400, { ok: false, error: 'Bad request' }, reqHeaders);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return modeOut(400, { ok: false, error: 'Bad request' }, reqHeaders);
  if (!checkPassword(body.password)) return modeOut(401, { ok: false, error: 'Wrong password' }, reqHeaders);
  const host = cleanHost(body.host);
  if (!host) {
    return modeOut(400, { ok: false, error: 'Invalid host — pass a bare hostname like example.com (no scheme, port, path, spaces or wildcard)' }, reqHeaders);
  }
  const ns = modeDo();
  try {
    if (ns) {
      const r = await callModeDo(ns, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: op === 'add' ? 'hosts-add' : 'hosts-remove', host }),
      });
      if (!r.ok) {
        // The object owns the cap and the floor, so a 400 from it is a real
        // rejection (list full) and is passed straight through.
        const why = (r.payload && typeof r.payload.error === 'string' && r.payload.error) || ('durable object returned ' + r.status);
        return modeOut(r.status === 400 ? 400 : 502, { ok: false, error: why.slice(0, 200) }, reqHeaders);
      }
      return modeOut(200, { ok: true, hosts: normalizeHosts(r.payload) }, reqHeaders);
    }
    let stored = null;
    try { stored = await storeGet(HOSTS_KEY, null); } catch { stored = null; }
    const current = normalizeHosts(stored);
    let next;
    if (op === 'remove') {
      // The floor can never be removed: 200 with the unchanged list so the UI
      // can simply re-render instead of special-casing the default entry.
      next = host === DEFAULT_HOST ? current : current.filter((h) => h !== host);
    } else if (current.indexOf(host) !== -1) {
      next = current; // already present: no duplicate, no error
    } else if (current.length >= MAX_HOSTS) {
      return modeOut(400, { ok: false, error: 'Host list is full (limit ' + MAX_HOSTS + ')' }, reqHeaders);
    } else {
      next = current.concat(host);
    }
    if (next.length !== current.length) await storeSet(HOSTS_KEY, hostAdditions(next));
    return modeOut(200, { ok: true, hosts: next }, reqHeaders);
  } catch (e) {
    return modeOut(502, { ok: false, error: 'Could not update the host allowlist: ' + String((e && e.message) || e).slice(0, 200) }, reqHeaders);
  }
}

// The allowlist, and the only place a destination is decided. checkTarget is
// the single choke point: it gates the client's url and every redirect hop.
// `mode` only ever decides whether the host allowlist is consulted — the
// protocol, default-port and private-range guards run in both modes.
function hostAllowed(hostname, hosts) {
  const h = String(hostname || '').toLowerCase();
  for (const base of hosts) {
    // Label-anchored on both sides: equality or a "."-prefixed tail, never a
    // bare suffix, so xpart.netlify.app.evil.com and evilxpart.netlify.app
    // fail for the xpart entry and the same holds for every stored host.
    if (h === base || h.endsWith('.' + base)) return true;
  }
  return false;
}

// Enough of the list to debug a 403 without turning it into a 4 KB error body.
function hostsSummary(hosts) {
  const shown = hosts.slice(0, 5);
  const more = hosts.length - shown.length;
  return shown.join(', ') + (more > 0 ? ' +' + more + ' more' : '');
}

// Second layer under the allowlist: destinations that are not publicly routable.
// Belt and braces against an SSRF pivot into the runtime's own network —
// loopback, RFC1918, link-local (where cloud metadata lives), carrier NAT,
// unique-local IPv6, and the .local/.internal/.localhost suffixes.
function isPrivateHost(hostname) {
  const h = String(hostname || '').toLowerCase().replace(/\.$/, '');
  if (!h) return true;
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.home.arpa')) return true;
  // Any target given as a bare IP literal.
  if (IPV4_RE.test(h)) {
    const p = h.split('.').map(Number);
    if (p.some((n) => n > 255)) return true;
    if (p[0] === 0 || p[0] === 10 || p[0] === 127) return true;
    if (p[0] === 169 && p[1] === 254) return true;                 // link-local + metadata
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;      // 172.16/12
    if (p[0] === 192 && p[1] === 168) return true;                  // 192.168/16
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true;    // 100.64/10 CGNAT
    if (p[0] >= 224) return true;                                   // multicast + reserved
    return false;
  }
  // IPv6 literals: ::1 loopback, fe80::/10 link-local, fc00::/7 unique-local,
  // ::ffff:a.b.c.d mapped IPv4 (unwrap and re-check), and the unspecified
  // address. URL.hostname keeps the [ ] around an IPv6 literal, so they are
  // stripped before the patterns are applied — otherwise `https://[::1]/` would
  // read as an ordinary host and slip past the whole branch.
  if (h.includes(':')) {
    const v6 = h.startsWith('[') && h.endsWith(']') ? h.slice(1, -1) : h;
    if (v6 === '::' || v6 === '::1') return true;
    const v4 = v6.match(V4_TAIL_RE);
    if (v6.startsWith('::ffff:') && v4) return isPrivateHost(v4[1]);
    if (V6_LINKLOCAL_RE.test(v6)) return true;
    if (V6_UNIQUE_LOCAL_RE.test(v6)) return true;
    return false;
  }
  return false;
}

function checkTarget(raw, reqHeaders, mode, hosts) {
  const tag = modeTag(mode);
  let u;
  try {
    u = new URL(String(raw));
  } catch {
    return { error: err(400, 'Invalid url — pass an absolute url, e.g. https://xpart.netlify.app/path', reqHeaders) };
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    return { error: err(403, 'Only http: and https: targets are allowed' + tag, reqHeaders) };
  }
  // Whole-label allowlist (stored list, floor always included), checked before
  // any socket work. Comparison is on u.hostname, so userinfo
  // (xpart.netlify.app@evil.com) cannot smuggle a host in, and the default port
  // is already normalised to '' by the parser. Skipped only in universal mode,
  // where the admin has explicitly widened the proxy.
  if (mode !== MODE_UNIVERSAL && !hostAllowed(u.hostname, hosts)) {
    return { error: err(403, 'Only proxied hosts are allowed: ' + hostsSummary(hosts) + tag, reqHeaders) };
  }
  if (u.port) {
    return { error: err(403, 'Only default ports are proxied (no explicit port on ' + u.hostname + ')' + tag, reqHeaders) };
  }
  // Never mode-dependent: a universal proxy still must not reach the runtime's
  // own network (loopback, RFC1918, link-local cloud metadata, CGNAT, ::1,
  // fe80::/fc00::, .local/.internal/.localhost).
  if (isPrivateHost(u.hostname)) {
    return { error: err(403, 'Private and loopback destinations are not proxied' + tag, reqHeaders) };
  }
  u.hash = '';
  return { target: u };
}

function targetFrom(event) {
  const q = event.queryStringParameters;
  if (q && typeof q === 'object') {
    const v = q.url || q.target || q.href;
    if (v) return String(v);
  }
  const withQuery = String(event.path || '') + (event.rawQuery ? '?' + event.rawQuery : '');
  const at = withQuery.indexOf('?');
  if (at !== -1) {
    const p = new URLSearchParams(withQuery.slice(at + 1));
    const v = p.get('url') || p.get('target') || p.get('href');
    if (v) return v;
  }
  const h = event.headers || {};
  return h['x-proxy-url'] || h['x-target-url'] || '';
}

function forwardHeaders(incoming) {
  const out = {};
  for (const k of Object.keys(incoming || {})) {
    const key = String(k).toLowerCase();
    if (stripHeader(key)) continue;
    const v = incoming[k];
    if (v == null) continue;
    out[key] = Array.isArray(v) ? v.join(', ') : String(v);
  }
  return out;
}

function byteLength(s) {
  if (typeof s !== 'string' || !s) return 0;
  if (typeof Buffer !== 'undefined') return Buffer.byteLength(s, 'utf8');
  return new TextEncoder().encode(s).length;
}

// Some runtimes throw on a malformed stored header; never let that 502 a
// perfectly good response.
function hdr(res, name) {
  try {
    return res.headers && typeof res.headers.get === 'function' ? (res.headers.get(name) || '') : '';
  } catch {
    return '';
  }
}

// Upstream Cache-Control wins; otherwise only a successful GET/HEAD gets a
// short shared-cache default, event streams are pinned to no-cache, and errors
// get nothing at all.
function cacheHeaderFor(method, status, contentType, upstream) {
  if (upstream) return upstream;
  if (EVENT_STREAM_RE.test(contentType || '')) return NO_CACHE;
  if ((method === 'GET' || method === 'HEAD') && status >= 200 && status < 300) return SHARED_CACHE;
  return null;
}

// Response headers for a successful proxy. Content-Type and Cache-Control are
// the only upstream headers copied across: content-encoding is deliberately NOT
// forwarded (the runtime hands us a decoded body, so labelling it would make
// clients try to decompress already-plain bytes) and content-length is dropped
// with it, since the byte count of a chunked relay is not known up front. CORS
// comes from cors(), which also sets Access-Control-Expose-Headers so browser
// JS can read the upstream headers back.
function responseHeaders(reqHeaders, contentType, cache) {
  const h = { ...cors(reqHeaders) };
  if (contentType) h['Content-Type'] = contentType;
  if (cache) h['Cache-Control'] = cache;
  return h;
}

// fetch + hand back the live body inside one abort window, so a target that
// accepts the socket and then stalls cannot pin the worker for longer than
// TIMEOUT_MS. `state` is owned by the caller so a timeout is still recognisable
// when the abort surfaces as a throw instead of a response. The returned
// `settle()` releases the timer and is handed to the body stream, so the abort
// window spans the whole stream and not just the response head.
async function hop(url, method, headers, body, state) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => { state.timedOut = true; ctrl.abort(); }, TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url.toString(), {
      method,
      headers,
      body: body === undefined ? undefined : body,
      redirect: 'manual',
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
  return { res, settle: () => clearTimeout(timer) };
}

// Zero-copy relay: the client's first byte is the upstream's first byte.
// `done` fires on close, error or cancel — that is what clears the hop timer.
// If the timer wins instead, ctrl.abort() errors the reader below and the
// client sees a terminated stream rather than a request that hangs.
function relayStream(source, done) {
  const reader = source.getReader();
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    try { done(); } catch { /* timer already gone */ }
  };
  return new ReadableStream({
    async pull(controller) {
      let chunk;
      try {
        chunk = await reader.read();
      } catch (e) {
        finish();
        try { controller.error(e); } catch { /* consumer already gone */ }
        return;
      }
      if (chunk.done) {
        finish();
        try { controller.close(); } catch { /* consumer already gone */ }
        return;
      }
      try {
        controller.enqueue(chunk.value);
      } catch (e) {
        finish();
        try { reader.cancel(e); } catch { /* source already gone */ }
      }
    },
    cancel(reason) {
      finish();
      try { return Promise.resolve(reader.cancel(reason)).catch(() => {}); } catch { return undefined; }
    },
  });
}

// Netlify Functions v1 fallback only: no streaming, so read the body out once.
async function collect(stream) {
  const chunks = [];
  const reader = stream.getReader();
  for (;;) {
    const r = await reader.read();
    if (r.done) break;
    if (r.value && r.value.byteLength) chunks.push(r.value);
  }
  let len = 0;
  for (const c of chunks) len += c.byteLength;
  const buf = new Uint8Array(len);
  let at = 0;
  for (const c of chunks) { buf.set(c, at); at += c.byteLength; }
  return buf;
}

// Release a redirect body we are not going to read.
function discard(res) {
  try {
    const b = res.body;
    if (b && typeof b.cancel === 'function') Promise.resolve(b.cancel()).catch(() => {});
  } catch { /* nothing to release */ }
}

exports.handler = async (event) => {
  const reqHeaders = event.headers || {};
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(reqHeaders) };

  const incoming = String(event.httpMethod || 'GET').toUpperCase();
  if (!METHODS.includes(incoming)) return err(405, 'Method not allowed: ' + incoming, reqHeaders);
  let method = incoming; // may be downgraded to GET by a 301/302/303 hop

  const declared = Number(reqHeaders['content-length'] || 0);
  if (declared && declared > MAX_BODY) return err(413, 'Request body too large (limit 4 MB)', reqHeaders);
  if (event.isBase64Encoded) return err(400, 'Binary (base64) request bodies are not supported — send text/JSON', reqHeaders);

  // Control plane, before any proxy work and before a target is even required:
  // the mode endpoint is a different verb, and must answer without a url.
  const intent = controlIntent(event, incoming);
  if (intent === 'read-mode') return modeOut(200, { ok: true, mode: (await currentSettings()).mode }, reqHeaders);
  if (intent === 'read-hosts') return modeOut(200, { ok: true, hosts: (await currentSettings()).hosts }, reqHeaders);
  if (intent === 'write-mode') return setMode(event, reqHeaders);
  if (intent === 'write-hosts-add') return editHosts(event, reqHeaders, 'add');
  if (intent === 'write-hosts-remove') return editHosts(event, reqHeaders, 'remove');

  const raw = targetFrom(event);
  if (!raw) return err(400, 'Missing target — use /api/proxy?url=https://xpart.netlify.app/... or the x-proxy-url header', reqHeaders);

  // Read fresh on every proxied request: one DO round trip on the Worker, one
  // store read elsewhere. No cache, so the next request after a mode flip or a
  // hosts add/remove already sees the new allowlist.
  const settings = await currentSettings();
  const mode = settings.mode;
  const checked = checkTarget(raw, reqHeaders, mode, settings.hosts);
  if (checked.error) return checked.error;

  let body = WITH_BODY.has(incoming) ? (event.body == null ? '' : String(event.body)) : undefined;
  if (byteLength(body) > MAX_BODY) return err(413, 'Request body too large (limit 4 MB)', reqHeaders);

  // Built once and reused across every hop: a same-host redirect can never
  // introduce a header we would have to re-filter, and a 301/302/303 to GET
  // only deletes two keys from this same object.
  const headers = forwardHeaders(reqHeaders);
  let url = checked.target; // the validated URL object, reused hop to hop
  const state = { timedOut: false };

  try {
    for (let hopCount = 0; hopCount <= MAX_HOPS; hopCount++) {
      const h = await hop(url, method, headers, body, state);
      const res = h.res;
      const status = res.status;
      const contentType = hdr(res, 'content-type');
      const isRedirect = status >= 300 && status < 400 && status !== 304;

      if (isRedirect) {
        // Re-validate the Location through the same allowlist + SSRF guards
        // before following it.
        const location = hdr(res, 'location');
        let next = { error: true };
        if (location) {
          try {
            next = checkTarget(new URL(location, url), reqHeaders, mode, settings.hosts);
          } catch { next = { error: true }; }
        }
        h.settle();
        discard(res);
        // Rejected hop (off-allowlist/unparseable Location) or hop budget spent:
        // hand back the 3xx status with CORS headers but no Location, so no
        // client is walked onto a blocked destination and no Authorization
        // header we forwarded rides along with it.
        if (next.error || hopCount === MAX_HOPS) {
          return jsonOut(status, {
            ok: false,
            error: next.error
              ? 'Upstream redirect target rejected by the proxy allowlist' + modeTag(mode)
              : 'Too many redirects',
          }, reqHeaders);
        }
        if (status === 303 || ((status === 301 || status === 302) && method === 'POST')) {
          method = 'GET';
          body = undefined;
          delete headers['content-type'];
          delete headers['content-length'];
        }
        url = next.target;
        continue;
      }

      // Final hop: relay it. Nothing upstream is inspected or rewritten, so the
      // happy path does zero buffering.
      const out = responseHeaders(reqHeaders, contentType, cacheHeaderFor(method, status, contentType, hdr(res, 'cache-control')));
      const source = res.body;
      if (!source || typeof source.getReader !== 'function') {
        // 204/HEAD and friends: no body to relay.
        h.settle();
        return { statusCode: status, headers: out, body: '' };
      }
      if (CAN_STREAM) {
        return { statusCode: status, headers: out, stream: relayStream(source, h.settle) };
      }
      let text = '';
      try {
        const buf = await collect(source);
        if (buf.byteLength) {
          try {
            text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
          } catch {
            // not text — refuse rather than hand back mangled bytes
            return err(502, 'Upstream body is not UTF-8 text and cannot be proxied', reqHeaders);
          }
        }
      } finally {
        h.settle();
      }
      return { statusCode: status, headers: out, body: text };
    }
  } catch (e) {
    if (state.timedOut) return err(504, 'Upstream timed out after ' + (TIMEOUT_MS / 1000) + 's', reqHeaders);
    return err(502, 'Upstream request failed: ' + String((e && e.message) || e).slice(0, 200), reqHeaders);
  }
  return err(502, 'Too many redirects', reqHeaders);
};
