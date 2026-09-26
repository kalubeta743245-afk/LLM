// Strongly-consistent home for the proxy destination mode ("xpart" |
// "universal"), read on the hot path of every proxied request.
//
// WHY A DURABLE OBJECT: the flag used to live in Cloudflare KV behind a 10 s
// per-isolate module cache. KV is EVENTUALLY CONSISTENT (up to ~60 s to
// propagate globally) and every Worker isolate holds its own copy, so a mode
// flip could not be turned off reliably — measured in production: some isolates
// kept serving the old "universal" for tens of seconds after the switch, in
// both directions. A Durable Object is one global instance that serialises all
// reads and writes, so a completed write is visible to the very next read from
// any isolate, anywhere, with no cache to expire.
//
// Storage key: 'mode' in the object's SQLite-backed storage. Absent/garbled ->
// "xpart". This endpoint is the ONLY writer's counterpart to the Worker entry
// point's read path, so it is deliberately tiny and unauthenticated here; the
// public password check lives in the caller (netlify/functions/proxy.js setMode)
// and nothing is exposed on a public route of its own.
const MODE_KEY = 'mode';
const MODE_XPART = 'xpart';
const MODE_UNIVERSAL = 'universal';
const DEFAULT_MODE = MODE_XPART; // fail closed: never default to universal

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

export class ProxyMode {
  constructor(state, env) {
    this.state = state;
    this.env = env;
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

    const stored = await this.state.storage.get(MODE_KEY);
    return json(200, { ok: true, mode: normalizeMode(stored === undefined || stored === null ? DEFAULT_MODE : stored) });
  }
}

export default ProxyMode;
