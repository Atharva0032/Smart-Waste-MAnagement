/**
 * Centralised environment configuration.
 *
 * Every module in the application reads configuration from here instead of
 * touching `process.env` directly, so defaults, parsing and validation live in
 * exactly one place.
 */
const path = require('path');

// Load `.env` from the backend root regardless of the process working directory.
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

/** Parse a boolean-ish env value with a fallback. */
const toBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

/** Parse a numeric env value with a fallback. */
const toNum = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** Parse a comma separated env value into a trimmed, non-empty array. */
const toList = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const backendRoot = path.resolve(__dirname, '..');

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: toNum(process.env.PORT, 5000),

  // Database
  MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart_waste_db',

  // Auth
  JWT_SECRET: process.env.JWT_SECRET || 'swms_development_only_secret_change_me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  BCRYPT_SALT_ROUNDS: toNum(process.env.BCRYPT_SALT_ROUNDS, 10),

  // CORS - the first CLIENT_URL is treated as the canonical origin.
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  CLIENT_URLS: toList(process.env.CLIENT_URLS) || ['http://localhost:5173'],

  // Uploads
  MAX_FILE_UPLOAD_MB: toNum(process.env.MAX_FILE_UPLOAD_MB, 5),
  UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',

  // AI
  AI_VERIFY_ENABLED: toBool(process.env.AI_VERIFY_ENABLED, true),
  AI_MIN_CONFIDENCE: toNum(process.env.AI_MIN_CONFIDENCE, 60),
  AI_REJECT_INVALID: toBool(process.env.AI_REJECT_INVALID, false),

  // Mail
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: toNum(process.env.SMTP_PORT, 587),
  SMTP_SECURE: toBool(process.env.SMTP_SECURE, false),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  MAIL_FROM: process.env.MAIL_FROM || 'Smart Waste Management System <no-reply@swms.gov>',

  // Absolute paths
  BACKEND_ROOT: backendRoot,
  UPLOAD_PATH: path.resolve(backendRoot, process.env.UPLOAD_DIR || 'uploads'),
};

/**
 * Resolve the list of allowed CORS origins.
 * In development every localhost origin is permitted to keep Vite ports flexible.
 */
env.allowedOrigins = () => {
  const origins = new Set([env.CLIENT_URL, ...env.CLIENT_URLS].filter(Boolean));
  return Array.from(origins);
};

/**
 * Fail fast on obviously insecure production configuration.
 * @returns {string[]} list of human readable problems (empty when healthy)
 */
env.validate = () => {
  const problems = [];
  const isProd = env.NODE_ENV === 'production';

  if (!env.MONGO_URI) problems.push('MONGO_URI is not configured.');
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
    problems.push('JWT_SECRET must be at least 32 characters long.');
  }
  if (isProd && env.JWT_SECRET.includes('development_only')) {
    problems.push('JWT_SECRET still uses the development default - set a real secret before deploying.');
  }
  if (isProd && !env.SMTP_HOST) {
    problems.push('SMTP_HOST is not configured - email notifications will only be logged.');
  }
  return problems;
};

module.exports = env;
