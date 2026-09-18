const { cors, storeGet, storeSet } = require('./_shared');

const CONFIG_KEY = 'model-dedup-config';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(event.headers) };

  // GET — return model groups (models appearing on 2+ providers)
  if (event.httpMethod === 'GET') {
    try {
      const config = await storeGet(CONFIG_KEY, {});
      const { getAllProviders } = require('./_shared');
      const providers = await getAllProviders();
      const providerMap = {};
      for (const p of providers) providerMap[p.id] = p;

      const modelsFn = require('./models').handler;
      const settled = await Promise.all(providers.map((p) =>
        modelsFn({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ providerId: p.id }) })
          .then((r) => ({ pid: p.id, r }))
          .catch(() => null)
      ));

      const byModel = {};
      for (const s of settled) {
        if (!s) continue;
        try {
          const d = JSON.parse(s.r.body || '{}');
          for (const m of (d.models || [])) {
            const name = String(m);
            if (!byModel[name]) byModel[name] = [];
            byModel[name].push(s.pid);
          }
        } catch { /* skip */ }
      }

      const groups = [];
      for (const [model, pids] of Object.entries(byModel)) {
        if (pids.length < 2) continue;
        const dedupConfig = config[model] || {};
        const provs = pids.sort().map((id) => ({
          id,
          name: (providerMap[id] || {}).name || id,
          color: (providerMap[id] || {}).color || '#666',
          enabled: dedupConfig[id] !== false,
        }));
        groups.push({ model, providers: provs });
      }
      groups.sort((a, b) => a.model.localeCompare(b.model));

      return { statusCode: 200, headers: cors(event.headers), body: JSON.stringify({ ok: true, groups }) };
    } catch (e) {
      return { statusCode: 500, headers: cors(event.headers), body: JSON.stringify({ ok: false, error: e.message }) };
    }
  }

  // POST — toggle a provider for a model
  if (event.httpMethod === 'POST') {
    try {
      const { model, providerId, enabled } = JSON.parse(event.body || '{}');
      if (!model || !providerId || typeof enabled !== 'boolean') {
        return { statusCode: 400, headers: cors(event.headers), body: JSON.stringify({ ok: false, error: 'model, providerId, enabled (boolean) required' }) };
      }
      const config = await storeGet(CONFIG_KEY, {});
      if (!config[model]) config[model] = {};
      config[model][providerId] = enabled;
      await storeSet(CONFIG_KEY, config);

      // Rebuild the group with all providers
      const { getAllProviders } = require('./_shared');
      const providers = await getAllProviders();
      const providerMap = {};
      for (const p of providers) providerMap[p.id] = p;

      const modelsFn = require('./models').handler;
      const settled = await Promise.all(providers.map((p) =>
        modelsFn({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ providerId: p.id }) })
          .then((r) => ({ pid: p.id, r }))
          .catch(() => null)
      ));

      const allPids = [];
      for (const s of settled) {
        if (!s) continue;
        try {
          const d = JSON.parse(s.r.body || '{}');
          if ((d.models || []).some((m) => String(m) === model)) allPids.push(s.pid);
        } catch { /* skip */ }
      }

      const provs = allPids.sort().map((id) => ({
        id,
        name: (providerMap[id] || {}).name || id,
        color: (providerMap[id] || {}).color || '#666',
        enabled: (config[model] || {})[id] !== false,
      }));

      return { statusCode: 200, headers: cors(event.headers), body: JSON.stringify({ ok: true, group: { model, providers: provs } }) };
    } catch (e) {
      return { statusCode: 500, headers: cors(event.headers), body: JSON.stringify({ ok: false, error: e.message }) };
    }
  }

  return { statusCode: 405, headers: cors(event.headers), body: JSON.stringify({ error: 'GET or POST only' }) };
};
