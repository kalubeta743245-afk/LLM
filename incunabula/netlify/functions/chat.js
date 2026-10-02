const { PROVIDERS, makeClient, cors, getAllProviders, providerFetch, secretFor } = require('./_shared');

// Most providers answer errors in the OpenAI shape ({"error":{"message":...}}),
// which the SDK parses for us. A few return a flatter shape instead (Novita:
// {"code":403,"reason":"NOT_ENOUGH_BALANCE","message":"..."}), and the SDK then
// reports a bare "403 status code (no body)" — hiding the one line that says
// what actually went wrong. Pull the real reason out of whatever shape arrives.
function errorDetail(body) {
  if (body == null) return '';
  const j = typeof body === 'string' ? safeJson(body) : body;
  if (!j || typeof j !== 'object') return String(body).slice(0, 300);
  const e = j.error;
  let msg = '';
  if (typeof e === 'string') msg = e;
  else if (e && typeof e === 'object') msg = e.message || e.detail || e.reason || '';
  if (!msg) msg = j.message || j.reason || j.detail || j.description || '';
  if (!msg && j.errors && j.errors[0]) msg = j.errors[0].message || String(j.errors[0]);
  let code = (j.code != null && !/^\d+$/.test(String(j.code)) && String(j.code).length < 60) ? String(j.code) : '';
  if (!code && e && typeof e === 'object' && e.code && !/^\d+$/.test(String(e.code)) && String(e.code).length < 60) code = String(e.code);
  if (!msg) return '';
  return code ? msg + ' (' + code + ')' : msg;
}
function safeJson(t) { try { return JSON.parse(t); } catch { return null; } }

// One extra request, only on the error path, to read a body the SDK dropped.
async function readUpstreamError(provider, chatParams) {
  try {
    const { url, headers } = providerFetch(provider);
    const r = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(chatParams),
      signal: AbortSignal.timeout(15000),
    });
    const t = await r.text().catch(() => '');
    return errorDetail(t) || t.slice(0, 300);
  } catch { return ''; }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors() };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: 'POST only' }) };

  // Hoisted so the catch below can reach them when re-reading an upstream error.
  let provider = null;
  let chatParams = null;

  try {
    const { providerId, model, messages = [], maxTokens = 64, temperature = 0.3, reasoning } = JSON.parse(event.body || '{}');
    provider = (await getAllProviders()).find((p) => p.id === providerId);
    if (!provider) {
      return { statusCode: 400, headers: cors(), body: JSON.stringify({ ok: false, error: 'Unknown provider: ' + providerId }) };
    }
    if (!model) {
      return { statusCode: 400, headers: cors(), body: JSON.stringify({ ok: false, error: 'Missing model' }) };
    }

    const client = makeClient(provider);
    // Full OpenAI passthrough: forward every SDK field (tools, tool_choice,
    // response_format, stream_options, penalties, seed, reasoning_effort,
    // verbosity, service_tier, etc.). Only gateway-internal keys are stripped.
    // Never send both max_tokens and max_completion_tokens.
    const INTERNAL = new Set(['providerId', 'maxTokens', 'reasoning']);
    chatParams = { model, messages };
    for (const [k, v] of Object.entries(JSON.parse(event.body || '{}'))) {
      if (!INTERNAL.has(k) && v !== undefined) chatParams[k] = v;
    }
    if (chatParams.temperature === undefined) chatParams.temperature = temperature;
    if (chatParams.max_tokens === undefined && chatParams.max_completion_tokens === undefined) {
      chatParams.max_tokens = maxTokens;
    }
    if (reasoning) {
      chatParams.extra_body = { ...(chatParams.extra_body || {}), reasoning_effort: 'low' };
    }

    const started = Date.now();
    let res;
    if (provider.noAuth) {
      // No-auth providers (e.g. Pollinations): plain fetch with NO Authorization
      // header — the OpenAI SDK would send `Bearer none` and get rejected.
      const r = await fetch(provider.baseURL + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(chatParams),
      });
      if (!r.ok) {
        if (r.status === 401 || r.status === 403) {
          const e = new Error('This endpoint needs an API key — edit this provider and add one');
          e.status = r.status;
          throw e;
        }
        const t = await r.text().catch(() => '');
        let msg = t.slice(0, 300) || r.statusText;
        try {
          const j = JSON.parse(t);
          msg = (j.details && j.details.error && j.details.error.message) || j.error || msg;
          if (j.deprecation_notice && typeof msg === 'string' && msg.length < 200) msg += ' | Free key: https://enter.pollinations.ai';
        } catch { /* keep raw text */ }
        const e = new Error(r.status + ' ' + msg);
        e.status = r.status;
        throw e;
      }
      res = await r.json();
    } else {
      res = await client.chat.completions.create(chatParams);
    }
    const ms = Date.now() - started;

    const choice = res.choices && res.choices[0];
    const msg = (choice && choice.message) || {};
    return {
      statusCode: 200,
      headers: cors(),
      body: JSON.stringify({
        ok: true,
        model: res.model || model,
        ms,
        content: msg.content || '',
        reasoning: msg.reasoning || null,
        tool_calls: msg.tool_calls || null,
        finishReason: choice && choice.finish_reason,
        usage: res.usage || null,
        id: res.id || null,
        completion: res,
      }),
    };
  } catch (e) {
    // The OpenAI SDK reports failures as "<status> <statusText>" (often
    // "403 status code (no body)") when the provider's error body is not in the
    // shape the SDK recognises. Prefer the provider's own message.
    const status = e.status || 0;
    let detail = errorDetail(e.error);
    if (!detail && e.response) detail = errorDetail(e.response.data);
    if (!detail && provider && !provider.noAuth && /\(\s*no body\s*\)|status code$/i.test(String(e.message || ''))) {
      detail = await readUpstreamError(provider, chatParams || {});
    }
    const msg = detail
      ? status + ' ' + String(detail).slice(0, 300)
      : (e.message || 'Request failed');
    return {
      statusCode: status || 500,
      headers: cors(),
      body: JSON.stringify({ ok: false, error: msg, status: status || undefined }),
    };
  }
};