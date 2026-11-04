/**
 * Authentication routes - mounted at /api/auth
 */
const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');

const { register, login, getMe, updateProfile } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validateMiddleware');

const router = express.Router();

/**
 * Brute-force protection for the credential endpoints.
 * 20 attempts per IP per 15 minutes is generous for humans and hostile to scripts.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts. Please try again in a few minutes.' },
});

/** Shared validation rules. */
const registerRules = [
  body('name').trim().isLength({ min: 2, max: 60 }).withMessage('Name must be between 2 and 60 characters.'),
  body('email').trim().isEmail().withMessage('Please provide a valid email address.').normalizeEmail(),
  body('password')
    .isLength({ min: 6, max: 64 })
    .withMessage('Password must be between 6 and 64 characters.'),
  body('phone')
    .optional({ checkFalsy: true })
    .matches(/^\+?[0-9\-\s]{7,15}$/)
    .withMessage('Please provide a valid phone number.'),
  body('role').optional().isIn(['user', 'worker']).withMessage('Role must be either "user" or "worker".'),
];

const loginRules = [
  body('email').trim().isEmail().withMessage('Please provide a valid email address.').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required.'),
];

const profileRules = [
  body('name').optional().trim().isLength({ min: 2, max: 60 }).withMessage('Name must be between 2 and 60 characters.'),
  body('phone')
    .optional({ checkFalsy: true })
    .matches(/^\+?[0-9\-\s]{7,15}$/)
    .withMessage('Please provide a valid phone number.'),
];

router.post('/register', authLimiter, validate(registerRules), register);
router.post('/login', authLimiter, validate(loginRules), login);
router.get('/me', protect, getMe);
router.put('/profile', protect, validate(profileRules), updateProfile);

module.exports = router;
