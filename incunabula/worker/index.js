// Cloudflare Worker entrypoint — same API as Netlify/local, same routes.
const FNS = {
  models: require('../netlify/functions/models').handler,
  chat: require('../netlify/functions/chat').handler,
  auth: require('../netlify/functions/auth').handler,
  visits: require('../netlify/functions/visits').handler,
  'custom-providers': require('../netlify/functions/custom-providers').handler,
  v1: require('../netlify/functions/v1').handler,
  'api-keys': require('../netlify/functions/api-keys').handler,
  'model-visibility': require('../netlify/functions/model-visibility').handler,
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

function toEvent(request, body, path, ctx) {
  const headers = {};
  request.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
  const ev = { httpMethod: request.method, headers, body, path };
  if (ctx) ev._ctx = ctx;
  return ev;
}

function json(statusCode, body, extraHeaders, request) {
  return new Response(body, {
    status: statusCode,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json', ...(extraHeaders || {}) },
  });
}

async function runFn(fn, request, path, ctx) {
  const body = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method) ? await request.text() : '';
  try {
    const result = await fn(toEvent(request, body, path, ctx));
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

export default {
  async fetch(request, env, ctx) {
    try {
      if (env.MODELLAB_KV) globalThis.MODELLAB_KV = env.MODELLAB_KV;
      if (env.SITE_PASSWORD) globalThis.SITE_PASSWORD = env.SITE_PASSWORD;
      for (const k of ['OPENROUTER_API_KEY', 'NVIDIA_NIM_API_KEY', 'TOKENROUTER_API_KEY', 'ORCAROUTER_API_KEY', 'TOKENHARBOR_API_KEY', 'TOKENFORGE_API_KEY', 'AIHUBMIX_API_KEY']) {
        if (env[k]) globalThis[k] = env[k];
      }
    } catch {}

    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (url.pathname === '/v1' || url.pathname.startsWith('/v1/')) {
      return runFn(FNS.v1, request, url.pathname, ctx);
    }

    const apiMatch =
      url.pathname.match(/^\/api\/(.+)$/) ||
      url.pathname.match(/^\/\.netlify\/functions\/(.+)$/);
    if (apiMatch && ['POST', 'GET', 'PUT', 'DELETE', 'PATCH', 'HEAD'].includes(request.method)) {
      const fn = FNS[apiMatch[1]];
      if (!fn) return json(404, JSON.stringify({ error: 'Unknown function' }), null, request);
      return runFn(fn, request, url.pathname, ctx);
    }

    const res = await env.ASSETS.fetch(request);
    return res;
  },
};
