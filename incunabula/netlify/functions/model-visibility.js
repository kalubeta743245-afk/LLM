const { cors, storeGet, storeSet } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors() };

  if (event.httpMethod === 'GET') {
    try {
      const vis = await storeGet('model-visibility', {});
      return { statusCode: 200, headers: cors(), body: JSON.stringify({ ok: true, visibility: vis }) };
    } catch (e) {
      return { statusCode: 500, headers: cors(), body: JSON.stringify({ ok: false, error: e.message }) };
    }
  }

  if (event.httpMethod === 'POST') {
    try {
      const { providerId, model, enabled } = JSON.parse(event.body || '{}');
      if (!providerId || !model || typeof enabled !== 'boolean') {
        return { statusCode: 400, headers: cors(), body: JSON.stringify({ ok: false, error: 'providerId, model, enabled (boolean) required' }) };
      }
      const key = providerId + '/' + model;
      const vis = await storeGet('model-visibility', {});
      vis[key] = enabled;
      await storeSet('model-visibility', vis);
      await storeSet('v1-models-cache', null).catch(() => {});
      await storeSet('v1-model-index', null).catch(() => {});
      return { statusCode: 200, headers: cors(), body: JSON.stringify({ ok: true, key, enabled }) };
    } catch (e) {
      return { statusCode: 500, headers: cors(), body: JSON.stringify({ ok: false, error: e.message }) };
    }
  }

  return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: 'GET or POST only' }) };
};
