// Incunabula as an OpenAI-compatible gateway.
//   GET  /v1/models                 — list every model as "<providerId>/<model>"
//   POST /v1/chat/completions       — {model:"<providerId>/<model>", messages:[...]}
// Auth: none — open gateway, no key needed.
// Non-streaming only. Reuses the existing chat/models handlers (ponytail).
const { cors, storeGet, storeSet, getAllProviders } = require('./_shared');
const chatFn = require('./chat').handler;
const modelsFn = require('./models').handler;

const err = (status, message, reqHeaders) => ({ statusCode: status, headers: cors(reqHeaders), body: JSON.stringify({ error: { message, type: 'invalid_request_error' } }) });

async function findKey(event) {
  const h = event.headers || {};
  const auth = h.authorization || h.Authorization || '';
  const key = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!key) return null;
  const keys = await storeGet('api-keys', []);
  return keys.find((k) => k.key === key) || null;
}
function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(event.headers) };
  const path = (event.path || '').replace(/\/+$/, '') || '/v1';

  // No key needed — open gateway. A valid Bearer key is still accepted
  // (for usage tracking) but never required.
  const keyEntry = await findKey(event).catch(() => null);

  if (event.httpMethod === 'GET' && (path === '/v1/models' || path === '/v1')) {
    const providers = await getAllProviders();
    const settled = await Promise.all(providers.map((p) =>
      withTimeout(modelsFn({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ providerId: p.id }) }), 15000)
        .then((r) => ({ p, r }))
        .catch(() => null)
    ));
    const data = [];
    for (const s of settled) {
      if (!s) continue;
      try {
        const d = JSON.parse(s.r.body || '{}');
        for (const m of (d.models || [])) data.push({ id: s.p.id + '/' + m, object: 'model', owned_by: s.p.id });
      } catch { /* skip failed provider */ }
    }
    if (keyEntry) {
      keyEntry.lastUsed = Date.now();
      const keys = await storeGet('api-keys', []);
      await storeSet('api-keys', keys.map((k) => (k.id === keyEntry.id ? keyEntry : k))).catch(() => {});
    }
    return { statusCode: 200, headers: cors(event.headers), body: JSON.stringify({ object: 'list', data }) };
  }

  if (event.httpMethod === 'POST' && path === '/v1/chat/completions') {
    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch { return err(400, 'Bad request — body must be JSON'); }
    if (body.stream) return err(400, 'Streaming is not supported — use stream:false');
    const full = String(body.model || '');
    const slash = full.indexOf('/');
    if (slash === -1) return err(400, 'model must look like "<providerId>/<model>" — see GET /v1/models');
    const providerId = full.slice(0, slash);
    const model = full.slice(slash + 1);
    if (!model) return err(400, 'model must look like "<providerId>/<model>"');
    const providers = await getAllProviders();
    if (!providers.find((p) => p.id === providerId)) return err(404, 'Unknown provider: ' + providerId);
    const r = await chatFn({
      httpMethod: 'POST', headers: {},
      body: JSON.stringify({ providerId, model, messages: body.messages || [], maxTokens: body.max_tokens || 512, temperature: body.temperature }),
    });
    const d = JSON.parse(r.body || '{}');
    if (r.statusCode !== 200 || d.ok === false) return err(r.statusCode === 200 ? 500 : r.statusCode, d.error || 'Upstream request failed');
    if (keyEntry) {
      keyEntry.lastUsed = Date.now();
      const keys = await storeGet('api-keys', []);
      await storeSet('api-keys', keys.map((k) => (k.id === keyEntry.id ? keyEntry : k))).catch(() => {});
    }
    return {
      statusCode: 200, headers: cors(event.headers),
      body: JSON.stringify({
        id: d.id || ('chatcmpl-' + Date.now().toString(36)),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: full,
        choices: [{ index: 0, message: { role: 'assistant', content: d.content || '' }, finish_reason: d.finishReason || 'stop' }],
        usage: d.usage || undefined,
      }),
    };
  }

  return err(404, 'Use GET /v1/models or POST /v1/chat/completions');
};
