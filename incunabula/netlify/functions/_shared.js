const OPENAI = require('openai');

const PROVIDERS = [
  {
    // My Site Free: OpenCode Zen free models. List over HTTPS; chat runs on
    // the desktop server's opencode CLI (locally or via BRIDGE_URL relay).
    id: 'mysitefree',
    name: 'My Site Free',
    tag: 'MF',
    color: '#16A34A',
    baseURL: 'https://opencode.ai/zen/v1',
    apiKey: '',
    noAuth: true,
    localBridge: true,
  },
  {
    id: 'tokenrouter',
    name: 'TokenRouter',
    tag: 'TR',
    color: '#0ea5e9',
    baseURL: 'https://api.tokenrouter.com/v1',
    apiKey: '',
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    tag: 'NV',
    color: '#76b900',
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKey: '',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    tag: 'OR',
    color: '#8b5cf6',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: '',
    defaultHeaders: { 'HTTP-Referer': 'http://localhost:3000', 'X-Title': 'Galaxy LLM' },
  },
  {
    id: 'tokenharbor',
    name: 'Token Harbor',
    tag: 'TH',
    color: '#f97316',
    baseURL: 'https://tokenharbor.ai/v1',
    apiKey: '',
  },
  {
    id: 'tokenforge',
    name: 'Token Forge',
    tag: 'TF',
    color: '#ef4444',
    baseURL: 'https://tokenforge.ai.studio/v1',
    apiKey: '',
  },
  {
    id: 'experientiallab',
    name: 'Experiential Labs',
    tag: 'XL',
    color: '#6366f1',
    baseURL: 'https://api.experientiallabs.ai/v1',
    apiKey: '',
  },
  {
    id: 'orcarouter',
    name: 'OrcaRouter',
    tag: 'OC',
    color: '#f59e0b',
    baseURL: 'https://www.orcarouter.ai/v1',
    apiKey: '',
  },
  {
    id: 'opencode',
    name: 'OpenCode Zen',
    tag: 'OC',
    color: '#000000',
    baseURL: 'https://opencode.ai/zen/v1',
    apiKey: '',
  },
];

function makeClient(provider) {
  return new OPENAI({ apiKey: secretFor(provider.id) || provider.apiKey, baseURL: provider.baseURL, defaultHeaders: provider.defaultHeaders, timeout: 20000, maxRetries: 1 });
}

// Raw request parts for endpoints the SDK client doesn't cover (e.g. SSE
// streaming relay). Same auth + headers as makeClient.
function providerFetch(provider) {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${secretFor(provider.id) || provider.apiKey || ''}` };
  if (provider.defaultHeaders) Object.assign(headers, provider.defaultHeaders);
  return { url: provider.baseURL + '/chat/completions', headers };
}

// Worker secrets (wrangler secret put) override hardcoded keys, so a key can
// be rotated without redeploying. Maps provider id -> secret name.
// Known model ids per provider, merged with the live /models list so a
// provider's catalogue stays visible even when its list endpoint is down.
// TokenForge list: their advertised catalogue (live endpoint exposes a subset).
const STATIC_MODELS = {
  tokenforge: ['gpt-6-astra', 'glm-5.3', 'glm-5.2', 'grok-4.5', 'deepseek-v4-flash', 'deepseek-v4-pro', 'claude-opus-5', 'qwen3.8-27b', 'qwen3.8-max', 'claude-fable-5', 'glm-5.1', 'claude-haiku-4.5', 'claude-opus-4.5', 'claude-opus-4.6', 'claude-opus-4.7', 'claude-sonnet-4.5', 'claude-sonnet-4.6', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o', 'gpt-4o-mini', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5.4', 'gpt-5.5', 'o3', 'o3-pro', 'o4-mini', 'kimi-k3', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'mistral-large-3', 'mistral-small-4', 'minimax-m2', 'minimax-m2-7', 'qwen3.7-max'],
  tokenharbor: ['th-orchestra', 'deepseek-v4-flash', 'deepseek-v4-pro', 'kimi-k3', 'glm-5.3', 'claude-opus-5'],
};

function secretFor(id) {
  const map = {
    openrouter: 'OPENROUTER_API_KEY',
    nvidia: 'NVIDIA_NIM_API_KEY',
    tokenrouter: 'TOKENROUTER_API_KEY',
    orcarouter: 'ORCAROUTER_API_KEY',
    tokenharbor: 'TOKENHARBOR_API_KEY',
    tokenforge: 'TOKENFORGE_API_KEY',
    experientiallab: 'EXPERIENTIALLAB_API_KEY',
    opencode: 'ZEN_KEY',
  };
  const name = map[id];
  if (!name) return '';
  try {
    if (typeof globalThis !== 'undefined' && globalThis[name]) return String(globalThis[name]);
    if (typeof process !== 'undefined' && process.env && process.env[name]) return process.env[name];
  } catch { /* no env */ }
  return '';
}

function cors(reqHeaders) {
  // Open gateway: any origin / SDK / browser can call without CORS errors.
  // Echo preflight-requested headers when known, else wildcard.
  let allowHeaders = '*';
  try {
    const h = reqHeaders && (reqHeaders['access-control-request-headers'] || reqHeaders['Access-Control-Request-Headers']);
    if (h && String(h).trim()) allowHeaders = String(h);
  } catch { /* keep wildcard */ }
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': allowHeaders,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Expose-Headers': '*',
    'Vary': 'Origin, Access-Control-Request-Headers',
  };
}

// Cloudflare KV store (bound as MODELLAB_KV in wrangler.toml, exposed on
// globalThis by the Worker entrypoint). Used first when present — works on
// Workers (no fs) and harmless everywhere else.
function cfKV() {
  try {
    const g = globalThis || {};
    if (g.MODELLAB_KV && typeof g.MODELLAB_KV.get === 'function') return g.MODELLAB_KV;
  } catch { /* no KV binding */ }
  return null;
}
// Netlify Blobs store, with local JSON-file fallback for `node server.js` dev.
function filePath(key) {
  return require('path').join(__dirname, '..', '..', '.data', key + '.json');
}
function fileGet(key, fallback) {
  try {
    return JSON.parse(require('fs').readFileSync(filePath(key), 'utf8'));
  } catch { return fallback; }
}
function fileSet(key, val) {
  const fs = require('fs');
  fs.mkdirSync(require('path').dirname(filePath(key)), { recursive: true });
  fs.writeFileSync(filePath(key), JSON.stringify(val));
}
function safeEnv(name) {
  try {
    if (typeof process !== 'undefined' && process.env) return process.env[name];
    if (typeof globalThis !== 'undefined' && globalThis[name]) return globalThis[name];
  } catch { /* no env */ }
  return undefined;
}
function isNetlify() {
  return !!(safeEnv('NETLIFY') || safeEnv('LAMBDA_TASK_ROOT') || safeEnv('AWS_LAMBDA_FUNCTION_NAME'));
}
async function blobStore() {
  const { getStore } = require('@netlify/blobs');
  if (process.env.BLOBS_TOKEN && process.env.BLOBS_SITE_ID) {
    return getStore({ name: 'modellab', siteID: process.env.BLOBS_SITE_ID, token: process.env.BLOBS_TOKEN });
  }
  return getStore('modellab'); // ambient credentials in Functions runtime
}
async function storeGet(key, fallback) {
  const kv = cfKV();
  if (kv) {
    try {
      const v = await kv.get(key, { type: 'json' });
      return v == null ? fallback : v;
    } catch { /* fall through to other stores */ }
  }
  try {
    const v = await (await blobStore()).get(key, { type: 'json' });
    return v == null ? fallback : v;
  } catch (e) { if (isNetlify()) throw new Error('blob-get failed: ' + (e.message || e)); return fileGet(key, fallback); } // ponytail: local dev, no blob context
}
async function storeSet(key, val) {
  const kv = cfKV();
  if (kv) {
    try { await kv.put(key, JSON.stringify(val)); return; } catch { /* fall through */ }
  }
  try {
    await (await blobStore()).setJSON(key, val);
  } catch (e) { if (isNetlify()) throw new Error('blob-set failed: ' + (e.message || e)); fileSet(key, val); } // ponytail: local dev, no blob context
}

// Built-in providers + user-shared custom providers (keys stay server-side).
async function getAllProviders() {
  const customs = await storeGet('custom-providers', []);
  return PROVIDERS.concat(customs.map((c) => ({
    id: c.id, name: c.name, tag: '+', color: '#60A5FA',
    baseURL: c.baseURL, apiKey: c.apiKey || 'none', custom: true, noAuth: !c.apiKey,
  })));
}

module.exports = { OPENAI, PROVIDERS, STATIC_MODELS, makeClient, providerFetch, cors, storeGet, storeSet, getAllProviders, secretFor };