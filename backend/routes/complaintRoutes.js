/**
 * Complaint routes - mounted at /api/complaints
 *
 * IMPORTANT: the static paths (/my, /track/:trackingId) are declared BEFORE the
 * dynamic /:id route, otherwise Express would treat "my" as an ObjectId.
 */
const express = require('express');
const { body } = require('express-validator');

const {
  createComplaint,
  getMyComplaints,
  getComplaint,
  trackComplaint,
  deleteComplaint,
} = require('../controllers/complaintController');
const { protect, optionalAuth } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { uploadImage } = require('../middleware/uploadMiddleware');
const { validate, sanitizeComplaintBody } = require('../middleware/validateMiddleware');
const { WASTE_TYPES, PRIORITIES } = require('../models/Complaint');

const router = express.Router();

/**
 * Validation runs AFTER multer, because multipart fields only exist once the
 * body parser used by multer has finished streaming the request.
 */
const createRules = [
  body('wasteType').isIn(WASTE_TYPES).withMessage(`Waste type must be one of: ${WASTE_TYPES.join(', ')}.`),
  body('description')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Description must be between 10 and 500 characters.'),
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('A valid latitude is required.'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('A valid longitude is required.'),
  body('priority').optional({ checkFalsy: true }).isIn(PRIORITIES).withMessage(`Priority must be one of: ${PRIORITIES.join(', ')}.`),
  body('area').optional({ checkFalsy: true }).trim().isLength({ max: 80 }).withMessage('Area cannot exceed 80 characters.'),
  body('address').optional({ checkFalsy: true }).trim().isLength({ max: 400 }).withMessage('Address cannot exceed 400 characters.'),
];

// --- Citizen endpoints -----------------------------------------------------
router.post(
  '/',
  protect,
  authorize('user'),
  uploadImage,
  sanitizeComplaintBody,
  validate(createRules),
  createComplaint
);
router.get('/my', protect, authorize('user'), getMyComplaints);

// --- Public tracker --------------------------------------------------------
// `optionalAuth` keeps the endpoint public while still recognising a logged-in
// visitor (used for future "is this mine?" UI affordances).
router.get('/track/:trackingId', optionalAuth, trackComplaint);

// --- Shared endpoints ------------------------------------------------------
router.get('/:id', protect, getComplaint);
router.delete('/:id', protect, authorize('user'), deleteComplaint);

module.exports = router;
