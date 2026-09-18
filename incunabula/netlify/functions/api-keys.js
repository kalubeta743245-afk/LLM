const { cors, storeGet, storeSet, PROVIDERS, secretFor, readTunnelUrl } = require('./_shared');
const { checkPassword } = require('./auth');

function newKey() {
  return 'ink_' + require('crypto').randomBytes(24).toString('base64url');
}
const maskKey = (k) => (k && k.length > 10 ? k.slice(0, 7) + '…' + k.slice(-4) : 'hidden');
const pub = (k) => ({ id: k.id, name: k.name, keyMasked: maskKey(k.key), createdAt: k.createdAt, lastUsed: k.lastUsed || 0 });

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors() };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: 'POST only' }) };
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: cors(), body: JSON.stringify({ ok: false, error: 'Bad request' }) }; }
  const { action } = body;

  // Everything below needs the site password.
  if (!checkPassword(body.password)) {
    return { statusCode: 401, headers: cors(), body: JSON.stringify({ ok: false, error: 'Wrong password' }) };
  }

  if (action === 'create') {
    const name = String(body.name || 'cli').trim().slice(0, 40) || 'cli';
    const keys = await storeGet('api-keys', []);
    const entry = { id: 'key-' + Date.now().toString(36), name, key: newKey(), createdAt: Date.now(), lastUsed: 0 };
    keys.push(entry);
    await storeSet('api-keys', keys);
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ ok: true, id: entry.id, name, key: entry.key }) };
  }

  if (action === 'list') {
    const keys = await storeGet('api-keys', []);
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ ok: true, keys: keys.map(pub) }) };
  }

  if (action === 'ensure') {
    // Single prebuilt gateway key: return it (full value, password-gated),
    // creating it first if none exists.
    let keys = await storeGet('api-keys', []);
    if (!keys.length) {
      const entry = { id: 'key-' + Date.now().toString(36), name: 'Default', key: newKey(), createdAt: Date.now(), lastUsed: 0 };
      keys.push(entry);
      await storeSet('api-keys', keys);
    }
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ ok: true, key: keys[0] }) };
  }

  if (action === 'revoke') {
    const keys = await storeGet('api-keys', []);
    const kept = keys.filter((k) => k.id !== body.id);
    if (kept.length === keys.length) return { statusCode: 404, headers: cors(), body: JSON.stringify({ ok: false, error: 'Key not found' }) };
    await storeSet('api-keys', kept);
    // Deleting the prebuilt key auto-creates a fresh one.
    let newKeyEntry = null;
    if (!kept.length) {
      newKeyEntry = { id: 'key-' + Date.now().toString(36), name: 'Default', key: newKey(), createdAt: Date.now(), lastUsed: 0 };
      await storeSet('api-keys', [newKeyEntry]);
    }
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ ok: true, keys: kept.map(pub), newKey: newKeyEntry }) };
  }

  if (action === 'provider-keys') {
    // Password already verified above. Returns live provider keys from
    // Cloudflare secrets so the (password-gated) UI can show + copy them.
    const keys = {};
    const providers = [];
    for (const p of PROVIDERS) {
      if (p.noAuth || p.localBridge) continue;
      const key = secretFor(p.id) || p.apiKey || '';
      keys[p.id] = key;
      providers.push({ id: p.id, name: p.name, baseURL: p.baseURL, key, custom: false });
    }
    const customs = await storeGet('custom-providers', []);
    for (const c of (customs || [])) {
      const key = c.apiKey || '';
      providers.push({ id: c.id, name: c.name, baseURL: c.baseURL, key, custom: true });
    }
    // The worker passes the original path but not the origin; recover it from
    // the request headers so the frontend can call this gateway directly.
    const h = event.headers || {};
    const getHeader = (name) => {
      const needle = name.toLowerCase();
      const hit = Object.keys(h).find((k) => k.toLowerCase() === needle);
      return hit ? h[hit] : undefined;
    };
    const host = getHeader('host');
    const base = host ? (getHeader('x-forwarded-proto') || 'https') + '://' + host + '/v1' : undefined;
    const payload = { ok: true, providers, keys };
    if (base) payload.universal_base = base;
    // Include tunnel URL for My Site Free as an alternative base
    const tunnelUrl = readTunnelUrl();
    if (tunnelUrl && tunnelUrl !== 'starting...') payload.tunnel_url = tunnelUrl;
    return { statusCode: 200, headers: cors(), body: JSON.stringify(payload) };
  }

  return { statusCode: 400, headers: cors(), body: JSON.stringify({ ok: false, error: 'Unknown action' }) };
};
