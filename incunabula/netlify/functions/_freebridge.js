// Keyless OpenCode free-tier bridge (stdlib only).
// The free relay rejects raw HTTPS chat calls, but the local opencode CLI
// handshakes fine with no key — so the model list goes over HTTPS,
// chat runs through the CLI. Visitors install nothing.
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ZEN = 'https://opencode.ai/zen/v1';
let cache = { t: 0, ids: [] };
let busy = false; // ponytail: naive single-flight ceiling — 429 when busy instead of a queue

async function zenFree() {
  if (Date.now() - cache.t < 300000 && cache.ids.length) return cache.ids;
  const r = await fetch(ZEN + '/models', { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('free list unreachable: HTTP ' + r.status);
  const d = await r.json();
  const ids = ((d.data || []).map((m) => m.id) || []).filter((id) => /free|pickle/i.test(id));
  if (!ids.length && !cache.ids.length) throw new Error('no free models right now');
  if (ids.length) cache = { t: Date.now(), ids };
  return ids.length ? ids : cache.ids;
}

function cliBin() {
  if (process.platform !== 'win32') return 'opencode';
  const exe = path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'opencode-ai', 'bin', 'opencode.exe');
  try { fs.accessSync(exe, fs.constants.X_OK); return exe; } catch { return 'opencode.cmd'; }
}

function spawnUnavailable() {
  // Cloudflare Workers / serverless: no processes. Detect without side effects.
  try {
    if (typeof process === 'undefined' || !process.versions || !process.versions.node) return true;
    const cp = require('child_process');
    if (!cp || typeof cp.spawn !== 'function') return true;
    const src = Function.prototype.toString.call(cp.spawn);
    if (/not implemented|unenv|unsupported/i.test(src)) return true;
  } catch {
    return true;
  }
  return false;
}

function cliChat(modelId, prompt) {
  return new Promise((resolve, reject) => {
    if (spawnUnavailable()) {
      const x = new Error('free chat needs the desktop server (or a ZEN_KEY on this host) — on this host use the TokenRouter free model instead');
      x.status = 501;
      return reject(x);
    }
    // ponytail: stdin 'ignore' (EOF at once) — a held-open pipe makes the CLI wait forever
    let child;
    try {
      child = spawn(cliBin(), ['run', '--model', 'opencode/' + modelId, prompt], { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      const x = new Error('free chat needs the desktop server (or a ZEN_KEY on this host) — on this host use the TokenRouter free model instead');
      x.status = 501;
      return reject(x);
    }
    let out = '', err = '';
    const t = setTimeout(() => { child.kill(); const x = new Error('free run timed out'); x.status = 504; reject(x); }, 120000);
    child.stdout.on('data', (d) => { out += d; if (out.length > 1048576) child.kill(); });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', () => { clearTimeout(t); const x = new Error('opencode CLI missing on host — install: npm i -g opencode-ai'); x.status = 501; reject(x); });
    child.on('close', (code) => {
      clearTimeout(t);
      if (code !== 0) { const x = new Error('free run failed: ' + String(out + err).replace(/\x1b\[[0-9;]*m/g, '').slice(0, 200)); x.status = 502; return reject(x); }
      resolve(String(out).replace(/\x1b\[[0-9;]*m/g, '').split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('>')).join('\n').trim() || '(empty)');
    });
  });
}

module.exports = {
  zenFree,
  cliChat,
  claim() { if (busy) return false; busy = true; return true; },
  release() { busy = false; },
};
