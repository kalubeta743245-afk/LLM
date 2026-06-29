/**
 * Docs routes
 *
 * Returns API documentation and ready-to-use code examples
 * for integrating with the optimizedLLM gateway.
 */
const express = require('express');

const router = express.Router();
const config = require('../config');

const BASE_URL = 'https://optimizedllm.netlify.app';
const MODEL_NAME = config.SERVED_MODEL_NAME;
const EXAMPLE_MODEL = 'moonshotai/kimi-k2.6-optimisedLLM';
const OPENAI_BASE_URL = 'https://optimizedllm.netlify.app/v1';

/**
 * GET /api/docs
 * Returns the full documentation JSON payload.
 */
router.get('/api/docs', (req, res) => {
  res.json({
    service: 'optimized-llm',
    model: MODEL_NAME,
    version: '1.0.0',
    baseUrl: BASE_URL,
    openaiBaseUrl: OPENAI_BASE_URL,
    endpoints: [
      {
        method: 'POST',
        path: '/v1/chat/completions',
        description: 'OpenAI-compatible chat completions endpoint.',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer <YOUR_API_KEY>' },
      },
      {
        method: 'GET',
        path: '/v1/models',
        description: 'List available models.',
      },
      {
        method: 'GET',
        path: '/health',
        description: 'Health check.',
      },
    ],
    examples: {
      curl: {
        title: 'cURL',
        language: 'bash',
        code: [
          `curl -X POST ${BASE_URL}/v1/chat/completions \\`,
          `  -H "Content-Type: application/json" \\`,
          `  -H "Authorization: Bearer gllm_YOUR_KEY_HERE" \\`,
          `  -d '{`,
          `    "model": "${EXAMPLE_MODEL}",`,
          `    "messages": [`,
          `      { "role": "system", "content": "You are a helpful assistant." },`,
          `      { "role": "user", "content": "Explain quantum computing in simple terms." }`,
          `    ]`,
          `  }'`,
        ].join('\n'),
      },
      javascript: {
        title: 'JavaScript (fetch)',
        language: 'javascript',
        code: [
          `const response = await fetch('${BASE_URL}/v1/chat/completions', {`,
          `  method: 'POST',`,
          `  headers: {`,
          `    'Content-Type': 'application/json',`,
          `    'Authorization': 'Bearer gllm_YOUR_KEY_HERE',`,
          `  },`,
          `  body: JSON.stringify({`,
          `    model: '${EXAMPLE_MODEL}',`,
          `    messages: [`,
          `      { role: 'system', content: 'You are a helpful assistant.' },`,
          `      { role: 'user', content: 'Explain quantum computing in simple terms.' }`,
          `    ]`,
          `  }),`,
          `});`,
          `const data = await response.json();`,
          `console.log(data.choices[0].message.content);`,
        ].join('\n'),
      },
      python: {
        title: 'Python (requests)',
        language: 'python',
        code: [
          `import requests`,
          ``,
          `url = '${BASE_URL}/v1/chat/completions'`,
          `headers = {`,
          `    'Content-Type': 'application/json',`,
          `    'Authorization': 'Bearer gllm_YOUR_KEY_HERE',`,
          `}`,
          `payload = {`,
          `    'model': '${EXAMPLE_MODEL}',`,
          `    'messages': [`,
          `        {'role': 'system', 'content': 'You are a helpful assistant.'},`,
          `        {'role': 'user', 'content': 'Explain quantum computing in simple terms.'}`,
          `    ]`,
          `}`,
          ``,
          `response = requests.post(url, json=payload, headers=headers)`,
          `print(response.json()['choices'][0]['message']['content'])`,
        ].join('\n'),
      },
      streaming: {
        title: 'Streaming (JavaScript)',
        language: 'javascript',
        code: [
          `const stream = await fetch('${BASE_URL}/v1/chat/completions', {`,
          `  method: 'POST',`,
          `  headers: {`,
          `    'Content-Type': 'application/json',`,
          `    'Authorization': 'Bearer gllm_YOUR_KEY_HERE',`,
          `  },`,
          `  body: JSON.stringify({`,
          `    model: '${EXAMPLE_MODEL}',`,
          `    stream: true,`,
          `    messages: [`,
          `      { role: 'user', content: 'Write a haiku about the moon.' }`,
          `    ]`,
          `  }),`,
          `});`,
          ``,
          `const reader = stream.body.getReader();`,
          `const decoder = new TextDecoder();`,
          `while (true) {`,
          `  const { done, value } = await reader.read();`,
          `  if (done) break;`,
          `  const chunk = decoder.decode(value);`,
          `  console.log(chunk);`,
          `}`,
        ].join('\n'),
      },
    },
    quickReference: {
      'Base URL': BASE_URL,
      'OpenAI Base URL': OPENAI_BASE_URL,
      'Model': MODEL_NAME,
      'Auth Header': 'Authorization: Bearer <API_KEY>',
      'MIME Type': 'application/json',
      'Supported Params': ['model', 'messages', 'stream (boolean)', 'temperature (0-2)'],
    },
  });
});

module.exports = router;
