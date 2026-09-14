const { PROVIDERS, STATIC_MODELS, makeClient, cors, getAllProviders } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors() };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: 'POST only' }) };

  try {
    const { providerId } = JSON.parse(event.body || '{}');
    const provider = (await getAllProviders()).find((p) => p.id === providerId);
    if (!provider) {
      return { statusCode: 400, headers: cors(), body: JSON.stringify({ ok: false, error: 'Unknown provider: ' + providerId }) };
    }

    const started = Date.now();
    if (provider.localBridge) {
      // Keyless free tier: list over HTTPS, no key, nothing to install.
      const { zenFree } = require('./_freebridge');
      const ids = await zenFree();
      return {
        statusCode: 200,
        headers: cors(),
        body: JSON.stringify({ ok: true, provider: provider.name, count: ids.length, ms: Date.now() - started, models: ids }),
      };
    }
    let ids;
    if (provider.modelsURL) {
      // No-auth providers with a non-OpenAI models format (e.g. Pollinations)
      const r = await fetch(provider.modelsURL, { headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error('models fetch failed: HTTP ' + r.status);
      const data = await r.json();
      const arr = Array.isArray(data) ? data : data.data || [];
      ids = arr.map((m) => (typeof m === 'string' ? m : m[provider.modelField || 'id'])).filter(Boolean);
      ids.sort((a, b) => a.localeCompare(b));
    } else if (provider.noAuth) {
      // Keyless custom base: plain fetch, no Authorization header.
      const r = await fetch(provider.baseURL + '/models', { headers: { Accept: 'application/json' } });
      if (!r.ok) {
        if (r.status === 401 || r.status === 403) throw new Error('This endpoint needs an API key — edit this provider and add one');
        throw new Error('models fetch failed: HTTP ' + r.status);
      }
      const data = await r.json();
      const arr = Array.isArray(data) ? data : data.data || [];
      ids = arr.map((m) => (typeof m === 'string' ? m : m[provider.modelField || 'id'])).filter(Boolean);
      ids.sort((a, b) => a.localeCompare(b));
    } else {
      const client = makeClient(provider);
      const models = await client.models.list();
      ids = models.data.map((m) => m.id).sort((a, b) => a.localeCompare(b));
    }
    const ms = Date.now() - started;

    // Merge known catalogue ids so the list stays complete even when the
    // provider's live endpoint is down or paginated.
    const statics = (STATIC_MODELS && STATIC_MODELS[provider.id]) || [];
    if (statics.length) {
      const seen = new Set(ids);
      for (const m of statics) if (!seen.has(m)) { seen.add(m); ids.push(m); }
      ids.sort((a, b) => a.localeCompare(b));
    }

    return {
      statusCode: 200,
      headers: cors(),
      body: JSON.stringify({ ok: true, provider: provider.name, count: ids.length, ms, models: ids }),
    };
  } catch (e) {
    return {
      statusCode: e.status || 500,
      headers: cors(),
      body: JSON.stringify({ ok: false, error: e.message || 'Failed to list models', status: e.status }),
    };
  }
};