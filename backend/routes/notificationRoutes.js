/**
 * Notification routes - mounted at /api/notifications
 */
const express = require('express');

const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Every notification route is scoped to the authenticated user.
router.use(protect);

// Static route first so "read-all" is not interpreted as an id.
router.put('/read-all', markAllAsRead);
router.get('/', getNotifications);
router.put('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

module.exports = router;
