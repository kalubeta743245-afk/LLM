const { PROVIDERS, makeClient, cors, getAllProviders } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors() };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: 'POST only' }) };

  try {
    const { providerId, model, messages = [], maxTokens = 64, temperature = 0.3, reasoning } = JSON.parse(event.body || '{}');
    const provider = (await getAllProviders()).find((p) => p.id === providerId);
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
    const chatParams = { model, messages };
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
    return {
      statusCode: e.status || 500,
      headers: cors(),
      body: JSON.stringify({ ok: false, error: e.message || 'Request failed', status: e.status }),
    };
  }
};