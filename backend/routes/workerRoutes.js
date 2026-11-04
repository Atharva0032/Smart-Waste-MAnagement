/**
 * Worker routes - mounted at /api/workers
 * Every route behind this router requires an authenticated field worker.
 */
const express = require('express');
const { body } = require('express-validator');

const { getAssigned, getComplaint, updateStatus, resolveComplaint, getProfile } = require('../controllers/workerController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { validate } = require('../middleware/validateMiddleware');
const { uploadCompletionImage } = require('../middleware/uploadMiddleware');

const router = express.Router();

router.use(protect, authorize('worker'));

/** Complaints assigned to the authenticated worker. */
router.get('/assigned', getAssigned);

/** Operational profile + live workload counters. */
router.get('/profile', getProfile);

/**
 * Close a complaint: requires a completion photo (multipart) and a note.
 * Declared before /:id so "assigned" and "profile" are never parsed as ids.
 */
router.put(
  '/complaints/:id/resolve',
  uploadCompletionImage,
  validate([
    body('note').trim().isLength({ min: 10, max: 500 }).withMessage('Resolution note must be between 10 and 500 characters.'),
  ]),
  resolveComplaint
);

router.put(
  '/complaints/:id/status',
  validate([
    body('status').isIn(['in_progress', 'resolved']).withMessage('Workers may only set the status to in_progress or resolved.'),
    body('note').optional({ checkFalsy: true }).trim().isLength({ max: 500 }).withMessage('Note cannot exceed 500 characters.'),
  ]),
  updateStatus
);

router.get('/complaints/:id', getComplaint);

module.exports = router;
