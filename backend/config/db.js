/**
 * MongoDB connection helper (Mongoose).
 *
 * Usage:
 *   const connectDB = require('./config/db');
 *   await connectDB();
 */
const mongoose = require('mongoose');
const env = require('./env');

// Fail fast instead of buffering queries forever when Mongo is unreachable.
mongoose.set('strictQuery', true);

let isConnected = false;

/**
 * Connect to MongoDB. Safe to call multiple times - subsequent calls resolve
 * immediately when a connection is already established.
 * @returns {Promise<typeof mongoose>}
 */
const connectDB = async () => {
  if (isConnected || mongoose.connection.readyState === 1) {
    return mongoose;
  }

  try {
    const conn = await mongoose.connect(env.MONGO_URI, {
      // Keep the connection pool small enough for free-tier Atlas clusters.
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    // Never print credentials: only host and database name.
    console.log(`[db] MongoDB connected -> ${conn.connection.host}/${conn.connection.name}`);

    mongoose.connection.on('disconnected', () => {
      isConnected = false;
      console.warn('[db] MongoDB disconnected.');
    });
    mongoose.connection.on('error', (err) => {
      console.error('[db] MongoDB connection error:', err.message);
    });

    return conn;
  } catch (error) {
    console.error('[db] Could not connect to MongoDB:', error.message);
    // Rethrow so the caller (server bootstrap / seed script) can exit cleanly.
    throw error;
  }
};

/** Gracefully close the connection (used by scripts and tests). */
const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    isConnected = false;
  }
};

module.exports = connectDB;
module.exports.connectDB = connectDB;
module.exports.disconnectDB = disconnectDB;
