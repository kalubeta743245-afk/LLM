const http = require('http');
const fs = require('fs');
const path = require('path');
const { cors } = require('./netlify/functions/_shared');
const modelsFn = require('./netlify/functions/models');
const chatFn = require('./netlify/functions/chat');
const authFn = require('./netlify/functions/auth');
const visitsFn = require('./netlify/functions/visits');
const customFn = require('./netlify/functions/custom-providers');
const v1Fn = require('./netlify/functions/v1');
const keysFn = require('./netlify/functions/api-keys');

const PORT = process.env.PORT || 8888;
const PUBLIC = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const FNS = { models: modelsFn.handler, chat: chatFn.handler, auth: authFn.handler, visits: visitsFn.handler, 'custom-providers': customFn.handler, v1: v1Fn.handler, 'api-keys': keysFn.handler };

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => resolve(body));
  });
}

function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    // Dev: never cache — normal F5 always gets fresh files, no hard-refresh.
    headers['Cache-Control'] = 'no-store, must-revalidate';
    headers['Pragma'] = 'no-cache';
    headers['Expires'] = '0';
    if (ext === '.html') {
      headers['Cross-Origin-Opener-Policy'] = 'same-origin';
      headers['Cross-Origin-Embedder-Policy'] = 'credentialless';
    }
    res.writeHead(200, headers);
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors());
    return res.end();
  }

  // OpenAI gateway: /v1/models, /v1/chat/completions
  if (url.pathname === '/v1' || url.pathname.startsWith('/v1/')) {
    const body = await readBody(req);
    try {
      const result = await v1Fn.handler({ httpMethod: req.method, headers: req.headers, body, path: url.pathname });
      if (result && result.stream && typeof result.stream.getReader === 'function') {
        // SSE streaming envelope: pipe the web stream to the response.
        res.writeHead(result.statusCode || 200, {
          ...(result.headers || cors()),
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        });
        const { Readable } = require('stream');
        return Readable.fromWeb(result.stream).pipe(res);
      }
      res.writeHead(result.statusCode, { ...(result.headers || cors()), 'Content-Type': 'application/json' });
      return res.end(result.body);
    } catch (e) {
      res.writeHead(500, { ...cors(), 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: { message: e.message || 'Request failed' } }));
    }
  }

  const apiMatch = url.pathname.match(/^\/api\/(.+)$/) || url.pathname.match(/^\/\.netlify\/functions\/(.+)$/);
  if (apiMatch && ['POST', 'GET', 'PUT', 'DELETE'].includes(req.method)) {
    const fn = FNS[apiMatch[1]];
    if (!fn) {
      res.writeHead(404, cors());
      return res.end(JSON.stringify({ error: 'Unknown function' }));
    }
    const body = await readBody(req);
    try {
      const result = await fn({ httpMethod: req.method, body, headers: req.headers });
      res.writeHead(result.statusCode, { ...(result.headers || cors()), 'Content-Type': 'application/json' });
      return res.end(result.body);
    } catch (e) {
      const status = e.status || 500;
      res.writeHead(status, { ...cors(), 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: e.message || 'Request failed', status }));
    }
  }

  // Keep-alive ping for free hosts (Koyeb/ModelScope sleep on idle).
  // No side effects — safe to hit every few minutes via cron.
  if (url.pathname === '/ping' && req.method === 'GET') {
    res.writeHead(200, { ...cors(), 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, bridge: true }));
  }

  // Static files
  let filePath = path.join(PUBLIC, url.pathname === '/' ? 'index.html' : url.pathname);
  serveStatic(res, filePath);
});

server.listen(PORT, () => {
  console.log(`\n  Model Lab running at:\n`);
  console.log(`    http://localhost:${PORT}`);
  console.log(`    http://localhost:${PORT}/api/models`);
  console.log(`    http://localhost:${PORT}/api/chat`);
  console.log(`    http://localhost:${PORT}/api/auth\n`);
});
