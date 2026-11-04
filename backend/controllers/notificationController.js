/**
 * Notification controller - the in-app notification feed.
 */
const Notification = require('../models/Notification');
const ApiError = require('../utils/apiError');

/**
 * @route   GET /api/notifications
 * @desc    Latest notifications for the authenticated user plus the unread count
 * @access  Private (any role)
 */
const getNotifications = async (req, res, next) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ recipient: req.user._id }).sort({ createdAt: -1 }).limit(limit),
      Notification.countDocuments({ recipient: req.user._id, isRead: false }),
    ]);

    return res.json({ success: true, unreadCount, count: notifications.length, notifications });
  } catch (error) {
    return next(error);
  }
};

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Mark a single notification as read
 * @access  Private (owner)
 */
const markAsRead = async (req, res, next) => {
  try {
    // Scoping the query by `recipient` prevents reading someone else's feed.
    const notification = await Notification.findOne({ _id: req.params.id, recipient: req.user._id });
    if (!notification) throw new ApiError(404, 'Notification not found.');

    if (!notification.isRead) {
      await notification.markRead();
    }

    return res.json({ success: true, notification });
  } catch (error) {
    return next(error);
  }
};

/**
 * @route   PUT /api/notifications/read-all
 * @desc    Mark every notification of the authenticated user as read
 * @access  Private (owner)
 */
const markAllAsRead = async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    return res.json({
      success: true,
      message: 'All notifications marked as read.',
      modifiedCount: result.modifiedCount || 0,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete one notification
 * @access  Private (owner)
 */
const deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user._id,
    });
    if (!notification) throw new ApiError(404, 'Notification not found.');

    return res.json({ success: true, message: 'Notification deleted.' });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getNotifications, markAsRead, markAllAsRead, deleteNotification };
