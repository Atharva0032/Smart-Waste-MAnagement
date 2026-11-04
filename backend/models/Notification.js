/**
 * Notification model - in-app notification feed plus an audit trail of the
 * emails the platform attempted to send.
 */
const mongoose = require('mongoose');

/** Notification categories, used by the UI to pick an icon / colour. */
const NOTIFICATION_TYPES = ['complaint_created', 'complaint_assigned', 'status_update', 'resolved', 'rejected', 'system'];

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A notification must have a recipient'],
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      default: 'system',
      index: true,
    },
    /** Deep link inside the SPA, e.g. `/complaints/66f...`. */
    link: { type: String, trim: true, default: '' },
    /** Related complaint, when applicable. */
    complaint: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', default: null },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
    /** Delivery state of the companion email (if one was sent). */
    email: {
      sent: { type: Boolean, default: false },
      error: { type: String, default: '' },
      sentAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

// The bell dropdown always reads "my newest notifications".
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });

/** Mark as read and stamp the time. */
notificationSchema.methods.markRead = function markRead() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Notification', notificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
