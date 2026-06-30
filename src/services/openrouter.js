const logger = require('../utils/logger');

const OR_API = 'https://openrouter.ai/api/v1/models';
const HF_API = 'https://huggingface.co/api/models';

let orCache = { models: [], byId: {}, lastFetched: 0 };
let hfCache = { data: {}, lastFetched: 0 };
const OR_TTL = 10 * 60 * 1000;
const HF_TTL = 60 * 60 * 1000;

// ── Known context windows by model family (fallback when OR/HF have no data) ──
const KNOWN_CTX = {
  '01-ai/yi': 200000,
  'adept/fuyu': 16384,
  'ai21labs/jamba': 256000,
  'aisingapore/sea-lion': 8192,
  'baai/bge': 8192,
  'bigcode/starcoder2': 16384,
  'bytedance/seed': 131072,
  'databricks/dbrx': 32768,
  'deepseek-ai/deepseek-chat': 1048576,
  'deepseek-ai/deepseek-coder': 131072,
  'deepseek-ai/deepseek-v4': 1048576,
  'google/codegemma': 8192,
  'google/deplot': 8192,
  'google/diffusiongemma': 8192,
  'google/gemma-2': 8192,
  'google/gemma-2b': 8192,
  'google/gemma-3': 131072,
  'google/gemma-3n': 32768,
  'google/recurrentgemma': 8192,
  'ibm/granite-3.0': 4096,
  'ibm/granite-34b-code': 4096,
  'ibm/granite-8b-code': 4096,
  'meta/codellama': 16384,
  'meta/llama-2': 4096,
  'meta/llama2': 4096,
  'meta/llama-3.1': 131072,
  'meta/llama-3.2-11b': 131072,
  'meta/llama-3.2-1b': 131072,
  'meta/llama-3.2-3b': 131072,
  'meta/llama-3.2-90b': 131072,
  'meta/llama-3.3': 131072,
  'meta/llama-4': 1048576,
  'meta/llama-guard': 8192,
  'microsoft/kosmos': 2048,
  'microsoft/phi-3-vision': 131072,
  'microsoft/phi-3.5': 131072,
  'microsoft/phi-4-mini': 131072,
  'microsoft/phi-4-multimodal': 131072,
  'mistralai/codestral': 32768,
  'mistralai/ministral-14b': 131072,
  'mistralai/mistral-7b': 32768,
  'mistralai/mistral-large': 131072,
  'mistralai/mistral-nemotron': 128000,
  'mistralai/mistral-small': 32768,
  'mistralai/mixtral-8x22b': 65536,
  'mistralai/mixtral-8x7b': 32768,
  'nv-mistralai/mistral-nemo': 128000,
  'nvidia/cosmos': 4096,
  'nvidia/edgen': 4096,
  'nvidia/embed': 8192,
  'nvidia/gliner': 512,
  'nvidia/ising': 8192,
  'nvidia/llama-3.1-nemotron-51b': 131072,
  'nvidia/llama-3.1-nemotron-nano-8b': 131072,
  'nvidia/llama-3.1-nemotron-nano-vl': 131072,
  'nvidia/llama-3.1-nemotron-safety': 8192,
  'nvidia/llama-3.1-nemotron-ultra': 131072,
  'nvidia/llama-3.1-nemoguard': 8192,
  'nvidia/llama-3.2-nemoretriever': 8192,
  'nvidia/llama-3.2-nv-embedqa': 8192,
  'nvidia/llama-nemotron-embed': 8192,
  'nvidia/llama3-chatqa': 8192,
  'nvidia/nemoretriever': 8192,
  'nvidia/nemotron-4': 4096,
  'nvidia/nemotron-3-content-safety': 4096,
  'nvidia/nemotron-content-safety': 4096,
  'nvidia/nemotron-mini': 4096,
  'nvidia/nemotron-parse': 8192,
  'nvidia/neva': 8192,
  'nvidia/nv-embedcode': 8192,
  'nvidia/nv-embedqa-e5': 512,
  'nvidia/nv-embed-v': 32768,
  'nvidia/nvclip': 8192,
  'nvidia/nvidia-nemotron-nano': 128000,
  'nvidia/parakeet': 4096,
  'nvidia/riva': 2048,
  'nvidia/sana': 4096,
  'nvidia/vila': 8192,
  'nvidia/ai-synthetic-video': 1024,
  'qwen/qwen2.5': 32768,
  'qwen/qwen3': 131072,
  'qwen/qwen3.5': 131072,
  'sarvamai/sarvam': 8192,
  'snowflake/arctic': 4096,
  'stockmark/stockmark-2': 32000,
  'upstage/solar': 4096,
  'writer/palmyra-creative': 131072,
  'writer/palmyra-fin': 32768,
  'writer/palmyra-med': 32768,
  'zyphra/zamba2': 16384,
  'microsoft/phi-4': 16384,
};

function knownContext(modelId) {
  const base = modelId.replace(/-optimisedllm$/i, '').toLowerCase();
  for (const [prefix, ctx] of Object.entries(KNOWN_CTX)) {
    if (base.startsWith(prefix)) return ctx;
  }
  return null;
}

// ── Override map: NIM model → OpenRouter model ──
const OVERRIDES = {
  'meta/llama-3.1-70b-instruct': 'meta-llama/llama-3.1-70b-instruct',
  'meta/llama-3.1-8b-instruct': 'meta-llama/llama-3.1-8b-instruct',
  'meta/llama-3.2-1b-instruct': 'meta-llama/llama-3.2-1b-instruct',
  'meta/llama-3.2-3b-instruct': 'meta-llama/llama-3.2-3b-instruct',
  'meta/llama-3.2-11b-vision-instruct': 'meta-llama/llama-3.2-11b-vision-instruct',
  'meta/llama-3.2-90b-vision-instruct': 'meta-llama/llama-3.2-90b-vision-instruct',
  'meta/llama-3.3-70b-instruct': 'meta-llama/llama-3.3-70b-instruct',
  'meta/llama-4-maverick-17b-128e-instruct': 'meta-llama/llama-4-maverick',
  'meta/llama-guard-4-12b': 'meta-llama/llama-guard-4-12b',
  'meta/llama2-70b': 'meta-llama/llama-2-70b',
  'meta/codellama-70b': 'meta-llama/codellama-70b',
  'deepseek-ai/deepseek-chat': 'deepseek/deepseek-chat',
  'deepseek-ai/deepseek-coder-6.7b-instruct': 'deepseek/deepseek-coder-6.7b-instruct',
  'mistralai/mistral-large': 'mistralai/mistral-large',
  'mistralai/mistral-large-2-instruct': 'mistralai/mistral-large-2407',
  'mistralai/mistral-7b-instruct-v0.3': 'mistralai/mistral-7b-instruct',
  'mistralai/mixtral-8x7b-instruct-v0.1': 'mistralai/mixtral-8x7b-instruct',
  'mistralai/mixtral-8x22b-v0.1': 'mistralai/mixtral-8x22b-instruct',
  'mistralai/codestral-22b-instruct-v0.1': 'mistralai/codestral-2501',
  'mistralai/ministral-14b-instruct-2512': 'mistralai/ministral-14b-2512',
  'mistralai/mistral-small-4-119b-2603': 'mistralai/mistral-small-3.1-24b-instruct',
  'google/gemma-2-2b-it': 'google/gemma-2-2b-it',
  'google/gemma-2b': 'google/gemma-2b',
  'google/gemma-3-12b-it': 'google/gemma-3-12b-it',
  'google/gemma-3-4b-it': 'google/gemma-3-4b-it',
  'microsoft/phi-3-vision-128k-instruct': 'microsoft/phi-3-vision-128k-instruct',
  'microsoft/phi-3.5-moe-instruct': 'microsoft/phi-3.5-moe-instruct',
  'microsoft/phi-4-mini-instruct': 'microsoft/phi-4-mini',
  'microsoft/phi-4-multimodal-instruct': 'microsoft/phi-4-multimodal-instruct',
  'qwen/qwen3.5-122b-a10b': 'qwen/qwen-3.5-122b-a10b',
  'qwen/qwen3-next-80b-a3b-instruct': 'qwen/qwen-3.5-122b-a10b',
  '01-ai/yi-large': '01-ai/yi-1.5-34b',
  'ai21labs/jamba-1.5-large-instruct': 'ai21/jamba-1.5-large',
  'databricks/dbrx-instruct': 'databricks/dbrx-instruct',
  'upstage/solar-10.7b-instruct': 'upstage/solar-10.7b-instruct',
  'zyphra/zamba2-7b-instruct': 'zyphra/zamba2-7b-instruct',
  'bytedance/seed-oss-36b-instruct': 'bytedance-seed/seed-1.6',
  'google/codegemma-7b': 'google/codegemma-1.1-7b',
  'mistralai/mistral-nemotron': 'mistralai/mistral-nemo',
  'nv-mistralai/mistral-nemo-12b-instruct': 'mistralai/mistral-nemo',
  'nvidia/llama-3.1-nemotron-70b-instruct': 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
};

// ── OpenRouter fetching & matching ──

async function fetchOpenRouter() {
  try {
    const res = await fetch(OR_API, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`);
    const body = await res.json();
    const list = body.data || [];
    const byId = {};
    for (const m of list) byId[m.id] = m;
    orCache = { models: list, byId, lastFetched: Date.now() };
    logger.info(`Fetched ${list.length} models from OpenRouter`);
    return list;
  } catch (err) {
    logger.warn(`OpenRouter fetch failed: ${err.message}`);
    return orCache.models;
  }
}

function canonical(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '').trim();
}

function lookupOR(nimId) {
  const base = nimId.replace(/-optimisedllm$/i, '');
  // Exact
  if (orCache.byId[base]) return orCache.byId[base];
  // Override
  const ov = OVERRIDES[base];
  if (ov && orCache.byId[ov]) return orCache.byId[ov];
  // Substring match (nim suffix appears in or model id)
  const parts = base.split('/');
  const suffix = parts.length === 2 ? parts[1] : base;
  const cSuffix = canonical(suffix);
  if (cSuffix && cSuffix.length >= 4) {
    for (const m of orCache.models) {
      const orSuffix = m.id.split('/').pop() || '';
      const cOr = canonical(orSuffix);
      if (cOr.includes(cSuffix) || cSuffix.includes(cOr)) return m;
    }
  }
  return null;
}

// ── HuggingFace enrichment (builds persistent cache) ──

function extractHFContext(config) {
  if (!config) return null;
  return config.max_position_embeddings
    || config.max_sequence_length
    || config.n_positions
    || config.text_config?.max_position_embeddings
    || (config.sliding_window && config.sliding_window > 100 ? config.sliding_window : null)
    || null;
}

async function fetchHF(nimId) {
  const base = nimId.replace(/-optimisedllm$/i, '');
  const hfPath = base.replace(/^nvidia\//, '');
  try {
    const url = `${HF_API}/${encodeURIComponent(hfPath)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'optimizedLLM/1.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const pipeline = data.pipeline_tag || null;
    const ctx = extractHFContext(data.config);
    let modalities = null;
    if (pipeline === 'image-text-to-text' || pipeline === 'image-to-text') modalities = ['image', 'text'];
    else if (pipeline === 'text-generation' || pipeline === 'text2text-generation') modalities = ['text'];
    else if (pipeline === 'sentence-similarity' || pipeline === 'feature-extraction') modalities = ['text', 'embedding'];
    else if (pipeline === 'text-to-image') modalities = ['text', 'image'];
    return { context_length: ctx, architecture: modalities ? { input_modalities: modalities, output_modalities: ['text'] } : null };
  } catch {
    return null;
  }
}

async function buildHFCache(nimIds) {
  if (Date.now() - hfCache.lastFetched < HF_TTL) return;
  const unique = [...new Set(nimIds)];
  let enriched = 0;
  for (const id of unique) {
    if (hfCache.data[id]) continue;
    const hf = await fetchHF(id);
    if (hf) {
      hfCache.data[id] = hf;
      enriched++;
    }
    await new Promise(r => setTimeout(r, 120));
  }
  hfCache.lastFetched = Date.now();
  if (enriched > 0) logger.info(`Cached HF data for ${enriched} models`);
}

// ── Public API ──

function enrichModels(nimModels) {
  const ids = [];

  const enriched = nimModels.map((m) => {
    ids.push(m.id);
    const or = lookupOR(m.id);
    if (or) {
      return {
        ...m,
        context_length: or.context_length || knownContext(m.id) || null,
        pricing: or.pricing || null,
        architecture: or.architecture || null,
        or_name: or.name || null,
        supported_parameters: or.supported_parameters || null,
      };
    }
    // Check HF cache as fallback
    const hf = hfCache.data[m.id];
    if (hf) {
      return {
        ...m,
        context_length: hf.context_length || knownContext(m.id) || null,
        pricing: null,
        architecture: hf.architecture,
        or_name: null,
      };
    }
    const kctx = knownContext(m.id);
    if (kctx) {
      return { ...m, context_length: kctx, pricing: null, architecture: null, or_name: null };
    }
    return { ...m, context_length: null, pricing: null, architecture: null };
  });

  // Build HF cache in background (populates hfCache.data for next request)
  buildHFCache(ids).catch(() => {});

  return enriched;
}

// Initialize
fetchOpenRouter();
setInterval(fetchOpenRouter, OR_TTL);

module.exports = { fetchOpenRouter, lookupOR, enrichModels };
