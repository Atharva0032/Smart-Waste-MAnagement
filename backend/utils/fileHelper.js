/**
 * Helpers for working with files stored in the local `uploads/` directory.
 * Uploaded images are served publicly at `/uploads/<filename>`.
 */
const fs = require('fs');
const path = require('path');
const env = require('../config/env');

/** Ensure the upload directory exists (called once during server bootstrap). */
const ensureUploadDir = () => {
  if (!fs.existsSync(env.UPLOAD_PATH)) {
    fs.mkdirSync(env.UPLOAD_PATH, { recursive: true });
    console.log(`[uploads] Created directory ${env.UPLOAD_PATH}`);
  }
};

/**
 * Convert a Multer file into the public, relative URL persisted in MongoDB.
 * @param {Express.Multer.File|undefined} file
 * @returns {string} e.g. `/uploads/1700000000000-482913-pile.jpg` or ''
 */
const toPublicPath = (file) => (file ? `/uploads/${file.filename}` : '');

/**
 * Delete an uploaded file from disk without throwing when it is already gone.
 * Only paths inside the upload directory are ever touched, which prevents
 * path-traversal deletion of arbitrary files.
 * @param {string} publicPath relative path such as `/uploads/abc.jpg`
 */
const removeUploadFile = (publicPath) => {
  if (!publicPath || typeof publicPath !== 'string') return;
  // Ignore remote URLs (e.g. when a cloud storage driver is used instead).
  if (/^https?:\/\//i.test(publicPath)) return;

  const filename = path.basename(publicPath);
  const absolute = path.join(env.UPLOAD_PATH, filename);

  // Defensive check: the resolved file must stay inside the upload directory.
  if (!absolute.startsWith(env.UPLOAD_PATH)) return;

  fs.promises.unlink(absolute).catch((err) => {
    if (err.code !== 'ENOENT') {
      console.warn(`[uploads] Could not delete ${filename}:`, err.message);
    }
  });
};

/** Build an absolute URL for an uploaded file (used inside emails). */
const toAbsoluteUrl = (publicPath) => {
  if (!publicPath) return '';
  if (/^https?:\/\//i.test(publicPath)) return publicPath;
  return `${env.CLIENT_URL.replace(/\/$/, '')}${publicPath}`;
};

module.exports = { ensureUploadDir, toPublicPath, removeUploadFile, toAbsoluteUrl };
