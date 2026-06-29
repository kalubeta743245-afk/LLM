/**
 * Dashboard routes
 *
 * Manages API keys for authenticated users.
 * All routes require a userId header for simplicity (prototype).
 */
const express = require('express');
const router = express.Router();

const {
  listApiKeys,
  createApiKey,
  deleteApiKey,
} = require('../services/api-keys');
const { getUserCredits } = require('../services/credits');
const logger = require('../utils/logger');

/**
 * Middleware: extract userId from X-User-Id header or query param.
 * In production, validate an Appwrite session token here.
 */
function requireUser(req, res, next) {
  const userId = req.headers['x-user-id'] || req.query.userId;
  if (!userId) {
    return res.status(401).json({
      error: { message: 'Authentication required. Send X-User-Id header.', type: 'unauthorized' },
    });
  }
  req.userId = userId;
  next();
}

/**
 * GET /api/dashboard
 * Returns user's API keys, credits summary, and account info.
 */
router.get('/api/dashboard', requireUser, async (req, res, next) => {
  try {
    const keys = await listApiKeys(req.userId);
    const userCredits = await getUserCredits(req.userId);

    // Get user info from Appwrite
    const { getUsers, requireConfigured } = require('../config/appwrite');
    requireConfigured();
    let userInfo = null;
    try {
      const user = await getUsers().get(req.userId);
      userInfo = { id: user.$id, email: user.email, name: user.name };
    } catch (_) {}

    res.json({
      userId: req.userId,
      user: userInfo,
      summary: {
        totalKeys: keys.length,
        totalCredits: userCredits.credits,
        totalUsed: userCredits.totalCredits - userCredits.credits,
      },
      keys: keys.map((k) => ({
        id: k.$id,
        name: k.name,
        key: k.key,
        credits: k.credits,
        totalCredits: k.totalCredits,
        lastUsedAt: k.lastUsedAt,
        createdAt: k.createdAt,
      })),
    });
  } catch (err) {
    logger.error('Dashboard error:', err.message);
    next(err);
  }
});

/**
 * POST /api/dashboard/keys
 * Body: { name }
 * Creates a new API key for the user.
 */
router.post('/api/dashboard/keys', requireUser, async (req, res, next) => {
  try {
    const { name } = req.body || {};
    const key = await createApiKey(req.userId, name || 'New Key');
    res.status(201).json({
      id: key.$id,
      name: key.name,
      key: key.key,
      credits: key.credits,
      createdAt: key.createdAt,
    });
  } catch (err) {
    logger.error('Create key error:', err.message);
    next(err);
  }
});

/**
 * DELETE /api/dashboard/keys/:keyId
 * Deletes an API key.
 */
router.delete('/api/dashboard/keys/:keyId', requireUser, async (req, res, next) => {
  try {
    await deleteApiKey(req.params.keyId, req.userId);
    res.json({ success: true });
  } catch (err) {
    logger.error('Delete key error:', err.message);
    next(err);
  }
});

/*
 * Removed: POST /api/dashboard/keys/:keyId/credits (add credits)
 * Credit management is now server-side / admin controlled.
 */

module.exports = router;
