const { cors, storeGet, storeSet } = require('./_shared');

const publicView = (list) => list.map((c) => ({ id: c.id, name: c.name, baseURL: c.baseURL, apiKey: c.apiKey || '', logoUrl: c.logoUrl || '', addedAt: c.addedAt }));

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors() };
  let list;
  try {
    list = await storeGet('custom-providers', []);
  } catch (e) {
    return { statusCode: 500, headers: cors(), body: JSON.stringify({ ok: false, error: e.message || 'store failed' }) };
  }

  if (event.httpMethod === 'GET') {
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ ok: true, providers: publicView(list) }) };
  }

  if (event.httpMethod === 'DELETE') {
    try {
      const { id } = JSON.parse(event.body || '{}');
      if (!id) throw new Error('Missing id');
      const before = list.length;
      list = list.filter((c) => c.id !== id);
      if (list.length === before) throw new Error('Provider not found');
      await storeSet('custom-providers', list); await storeSet('v1-models-cache', null).catch(() => {}); await storeSet('v1-model-index', null).catch(() => {});
      return { statusCode: 200, headers: cors(), body: JSON.stringify({ ok: true, providers: publicView(list) }) };
    } catch (e) {
      return { statusCode: 400, headers: cors(), body: JSON.stringify({ ok: false, error: e.message || 'Bad request' }) };
    }
  }

  if (event.httpMethod === 'PUT') {
    try {
      const { id, name, baseURL, apiKey } = JSON.parse(event.body || '{}');
      if (!id) throw new Error('Missing id');
      const idx = list.findIndex((c) => c.id === id);
      if (idx === -1) throw new Error('Provider not found');
      if (name) {
        if (String(name).trim().length < 2 || String(name).length > 40) throw new Error('Name 2-40 chars');
        list[idx].name = String(name).trim();
      }
      if (baseURL) {
        const url = new URL(String(baseURL).trim().replace(/\/+$/, ''));
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Base URL must be http(s)');
        list[idx].baseURL = url.origin + url.pathname;
      }
      if (apiKey !== undefined) list[idx].apiKey = String(apiKey).trim();
      list[idx].updatedAt = Date.now();
      await storeSet('custom-providers', list); await storeSet('v1-models-cache', null).catch(() => {}); await storeSet('v1-model-index', null).catch(() => {});
      return { statusCode: 200, headers: cors(), body: JSON.stringify({ ok: true, providers: publicView(list) }) };
    } catch (e) {
      return { statusCode: 400, headers: cors(), body: JSON.stringify({ ok: false, error: e.message || 'Bad request' }) };
    }
  }

  if (event.httpMethod === 'POST') {
    try {
      const { name, baseURL, apiKey, logoUrl } = JSON.parse(event.body || '{}');
      if (!name || String(name).trim().length < 2 || String(name).length > 40) throw new Error('Name 2-40 chars');
      const url = new URL(String(baseURL || '').trim().replace(/\/+$/, ''));
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Base URL must be http(s)');
      if (list.length >= 20) throw new Error('Shared list full (20 max)');
      const entry = {
        id: 'custom-' + Date.now().toString(36),
        name: String(name).trim(), baseURL: url.origin + url.pathname,
        apiKey: String(apiKey || '').trim(), addedAt: Date.now(),
        logoUrl: String(logoUrl || '').trim().slice(0, 300),
      };
      list.push(entry);
      await storeSet('custom-providers', list); await storeSet('v1-models-cache', null).catch(() => {}); await storeSet('v1-model-index', null).catch(() => {});
      return { statusCode: 200, headers: cors(), body: JSON.stringify({ ok: true, providers: publicView(list) }) };
    } catch (e) {
      return { statusCode: 400, headers: cors(), body: JSON.stringify({ ok: false, error: e.message || 'Bad request' }) };
    }
  }

  return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: 'GET, POST, PUT, DELETE only' }) };
};
