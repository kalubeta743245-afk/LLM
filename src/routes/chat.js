/**
 * POST /v1/chat/completions — OpenAI-compatible chat completion endpoint.
 *
 * Pipeline:
 *   client -> promptMerge (inject default system prompt) -> llm service -> OpenRouter
 *
 * Supports both:
 *   - non-streaming (returns one JSON object)
 *   - streaming     (stream:true -> SSE chunk passthrough)
 */
const express = require('express');
const router = express.Router();

const llm = require('../services/llm');
const config = require('../config');
const { promptMergeMiddleware } = require('../middleware/promptMerge');
const { deductCredits } = require('../services/credits');
const logger = require('../utils/logger');

// Apply the default-system-prompt merge BEFORE we hit the handler.
router.post('/v1/chat/completions', promptMergeMiddleware, async (req, res, next) => {
  const body = req.body || {};
  const messages = Array.isArray(body.messages) ? body.messages : [];

  if (messages.length === 0) {
    return res.status(400).json({
      error: { message: 'messages[] is required.', type: 'invalid_request_error' },
    });
  }

  const stream = body.stream === true;
  // Resolve the served alias now so we can rewrite it consistently in both
  // streaming and non-streaming responses (clients should always see the alias,
  // never the upstream id).
  const servedName = config.resolveServedModel(body.model).served;

  try {
    if (stream) {
      await handleStream(res, body, servedName, req.apiKeyDoc.userId);
    } else {
      const completion = await llm.chatCompletion(body);
    await deductCredits(req.apiKeyDoc.userId);
      // Normalize the returned model field to our served alias.
      if (completion && completion.model) {
        completion.model = servedName;
      }
      res.json(completion);
    }
  } catch (err) {
    next(err);
  }
});

/**
 * Stream chunks back to the client as Server-Sent Events.
 * We relay the provider's chunks directly; they are already OpenAI-shaped.
 */
async function handleStream(res, body, servedName, userId) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable proxy buffering
  res.flushHeaders?.();

  const send = (obj) => {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };

  try {
    const stream = await llm.chatCompletionStream(body);
    for await (const chunk of stream) {
      // chunks carry the upstream model id; rewrite it to our alias so the
      // served name stays consistent for clients.
      if (chunk.model) {
        chunk.model = servedName;
      }
      send(chunk);
    }
    await deductCredits(req.apiKeyDoc.userId);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    logger.error('Streaming error:', err.message);
    // If headers already sent, emit an SSE error then close.
    send({
      error: { message: err.message || 'Stream failed', type: 'api_error' },
    });
    res.write('data: [DONE]\n\n');
    res.end();
  }
}

module.exports = router;
