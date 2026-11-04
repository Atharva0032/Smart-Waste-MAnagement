/**
 * Email delivery.
 *
 * Nodemailer is configured from SMTP_* environment variables. When SMTP is not
 * configured (for example on a fresh local checkout) messages are logged to the
 * console instead of throwing, so the application keeps working in development.
 */
const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter = null;

/** True when enough SMTP settings are present to attempt real delivery. */
const isEmailConfigured = () => Boolean(env.SMTP_HOST && env.SMTP_USER);

/** Lazily create and memoise the SMTP transport. */
const getTransporter = () => {
  if (!isEmailConfigured()) return null;
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE, // true for port 465, false for 587/25
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    // Avoid hanging requests on a misconfigured SMTP host.
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  return transporter;
};

/**
 * Send an email. Never throws: failures are logged and returned.
 * @param {{to: string, subject: string, html?: string, text?: string}} options
 * @returns {Promise<{sent: boolean, skipped?: boolean, messageId?: string, error?: string}>}
 */
const sendEmail = async ({ to, subject, html, text }) => {
  if (!to) return { sent: false, error: 'No recipient address provided' };

  const transport = getTransporter();
  if (!transport) {
    console.log(`[mail:disabled] would send "${subject}" to ${to}`);
    return { sent: false, skipped: true };
  }

  try {
    const info = await transport.sendMail({
      from: env.MAIL_FROM,
      to,
      subject,
      text: text || undefined,
      html: html || undefined,
    });
    console.log(`[mail:sent] "${subject}" -> ${to} (${info.messageId})`);
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[mail:error] "${subject}" -> ${to}:`, error.message);
    return { sent: false, error: error.message };
  }
};

/* -------------------------------------------------------------------------- */
/* HTML templates                                                             */
/* -------------------------------------------------------------------------- */

const STATUS_LABEL = {
  pending: 'Pending',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  rejected: 'Rejected',
};

/** Shared, table-based responsive email shell (works in every mail client). */
const layout = ({ heading, intro, rows = [], cta }) => `
  <div style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f1f5f9;padding:24px">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
      <div style="background:linear-gradient(135deg,#0d9488,#059669);padding:22px 28px">
        <h1 style="margin:0;font-size:18px;color:#ffffff;letter-spacing:.3px">Smart Waste Management System</h1>
        <p style="margin:4px 0 0;font-size:12px;color:#ccfbf1">Municipal Grievance &amp; Resolution Platform</p>
      </div>
      <div style="padding:28px">
        <h2 style="margin:0 0 12px;font-size:17px;color:#0f172a">${heading}</h2>
        <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#475569">${intro}</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          ${rows
            .map(
              (row) => `<tr>
                <td style="padding:9px 12px;background:#f8fafc;border:1px solid #e2e8f0;color:#64748b;width:38%">${row.label}</td>
                <td style="padding:9px 12px;border:1px solid #e2e8f0;color:#0f172a;font-weight:600">${row.value ?? '—'}</td>
              </tr>`
            )
            .join('')}
        </table>
        ${
          cta
            ? `<div style="margin-top:22px"><a href="${cta.url}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:14px;font-weight:600">${cta.label}</a></div>`
            : ''
        }
      </div>
      <div style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8">
        This is an automated message from your municipal waste management portal. Please do not reply.
      </div>
    </div>
  </div>`;

const templates = {
  /** Sent to every admin when a citizen files a new complaint. */
  complaintCreated: ({ complaint, reporter }) => ({
    subject: `New waste report ${complaint.trackingId} - ${complaint.wasteType}`,
    html: layout({
      heading: 'A new waste report needs triage',
      intro: `A citizen has reported a waste issue that requires assignment to a field worker.`,
      rows: [
        { label: 'Tracking ID', value: complaint.trackingId },
        { label: 'Waste Type', value: complaint.wasteType },
        { label: 'Area', value: complaint.location?.area || 'Not specified' },
        { label: 'Address', value: complaint.location?.address || 'Not specified' },
        { label: 'Reported By', value: reporter?.name || 'Citizen' },
        { label: 'Description', value: complaint.description },
      ],
      cta: { label: 'Open complaint', url: `${env.CLIENT_URL}/admin/complaints` },
    }),
  }),

  /** Sent to the citizen whenever the status of their complaint changes. */
  statusChanged: ({ complaint, status, note }) => ({
    subject: `Complaint ${complaint.trackingId} is now ${STATUS_LABEL[status] || status}`,
    html: layout({
      heading: `Your complaint is now ${STATUS_LABEL[status] || status}`,
      intro: `The municipal team has updated the status of your waste report.`,
      rows: [
        { label: 'Tracking ID', value: complaint.trackingId },
        { label: 'New Status', value: STATUS_LABEL[status] || status },
        { label: 'Area', value: complaint.location?.area || 'Not specified' },
        { label: 'Note', value: note || 'No additional note was provided.' },
      ],
      cta: { label: 'Track your complaint', url: `${env.CLIENT_URL}/complaints/${complaint._id}` },
    }),
  }),

  /** Sent to a field worker when an admin assigns a complaint to them. */
  workerAssigned: ({ complaint, worker }) => ({
    subject: `New assignment: ${complaint.trackingId}`,
    html: layout({
      heading: 'A new complaint has been assigned to you',
      intro: `Hello ${worker?.name || 'there'}, please attend to the waste report below.`,
      rows: [
        { label: 'Tracking ID', value: complaint.trackingId },
        { label: 'Waste Type', value: complaint.wasteType },
        { label: 'Priority', value: complaint.priority },
        { label: 'Area', value: complaint.location?.area || 'Not specified' },
        { label: 'Address', value: complaint.location?.address || 'Not specified' },
        { label: 'Description', value: complaint.description },
      ],
      cta: { label: 'Open assignment', url: `${env.CLIENT_URL}/worker/complaints` },
    }),
  }),
};

module.exports = sendEmail;
module.exports.sendEmail = sendEmail;
module.exports.templates = templates;
module.exports.isEmailConfigured = isEmailConfigured;
