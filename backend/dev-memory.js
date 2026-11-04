/**
 * Zero-setup development launcher (in-memory database)
 * ---------------------------------------------------------------------------
 * Boots an ephemeral MongoDB instance via `mongodb-memory-server`, seeds the
 * demo accounts and sample complaints, then starts the real API against it.
 *
 *   npm run dev:memory            # start + seed
 *   npm run dev:memory -- --no-seed
 *
 * Everything is discarded when the process exits, so this is a local
 * development convenience only - never a production database.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');

const SHOULD_SEED = !process.argv.includes('--no-seed');

(async () => {
  const mongo = await MongoMemoryServer.create({
    instance: { dbName: 'smart_waste_db' },
  });
  const uri = mongo.getUri('smart_waste_db');

  // Set before any local module is required: `config/env` loads dotenv, which
  // does not override variables that already exist in process.env.
  process.env.MONGO_URI = uri;

  console.log(`[dev-memory] In-memory MongoDB ready -> ${uri}`);
  console.log('[dev-memory] Data is discarded when this process exits.\n');

  const { disconnectDB } = require('./config/db');

  if (SHOULD_SEED) {
    const { run: seed } = require('./seed');
    await seed();
  }

  const { startServer } = require('./server');
  await startServer();

  // `server.js` already handles SIGINT/SIGTERM for the HTTP server; this adds
  // the extra step of stopping the in-memory database.
  const shutdown = async () => {
    await mongo.stop().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Ensure the connection is closed if the process ends unexpectedly.
  process.on('exit', () => {
    if (disconnectDB) {
      // Best-effort; the process is already exiting.
      require('mongoose').connection.close().catch(() => {});
    }
  });
})().catch((error) => {
  console.error('[dev-memory] Failed to start:', error.message);
  if (process.env.NODE_ENV !== 'production') console.error(error.stack);
  process.exit(1);
});
