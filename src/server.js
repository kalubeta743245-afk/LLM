/**
 * optimizedLLM — server entrypoint.
 *
 * Wires together Express middleware, routes, and graceful shutdown.
 * Configuration is validated on import of ./config (fails fast on missing env).
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const config = require('./config');
const logger = require('./utils/logger');
const apiKeyGate = require('./middleware/apiKeyGate');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Routers
const healthRouter = require('./routes/health');
const modelsRouter = require('./routes/models');
const chatRouter = require('./routes/chat');
const authRouter = require('./routes/auth');
const dashboardRouter = require('./routes/dashboard');
const docsRouter = require('./routes/docs');
const nvidiaModelsRouter = require('./routes/nvidia-models');

const app = express();

// ---- Global middleware ----
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com', 'https://unpkg.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com', 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
    },
  },
}));
app.use(cors());
// Raw JSON body; OpenAI bodies can be moderately large (long conversations).
app.use(express.json({ limit: '8mb' }));
app.use(morgan(config.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.static('src/public'));

// Ignore favicon requests (prevent hitting middleware stack).
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Pass through .well-known requests (e.g. app association files).
app.all('/.well-known/*', (req, res) => res.status(404).json({
  error: { message: 'Not found', type: 'not_found' },
}));

// ---- Routes ----
app.get('/', (req, res) => {
  res.json({
    service: 'optimized-llm',
    servedModel: config.SERVED_MODEL_NAME,
    docs: 'See README.md. Try GET /v1/models or POST /v1/chat/completions.',
  });
});

// Public health check.
app.use(healthRouter);

// Public models listing.
app.use(modelsRouter);

// Public auth, docs and dashboard routes.
app.use(authRouter);
app.use(dashboardRouter);
app.use(docsRouter);
app.use(nvidiaModelsRouter);

// ---- SPA fallback (serve index.html for browser routes only) ----
app.get('*', (req, res, next) => {
  // Skip API routes — let them fall through to 404/error handlers
  if (req.path.startsWith('/api/') || req.path.startsWith('/v1/')) return next()
  res.sendFile('index.html', { root: 'src/public' }, (err) => {
    if (err) next();
  });
});

// Chat is protected by database-backed API key validation.
app.use(apiKeyGate);
app.use(chatRouter);

// ---- 404 + error handling (must be last) ----
app.use(notFound);
app.use(errorHandler);

// ---- Boot (only when run directly, not when imported by Netlify Function) ----
if (require.main === module) {
  const server = app.listen(config.PORT, () => {
    logger.info(`optimizedLLM listening on http://localhost:${config.PORT}`);
    logger.info(`Serving model "${config.SERVED_MODEL_NAME}" -> upstream "${config.UPSTREAM_MODEL}"`);
    if (config.isAuthEnabled()) {
      logger.info('Backend API-key gate is ENABLED.');
    } else {
      logger.info('Backend API-key gate is DISABLED (prototype mode).');
    }
  });

  function shutdown(signal) {
    logger.info(`${signal} received, shutting down...`);
    server.close(() => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = app;
