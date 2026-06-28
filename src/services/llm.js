/**
 * LLM service
 *
 * Wraps the `openai` SDK and points it at NVIDIA NIM (which exposes an
 * OpenAI-compatible API). Handles:
 *   - client init with baseURL + apiKey
 *   - model aliasing (served name -> upstream id)
 *   - streaming and non-streaming chat completions
 */
const OpenAI = require('openai');
const config = require('../config');
const logger = require('../utils/logger');

// NVIDIA NIM is OpenAI-API compatible: just override baseURL + key.
const client = new OpenAI({
  apiKey: config.NVIDIA_NIM_API_KEY,
  baseURL: config.NVIDIA_NIM_BASE_URL,
});

/**
 * Resolve a client-supplied model alias to its registry entry.
 * Uses the served name (e.g. "andromeda", "meteor") case-insensitively and
 * falls back to the default model entry when the alias is missing/unknown.
 *
 * @param {string} [requestedModel]
 * @returns {{served:string, upstream:string, description:string, fast:boolean}}
 */
function resolveModelEntry(requestedModel) {
  return config.resolveServedModel(requestedModel);
}

/**
 * Backward-compatible helper: returns the upstream id for a requested alias.
 * @param {string} [requestedModel]
 * @returns {string} upstream model id
 */
function resolveUpstreamModel(requestedModel) {
  return resolveModelEntry(requestedModel).upstream;
}

/**
 * Non-streaming chat completion.
 * @param {{model?:string, messages:Array, temperature?:number, [k:string]:any}} params
 * @returns {Promise<object>} OpenAI-style completion object
 */
async function chatCompletion(params) {
  const entry = resolveModelEntry(params.model);
  logger.info(`chatCompletion [${entry.served}] -> ${entry.upstream} (${params.messages?.length || 0} msgs)`);
  const upstreamModel = entry.upstream;

  const response = await client.chat.completions.create({
    model: upstreamModel,
    messages: params.messages,
    temperature: params.temperature,
    max_tokens: params.max_tokens,
    top_p: params.top_p,
    // Pass-through any other OpenAI-compatible fields the client sent.
    ...passthrough(params),
  });

  return response;
}

/**
 * Streaming chat completion.
 * Returns an async iterable of OpenAI-style chunk objects (SSE-shaped by SDK).
 * @param {{model?:string, messages:Array, temperature?:number, [k:string]:any}} params
 * @returns {Promise<AsyncIterable<object>>}
 */
async function chatCompletionStream(params) {
  const entry = resolveModelEntry(params.model);
  logger.info(`chatCompletionStream [${entry.served}] -> ${entry.upstream} (${params.messages?.length || 0} msgs)`);
  const upstreamModel = entry.upstream;

  const stream = await client.chat.completions.create({
    model: upstreamModel,
    messages: params.messages,
    temperature: params.temperature,
    max_tokens: params.max_tokens,
    top_p: params.top_p,
    stream: true,
    ...passthrough(params),
  });

  return stream;
}

// Fields we explicitly handle; everything else is forwarded to the provider.
const HANDLED_FIELDS = new Set([
  'model',
  'messages',
  'temperature',
  'max_tokens',
  'top_p',
  'stream',
]);

function passthrough(params) {
  const extra = {};
  for (const [key, value] of Object.entries(params)) {
    if (!HANDLED_FIELDS.has(key) && value !== undefined) {
      extra[key] = value;
    }
  }
  return extra;
}

module.exports = {
  client,
  resolveUpstreamModel,
  resolveModelEntry,
  chatCompletion,
  chatCompletionStream,
};
