/**
 * GET /api/models — fetches all available models from NVIDIA NIM and appends
 * the -optimisedLLM suffix to each model ID.
 */
const express = require('express');
const router = express.Router();
const config = require('../config');
const logger = require('../utils/logger');

router.get('/api/models', async (req, res, next) => {
  try {
    const nimBase = config.NVIDIA_NIM_BASE_URL;
    const nimKey = config.NVIDIA_NIM_API_KEY;
    
    if (!nimKey) {
      return res.json({
        object: 'list',
        data: config.MODEL_REGISTRY.map((m) => ({
          id: m.upstream + '-optimisedLLM',
          object: 'model',
          created: Math.floor(Date.now() / 1000),
          owned_by: 'nvidia-nim',
          served_by: 'optimizedLLM',
          description: m.description,
        })),
      });
    }

    const response = await fetch(`${nimBase}/models`, {
      headers: {
        'Authorization': `Bearer ${nimKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`NVIDIA NIM API error: ${response.status}`);
    }

    const data = await response.json();
    
    const models = (data.data || []).map((m) => ({
      id: m.id + '-optimisedLLM',
      object: 'model',
      created: m.created || Math.floor(Date.now() / 1000),
      owned_by: m.owned_by || 'nvidia-nim',
      served_by: 'optimizedLLM',
      description: `NVIDIA NIM model — ${m.id}`,
    }));

    res.json({ object: 'list', data: models });
  } catch (err) {
    logger.error('NVIDIA models fetch error:', err.message);
    res.json({
      object: 'list',
      data: config.MODEL_REGISTRY.map((m) => ({
        id: m.upstream + '-optimisedLLM',
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'nvidia-nim',
        served_by: 'optimizedLLM',
        description: m.description,
      })),
    });
  }
});

module.exports = router;
