const { cors, storeGet, storeSet } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors() };

  if (event.httpMethod === 'GET') {
    try {
      const vis = await storeGet('model-visibility', {});
      const aliases = await storeGet('model-aliases', {});
      return { statusCode: 200, headers: cors(), body: JSON.stringify({ ok: true, visibility: vis, aliases }) };
    } catch (e) {
      return { statusCode: 500, headers: cors(), body: JSON.stringify({ ok: false, error: e.message }) };
    }
  }

  if (event.httpMethod === 'POST') {
    try {
      const { providerId, model, enabled, alias } = JSON.parse(event.body || '{}');
      if (typeof providerId !== 'string' || !providerId.trim() || typeof model !== 'string' || !model.trim()) {
        return { statusCode: 400, headers: cors(), body: JSON.stringify({ ok: false, error: 'providerId and model must be non-empty strings' }) };
      }
      if (enabled === undefined && alias === undefined) {
        return { statusCode: 400, headers: cors(), body: JSON.stringify({ ok: false, error: 'enabled (boolean) and/or alias (string or null) required' }) };
      }
      if (enabled !== undefined && typeof enabled !== 'boolean') {
        return { statusCode: 400, headers: cors(), body: JSON.stringify({ ok: false, error: 'enabled must be a boolean' }) };
      }
      if (alias !== undefined && alias !== null && typeof alias !== 'string') {
        return { statusCode: 400, headers: cors(), body: JSON.stringify({ ok: false, error: 'alias must be a string, null, or empty string' }) };
      }
      const trimmed = typeof alias === 'string' ? alias.trim() : '';
      if (trimmed.length > 64) {
        return { statusCode: 400, headers: cors(), body: JSON.stringify({ ok: false, error: 'alias must be 64 characters or fewer' }) };
      }
      const key = providerId + '/' + model;
      const res = { ok: true, key };
      let wrote = false;
      if (enabled !== undefined) {
        const vis = await storeGet('model-visibility', {});
        vis[key] = enabled;
        await storeSet('model-visibility', vis);
        res.enabled = enabled;
        wrote = true;
      }
      if (alias !== undefined) {
        const aliases = await storeGet('model-aliases', {});
        const before = aliases[key];
        if (alias === null || trimmed === '') {
          delete aliases[key];
          res.alias = null;
        } else {
          aliases[key] = trimmed;
          res.alias = trimmed;
        }
        if (aliases[key] !== before) {
          await storeSet('model-aliases', aliases);
          wrote = true;
        }
      }
      if (wrote) {
        await storeSet('v1-models-cache', null).catch(() => {});
        await storeSet('v1-model-index', null).catch(() => {});
      }
      return { statusCode: 200, headers: cors(), body: JSON.stringify(res) };
    } catch (e) {
      return { statusCode: 500, headers: cors(), body: JSON.stringify({ ok: false, error: e.message }) };
    }
  }

  return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: 'GET or POST only' }) };
};
