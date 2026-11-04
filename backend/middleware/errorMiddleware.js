/**
 * Central error handling.
 *
 * `notFound` turns unmatched routes into a 404 ApiError and `errorHandler`
 * converts every thrown error into a single, predictable JSON envelope:
 *   { success: false, message: string, errors?: [{field, message}], stack?: string }
 */
const multer = require('multer');
const env = require('../config/env');
const ApiError = require('../utils/apiError');

/** 404 for unknown routes. */
const notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

/* eslint-disable no-unused-vars */
/**
 * Express error middleware (must keep the 4-argument signature).
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details;

  // --- Mongoose: invalid ObjectId / bad cast -------------------------------
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for "${err.path}".`;
  }

  // --- Mongoose: schema validation ----------------------------------------
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed. Please check the submitted data.';
    details = Object.values(err.errors || {}).map((e) => ({ field: e.path, message: e.message }));
  }

  // --- Mongo: duplicate key -----------------------------------------------
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {}).join(', ') || 'field';
    message = `A record with that ${field} already exists.`;
  }

  // --- Multer -------------------------------------------------------------
  if (err instanceof multer.MulterError) {
    statusCode = 400;
    message =
      err.code === 'LIMIT_FILE_SIZE'
        ? `The uploaded image is too large. Maximum allowed size is ${env.MAX_FILE_UPLOAD_MB} MB.`
        : `Upload failed: ${err.message}`;
  }

  // --- JWT ----------------------------------------------------------------
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Not authorized. The provided token is invalid.';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Your session has expired. Please log in again.';
  }

  // --- Body parser --------------------------------------------------------
  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Malformed JSON body.';
  }

  if (statusCode >= 500) {
    console.error('[error]', req.method, req.originalUrl, '-', err.message);
    if (env.NODE_ENV !== 'production') console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(details ? { errors: details } : {}),
    ...(env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
};

module.exports = { notFound, errorHandler };
