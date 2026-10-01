const { cors } = require('./_shared');
const { checkPassword } = require('./auth');

// Today's request counts, read from our own Durable Object (bound as
// USAGE_COUNTS, name 'usage') rather than Cloudflare GraphQL analytics. The
// old CF_API_TOKEN path is gone: the token expired, and Cloudflare could not
// report per-route data for a workers.dev script anyway. Counting happens in
// worker/index.js, off the critical path, so this endpoint is a pure read.
const DO_NAME = 'usage';
const DO_URL = 'https://do/usage';
const TIMEOUT_MS = 10000;

// Cloudflare Workers on the Free plan allow this many requests per day. Only a
// reference budget for the "remaining" tile — it is not enforced anywhere.
// Override with USAGE_DAILY_LIMIT if the plan or cap changes.
const DEFAULT_DAILY_LIMIT = 100000;

function dailyLimit() {
  let raw = null;
  try {
    if (typeof process !== 'undefined' && process.env && process.env.USAGE_DAILY_LIMIT) raw = process.env.USAGE_DAILY_LIMIT;
  } catch { /* no process */ }
  if (raw == null || raw === '') {
    try { if (globalThis && globalThis.USAGE_DAILY_LIMIT) raw = globalThis.USAGE_DAILY_LIMIT; } catch { /* no globalThis */ }
  }
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_DAILY_LIMIT;
}

const reply = (statusCode, payload) => ({
  statusCode,
  headers: { ...cors(), 'Cache-Control': 'no-store' },
  body: JSON.stringify(payload),
});

const today = () => new Date().toISOString().slice(0, 10);
const num = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);

// Shaped exactly like a real read so the UI has nothing special to detect —
// `configured:false` is the only difference, and it renders as "not counting".
function zeroPayload(configured) {
  const limit = dailyLimit();
  return {
    ok: true,
    configured,
    day: today(),
    total: 0,
    dailyLimit: limit,
    remaining: limit,
    services: [],
    days: [],
  };
}

// Busy counter: largest first, name as a stable tiebreak so equal counts never
// shuffle between reads.
function serviceRows(services) {
  if (!services || typeof services !== 'object' || Array.isArray(services)) return [];
  return Object.keys(services)
    .map((service) => ({ service: String(service), requests: num(services[service]) }))
    .sort((a, b) => b.requests - a.requests || a.service.localeCompare(b.service));
}

// Oldest first; a day the counter never saw is simply absent.
function dayRows(days) {
  if (!Array.isArray(days)) return [];
  return days
    .map((d) => (d && typeof d === 'object' ? { day: String(d.day || ''), total: num(d.total) } : null))
    .filter((d) => d && /^\d{4}-\d{2}-\d{2}$/.test(d.day))
    .sort((a, b) => a.day.localeCompare(b.day));
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: { ...cors(), 'Cache-Control': 'no-store' } };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: { ...cors(), 'Cache-Control': 'no-store' }, body: JSON.stringify({ error: 'POST only' }) };

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { return reply(400, { ok: false, error: 'Bad request' }); }

  // Same site-password gate as api-keys.js.
  if (!checkPassword(body.password)) {
    return reply(401, { ok: false, error: 'Wrong password' });
  }

  // No binding (Netlify, or a worker build without the DO) is a zeroed page,
  // never an error: counting is a convenience, not the endpoint's job.
  let ns = null;
  try { ns = (globalThis && globalThis.USAGE_COUNTS) || null; } catch { ns = null; }
  if (!ns || typeof ns.idFromName !== 'function' || typeof ns.get !== 'function') {
    return reply(200, zeroPayload(false));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let data;
  try {
    const res = await ns.get(ns.idFromName(DO_NAME)).fetch(DO_URL, { signal: controller.signal });
    if (!res || typeof res.json !== 'function') return reply(200, zeroPayload(false));
    data = await res.json();
  } catch {
    // A transient counter hiccup must not look like an auth/analytics failure
    // to the dashboard, so degrade to zeros instead of a 502.
    return reply(200, zeroPayload(false));
  } finally {
    clearTimeout(timer);
  }
  if (!data || typeof data !== 'object' || data.ok === false) return reply(200, zeroPayload(false));

  const limit = dailyLimit();
  const total = num(data.total);
  return reply(200, {
    ok: true,
    configured: true,
    day: /^\d{4}-\d{2}-\d{2}$/.test(String(data.day || '')) ? String(data.day) : today(),
    total,
    dailyLimit: limit,
    remaining: Math.max(0, limit - total),
    services: serviceRows(data.services),
    days: dayRows(data.days),
  });
};