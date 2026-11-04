/**
 * Smart Waste Management System - API server
 * ---------------------------------------------------------------------------
 * Express application bootstrap:
 *   helmet -> cors -> body parsers -> request log -> static uploads -> routes
 *   -> 404 -> central error handler
 */
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const connectDB = require('./config/db');
const apiRoutes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const { ensureUploadDir } = require('./utils/fileHelper');
const { warmupClassifier } = require('./utils/wasteClassifier');

const app = express();

/* -------------------------------------------------------------------------- */
/* Trust proxy                                                                */
/* -------------------------------------------------------------------------- */
// Required on Render / Vercel so `req.ip` and rate limiting see the real client.
app.set('trust proxy', 1);

/* -------------------------------------------------------------------------- */
/* Upload directory                                                           */
/* -------------------------------------------------------------------------- */
ensureUploadDir();

/* -------------------------------------------------------------------------- */
/* Security headers                                                           */
/* -------------------------------------------------------------------------- */
app.use(
  helmet({
    // The API serves images consumed by a different origin (the Vite app),
    // so the default `same-origin` resource policy must be relaxed.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
    // This is a JSON API; CSP is enforced by the frontend host instead.
    contentSecurityPolicy: false,
  })
);

/* -------------------------------------------------------------------------- */
/* CORS                                                                       */
/* -------------------------------------------------------------------------- */
const allowedOrigins = env.allowedOrigins();

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow same-origin / server-to-server calls (no Origin header).
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);

      // In development accept any localhost / 127.0.0.1 port so that a Vite
      // instance that picked a fallback port still works.
      if (env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

/* -------------------------------------------------------------------------- */
/* Body parsers                                                               */
/* -------------------------------------------------------------------------- */
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

/* -------------------------------------------------------------------------- */
/* Request logging                                                            */
/* -------------------------------------------------------------------------- */
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

/* -------------------------------------------------------------------------- */
/* Static uploads                                                             */
/* -------------------------------------------------------------------------- */
// Waste images are served directly: GET /uploads/<filename>
app.use(
  '/uploads',
  express.static(env.UPLOAD_PATH, {
    maxAge: '7d',
    fallthrough: true,
    setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
  })
);

/* -------------------------------------------------------------------------- */
/* Global rate limit                                                          */
/* -------------------------------------------------------------------------- */
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600, // generous: a single dashboard page issues several parallel calls
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please try again shortly.' },
  })
);

/* -------------------------------------------------------------------------- */
/* API routes                                                                 */
/* -------------------------------------------------------------------------- */
app.use('/api', apiRoutes);

/* -------------------------------------------------------------------------- */
/* Service metadata                                                           */
/* -------------------------------------------------------------------------- */
app.get('/', (req, res) => {
  res.json({
    success: true,
    name: 'Smart Waste Management System API',
    version: '1.0.0',
    documentation: '/api/health',
    endpoints: {
      auth: '/api/auth',
      complaints: '/api/complaints',
      admin: '/api/admin',
      workers: '/api/workers',
      notifications: '/api/notifications',
      ai: '/api/ai',
    },
  });
});

/* -------------------------------------------------------------------------- */
/* Error handling (must be last)                                              */
/* -------------------------------------------------------------------------- */
app.use(notFound);
app.use(errorHandler);

/* -------------------------------------------------------------------------- */
/* Bootstrap                                                                  */
/* -------------------------------------------------------------------------- */
const startServer = async () => {
  // Surface configuration problems early instead of failing mysteriously later.
  const problems = env.validate();
  problems.forEach((problem) => console.warn(`[config] WARNING: ${problem}`));

  try {
    await connectDB();
  } catch (error) {
    console.error('[server] Fatal: unable to reach MongoDB. Check MONGO_URI.');
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    /* eslint-disable no-console */
    console.log('');
    console.log('  ╔══════════════════════════════════════════════════════════╗');
    console.log('  ║   Smart Waste Management System - API Server              ║');
    console.log('  ╠══════════════════════════════════════════════════════════╣');
    console.log(`  ║   Mode        : ${env.NODE_ENV.padEnd(41)}║`);
    console.log(`  ║   Port        : ${String(env.PORT).padEnd(41)}║`);
    console.log(`  ║   API base    : ${`http://localhost:${env.PORT}/api`.padEnd(41)}║`);
    console.log(`  ║   Health      : ${`http://localhost:${env.PORT}/api/health`.padEnd(41)}║`);
    console.log(`  ║   Uploads     : ${env.UPLOAD_PATH.slice(-41).padEnd(41)}║`);
    console.log(`  ║   Client URL  : ${env.CLIENT_URL.slice(-41).padEnd(41)}║`);
    console.log('  ╚══════════════════════════════════════════════════════════╝');
    console.log('');
    /* eslint-enable no-console */
  });

  // Preload the TensorFlow model in the background so the first citizen upload
  // is not penalised by the (multi-second) cold model load.
  warmupClassifier()
    .then((info) => console.log(`[ai] Verification engine: ${info.engine}${info.error ? ` (${info.error})` : ''}`))
    .catch(() => {});

  /* --------------------------- Process safety ---------------------------- */
  const shutdown = (signal) => {
    console.log(`\n[server] ${signal} received - shutting down gracefully.`);
    server.close(() => {
      console.log('[server] HTTP server closed.');
      process.exit(0);
    });
    // Force-exit if connections refuse to drain.
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    console.error('[server] Unhandled promise rejection:', reason);
  });
  process.on('uncaughtException', (error) => {
    console.error('[server] Uncaught exception:', error);
    shutdown('uncaughtException');
  });

  return server;
};

// Only start listening when executed directly (keeps the module testable).
if (require.main === module) {
  startServer();
}

module.exports = app;
module.exports.startServer = startServer;
