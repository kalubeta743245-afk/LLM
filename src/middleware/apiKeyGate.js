/**
 * API Key Gate middleware
 *
 * Replaces the simple static BACKEND_API_KEY check with database-backed
 * validation. Validates the API key against the Appwrite database and
 * enforces user-level credit limits.
 *
 * Flow:
 *   1. Extract Authorization: Bearer <key>
 *   2. Look up the key in the api_keys collection
 *   3. If not found -> 401
 *   4. Look up user-level credits
 *   5. If user credits <= 0 -> 403 (out of credits)
 *   6. Otherwise -> attach keyDoc and userId to req and continue
 */
const { validateApiKey } = require('../services/api-keys');
const { getUserCredits } = require('../services/credits');
const logger = require('../utils/logger');

async function apiKeyGate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token) {
    return res.status(401).json({
      error: {
        message: 'Missing API key. Provide Authorization: Bearer <your-api-key>.',
        type: 'unauthorized',
      },
    });
  }

  try {
    const keyDoc = await validateApiKey(token);

    if (!keyDoc) {
      return res.status(401).json({
        error: {
          message: 'Invalid API key.',
          type: 'unauthorized',
        },
      });
    }

    const userCredits = await getUserCredits(keyDoc.userId);
    if (userCredits.credits <= 0) {
      return res.status(403).json({
        error: {
          message: 'Out of credits. Please add more credits in your dashboard.',
          type: 'insufficient_credits',
        },
      });
    }

    req.userId = keyDoc.userId;
    req.apiKeyDoc = keyDoc;
    next();
  } catch (err) {
    logger.error('API key validation error:', err.message);
    // Fail closed — propagate so the error handler can return 500.
    next(err);
  }
}

module.exports = apiKeyGate;
