/**
 * GET /v1/models — lists the models this gateway serves (galaxy aliases).
 *
 * Only served names (e.g. "andromeda", "meteor") are exposed; upstream ids are
 * never revealed to clients.
 */
const express = require('express');
const router = express.Router();
const config = require('../config');

router.get('/v1/models', (req, res) => {
  res.json({
    object: 'list',
    data: config.MODEL_REGISTRY.map((m) => ({
      id: m.served,
      object: 'model',
      created: 0,
      owned_by: 'galaxy-llm',
    })),
  });
});

module.exports = router;
