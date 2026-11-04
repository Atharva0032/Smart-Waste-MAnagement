/**
 * express-validator integration.
 *
 * Usage:
 *   const { body } = require('express-validator');
 *   router.post('/', validate([body('email').isEmail()]), controller);
 *
 * `validate` returns an ARRAY of middlewares which Express flattens into the
 * route handler chain: the validation chains run first (each calling `next()`
 * and recording failures on the request), then a final middleware converts the
 * collected failures into a 400 response shaped as `[{ field, message }]` -
 * exactly what the React forms render underneath each input.
 */
const { validationResult } = require('express-validator');
const ApiError = require('../utils/apiError');

/**
 * @param {Array<import('express-validator').ValidationChain>} validations
 * @returns {Array<import('express').RequestHandler>} handler chain
 */
const validate = (validations = []) => [
  ...validations,
  (req, res, next) => {
    const result = validationResult(req);

    if (result.isEmpty()) return next();

    const errors = result.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
    }));

    return next(new ApiError(400, errors[0]?.message || 'Validation failed.', errors));
  },
];

/**
 * Normalise a complaint location coming from a multipart form.
 * Multipart values are always strings, so numbers must be coerced explicitly
 * before express-validator's numeric rules inspect them.
 */
const sanitizeComplaintBody = (req, res, next) => {
  const body = req.body || {};

  const toNumber = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  req.body.latitude = toNumber(body.latitude);
  req.body.longitude = toNumber(body.longitude);
  if (body.aiConfidence !== undefined && body.aiConfidence !== '') {
    req.body.aiConfidence = toNumber(body.aiConfidence);
  }

  ['wasteType', 'description', 'address', 'area', 'priority', 'aiLabel', 'phone'].forEach((key) => {
    if (typeof body[key] === 'string') req.body[key] = body[key].trim();
  });

  return next();
};

module.exports = { validate, sanitizeComplaintBody };
