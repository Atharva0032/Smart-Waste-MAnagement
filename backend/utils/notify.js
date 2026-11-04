/**
 * Notification service.
 *
 * Combines the two notification channels the platform uses:
 *   1. In-app notifications persisted in MongoDB (bell dropdown)
 *   2. Transactional email via `sendEmail`
 *
 * Every helper is fire-and-forget safe: a failure to notify must never break
 * the business operation that triggered it.
 */
const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendEmail, templates } = require('./sendEmail');
const { toAbsoluteUrl } = require('./fileHelper');

/**
 * Persist an in-app notification and optionally send a companion email.
 *
 * @param {object} options
 * @param {string} options.recipient recipient User id
 * @param {string} options.title short headline
 * @param {string} options.message body text
 * @param {string} [options.type] one of NOTIFICATION_TYPES
 * @param {string} [options.link] in-app deep link
 * @param {string} [options.complaint] related complaint id
 * @param {object} [options.emailTemplate] `{ subject, html }` to email the recipient
 */
const createNotification = async ({
  recipient,
  title,
  message,
  type = 'system',
  link = '',
  complaint = null,
  emailTemplate = null,
}) => {
  try {
    if (!recipient) return null;

    const notification = await Notification.create({
      recipient,
      title,
      message,
      type,
      link,
      complaint,
    });

    if (emailTemplate) {
      // Look up the address here so callers can stay terse.
      const user = await User.findById(recipient).select('name email');
      if (user?.email) {
        const result = await sendEmail({ to: user.email, subject: emailTemplate.subject, html: emailTemplate.html });
        notification.email = {
          sent: Boolean(result.sent),
          error: result.error || '',
          sentAt: result.sent ? new Date() : null,
        };
        await notification.save();
      }
    }

    return notification;
  } catch (error) {
    console.error('[notify] Failed to create notification:', error.message);
    return null;
  }
};

/**
 * Fan-out helper: notify every active admin.
 * @param {object} options same shape as createNotification minus `recipient`
 */
const notifyAdmins = async ({ title, message, type = 'complaint_created', link = '', complaint = null, emailTemplate = null }) => {
  try {
    const admins = await User.find({ role: 'admin', isActive: true }).select('_id email');
    if (!admins.length) return [];

    return Promise.all(
      admins.map((admin) =>
        createNotification({
          recipient: admin._id,
          title,
          message,
          type,
          link,
          complaint,
          // Only send one email per admin; the template is the same for all.
          emailTemplate,
        })
      )
    );
  } catch (error) {
    console.error('[notify] Failed to notify admins:', error.message);
    return [];
  }
};

/**
 * Create the in-app notification (and email) for a complaint status transition.
 *
 * @param {object} options
 * @param {import('../models/Complaint')} options.complaint populated complaint
 * @param {string} options.status new status
 * @param {string} [options.note] optional admin/worker note
 */
const notifyStatusChange = async ({ complaint, status, note = '' }) => {
  if (!complaint) return null;

  const STATUS_COPY = {
    pending: 'Your report is pending triage.',
    assigned: 'A field worker has been assigned to your report.',
    in_progress: 'A field worker has started working on your report.',
    resolved: 'Your report has been resolved. Thank you for helping keep the city clean!',
    rejected: 'Your report was reviewed and marked as invalid.',
  };

  const ownerId = complaint.user?._id || complaint.user;
  if (ownerId) {
    await createNotification({
      recipient: ownerId,
      title: `Complaint ${complaint.trackingId} - ${status.replace('_', ' ')}`,
      message: note || STATUS_COPY[status] || 'Your complaint status was updated.',
      type: status === 'resolved' ? 'resolved' : status === 'rejected' ? 'rejected' : 'status_update',
      link: `/complaints/${complaint._id}`,
      complaint: complaint._id,
      emailTemplate: templates.statusChanged({ complaint, status, note }),
    });
  }

  return true;
};

/** Public, absolute image URL helper re-exported for controllers. */
module.exports = {
  createNotification,
  notifyAdmins,
  notifyStatusChange,
  toAbsoluteUrl,
};
