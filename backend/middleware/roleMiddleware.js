/**
 * Role based access control.
 *
 * Usage:
 *   router.get('/admin/stats', protect, authorize('admin'), handler)
 */
const ApiError = require('../utils/apiError');

/**
 * @param {...string} roles roles allowed to reach the route
 * @returns {import('express').RequestHandler}
 */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return next(new ApiError(401, 'Not authorized. Please log in to continue.'));
  }
  if (!roles.length || roles.includes(req.user.role)) {
    return next();
  }
  return next(
    new ApiError(403, `Access denied. This action requires the ${roles.join(' or ')} role.`)
  );
};

/** Convenience guards that read a little better in route files. */
const adminOnly = authorize('admin');
const workerOnly = authorize('worker');
const citizenOnly = authorize('user');

/**
 * Allow the owner of a resource OR an administrator.
 * The resource loader must set `req.resourceOwnerId` (or pass a getter).
 * @param {(req: import('express').Request) => string} getOwnerId
 */
const ownerOrAdmin = (getOwnerId) => (req, res, next) => {
  if (!req.user) return next(new ApiError(401, 'Not authorized.'));
  if (req.user.role === 'admin') return next();
  const ownerId = typeof getOwnerId === 'function' ? getOwnerId(req) : getOwnerId;
  if (String(ownerId) === String(req.user._id)) return next();
  return next(new ApiError(403, 'Access denied. You can only access your own resources.'));
};

module.exports = { authorize, adminOnly, workerOnly, citizenOnly, ownerOrAdmin };
