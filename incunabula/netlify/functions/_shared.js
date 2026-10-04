const OPENAI = require('openai');

const PROVIDERS = [
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
    // NIM is slow to first token on big models. A 20s cap turned healthy
    // probes into spurious failures, so give this provider its own budget.
    timeoutMs: 120000,
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
    id: 'orcarouter',
    name: 'OrcaRouter',
    tag: 'OC',
    color: '#f59e0b',
    baseURL: 'https://www.orcarouter.ai/v1',
    apiKey: '',
  },
  {
    id: 'inception',
    name: 'Inception',
    tag: 'IN',
    color: '#ff3b30',
    baseURL: 'https://api.inceptionlabs.ai/v1',
    apiKey: '',
  },
  {
    id: 'kilo',
    name: 'Kilo Gate',
    tag: 'KG',
    color: '#ff6a00',
    baseURL: 'https://api.kilo.ai/api/gateway',
    apiKey: '',
    noAuth: true,
  },
  {
    id: 'apinex',
    name: 'APInex',
    tag: 'AX',
    color: '#5C766D',
    baseURL: 'https://api.apinex.bond/v1',
    apiKey: '',
  },
  {
    id: 'novita',
    name: 'Novita',
    tag: 'NO',
    color: '#8b7cf6',
    baseURL: 'https://api.novita.ai/v3/openai',
    apiKey: '',
  },
  {
    id: 'apmix',
    name: 'APMIX',
    tag: 'AM',
    color: '#d946a8',
    baseURL: 'https://api.apmix.ai/v1',
    apiKey: '',
  },
  {
    id: 'cleanapis',
    name: 'Clean APIs',
    tag: 'CA',
    color: '#2dd4bf',
    baseURL: 'https://cleanapis.com/v1',
    apiKey: '',
    authHeader: 'x-api-key',
  },
];

// Site probes only. `provider.timeoutMs` is an optional per-provider override
// (NIM needs minutes, everyone else is fine on the 20s default); the gateway
// pipe is unaffected — see providerFetch below.
function makeClient(provider) {
  const key = secretFor(provider.id) || provider.apiKey;
  const opts = { baseURL: provider.baseURL, timeout: provider.timeoutMs || 20000, maxRetries: 1 };
  // A few providers reject "Authorization: Bearer" and require a named header
  // instead. Send the key that way and keep the SDK from adding its own Bearer.
  if (provider.authHeader) {
    opts.apiKey = 'not-used';
    opts.defaultHeaders = { ...(provider.defaultHeaders || {}), [provider.authHeader]: key || '' };
  } else {
    opts.apiKey = key;
    if (provider.defaultHeaders) opts.defaultHeaders = provider.defaultHeaders;
  }
  return new OPENAI(opts);
}

// Raw request parts for the thin gateway pipe. Same auth + headers as
// makeClient. No key -> no Authorization header at all (some keyless
// endpoints reject even an empty Bearer).
function providerFetch(provider) {
  const key = secretFor(provider.id) || provider.apiKey || '';
  const headers = { 'Content-Type': 'application/json' };
  if (key) {
    if (provider.authHeader) headers[provider.authHeader] = key;
    else headers.Authorization = `Bearer ${key}`;
  }
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
  apinex: ['claude-fable-5.1', 'claude-opus-5', 'claude-opus-5.5', 'claude-sonnet-5', 'deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-v4.1-flash', 'free/claude-opus-4.6', 'free/claude-sonnet-4.6', 'free/deepseek-v4-flash-0731', 'free/deepseek-v4-pro-0813', 'free/deepseek-v4.1-flash', 'free/glm-5.3-flash', 'free/gemini-3.1-pro', 'free/gemini-3.8-flash', 'free/gpt-6-luna', 'free/hy4', 'free/kimi-k3', 'free/mimo-v2.6-flash', 'free/mimo-v2.6-pro', 'free/muse-spark-1.3', 'free/qwen-3.8-max', 'gemini-3.1-pro', 'gemini-3.8-flash', 'kimi-k3', 'gpt-5.6-terra', 'gpt-6-astra', 'gpt-6-luna', 'gpt-6-sol', 'glm-5.3', 'glm-5.2'],
  novita: ['baichuan/baichuan-m2-32b', 'baidu/cobuddy', 'baidu/ernie-4.5-21B-a3b', 'baidu/ernie-4.5-vl-424b-a47b', 'bunny', 'deepseek/deepseek_v3', 'deepseek/deepseek-ocr-2', 'deepseek/deepseek-r1/community', 'deepseek/deepseek-r1-0528', 'deepseek/deepseek-r1-0528-qwen3-8b', 'deepseek/deepseek-r1-turbo', 'deepseek/deepseek-v4.1-flash', 'deepseek/deepseek-v4.1-flash-dst', 'deepseek/deepseek-v4.1-flash-p', 'deepseek/deepseek-v4-flash', 'deepseek/deepseek-v4-flash-0731', 'deepseek/deepseek-v4-flash-0731-p', 'deepseek/deepseek-v4-flash-vision-exp', 'deepseek/deepseek-v4-pro', 'deepseek/deepseek-v4-pro-0813', 'deepseek/deepseek-v4-pro-0813-p', 'dev/glm46', 'google/gemma-3-12b-it', 'google/gemma-3-27b-it', 'google/gemma-4-26b-a4b-it', 'google/gemma-4-31b-it', 'gryphe/mythomax-l2-13b', 'inclusionai/ling-3.0-flash', 'inclusionai/ling-3.0-flash-fin', 'inclusionai/ling-3.0-flash-sante', 'inclusionai/ling-3.0-flash-vl', 'inclusionai/ling-3.1-flash', 'meta-llama/llama-3.1-8b-instruct', 'meta-llama/llama-3.2-1b-instruct', 'meta-llama/llama-3.3-70b-instruct', 'meta-llama/llama-4-maverick-17b-128e-instruct-fp8', 'meta-llama/llama-4-scout-17b-16e-instruct', 'microsoft/wizardlm-2-8x22b', 'mindai/macaron-v1-tall', 'mindai/macaron-v1-venti', 'ming-image-0.1-design', 'ming-image-0.1-design-layer', 'minimax/minimax-m2', 'minimax/minimax-m2.1', 'minimax/minimax-m2.5', 'minimax/minimax-m2.5-highspeed', 'minimax/minimax-m2.7', 'minimax/minimax-m2.7-highspeed', 'minimax/minimax-m3', 'minimaxai/minimax-m1-80k', 'mistralai/mistral-nemo', 'moonshotai/kimi-k2.5', 'moonshotai/kimi-k2.6', 'moonshotai/kimi-k2.7-code', 'moonshotai/kimi-k2-0905', 'moonshotai/kimi-k2-instruct', 'moonshotai/kimi-k2-thinking', 'moonshotai/kimi-k3', 'moonshotai/kimi-k3-p', 'nousresearch/hermes-2-pro-llama-3-8b', 'nvidia/nemotron-3-nano-30b-a3b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'paddlepaddle/paddleocr-vl', 'qwen/qwen-2.5-72b-instruct', 'qwen/qwen3.5-122b-a10b', 'qwen/qwen3.5-27b', 'qwen/qwen3.5-35b-a3b', 'qwen/qwen3.5-397b-a17b', 'qwen/qwen3.5-plus', 'qwen/qwen3.6-27b', 'qwen/qwen3.6-35b-a3b', 'qwen/qwen3.6-plus', 'qwen/qwen3.7-max', 'qwen/qwen3.8-2.4t-a95b', 'qwen/qwen3.8-27b', 'qwen/qwen3.8-flash', 'qwen/qwen3.8-max', 'qwen/qwen3-235b-a22b-fp8', 'qwen/qwen3-235b-a22b-instruct-2507', 'qwen/qwen3-235b-a22b-thinking-2507', 'qwen/qwen3-coder-30b-a3b-instruct', 'qwen/qwen3-coder-480b-a35b-instruct', 'qwen/qwen3-coder-next', 'qwen/qwen3-max', 'qwen/qwen3-next-80b-a3b-instruct', 'qwen/qwen3-omni-30b-a3b-instruct', 'qwen/qwen3-omni-30b-a3b-thinking', 'qwen/qwen3-vl-235b-a22b-instruct', 'qwen/qwen3-vl-235b-a22b-thinking', 'qwen/qwen3-vl-30b-a3b-instruct', 'qwen/qwen-mt-plus', 'sao10k/l31-70b-euryale-v2.2', 'sao10k/l3-70b-euryale-v2.1', 'sao10k/l3-8b-lunaris', 'Sao10K/L3-8B-Stheno-v3.2', 'stepfun/step-3.7-flash', 'tencent/hy3', 'tencent/hy4-preview', 'thudm/glm-4-32b-0414', 'xiaomimimo/mimo-v2.5', 'xiaomimimo/mimo-v2.5-pro', 'xiaomimimo/mimo-v2.6-flash', 'xiaomimimo/mimo-v2.6-pro', 'zai-org/autoglm-phone-9b-multilingual', 'zai-org/glm-4.5-air', 'zai-org/glm-4.5v', 'zai-org/glm-4.6', 'zai-org/glm-4.6v', 'zai-org/glm-4.7', 'zai-org/glm-4.7-flash', 'zai-org/glm-4.7-h', 'zai-org/glm-5', 'zai-org/glm-5.1', 'zai-org/glm-5.2', 'zai-org/glm-5.3', 'zai-org/glm-5.3-flash', 'zai-org/glm-5.3-p', 'zai-org/glm-5-turbo', 'zai-org/glm-5v-turbo'],
  cleanapis: ['muse-spark-1.1', 'gemma-2-2b', 'gpt-5.6-sol', 'claude-opus-5', 'claude-fable-5', 'claude-mythos-preview', 'kimi-k3', 'glm-5.3', 'deepseek-v4-pro-0813', 'qwen3.8-max', 'gpt-5.6-terra', 'claude-opus-4.8', 'gemini-3.7-flash', 'claude-sonnet-5', 'gpt-5.5', 'grok-4.5', 'deepseek-v4-flash-0731', 'grok-4.6', 'seed-2.1-pro', 'glm-5.2', 'qwen3.8-27b', 'gpt-5.6-luna', 'qwen3.7-max', 'claude-opus-4.6', 'gpt-5.5-pro', 'claude-opus-4.7', 'gemini-3.6-flash', 'kimi-k2.6', 'seed-2.1-turbo', 'gemini-3.1-pro', 'deepseek-v4-pro-max', 'claude-fable-5.1', 'claude-opus-5.5'],
};

function secretFor(id) {
  const map = {
    nvidia: 'NVIDIA_NIM_API_KEY',
    tokenrouter: 'TOKENROUTER_API_KEY',
    orcarouter: 'ORCAROUTER_API_KEY',
    tokenharbor: 'TOKENHARBOR_API_KEY',
    tokenforge: 'TOKENFORGE_API_KEY',
    inception: 'INCEPTION_API_KEY',
    apinex: 'APINEX_API_KEY',
    novita: 'NOVITA_API_KEY',
    apmix: 'APMIX_API_KEY',
    cleanapis: 'CLEANAPIS_API_KEY',
  };
  const name = map[id];
  if (!name) return '';
  try {
    if (typeof globalThis !== 'undefined' && globalThis[name]) return String(globalThis[name]);
    if (typeof process !== 'undefined' && process.env && process.env[name]) return process.env[name];
  } catch { /* no env */ }
  return '';
}

// Read the tunnel URL from the bridge's persistent file.
function readTunnelUrl() {
  try {
    const fs = require('fs');
    const p = require('path').join(__dirname, '..', '..', '.data', 'tunnel-url.txt');
    return fs.readFileSync(p, 'utf8').trim();
  } catch { return ''; }
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

async function fetchOpenCodeModels() { return []; }
async function getOpenCodeModels() { return []; }

module.exports = { OPENAI, PROVIDERS, STATIC_MODELS, makeClient, providerFetch, cors, storeGet, storeSet, getAllProviders, secretFor, readTunnelUrl, fetchOpenCodeModels, getOpenCodeModels };