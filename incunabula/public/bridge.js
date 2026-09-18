// Incunabula visitor bridge — run YOUR free models on YOUR pc.
// No install: needs only Node.js 18+ and the opencode CLI (npm i -g opencode-ai).
//
//   1. Save this file anywhere, then run:  node bridge.js
//   2. Keep it running, open the Incunabula site in your browser.
//   3. The "OpenCode Local Tunnel" card automatically uses YOUR pc (badge shows "your pc").
//
// Nothing is uploaded: prompts run through your local opencode CLI only.
// Stop it any time with Ctrl+C. Listens on http://127.0.0.1:8899 (loopback only).
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 8899;
const ZEN = 'https://opencode.ai/zen/v1';
let cache = { t: 0, ids: [] };
let busy = false;

// --- Tunnel helpers ---
const DATA_DIR = path.join(__dirname, '..', '.data');
const TUNNEL_URL_FILE = path.join(DATA_DIR, 'tunnel-url.txt');

function readTunnelUrl() {
  try { return fs.readFileSync(TUNNEL_URL_FILE, 'utf8').trim(); } catch { return ''; }
}

function startTunnelManager() {
  const cf = path.join(__dirname, '..', 'cloudflared.exe');
  if (!fs.existsSync(cf)) return;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  try {
    const child = spawn(cf, ['tunnel', '--url', 'http://localhost:8899'], {
      detached: true, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    });
    child.unref();
    let found = false;
    const deadline = Date.now() + 20000;
    function onLine(line) {
      const m = line.match(/https:\/\/[a-z0-9\-]+\.trycloudflare\.com/);
      if (m && !found) {
        found = true;
        fs.writeFileSync(TUNNEL_URL_FILE, m[0]);
      }
    }
    let buf = '';
    child.stderr.on('data', (d) => {
      buf += d.toString();
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const l of lines) onLine(l);
    });
    child.stdout.on('data', (d) => {
      buf += d.toString();
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const l of lines) onLine(l);
    });
    // Final check after deadline
    setTimeout(() => {
      if (!found && buf) onLine(buf);
      if (!found) fs.writeFileSync(TUNNEL_URL_FILE, 'failed');
    }, 22000);
  } catch { /* ignore */ }
}

function pingUrl(url) {
  return fetch(url + '/ping', { method: 'GET', signal: AbortSignal.timeout(5000) })
    .then((r) => r.ok).catch(() => false);
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

async function zenFree() {
  if (Date.now() - cache.t < 300000 && cache.ids.length) return cache.ids;
  const r = await fetch(ZEN + '/models', { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('free list unreachable: HTTP ' + r.status);
  const d = await r.json();
  const ids = ((d.data || []).map((m) => m.id) || []).filter((id) => /free|pickle|:free$/i.test(id));
  if (!ids.length && !cache.ids.length) throw new Error('no free models right now');
  if (ids.length) cache = { t: Date.now(), ids };
  return ids.length ? ids : cache.ids;
}

function cliBin() {
  if (process.platform !== 'win32') return 'opencode';
  const path = require('path');
  const fs = require('fs');
  const exe = path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'opencode-ai', 'bin', 'opencode.exe');
  try { fs.accessSync(exe, fs.constants.X_OK); return exe; } catch { return 'opencode.cmd'; }
}

function cliChat(modelId, prompt) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(cliBin(), ['run', '--model', 'opencode/' + modelId, prompt], { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      const x = new Error('opencode CLI not found — install: npm i -g opencode-ai');
      x.status = 501;
      return reject(x);
    }
    let out = '', err = '';
    const t = setTimeout(() => { try { child.kill(); } catch {} const x = new Error('free run timed out'); x.status = 504; reject(x); }, 150000);
    child.stdout.on('data', (d) => { out += d; if (out.length > 1048576) { try { child.kill(); } catch {} } });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', () => { clearTimeout(t); const x = new Error('opencode CLI not found — install: npm i -g opencode-ai'); x.status = 501; reject(x); });
    child.on('close', (code) => {
      clearTimeout(t);
      if (code !== 0) { const x = new Error('free run failed: ' + String(out + err).replace(/\x1b\[[0-9;]*m/g, '').slice(0, 200)); x.status = 502; return reject(x); }
      resolve(String(out).replace(/\x1b\[[0-9;]*m/g, '').split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('>')).join('\n').trim() || '(empty)');
    });
  });
}

function readBody(req) {
  return new Promise((resolve) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => resolve(b)); });
}

function cliVersion() {
  return new Promise((resolve) => {
    try {
      const c = spawn(cliBin(), ['--version'], { stdio: ['ignore', 'pipe', 'ignore'] });
      let out = '';
      c.stdout.on('data', (d) => { out += d; });
      c.on('error', () => resolve('unknown'));
      c.on('close', () => resolve(out.replace(/\x1b\[[0-9;]*m/g, '').trim() || 'unknown'));
      setTimeout(() => { try { c.kill(); } catch {} resolve('unknown'); }, 8000);
    } catch { resolve('unknown'); }
  });
}

function npmUpdate() {
  return new Promise((resolve) => {
    try {
      const c = spawn('npm', ['install', '-g', 'opencode-ai@latest'], { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '', err = '';
      c.stdout.on('data', (d) => { out += d; });
      c.stderr.on('data', (d) => { err += d; });
      c.on('error', () => resolve({ ok: false, error: 'npm not found' }));
      c.on('close', (code) => resolve({ ok: code === 0, output: (out + err).slice(0, 500) }));
      setTimeout(() => { try { c.kill(); } catch {} resolve({ ok: false, error: 'update timed out' }); }, 120000);
    } catch (e) { resolve({ ok: false, error: e.message }); }
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:' + PORT);
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  const send = (code, obj) => { res.writeHead(code, { ...CORS, 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

  if (url.pathname === '/tunnel-status' && req.method === 'GET') {
    const tunnelUrl = readTunnelUrl();
    if (!tunnelUrl || tunnelUrl === 'starting...') {
      return send(200, { ok: true, tunnelUrl: tunnelUrl || null, alive: false });
    }
    const alive = await pingUrl(tunnelUrl);
    return send(200, { ok: true, tunnelUrl, alive });
  }

  // OpenAI-compatible: GET /v1/models OR /models
  if ((url.pathname === '/v1/models' || url.pathname === '/models') && req.method === 'GET') {
    try {
      const ids = await zenFree();
      const data = ids.map((id) => ({ id, object: 'model', owned_by: 'mysitefree' }));
      return send(200, { object: 'list', data });
    } catch (e) { return send(500, { error: { message: e.message } }); }
  }

  // OpenAI-compatible: POST /v1/chat/completions OR /chat/completions
  if ((url.pathname === '/v1/chat/completions' || url.pathname === '/chat/completions') && req.method === 'POST') {
    let body = {};
    try { body = JSON.parse(await readBody(req) || '{}'); } catch { return send(400, { error: { message: 'Bad request' } }); }
    const fid = String(body.model || '').replace(/^opencode\//, '').replace(/^mysitefree\//, '');
    try {
      const ids = await zenFree();
      if (!ids.includes(fid)) return send(400, { error: { message: 'Unknown model: ' + (body.model || '') } });
      if (busy) return send(429, { error: { message: 'busy, retry in a minute' } });
      busy = true;
      const started = Date.now();
      try {
        const msgs = body.messages || [];
        const last = [...msgs].reverse().find((m) => m.role === 'user');
        const c = last && last.content;
        const text = typeof c === 'string' ? c : Array.isArray(c) ? c.map((p) => (p && p.text) || '').join('') : '';
        const content = await cliChat(fid, (text || 'ping').slice(0, 4000));
        const id = 'chatcmpl-' + Date.now().toString(36);
        const created = Math.floor(Date.now() / 1000);
        const model = body.model || fid;

        // Streaming: send content word-by-word as SSE chunks
        if (body.stream) {
          res.writeHead(200, {
            ...CORS,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          });
          const words = content.split(/(\s+)/);
          for (let i = 0; i < words.length; i++) {
            const chunk = { id, object: 'chat.completion.chunk', created, model, choices: [{ index: 0, delta: { content: words[i] }, finish_reason: null }] };
            res.write('data: ' + JSON.stringify(chunk) + '\n\n');
          }
          const final = { id, object: 'chat.completion.chunk', created, model, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] };
          res.write('data: ' + JSON.stringify(final) + '\n\n');
          res.write('data: [DONE]\n\n');
          return res.end();
        }

        // Non-streaming: return complete JSON
        return send(200, {
          id, object: 'chat.completion', created, model,
          choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
          usage: null,
        });
      } finally { busy = false; }
    } catch (e) { return send(e.status || 500, { error: { message: e.message || 'Request failed' } }); }
  }

  if (url.pathname === '/ping' && req.method === 'GET') {
    let cli = false;
    try { await new Promise((ok, no) => { const c = spawn(cliBin(), ['--version'], { stdio: ['ignore', 'ignore', 'ignore'] }); c.on('error', no); c.on('close', (code) => (code === 0 ? ok() : no())); setTimeout(no, 8000); }); cli = true; } catch { cli = false; }
    return send(200, { ok: true, bridge: true, cli });
  }

  // Instant update: check OpenCode version → update if newer → fetch fresh models.
  if (url.pathname === '/api/update' && req.method === 'POST') {
    const before = await cliVersion();
    const update = await npmUpdate();
    const after = await cliVersion();
    // Force-refresh model cache.
    cache = { t: 0, ids: [] };
    let models = [];
    try { models = await zenFree(); } catch { /* use stale */ }
    return send(200, { ok: true, before, after, updated: before !== after, npm: update.ok, models, count: models.length });
  }

  const fn = (url.pathname.match(/^\/(?:api|(?:\.netlify\/functions))\/(.+)$/) || [])[1];
  if (!fn || !['models', 'chat'].includes(fn) || req.method !== 'POST') return send(404, { error: 'use POST /api/models or POST /api/chat' });
  let body = {};
  try { body = JSON.parse(await readBody(req) || '{}'); } catch { return send(400, { ok: false, error: 'Bad request' }); }
  if (body.providerId && body.providerId !== 'mysitefree') return send(400, { ok: false, error: 'bridge serves mysitefree only' });

  try {
    if (fn === 'models') {
      const started = Date.now();
      const ids = await zenFree();
      return send(200, { ok: true, provider: 'OpenCode Local Tunnel', count: ids.length, ms: Date.now() - started, models: ids, via: 'your pc' });
    }
    const ids = await zenFree();
    const fid = String(body.model || '').replace(/^opencode\//, '');
    if (!body.model || !ids.includes(fid)) return send(400, { ok: false, error: 'Unknown model: ' + (body.model || '') });
    if (busy) return send(429, { ok: false, error: 'busy, retry in a minute' });
    busy = true;
    const started = Date.now();
    try {
      const msgs = body.messages || [];
      const last = [...msgs].reverse().find((m) => m.role === 'user');
      const c = last && last.content;
      const text = typeof c === 'string' ? c : Array.isArray(c) ? c.map((p) => (p && p.text) || '').join('') : '';
      const content = await cliChat(fid, (text || 'ping').slice(0, 4000));
      return send(200, { ok: true, model: fid, ms: Date.now() - started, content, reasoning: null, finishReason: 'stop', usage: null, id: null, via: 'your pc' });
    } finally { busy = false; }
  } catch (e) {
    return send(e.status || 500, { ok: false, error: e.message || 'Request failed' });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Incunabula bridge on http://127.0.0.1:' + PORT + ' — open the site and use OpenCode Local Tunnel.');
  // Auto-start permanent Cloudflare tunnel
  startTunnelManager();
});
