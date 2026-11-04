/**
 * JWT authentication middleware.
 *
 * `protect` verifies the `Authorization: Bearer <token>` header, loads the
 * matching user and attaches it to `req.user`. `optionalAuth` never fails the
 * request - useful for public endpoints that enrich the response when a token
 * happens to be present.
 */
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const ApiError = require('../utils/apiError');

/** Pull the raw token out of the Authorization header or the `token` cookie. */
const extractToken = (req) => {
  const header = req.headers.authorization || req.headers.Authorization || '';
  if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim();
  }
  if (req.cookies && req.cookies.token) return req.cookies.token;
  return null;
};

/** Decode and verify a JWT, translating library errors into ApiError. */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, env.JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Your session has expired. Please log in again.');
    }
    throw new ApiError(401, 'Not authorized. The provided token is invalid.');
  }
};

/** Load the authenticated user document for a decoded token. */
const resolveUser = async (decoded) => {
  const user = await User.findById(decoded.id);
  if (!user) {
    throw new ApiError(401, 'Not authorized. The account linked to this token no longer exists.');
  }
  if (!user.isActive) {
    throw new ApiError(403, 'Your account has been deactivated. Contact the municipal administrator.');
  }
  return user;
};

/** Hard gate: 401/403 when the request is not authenticated. */
const protect = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new ApiError(401, 'Not authorized. Please log in to continue.');
    }
    const decoded = verifyToken(token);
    req.user = await resolveUser(decoded);
    req.userId = req.user._id;
    return next();
  } catch (error) {
    return next(error);
  }
};

/** Soft gate: attaches `req.user` when a valid token exists, never throws. */
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) return next();
    const decoded = verifyToken(token);
    req.user = await resolveUser(decoded);
    req.userId = req.user._id;
    return next();
  } catch (error) {
    // Public endpoints must keep working even with a stale token.
    return next();
  }
};

module.exports = { protect, optionalAuth, extractToken };
