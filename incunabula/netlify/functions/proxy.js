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
// DESTINATION ALLOWLIST — closed, not open. Only `xpart.netlify.app` and its
// subdomains (any depth, any path) are ever forwarded to. The match is on whole
// DNS labels off `URL.hostname` (userinfo already stripped by the parser), so
// `xpart.netlify.app.evil.com`, `evilxpart.netlify.app`,
// `xpart.netlify.app%2eevil.com`, `xpart.netlify.app@evil.com` and the
// trailing-dot FQDN `xpart.netlify.app.` are all rejected with 403 before a
// socket is opened. `http:`/`https:` only, and default ports only (80/443 — the
// parser already normalises those away, so any surviving `u.port` is refused).
//
// Two SSRF guards stay layered on top of the allowlist, invisible to normal
// use and free: no private/loopback/link-local destinations (.local/.internal/
// .localhost, RFC1918, CGNAT, 169.254.169.254 cloud metadata). Every redirect
// hop is re-validated through the same checkTarget.
const { cors } = require('./_shared');

const MAX_BODY = 4 * 1024 * 1024; // 4 MB of request body forwarded, hard stop
const TIMEOUT_MS = 60000;          // per hop: fetch + the streamed body
const MAX_HOPS = 3;                // redirect hops followed
const METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
const WITH_BODY = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const ALLOWED_HOST = 'xpart.netlify.app';
const ALLOWED_SUFFIX = '.' + ALLOWED_HOST; // label-anchored, never a bare prefix
const SHARED_CACHE = 'public, max-age=60';  // default for cacheable GET/HEAD
const NO_CACHE = 'no-cache, no-transform';  // event streams must never be cached

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

// The allowlist, and the only place a destination is decided. checkTarget is
// the single choke point: it gates the client's url and every redirect hop.
function isAllowedHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  return h === ALLOWED_HOST || h.endsWith(ALLOWED_SUFFIX);
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
  // ::ffff:a.b.c.d mapped IPv4 (unwrap and re-check), and the unspecified address.
  if (h.includes(':')) {
    if (h === '::' || h === '::1') return true;
    const v4 = h.match(V4_TAIL_RE);
    if (h.startsWith('::ffff:') && v4) return isPrivateHost(v4[1]);
    if (V6_LINKLOCAL_RE.test(h)) return true;
    if (V6_UNIQUE_LOCAL_RE.test(h)) return true;
    return false;
  }
  return false;
}

function checkTarget(raw, reqHeaders) {
  let u;
  try {
    u = new URL(String(raw));
  } catch {
    return { error: err(400, 'Invalid url — pass an absolute url, e.g. https://xpart.netlify.app/path', reqHeaders) };
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    return { error: err(403, 'Only http: and https: targets are allowed', reqHeaders) };
  }
  // Whole-label allowlist, checked before any socket work. Comparison is on
  // u.hostname, so userinfo (xpart.netlify.app@evil.com) cannot smuggle a host
  // in, and the default port is already normalised to '' by the parser.
  if (!isAllowedHost(u.hostname)) {
    return { error: err(403, 'Only ' + ALLOWED_HOST + ' and its subdomains are proxied', reqHeaders) };
  }
  if (u.port) {
    return { error: err(403, 'Only default ports are proxied (no explicit port on ' + u.hostname + ')', reqHeaders) };
  }
  if (isPrivateHost(u.hostname)) {
    return { error: err(403, 'Private and loopback destinations are not proxied', reqHeaders) };
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

  const raw = targetFrom(event);
  if (!raw) return err(400, 'Missing target — use /api/proxy?url=https://xpart.netlify.app/... or the x-proxy-url header', reqHeaders);

  const checked = checkTarget(raw, reqHeaders);
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
            next = checkTarget(new URL(location, url), reqHeaders);
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
              ? 'Upstream redirect target rejected by the proxy allowlist'
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
