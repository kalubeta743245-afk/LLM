const { cors, storeGet, storeSet } = require('./_shared');

function maskIp(ip) {
  if (!ip || ip === 'local') return 'local';
  if (ip.includes(':')) return ip.split(':').slice(0, 3).join(':') + ':••••'; // IPv6
  const p = ip.split('.');
  return p.length === 4 ? p[0] + '.' + p[1] + '.••.••' : 'unknown';
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors() };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: 'GET only' }) };
  const h = event.headers || {};
  const ip = h['x-nf-client-connection-ip'] || h['client-ip'] || (h['x-forwarded-for'] || '').split(',')[0].trim() || 'local';
  try {
    const data = await storeGet('visits', { ips: {} });
    data.ips[ip] = Date.now(); // unique IPs only, kept up to date on every visit
    await storeSet('visits', data);
    const ips = Object.entries(data.ips)
      .map(([raw, last]) => ({ ip: maskIp(raw), last }))
      .sort((a, b) => b.last - a.last)
      .slice(0, 50);
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ ok: true, count: ips.length, ips }) };
  } catch (e) {
    return { statusCode: 500, headers: cors(), body: JSON.stringify({ ok: false, error: e.message || 'store failed' }) };
  }
};
