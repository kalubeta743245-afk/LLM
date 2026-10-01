// Cloudflare Worker entrypoint — same API as Netlify/local, same routes.
import { UsageCounts, serviceBucket } from './usage-do.js';

const FNS = {
  models: require('../netlify/functions/models').handler,
  chat: require('../netlify/functions/chat').handler,
  auth: require('../netlify/functions/auth').handler,
  visits: require('../netlify/functions/visits').handler,
  'custom-providers': require('../netlify/functions/custom-providers').handler,
  v1: require('../netlify/functions/v1').handler,
  'api-keys': require('../netlify/functions/api-keys').handler,
  'model-visibility': require('../netlify/functions/model-visibility').handler,
  usage: require('../netlify/functions/usage').handler,
  proxy: require('../netlify/functions/proxy').handler,
};

function corsHeaders(request) {
  let allowHeaders = '*';
  try {
    const h = request && request.headers && request.headers.get('Access-Control-Request-Headers');
    if (h && String(h).trim()) allowHeaders = String(h);
  } catch {}
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': allowHeaders,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Expose-Headers': '*',
    'Vary': 'Origin, Access-Control-Request-Headers',
  };
}

function toEvent(request, body, path, ctx, url) {
  const headers = {};
  request.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
  const ev = { httpMethod: request.method, headers, body, path };
  if (url) {
    const qp = {};
    for (const [k, v] of url.searchParams) qp[k] = v;
    ev.queryStringParameters = qp;
    ev.rawQuery = url.search.replace(/^\?/, '');
  }
  if (ctx) ev._ctx = ctx;
  return ev;
}

function json(statusCode, body, extraHeaders, request) {
  return new Response(body, {
    status: statusCode,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json', ...(extraHeaders || {}) },
  });
}

async function runFn(fn, request, path, ctx, url) {
  const body = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method) ? await request.text() : '';
  try {
    const result = await fn(toEvent(request, body, path, ctx, url));
    if (result && result.stream && typeof result.stream.getReader === 'function') {
      return new Response(result.stream, {
        status: result.statusCode || 200,
        headers: {
          ...corsHeaders(request),
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
          ...(result.headers || {}),
        },
      });
    }
    return json(result.statusCode, result.body, result.headers, request);
  } catch (e) {
    const status = (e && e.status) || 500;
    return json(status, JSON.stringify({ ok: false, error: (e && e.message) || 'Request failed', status }), null, request);
  }
}

// Our own request counter. Every request that reaches the worker is bucketed
// once, here, and counted off the critical path — so no individual function
// below has to know about it and no request ever waits on the counter.
const USAGE_DO_NAME = 'usage';

async function bumpUsage(binding, service) {
  try {
    const id = binding.idFromName(USAGE_DO_NAME);
    const res = await binding.get(id).fetch('https://do/usage', {
      method: 'POST',
      body: JSON.stringify({ service }),
    });
    // Nothing reads this response; drain it so the stub releases cleanly.
    if (res && res.body && typeof res.body.cancel === 'function') await res.body.cancel();
  } catch { /* counting must never surface */ }
}

function countRequest(url, env, ctx) {
  try {
    if (!ctx || typeof ctx.waitUntil !== 'function') return;
    const binding = (env && env.USAGE_COUNTS) || globalThis.USAGE_COUNTS;
    if (!binding || typeof binding.idFromName !== 'function' || typeof binding.get !== 'function') return;
    ctx.waitUntil(bumpUsage(binding, serviceBucket(url.pathname)));
  } catch { /* counting must never break a request */ }
}

export default {
  async fetch(request, env, ctx) {
    try {
      if (env.MODELLAB_KV) globalThis.MODELLAB_KV = env.MODELLAB_KV;
      if (env.PROXY_MODE) globalThis.PROXY_MODE = env.PROXY_MODE;
      if (env.USAGE_COUNTS) globalThis.USAGE_COUNTS = env.USAGE_COUNTS;
      if (env.SITE_PASSWORD) globalThis.SITE_PASSWORD = env.SITE_PASSWORD;
      for (const k of ['NVIDIA_NIM_API_KEY', 'TOKENROUTER_API_KEY', 'ORCAROUTER_API_KEY', 'TOKENHARBOR_API_KEY', 'TOKENFORGE_API_KEY', 'INCEPTION_API_KEY', 'APINEX_API_KEY']) {
        if (env[k]) globalThis[k] = env[k];
      }
    } catch {}

    const url = new URL(request.url);

    // Counted before any routing below — one call site, every request,
    // OPTIONS preflights included (they bucket as their own route).
    countRequest(url, env, ctx);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (url.pathname === '/v1' || url.pathname.startsWith('/v1/')) {
      return runFn(FNS.v1, request, url.pathname, ctx, url);
    }

    const apiMatch =
      url.pathname.match(/^\/api\/(.+)$/) ||
      url.pathname.match(/^\/\.netlify\/functions\/(.+)$/);
    if (apiMatch && ['POST', 'GET', 'PUT', 'DELETE', 'PATCH', 'HEAD'].includes(request.method)) {
      const fn = FNS[apiMatch[1]];
      if (!fn) return json(404, JSON.stringify({ error: 'Unknown function' }), null, request);
      return runFn(fn, request, url.pathname, ctx, url);
    }

    const res = await env.ASSETS.fetch(request);
    return res;
  },
};

// The Durable Object classes live in their own modules but `main` stays
// worker/index.js, so they are re-exported here for wrangler to find and bind.
export { ProxyMode } from './proxy-mode-do.js';
export { UsageCounts } from './usage-do.js';
