/**
 * GET /health — simple liveness probe.
 */
const express = require('express');
const router = express.Router();

const startedAt = Date.now();

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'optimized-llm',
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
