// Incunabula as an OpenAI-compatible gateway.
//   GET  /v1/models                 — list every model as "<providerId>/<model>"
//   POST /v1/chat/completions       — {model:"<providerId>/<model>", messages:[...]}
// Auth: none — open gateway, no key needed.
// Non-streaming only. Reuses the existing chat/models handlers (ponytail).
const { cors, storeGet, storeSet, getAllProviders, providerFetch } = require('./_shared');
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

// Fetch every provider's model list once. Returns the ordered entries plus a
// modelName -> Set(providerId) index used for alias disambiguation.
async function collectModels() {
  const providers = await getAllProviders();
  const settled = await Promise.all(providers.map((p) =>
    withTimeout(modelsFn({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ providerId: p.id }) }), 15000)
      .then((r) => ({ p, r }))
      .catch(() => null)
  ));
  const entries = [];
  const byModel = new Map();
  for (const s of settled) {
    if (!s) continue;
    try {
      const d = JSON.parse(s.r.body || '{}');
      for (const m of (d.models || [])) {
        const name = String(m);
        entries.push({ providerId: s.p.id, model: name });
        if (!byModel.has(name)) byModel.set(name, new Set());
        byModel.get(name).add(s.p.id);
      }
    } catch { /* skip failed provider */ }
  }
  return { entries, byModel };
}

// SSE streaming relay: forwards the client's full body upstream with
// stream:true and pipes chunks back, rewriting only the model id to the
// gateway id. Tool-call deltas, usage chunks and [DONE] pass through
// untouched. Returns an envelope both adapters understand
// ({statusCode, stream, headers}).
async function streamRelay(event, provider, full, model, body) {
  const { url, headers } = providerFetch(provider);
  let upstream;
  try {
    upstream = await fetch(url, {
      method: 'POST', headers,
      body: JSON.stringify({ ...body, model, stream: true }),
    });
  } catch (e) {
    const err2 = new Error('Upstream unreachable: ' + (e.message || e));
    err2.status = 502;
    throw err2;
  }
  if (!upstream.ok || !upstream.body) {
    const t = await upstream.text().catch(() => '');
    let msg = 'HTTP ' + upstream.status;
    try { const j = JSON.parse(t); msg = (j.error && (j.error.message || j.error)) || msg; } catch { /* raw */ }
    const e = new Error(String(msg).slice(0, 300));
    e.status = upstream.status;
    throw e;
  }
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buf = '';
  const stream = new ReadableStream({
    async pull(controller) {
      while (true) {
        const nl = buf.indexOf('\n');
        if (nl !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          const trimmed = line.trim();
          if (!trimmed) { controller.enqueue(encoder.encode('\n')); return; }
          if (trimmed.startsWith('data:')) {
            const payload = trimmed.slice(5).trim();
            if (payload === '[DONE]') { controller.enqueue(encoder.encode('data: [DONE]\n\n')); return; }
            try {
              const chunk = JSON.parse(payload);
              if (chunk && typeof chunk === 'object' && 'model' in chunk) chunk.model = full;
              controller.enqueue(encoder.encode('data: ' + JSON.stringify(chunk) + '\n\n'));
            } catch {
              controller.enqueue(encoder.encode(line + '\n'));
            }
          } else {
            controller.enqueue(encoder.encode(line + '\n'));
          }
          return;
        }
        const { done, value } = await reader.read();
        if (done) {
          if (buf.trim()) {
            const rest = buf; buf = '';
            controller.enqueue(encoder.encode(rest.endsWith('\n') ? rest : rest + '\n'));
            return;
          }
          controller.close();
          return;
        }
        buf += decoder.decode(value, { stream: true });
      }
    },
    cancel() { try { reader.cancel(); } catch { /* ignore */ } },
  });
  return {
    statusCode: 200,
    stream,
    headers: cors(event.headers),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(event.headers) };
  const path = (event.path || '').replace(/\/+$/, '') || '/v1';

  // No key needed — open gateway. A valid Bearer key is still accepted
  // (for usage tracking) but never required.
  const keyEntry = await findKey(event).catch(() => null);

  if (event.httpMethod === 'GET' && (path === '/v1/models' || path === '/v1')) {
    const { entries, byModel } = await collectModels();
    // Same exact name from 2+ providers: sort provider ids, aliases get -1..-N.
    const rank = new Map();
    for (const [name, set] of byModel) {
      if (set.size < 2) continue;
      const ids = [...set].sort();
      ids.forEach((pid, i) => rank.set(pid + '/' + name, { n: i + 1, total: ids.length }));
    }
    const data = [];
    for (const e of entries) {
      const r = rank.get(e.providerId + '/' + e.model);
      // Canonical entries keep their EXACT names: "<providerId>/<model>".
      const info = { id: e.providerId + '/' + e.model, object: 'model', owned_by: e.providerId };
      if (r) { info.p_index = r.n; info.p_count = r.total; }
      data.push(info);
      // Duplicates also get callable aliases "<model>-1" … "<model>-N".
      if (r) data.push({ id: e.model + '-' + r.n, object: 'model', owned_by: e.providerId, alias_of: e.providerId + '/' + e.model });
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
    const full = String(body.model || '');
    let providerId = '';
    let model = '';
    const slash = full.indexOf('/');
    if (slash === -1) {
      // Bare name. Exact match wins first (so real names ending in digits
      // still work), then "<model>-N" aliases for duplicated names.
      const { byModel } = await collectModels();
      const direct = [...(byModel.get(full) || [])].sort();
      if (direct.length === 1) {
        providerId = direct[0];
        model = full;
      } else if (direct.length > 1) {
        return err(400, 'Ambiguous model "' + full + '" — use one of: ' + direct.map((_, i) => full + '-' + (i + 1)).join(', '));
      } else {
        const alias = full.match(/^(.*)-(\d+)$/);
        if (!alias) return err(400, 'model must look like "<providerId>/<model>" — see GET /v1/models');
        const ids = [...(byModel.get(alias[1]) || [])].sort();
        const n = parseInt(alias[2], 10);
        if (!ids[n - 1]) return err(400, 'Unknown model alias: ' + full);
        providerId = ids[n - 1];
        model = alias[1];
      }
    } else {
      providerId = full.slice(0, slash);
      model = full.slice(slash + 1);
      if (!model) return err(400, 'model must look like "<providerId>/<model>"');
    }
    const providers = await getAllProviders();
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) return err(404, 'Unknown provider: ' + providerId);
    if (provider.localBridge || provider.noAuth) {
      if (body.stream) return err(400, 'Streaming is not supported for provider "' + providerId + '" — use stream:false');
    } else if (body.stream) {
      return streamRelay(event, provider, full, model, body);
    }
    // Forward the client's full body (tools, response_format, penalties,
    // seed, reasoning_effort, …) — chat.js passes everything through.
    const r = await chatFn({
      httpMethod: 'POST', headers: {},
      body: JSON.stringify({ ...body, providerId, model }),
    });
    const d = JSON.parse(r.body || '{}');
    if (r.statusCode !== 200 || d.ok === false) return err(r.statusCode === 200 ? 500 : r.statusCode, d.error || 'Upstream request failed');
    if (keyEntry) {
      keyEntry.lastUsed = Date.now();
      const keys = await storeGet('api-keys', []);
      await storeSet('api-keys', keys.map((k) => (k.id === keyEntry.id ? keyEntry : k))).catch(() => {});
    }
    // Prefer the raw upstream completion (keeps tool_calls, logprobs, usage…).
    if (d.completion && typeof d.completion === 'object') {
      const out = { ...d.completion, model: full };
      if (!out.usage && d.usage) out.usage = d.usage;
      return { statusCode: 200, headers: cors(event.headers), body: JSON.stringify(out) };
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
