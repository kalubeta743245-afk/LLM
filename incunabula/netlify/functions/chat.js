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

    if (provider.localBridge) {
      // Keyless free tier: chat runs through the host's opencode CLI (raw HTTPS is rejected by the relay).
      const { zenFree, cliChat, claim, release } = require('./_freebridge');
      const ids = await zenFree();
      const fid = String(model).replace(/^opencode\//, '');
      if (!ids.includes(fid)) {
        return { statusCode: 400, headers: cors(), body: JSON.stringify({ ok: false, error: 'Unknown model: ' + model }) };
      }
      // Cloudflare/host without CLI: relay to the desktop server, which runs the CLI.
      let bridge = null;
      try { if (typeof globalThis !== 'undefined' && globalThis.BRIDGE_URL) bridge = String(globalThis.BRIDGE_URL); } catch { /* no env */ }
      if (bridge) {
        const started = Date.now();
        try {
          const r = await fetch(bridge.replace(/\/+$/, '') + '/api/chat', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ providerId, model, messages, maxTokens, temperature }),
          });
          const d = await r.json().catch(() => ({}));
          if (!r.ok || d.ok === false) throw new Error(d.error || ('bridge HTTP ' + r.status));
          d.ms = Date.now() - started;
          return { statusCode: 200, headers: cors(), body: JSON.stringify(d) };
        } catch (e) {
          return { statusCode: 502, headers: cors(), body: JSON.stringify({ ok: false, error: 'bridge unreachable: ' + (e.message || e) }) };
        }
      }
      // If a ZEN_KEY is configured on this host (Worker secret / server env),
      // use plain HTTPS with Bearer — works everywhere, draws the key's quota.
      let zenKey = null;
      try {
        if (typeof globalThis !== 'undefined' && globalThis.ZEN_KEY) zenKey = globalThis.ZEN_KEY;
        else if (typeof process !== 'undefined' && process.env && process.env.ZEN_KEY) zenKey = process.env.ZEN_KEY;
      } catch { /* no env */ }
      if (zenKey) {
        const started = Date.now();
        try {
          const last = [...messages].reverse().find((m) => m.role === 'user');
          const c = last && last.content;
          const text = typeof c === 'string' ? c : Array.isArray(c) ? c.map((p) => (p && p.text) || '').join('') : '';
          const r = await fetch('https://opencode.ai/zen/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + zenKey },
            body: JSON.stringify({ model: fid, messages: [{ role: 'user', content: (text || 'ping').slice(0, 4000) }], max_tokens: maxTokens }),
          });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) {
            const msg = (d && d.error && (d.error.message || d.error)) || ('HTTP ' + r.status);
            return { statusCode: r.status, headers: cors(), body: JSON.stringify({ ok: false, error: String(msg).slice(0, 300) }) };
          }
          const choice = (d.choices && d.choices[0]) || {};
          return {
            statusCode: 200, headers: cors(),
            body: JSON.stringify({ ok: true, model: fid, ms: Date.now() - started, content: (choice.message && choice.message.content) || '', reasoning: null, finishReason: choice.finish_reason || 'stop', usage: d.usage || null, id: d.id || null }),
          };
        } catch (e) {
          return { statusCode: 500, headers: cors(), body: JSON.stringify({ ok: false, error: e.message || 'Request failed' }) };
        }
      }
      if (!claim()) {
        return { statusCode: 429, headers: cors(), body: JSON.stringify({ ok: false, error: 'busy, retry in a minute' }) };
      }
      const started = Date.now();
      try {
        const last = [...messages].reverse().find((m) => m.role === 'user');
        const c = last && last.content;
        const text = typeof c === 'string' ? c : Array.isArray(c) ? c.map((p) => (p && p.text) || '').join('') : '';
        const content = await cliChat(fid, (text || 'ping').slice(0, 4000));
        return {
          statusCode: 200,
          headers: cors(),
          body: JSON.stringify({ ok: true, model: fid, ms: Date.now() - started, content, reasoning: null, finishReason: 'stop', usage: null, id: null }),
        };
      } catch (e) {
        return { statusCode: e.status || 500, headers: cors(), body: JSON.stringify({ ok: false, error: e.message || 'Request failed' }) };
      } finally { release(); }
    }

    const client = makeClient(provider);
    const chatParams = { model, messages, max_tokens: maxTokens, temperature };
    if (reasoning) chatParams.extra_body = { reasoning_effort: 'low' };

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
    return {
      statusCode: 200,
      headers: cors(),
      body: JSON.stringify({
        ok: true,
        model: res.model || model,
        ms,
        content: (choice && choice.message && choice.message.content) || '',
        reasoning: (choice && choice.message && choice.message.reasoning) || null,
        finishReason: choice && choice.finish_reason,
        usage: res.usage || null,
        id: res.id || null,
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