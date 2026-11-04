/**
 * JWT helpers.
 */
const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Sign an access token for a user.
 * The payload intentionally stays small: only the id and role are encoded, so
 * role changes take effect as soon as the client refreshes the profile.
 *
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {string} [role]
 * @returns {string} signed JWT
 */
const generateToken = (userId, role) =>
  jwt.sign({ id: String(userId), ...(role ? { role } : {}) }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });

/**
 * Verify a token, returning the decoded payload or `null` when invalid.
 * @param {string} token
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

/**
 * Build the auth payload returned by register / login.
 * @param {import('../models/User')} user
 */
const buildAuthResponse = (user) => ({
  token: generateToken(user._id, user.role),
  user: user.toJSON ? user.toJSON() : user,
});

module.exports = { generateToken, verifyToken, buildAuthResponse };
