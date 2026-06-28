/**
 * Optional backend API-key gate.
 *
 * Only activates when BACKEND_API_KEY is configured. In prototype mode
 * (no key set) it passes every request through, so local dev is friction-free.
 *
 * When enabled, clients must send:
 *   Authorization: Bearer <BACKEND_API_KEY>
 */
const config = require('../config');

function authGate(req, res, next) {
  if (!config.isAuthEnabled()) {
    return next();
  }

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token || token !== config.BACKEND_API_KEY) {
    return res.status(401).json({
      error: {
        message: 'Invalid or missing API key. Provide Authorization: Bearer <key>.',
        type: 'unauthorized',
      },
    });
  }

  next();
}

module.exports = authGate;
