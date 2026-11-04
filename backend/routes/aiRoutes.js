/**
 * AI routes - mounted at /api/ai
 */
const express = require('express');
const rateLimit = require('express-rate-limit');

const { verifyImage, getStatus } = require('../controllers/aiController');
const { uploadMemoryImage } = require('../middleware/uploadMiddleware');

const router = express.Router();

/**
 * Inference is CPU heavy, so this endpoint gets its own (tighter) limiter to
 * keep a single client from saturating the Node event loop.
 */
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many image verifications. Please slow down.' },
});

/** Verify an image before the citizen submits the complaint form. */
router.post('/verify', aiLimiter, uploadMemoryImage, verifyImage);

/** Diagnostic endpoint reporting which inference engine is active. */
router.get('/status', getStatus);

module.exports = router;
