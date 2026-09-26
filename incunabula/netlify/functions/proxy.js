// Same-origin CORS-bypass proxy. Browser clients talk to this app's own origin
// and get xpart.netlify.app back with CORS headers attached, so a browser never
// has to pass a CORS check against the target.
//
//   GET|POST|PUT|PATCH|DELETE /api/proxy?url=https://xpart.netlify.app/<path>
//   GET|POST|PUT|PATCH|DELETE /.netlify/functions/proxy?url=<absolute-url>
//   ...or the same routes with the target in an `x-proxy-url` header (browsers
//   may set it after the 204 preflight; the Cloudflare Worker route keeps the
//   query string out of the event, so this is the form that always works).
//
// NOT a relay. The allowlist is the whole security model: only
// xpart.netlify.app and its subdomains, http(s) only, default ports only —
// checked before any socket is opened, and re-checked on every redirect hop.
const { cors } = require('./_shared');

const ALLOW_HOST = 'xpart.netlify.app';
const MAX_BODY = 4 * 1024 * 1024; // 4 MB of request body forwarded, hard stop
const TIMEOUT_MS = 60000;          // per hop, fetch + body read
const MAX_HOPS = 3;                // redirect hops followed
const METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
const WITH_BODY = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Hop-by-hop, host-bound, cookie and edge headers that must never be replayed
// onto the target. accept-encoding/content-encoding are dropped as well so the
// runtime negotiates and decodes the body for us instead of shipping a
// client-gzipped payload we would then mislabel.
const STRIP = new Set([
  'host', 'origin', 'referer', 'connection', 'content-length', 'transfer-encoding',
  'keep-alive', 'upgrade', 'cookie', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'accept-encoding', 'content-encoding', 'expect',
]);
const stripHeader = (k) => STRIP.has(k) || k.startsWith('cf-') || k.startsWith('access-control-request-');
const LABEL = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

function err(status, message, reqHeaders) {
  return {
    statusCode: status,
    headers: { ...cors(reqHeaders), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: false, error: message }),
  };
}

function pass(status, text, contentType, reqHeaders) {
  return {
    statusCode: status,
    headers: { ...cors(reqHeaders), 'Content-Type': contentType || 'application/json' },
    body: text == null ? '' : text,
  };
}

// Exact host, or a real subdomain of it. Compared on whole DNS labels, never as
// a bare prefix: "xpart.netlify.app.evil.com" and "evilxpart.netlify.app" both
// fail, and a trailing-dot FQDN ("xpart.netlify.app.") is rejected too — it
// serializes to a different Host header, so it is not the same target.
function hostAllowed(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (h === ALLOW_HOST) return true;
  if (!h.endsWith('.' + ALLOW_HOST)) return false;
  return h.slice(0, h.length - ALLOW_HOST.length - 1).split('.').every((l) => LABEL.test(l));
}

// Single choke point for every URL we are about to fetch, including redirects.
function checkTarget(raw, reqHeaders) {
  let u;
  try {
    u = new URL(String(raw));
  } catch {
    return { error: err(400, 'Invalid url — pass an absolute url, e.g. https://xpart.netlify.app/', reqHeaders) };
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    return { error: err(403, 'Only http: and https: targets are allowed', reqHeaders) };
  }
  if (!hostAllowed(u.hostname)) {
    return { error: err(403, 'Host not allowed — this proxy only forwards to ' + ALLOW_HOST + ' and its subdomains', reqHeaders) };
  }
  if (u.port) {
    return { error: err(403, 'Non-default port not allowed (use the default http/https port)', reqHeaders) };
  }
  u.hash = '';
  return { target: u };
}

function targetFrom(event) {
  const q = event.queryStringParameters;
  if (q && typeof q === 'object') {
    const v = q.url || q.target || q.href;
    if (v) return String(v);
  }
  const withQuery = String(event.path || '') + (event.rawQuery ? '?' + event.rawQuery : '');
  const at = withQuery.indexOf('?');
  if (at !== -1) {
    const p = new URLSearchParams(withQuery.slice(at + 1));
    const v = p.get('url') || p.get('target') || p.get('href');
    if (v) return v;
  }
  const h = event.headers || {};
  return h['x-proxy-url'] || h['x-target-url'] || '';
}

function forwardHeaders(incoming) {
  const out = {};
  for (const k of Object.keys(incoming || {})) {
    const key = String(k).toLowerCase();
    if (stripHeader(key)) continue;
    const v = incoming[k];
    if (v == null) continue;
    out[key] = Array.isArray(v) ? v.join(', ') : String(v);
  }
  return out;
}

function byteLength(s) {
  if (typeof s !== 'string' || !s) return 0;
  if (typeof Buffer !== 'undefined') return Buffer.byteLength(s, 'utf8');
  return new TextEncoder().encode(s).length;
}

// fetch + full body read inside one abort window, so a target that accepts the
// socket and then stalls cannot pin the worker for longer than TIMEOUT_MS.
// `state` is owned by the caller so a timeout is still recognisable when the
// abort surfaces as a throw instead of a response.
async function hop(url, method, headers, body, state) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => { state.timedOut = true; ctrl.abort(); }, TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      method,
      headers,
      body: body === undefined ? undefined : body,
      redirect: 'manual',
      signal: ctrl.signal,
    });
    const buf = await res.arrayBuffer();
    let text = '';
    if (buf && buf.byteLength) {
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
      } catch {
        text = null; // not text — refuse rather than hand back mangled bytes
      }
    }
    let location = '';
    try { location = res.headers.get('location') || ''; } catch { location = ''; }
    return { status: res.status, location, text, type: (res.headers.get('content-type') || '').split(';')[0].trim() };
  } finally {
    clearTimeout(timer);
  }
}

exports.handler = async (event) => {
  const reqHeaders = event.headers || {};
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(reqHeaders) };

  const incoming = String(event.httpMethod || 'GET').toUpperCase();
  if (!METHODS.includes(incoming)) return err(405, 'Method not allowed: ' + incoming, reqHeaders);
  let method = incoming; // may be downgraded to GET by a 301/302/303 hop

  const declared = Number(reqHeaders['content-length'] || 0);
  if (declared && declared > MAX_BODY) return err(413, 'Request body too large (limit 4 MB)', reqHeaders);
  if (event.isBase64Encoded) return err(400, 'Binary (base64) request bodies are not supported — send text/JSON', reqHeaders);

  const raw = targetFrom(event);
  if (!raw) return err(400, 'Missing target — use /api/proxy?url=https://xpart.netlify.app/... or the x-proxy-url header', reqHeaders);

  const checked = checkTarget(raw, reqHeaders);
  if (checked.error) return checked.error;

  let body = WITH_BODY.has(incoming) ? (event.body == null ? '' : String(event.body)) : undefined;
  if (byteLength(body) > MAX_BODY) return err(413, 'Request body too large (limit 4 MB)', reqHeaders);

  const headers = forwardHeaders(reqHeaders);
  let url = checked.target;
  const state = { timedOut: false };

  try {
    for (let hopCount = 0; hopCount <= MAX_HOPS; hopCount++) {
      const res = await hop(url, method, headers, body, state);
      const type = res.type || 'application/json';
      const isRedirect = res.status >= 300 && res.status < 400 && res.status !== 304;
      if (!isRedirect) {
        if (res.text === null) return err(502, 'Upstream body is not UTF-8 text and cannot be proxied', reqHeaders);
        return pass(res.status, res.text, type, reqHeaders);
      }
      // Off-allowlist (or unparseable) Location: hand back the 3xx status with
      // CORS headers but no Location, so no client is walked off the allowlist
      // and no Authorization header we forwarded rides along with it.
      let next = { error: true };
      if (res.location) {
        try {
          next = checkTarget(new URL(res.location, url.toString()), reqHeaders);
        } catch { next = { error: true }; }
      }
      if (next.error || hopCount === MAX_HOPS) {
        return pass(res.status, res.text || '', 'application/json', reqHeaders);
      }
      if (res.status === 303 || ((res.status === 301 || res.status === 302) && method === 'POST')) {
        method = 'GET';
        body = undefined;
        delete headers['content-type'];
        delete headers['content-length'];
      }
      url = next.target;
    }
  } catch (e) {
    if (state.timedOut) return err(504, 'Upstream timed out after ' + (TIMEOUT_MS / 1000) + 's', reqHeaders);
    return err(502, 'Upstream request failed: ' + String((e && e.message) || e).slice(0, 200), reqHeaders);
  }
  return err(502, 'Too many redirects', reqHeaders);
};
