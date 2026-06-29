const express = require('express');
const router = express.Router();
const config = require('../config');

router.get('/v1/models', (req, res) => {
  res.json({
    object: 'list',
    data: config.MODEL_REGISTRY.map((m) => ({
      id: m.upstream + '-optimisedLLM',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'nvidia-nim',
      served_by: 'optimized-llm',
      description: m.description,
    })),
  });
});

module.exports = router;
