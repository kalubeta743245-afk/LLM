// Strongly-consistent home for the proxy destination mode ("xpart" |
// "universal") and the proxy destination allowlist, both read on the hot path
// of every proxied request.
//
// WHY A DURABLE OBJECT: the flag used to live in Cloudflare KV behind a 10 s
// per-isolate module cache. KV is EVENTUALLY CONSISTENT (up to ~60 s to
// propagate globally) and every Worker isolate holds its own copy, so a mode
// flip could not be turned off reliably — measured in production: some isolates
// kept serving the old "universal" for tens of seconds after the switch, in
// both directions. The same argument applies to a revoked host: a cached
// allowlist would keep proxying to it after it was removed. A Durable Object is
// one global instance that serialises all reads and writes, so a completed
// write is visible to the very next read from any isolate, anywhere, with no
// cache to expire.
//
// Storage keys, both in the object's SQLite-backed storage:
//   'mode'  — 'xpart' | 'universal'. Absent/garbled -> 'xpart'.
//   'hosts' — the runtime-added allowlist entries as a JSON array of bare
//             lowercase hostnames, in insertion order. Only the ADDITIONS are
//             stored: xpart.netlify.app is an unconditional floor (see
//             DEFAULT_HOST), so a store wipe, a failed write or a hostile value
//             can never take the default host away from the user. The same key
//             name is used by the shared-store fallback in
//             netlify/functions/proxy.js (Netlify Blobs / local .data file) so
//             the two runtimes cannot drift apart.
// A GET returns BOTH settings in one response, so the proxy's hot path costs a
// single round trip per request and one is not enough for a stale second value.
//
// This endpoint is deliberately tiny and unauthenticated here — it is not
// reachable on a public route of its own; the public password check lives in
// the caller (netlify/functions/proxy.js setMode / editHosts). Host validation
// is duplicated there (cleanHost below mirrors cleanHost in proxy.js) so this
// file keeps zero imports and no dependency on the Netlify bundle.
const MODE_KEY = 'mode';
const HOSTS_KEY = 'hosts';
const MODE_XPART = 'xpart';
const MODE_UNIVERSAL = 'universal';
const DEFAULT_MODE = MODE_XPART; // fail closed: never default to universal
const DEFAULT_HOST = 'xpart.netlify.app'; // unconditional allowlist floor
const MAX_HOSTS = 50;            // total entries incl. the floor

const HOST_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const HOST_TLD_RE = /^[a-z]{2,}$/;
const HOST_FORBIDDEN_RE = /[/\\:@?#*\s]/;

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// Anything that is not literally "universal" is "xpart" — a missing, garbled or
// half-written value fails closed rather than silently opening the proxy.
function normalizeMode(raw) {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return s === MODE_UNIVERSAL ? MODE_UNIVERSAL : MODE_XPART;
}

// Mirrors cleanHost() in netlify/functions/proxy.js: bare, lowercase, publicly
// routable hostname only. Returns '' for schemes, ports, paths, userinfo,
// wildcards, spaces, IP literals and single-label names.
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
  if (!HOST_TLD_RE.test(labels[labels.length - 1])) return '';
  return h;
}

// The effective list handed to the proxy: floor first, then the stored
// additions in insertion order, de-duplicated, capped, with anything unusable in
// the store dropped rather than trusted.
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

function additionsOf(hosts) {
  return hosts.filter((h) => h !== DEFAULT_HOST);
}

export class ProxyMode {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  // Read-modify-write inside a storage transaction: the object is
  // single-threaded, but it can still yield at an await, so two concurrent
  // hosts-add requests would otherwise both read the same list and one write
  // would be lost. The transaction makes the pair atomic.
  async editHosts(op, rawHost) {
    const host = cleanHost(rawHost);
    if (!host) return json(400, { ok: false, error: 'Invalid host — pass a bare hostname like example.com' });
    return this.state.storage.transaction(async (txn) => {
      const hosts = normalizeHosts(await txn.get(HOSTS_KEY));
      if (op === 'hosts-remove') {
        // The floor is permanent: removing it answers 200 with the unchanged
        // list so the UI can just re-render.
        if (host === DEFAULT_HOST) return json(200, { ok: true, hosts });
        const next = hosts.filter((h) => h !== host);
        if (next.length !== hosts.length) await txn.put(HOSTS_KEY, additionsOf(next));
        return json(200, { ok: true, hosts: next });
      }
      if (hosts.indexOf(host) !== -1) return json(200, { ok: true, hosts }); // no duplicate
      if (hosts.length >= MAX_HOSTS) return json(400, { ok: false, error: 'Host list is full (limit ' + MAX_HOSTS + ')' });
      const next = hosts.concat(host);
      await txn.put(HOSTS_KEY, additionsOf(next));
      return json(200, { ok: true, hosts: next });
    });
  }

  async fetch(request) {
    const method = String((request && request.method) || 'GET').toUpperCase();

    if (method === 'POST' || method === 'PUT') {
      let body;
      try {
        body = JSON.parse((await request.text()) || '{}');
      } catch {
        return json(400, { ok: false, error: 'Bad request' });
      }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return json(400, { ok: false, error: 'Bad request' });

      if (body.op === 'hosts-add' || body.op === 'hosts-remove') {
        return this.editHosts(body.op, body.host);
      }

      // Strict on the way in: only the two known modes are storable, so a typo
      // can never leave a garbage value for the read path to interpret later.
      const mode = typeof body.mode === 'string' ? body.mode.trim().toLowerCase() : '';
      if (mode !== MODE_XPART && mode !== MODE_UNIVERSAL) {
        return json(400, { ok: false, error: 'Invalid mode - use "xpart" or "universal"' });
      }
      // The write is acknowledged only after the storage round trip, so a 200
      // from here means every subsequent read anywhere observes this value.
      await this.state.storage.put(MODE_KEY, mode);
      return json(200, { ok: true, mode });
    }

    if (method !== 'GET' && method !== 'HEAD') return json(405, { ok: false, error: 'Method not allowed' });

    // One storage round trip for both settings — mode for the control read and
    // the allowlist for every proxied request and redirect hop.
    const stored = await this.state.storage.get([MODE_KEY, HOSTS_KEY]);
    // storage.get([...]) returns a Map. Read it defensively so a plain-object
    // return (older SDK / stub) still works — indexing a Map with bag[key]
    // silently yields undefined and both settings fall back to defaults.
    const pick = (k) => (stored && typeof stored.get === 'function' ? stored.get(k) : (stored ? stored[k] : undefined));
    const mode = pick(MODE_KEY);
    return json(200, {
      ok: true,
      mode: normalizeMode(mode === undefined || mode === null ? DEFAULT_MODE : mode),
      hosts: normalizeHosts(pick(HOSTS_KEY)),
    });
  }
}

export default ProxyMode;
