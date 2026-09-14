const { cors } = require('./_shared');

// Site password lives in the backend only (never shipped to the browser).
// Override with the SITE_PASSWORD env var (Netlify / Worker vars / .env) — default is '200'.
function sitePassword() {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.SITE_PASSWORD) return globalThis.SITE_PASSWORD;
    if (typeof process !== 'undefined' && process.env && process.env.SITE_PASSWORD) return process.env.SITE_PASSWORD;
  } catch { /* no env */ }
  return '200';
}

function checkPassword(pw) {
  return typeof pw === 'string' && pw.length > 0 && pw === sitePassword();
}

exports.checkPassword = checkPassword;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors() };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: 'POST only' }) };
  try {
    const { password } = JSON.parse(event.body || '{}');
    if (checkPassword(password)) {
      return { statusCode: 200, headers: cors(), body: JSON.stringify({ ok: true }) };
    }
    return { statusCode: 401, headers: cors(), body: JSON.stringify({ ok: false, error: 'Wrong password' }) };
  } catch (e) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ ok: false, error: 'Bad request' }) };
  }
};
