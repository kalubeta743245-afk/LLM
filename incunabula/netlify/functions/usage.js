const { cors } = require('./_shared');
const { checkPassword } = require('./auth');

// Cloudflare GraphQL analytics for the `ai` worker (ai.labai.workers.dev).
const GRAPHQL_URL = 'https://api.cloudflare.com/client/v4/graphql';
const ACCOUNT = '82c9984e7a80323c6c781dc9f99eff0d';
const SCRIPT = 'ai';
// Hard ceiling on what a caller may ask for — 24h / 7d / 30d. Anything else
// (NaN, negative, absurd, wrong type) falls back to 24h so nobody can
// trigger an unbounded scan of the account.
const ALLOWED_HOURS = [24, 168, 720];
const DEFAULT_HOURS = 24;
const TIMEOUT_MS = 20000;

// No `orderBy` and no top-level `datetime_geq` — both are rejected by the API;
// the since-filter lives inside `filter` next to `scriptName`.
function buildQuery(sinceIso) {
  return `{ viewer { accounts(filter:{accountTag:"${ACCOUNT}"}) { workersInvocationsAdaptive(limit:200, filter:{scriptName:"${SCRIPT}", datetime_geq:"${sinceIso}"}) { sum { requests errors subrequests } quantiles { cpuTimeP50 cpuTimeP99 durationP50 durationP99 } dimensions { datetimeHour status } } } } }`;
}

function apiToken() {
  try { if (typeof process !== 'undefined' && process.env && process.env.CF_API_TOKEN) return String(process.env.CF_API_TOKEN); } catch { /* no process */ }
  try { if (typeof globalThis !== 'undefined' && globalThis.CF_API_TOKEN) return String(globalThis.CF_API_TOKEN); } catch { /* no globalThis */ }
  return '';
}

function clampHours(v) {
  if (typeof v === 'number' && Number.isFinite(v) && ALLOWED_HOURS.indexOf(v) !== -1) return v;
  return DEFAULT_HOURS;
}

// GraphQL numerics are nullable; anything missing becomes 0 rather than NaN.
const num = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const r6 = (v) => Math.round(v * 1e6) / 1e6;

// Collapse an upstream failure into one short, displayable line.
function shortMessage(v, fallback) {
  const s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  if (!s) return fallback;
  return s.length > 200 ? s.slice(0, 197) + '...' : s;
}

// Canonical hour bucket key: YYYY-MM-DDTHH:00:00Z (second precision, no
// millis) so points from different statuses in the same hour merge and sort.
function hourKey(v) {
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v || '');
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

const reply = (statusCode, payload) => ({
  statusCode,
  headers: { ...cors(), 'Cache-Control': 'no-store' },
  body: JSON.stringify(payload),
});

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: { ...cors(), 'Cache-Control': 'no-store' } };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: { ...cors(), 'Cache-Control': 'no-store' }, body: JSON.stringify({ error: 'POST only' }) };

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { return reply(400, { ok: false, error: 'Bad request' }); }

  // Same site-password gate as api-keys.js.
  if (!checkPassword(body.password)) {
    return reply(401, { ok: false, error: 'Wrong password' });
  }

  const hours = clampHours(body.hours);
  const token = apiToken();
  if (!token) {
    return reply(503, { ok: false, error: 'Cloudflare analytics token not configured', configured: false });
  }

  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let upstream;
  try {
    upstream = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: buildQuery(since) }),
      signal: controller.signal,
    });
  } catch (e) {
    return reply(502, { ok: false, error: shortMessage(e && e.name === 'AbortError' ? 'Cloudflare request timed out' : e && e.message, 'Cloudflare request failed') });
  } finally {
    clearTimeout(timer);
  }

  let json;
  try {
    json = await upstream.json();
  } catch (e) {
    return reply(502, { ok: false, error: shortMessage(e && e.message, 'Cloudflare returned a non-JSON response') });
  }
  if (!upstream.ok) {
    return reply(502, { ok: false, error: shortMessage((json && json.errors && json.errors[0] && json.errors[0].message) || 'Cloudflare API HTTP ' + upstream.status, 'Cloudflare API HTTP ' + upstream.status) });
  }
  if (json && Array.isArray(json.errors) && json.errors.length) {
    return reply(502, { ok: false, error: shortMessage(json.errors[0] && json.errors[0].message, 'Cloudflare GraphQL error') });
  }

  const points = (json && json.data && json.data.viewer && Array.isArray(json.data.viewer.accounts) && json.data.viewer.accounts[0] && json.data.viewer.accounts[0].workersInvocationsAdaptive) || [];
  const list = Array.isArray(points) ? points : [];

  let requests = 0;
  let errors = 0;
  let subrequests = 0;
  let peak = null;      // busiest single point
  let peakReq = -1;
  const statuses = new Map();
  const hoursMap = new Map();

  for (const p of list) {
    const sum = (p && p.sum) || {};
    const q = (p && p.quantiles) || {};
    const dim = (p && p.dimensions) || {};
    const r = num(sum.requests);
    const e = num(sum.errors);
    requests += r;
    errors += e;
    subrequests += num(sum.subrequests);
    if (r > peakReq) { peakReq = r; peak = q; }

    const status = String(dim.status || 'unknown');
    const s = statuses.get(status) || { status, requests: 0, errors: 0 };
    s.requests += r;
    s.errors += e;
    statuses.set(status, s);

    const hour = hourKey(dim.datetimeHour);
    const h = hoursMap.get(hour) || { hour, requests: 0, errors: 0 };
    h.requests += r;
    h.errors += e;
    hoursMap.set(hour, h);
  }

  const pq = (peak || {});
  const successRate = requests > 0 ? r4((requests - errors) / requests) : 0;

  return reply(200, {
    ok: true,
    configured: true,
    script: SCRIPT,
    account: ACCOUNT,
    hours,
    generatedAt: new Date().toISOString(),
    totals: { requests, errors, subrequests, successRate },
    // `quantiles` are per returned point, not global. You cannot average or
    // request-weight percentiles (both are statistically invalid), and the API
    // exposes no global aggregate — so report the quantiles of the single
    // busiest point, i.e. the bucket that dominates real traffic.
    latency: {
      cpuP50: r6(num(pq.cpuTimeP50)),
      cpuP99: r6(num(pq.cpuTimeP99)),
      durationP50: r4(num(pq.durationP50)), // seconds
      durationP99: r4(num(pq.durationP99)), // seconds
    },
    byStatus: Array.from(statuses.values()).sort((a, b) => b.requests - a.requests || a.status.localeCompare(b.status)),
    timeline: Array.from(hoursMap.values()).sort((a, b) => (Date.parse(a.hour) || 0) - (Date.parse(b.hour) || 0)),
  });
};
