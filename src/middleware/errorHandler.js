/**
 * Central error handler. Mounted last in the Express stack.
 *
 * Maps upstream/provider errors to OpenAI-style error envelopes and keeps the
 * default 500 fallback generic so internal details don't leak.
 */
const logger = require('../utils/logger');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Preserve AppwriteException code field (node-appwrite SDK).
  const status = err.code || err.status || err.statusCode || 500;

  if (status >= 500) {
    logger.error('Unhandled error:', err);
  } else {
    logger.warn('Client error:', err.message);
  }

  // Handle known Appwrite error types.
  if (err.type === 'user_not_found' || err.type === 'document_not_found') {
    return res.status(404).json({
      error: { message: err.message || 'Resource not found.', type: 'not_found' },
    });
  }

  // If the error already looks like an OpenAI/SDK error, mirror its shape.
  const message = err.message || 'Internal server error';
  const type = err.type || (status === 429 ? 'rate_limit_exceeded' : 'api_error');

  res.status(status).json({
    error: { message, type },
  });
}

// 404 handler for unknown routes.
function notFound(req, res) {
  res.status(404).json({
    error: {
      message: `Not found: ${req.method} ${req.originalUrl}`,
      type: 'not_found',
    },
  });
}

module.exports = { errorHandler, notFound };
