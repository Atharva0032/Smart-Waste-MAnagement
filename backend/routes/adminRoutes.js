/**
 * Admin routes - mounted at /api/admin
 * Every route behind this router requires an authenticated administrator.
 */
const express = require('express');
const { body } = require('express-validator');

const {
  getStats,
  getComplaints,
  assignComplaint,
  updateComplaintStatus,
  deleteComplaint,
  getWorkers,
  createWorker,
  updateWorker,
  deleteWorker,
  getUsers,
  toggleUserStatus,
} = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { validate } = require('../middleware/validateMiddleware');
const { COMPLAINT_STATUSES } = require('../models/Complaint');

const router = express.Router();

// Gate the entire router: authentication + admin role.
router.use(protect, authorize('admin'));

/* ------------------------------ Analytics -------------------------------- */
router.get('/stats', getStats);

/* ----------------------------- Complaints -------------------------------- */
router.get('/complaints', getComplaints);

router.put(
  '/complaints/:id/assign',
  validate([body('workerId').isMongoId().withMessage('A valid worker id is required.')]),
  assignComplaint
);

router.put(
  '/complaints/:id/status',
  validate([
    body('status').isIn(COMPLAINT_STATUSES).withMessage(`Status must be one of: ${COMPLAINT_STATUSES.join(', ')}.`),
    body('note').optional({ checkFalsy: true }).trim().isLength({ max: 500 }).withMessage('Note cannot exceed 500 characters.'),
  ]),
  updateComplaintStatus
);

router.delete('/complaints/:id', deleteComplaint);

/* ------------------------------- Workers --------------------------------- */
router.get('/workers', getWorkers);

router.post(
  '/workers',
  validate([
    body('name').trim().isLength({ min: 2, max: 60 }).withMessage('Name must be between 2 and 60 characters.'),
    body('email').trim().isEmail().withMessage('Please provide a valid email address.').normalizeEmail(),
    body('password').isLength({ min: 6, max: 64 }).withMessage('Password must be between 6 and 64 characters.'),
    body('phone').optional({ checkFalsy: true }).matches(/^\+?[0-9\-\s]{7,15}$/).withMessage('Please provide a valid phone number.'),
    body('zone').optional({ checkFalsy: true }).trim().isLength({ max: 80 }).withMessage('Zone cannot exceed 80 characters.'),
  ]),
  createWorker
);

router.put('/workers/:id', updateWorker);
router.delete('/workers/:id', deleteWorker);

/* -------------------------------- Users ---------------------------------- */
router.get('/users', getUsers);
router.put('/users/:id/status', toggleUserStatus);

module.exports = router;
