// Our own request counter for the `ai` worker, replacing Cloudflare's
// GraphQL analytics (which needed a `CF_API_TOKEN` secret that expired and
// could not tell us anything per-route for a workers.dev script).
//
// WHY A DURABLE OBJECT: one global instance serialises every read-modify-write,
// so counters are exact instead of eventually consistent, and the whole thing
// is our own code with no third-party token to expire, scope or rotate. The
// counter is incremented OFF the critical path (ctx.waitUntil in worker/index.js),
// so this object's latency is never added to a request's.
//
// Storage keys: 'd:<YYYY-MM-DD>' (UTC day) ->
//   { services: { "<bucket>": <count> }, total: <count> }
// Day buckets are tiny and are pruned once they fall out of the 30-day window.
//
// BUCKET NAMES: short opaque strings produced by serviceBucket() below. Strictly
// validated on write so a hand-crafted request can never grow the key space.

const BUCKET_RE = /^[a-z0-9._-]{1,32}$/i;
const DAY_MS = 86400000;
const WINDOW_DAYS = 7;    // days of history returned to the dashboard
const RETENTION_DAYS = 30; // day buckets older than this are pruned
const PRUNE_SWEEP = 6;     // how many days one prune sweeps, counting back from the cutoff

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// UTC day key. `d.toISOString()` is always Z-suffixed, so a local-time bug is
// not even representable.
function dayKey(d) {
  return 'd:' + d.toISOString().slice(0, 10);
}

// last 7 UTC days, oldest first, ending with today.
function windowDays(now) {
  const out = [];
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) out.push(new Date(now - i * DAY_MS));
  return out;
}

// `storage.get([keys])` returns a Map in workerd; tolerate a plain object too.
function pick(rows, key) {
  if (!rows) return undefined;
  if (typeof rows.get === 'function') return rows.get(key);
  return Object.prototype.hasOwnProperty.call(rows, key) ? rows[key] : undefined;
}

function int(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

// The bundled netlify functions. Anything else under /api/ is not a real
// endpoint, so it folds into `api.other` instead of minting a bucket per junk
// path — the whole point of the mapping is a SMALL, STABLE set of names.
const API_FNS = new Set([
  'api-keys', 'auth', 'chat', 'custom-providers', 'model-visibility', 'models', 'usage', 'visits', 'proxy',
]);

/* ── Route -> service bucket ── */
// Pure and deliberately total: every request that reaches the worker lands in
// exactly one small, stable bucket, so the dashboard has a fixed vocabulary
// instead of an unbounded key space. `method` is intentionally NOT an input —
// an OPTIONS preflight is counted against its own route, same as the real call.
export function serviceBucket(pathname) {
  let p = String(pathname == null ? '' : pathname);
  // Only ever handed a pathname, but a stray query/fragment must not become
  // part of a bucket name.
  const cut = p.search(/[?#]/);
  if (cut !== -1) p = p.slice(0, cut);
  try { p = decodeURIComponent(p); } catch { /* keep the raw path */ }
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  const lower = p.toLowerCase();

  // OpenAI-compatible surface.
  if (lower === '/v1' || lower.startsWith('/v1/')) {
    if (lower === '/v1/models') return 'v1.models';
    if (lower === '/v1/chat/completions') return 'v1.chat';
    return 'v1.other';
  }

  // Named first-party endpoints win over the generic /api/<fn> shape.
  if (lower === '/api/proxy' || lower === '/.netlify/functions/proxy') return 'proxy';
  if (lower === '/api/usage' || lower === '/.netlify/functions/usage') return 'usage';

  // Everything else served by a bundled netlify function.
  let fn = null;
  if (lower.startsWith('/api/')) fn = lower.slice(5);
  else if (lower.startsWith('/.netlify/functions/')) fn = lower.slice('/.netlify/functions/'.length);
  if (fn) return API_FNS.has(fn) ? 'api.' + fn : 'api.other';

  return 'assets'; // static assets, index.html, app.js, anything unknown
}

export class UsageCounts {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const method = String((request && request.method) || 'GET').toUpperCase();
    if (method === 'POST' || method === 'PUT') return this.increment(request);
    if (method !== 'GET' && method !== 'HEAD') {
      return json(405, { ok: false, error: 'Method not allowed' });
    }
    return this.read(Date.now());
  }

  // Today only, plus the last 6 days. Missing days are simply absent from
  // `days`; an empty store is not an error, it is all zeros.
  async read(now) {
    const days = windowDays(now);
    const keys = days.map(dayKey);
    const rows = await this.state.storage.get(keys);

    const today = days[days.length - 1];
    const cur = pick(rows, dayKey(today)) || {};
    const history = [];
    for (let i = 0; i < days.length; i++) {
      const rec = pick(rows, keys[i]);
      if (!rec) continue; // tolerate a day that never happened
      history.push({ day: keys[i].slice(2), total: int(rec.total) });
    }

    const services = {};
    const src = (cur && cur.services && typeof cur.services === 'object') ? cur.services : {};
    for (const name of Object.keys(src)) {
      if (!BUCKET_RE.test(name)) continue;
      const n = int(src[name]);
      if (n > 0) services[name] = n;
    }

    return json(200, {
      ok: true,
      day: dayKey(today).slice(2),
      total: int(cur.total),
      services,
      days: history,
    });
  }

  async increment(request) {
    let body;
    try {
      body = JSON.parse((await request.text()) || '{}');
    } catch {
      return json(400, { ok: false, error: 'Bad request' });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json(400, { ok: false, error: 'Bad request' });
    }
    const service = typeof body.service === 'string' ? body.service.trim() : '';
    if (!BUCKET_RE.test(service)) {
      return json(400, { ok: false, error: 'Invalid service' });
    }

    const now = Date.now();
    const key = dayKey(new Date(now));
    // One global object, so day reads/writes are serialised by the runtime and
    // the common case is exact. Deliberately NOT wrapped in
    // blockConcurrencyWhile: the write path stays one get + one put, and if two
    // increments ever land in the same tick the gauge drifts by a request or
    // two, which is a better trade than a blocking primitive on a hot object.
    const cur = (await this.state.storage.get(key)) || {};
    const services = (cur.services && typeof cur.services === 'object') ? cur.services : {};
    services[service] = int(services[service]) + 1;

    const isNewDay = !cur.total;
    const next = { services, total: int(cur.total) + 1 };
    await this.state.storage.put(key, next);

    // Retention is bounded work: only the first write of a new day sweeps, and
    // it deletes the six day keys that have just fallen out of the window. Any
    // key eventually passes through it, so nothing is kept forever and no
    // list() is ever needed.
    if (isNewDay) {
      try {
        const cutoff = new Date(now - RETENTION_DAYS * DAY_MS);
        const stale = [];
        for (let i = 0; i < PRUNE_SWEEP; i++) stale.push(dayKey(new Date(cutoff.getTime() - i * DAY_MS)));
        await this.state.storage.delete(stale);
      } catch { /* pruning is best-effort, never fatal */ }
    }

    return this.read(now);
  }
}

export default UsageCounts;