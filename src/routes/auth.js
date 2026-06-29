/**
 * Auth routes
 *
 * Handles user registration and login via Appwrite server SDK.
 * On registration, also creates an initial API key with credits.
 */
const express = require('express');
const router = express.Router();

const { getUsers, ID, Query, requireConfigured } = require('../config/appwrite');
const { createInitialApiKey } = require('../services/api-keys');
const { getUserCredits } = require('../services/credits');
const logger = require('../utils/logger');

/**
 * POST /api/auth/register
 * Body: { email, password, name }
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/api/auth/register', async (req, res, next) => {
  try {
    requireConfigured();

    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: { message: 'Email and password are required.', type: 'invalid_request_error' },
      });
    }

    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({
        error: { message: 'Invalid email format.', type: 'invalid_request_error' },
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: { message: 'Password must be at least 8 characters.', type: 'invalid_request_error' },
      });
    }

    // Create Appwrite user
    const user = await getUsers().create(ID.unique(), email, undefined, password, name || email.split('@')[0]);
    logger.info(`Registered new user: ${user.$id} (${email})`);

    // Create initial API key with credits
    const apiKey = await createInitialApiKey(user.$id);

    const userCredits = await getUserCredits(user.$id);
    res.status(201).json({
      user: { id: user.$id, email: user.email, name: user.name },
      apiKey: { id: apiKey.$id, key: apiKey.key },
      credits: userCredits.credits,
    });
  } catch (err) {
    // Appwrite SDK throws with specific error types
    const msg = err.message || '';
    if (msg.includes('already exists') || msg.includes('duplicate')) {
      return res.status(409).json({
        error: { message: 'An account with this email already exists.', type: 'invalid_request_error' },
      });
    }
    logger.error('Registration error:', msg);
    next(err);
  }
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 *
 * Creates an Appwrite session and returns it.
 */
router.post('/api/auth/login', async (req, res, next) => {
  try {
    requireConfigured();

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: { message: 'Email and password are required.', type: 'invalid_request_error' },
      });
    }

    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({
        error: { message: 'Invalid email format.', type: 'invalid_request_error' },
      });
    }

    // Find user by email first
    const userList = await getUsers().list([Query.equal('email', email), Query.limit(1)]);
    if (userList.total === 0) {
      return res.status(401).json({
        error: { message: 'Invalid email or password.', type: 'unauthorized' },
      });
    }
    const foundUserId = userList.users[0].$id;

    // Create email/password session
    const session = await getUsers().createSession(foundUserId, password);
    logger.info(`User logged in: ${session.userId}`);

    res.json({
      session: {
        id: session.$id,
        userId: session.userId,
        expire: session.expire,
      },
    });
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('Invalid credentials') || msg.includes('invalid')) {
      return res.status(401).json({
        error: { message: 'Invalid email or password.', type: 'unauthorized' },
      });
    }
    // Catch Appwrite user_not_found errors
    if (err.type === 'user_not_found') {
      return res.status(401).json({
        error: { message: 'Invalid email or password.', type: 'unauthorized' },
      });
    }
    logger.error('Login error:', msg);
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Query: ?userId=<id>
 *
 * Returns basic user info (simplified — no session validation for prototype).
 */
router.get('/api/auth/me', async (req, res, next) => {
  try {
    requireConfigured();

    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({
        error: { message: 'userId query parameter is required.', type: 'invalid_request_error' },
      });
    }
    const user = await getUsers().get(userId);
    res.json({
      user: { id: user.$id, email: user.email, name: user.name },
    });
  } catch (err) {
    logger.error('Get user error:', err.message);
    next(err);
  }
});

/**
 * POST /api/auth/logout
 * Body: { userId }
 */
router.post('/api/auth/logout', async (req, res, next) => {
  try {
    requireConfigured();

    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({
        error: { message: 'userId is required.', type: 'invalid_request_error' },
      });
    }
    // Delete all sessions for the user
    await getUsers().deleteSessions(userId);
    logger.info(`User logged out: ${userId}`);
    res.json({ success: true });
  } catch (err) {
    logger.error('Logout error:', err.message);
    next(err);
  }
});

module.exports = router;
