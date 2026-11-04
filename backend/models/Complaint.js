/**
 * Complaint model - the core domain entity.
 *
 * Lifecycle / status machine:
 *   pending      -> reported by a citizen, waiting for triage
 *   assigned     -> an admin assigned the complaint to a field worker
 *   in_progress  -> the worker started working on it
 *   resolved     -> the worker uploaded a completion photo
 *   rejected     -> an admin marked it as a false / invalid report
 */
const mongoose = require('mongoose');
const crypto = require('crypto');

/** Allowed complaint statuses (order matters: it drives the progress bar). */
const COMPLAINT_STATUSES = ['pending', 'assigned', 'in_progress', 'resolved', 'rejected'];

/** Waste categories selectable by the citizen. */
const WASTE_TYPES = ['organic', 'plastic', 'electronic', 'hazardous', 'construction', 'medical', 'other'];

/** Triage priority set by the reporting citizen and adjustable by admins. */
const PRIORITIES = ['low', 'medium', 'high'];

/** Timeline entry: one immutable step of the complaint history. */
const timelineSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: COMPLAINT_STATUSES,
      required: true,
    },
    note: { type: String, trim: true, default: '', maxlength: 500 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

/** Result of the AI image screening performed at upload time. */
const aiVerificationSchema = new mongoose.Schema(
  {
    isWaste: { type: Boolean, default: false },
    confidence: { type: Number, min: 0, max: 100, default: 0 },
    label: { type: String, trim: true, default: '' },
    model: { type: String, trim: true, default: '' },
    verifiedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

/** Geo details captured by the citizen (map picker or browser geolocation). */
const locationSchema = new mongoose.Schema(
  {
    address: { type: String, trim: true, default: '' },
    area: { type: String, trim: true, default: '' },
    latitude: {
      type: Number,
      min: [-90, 'Latitude must be between -90 and 90'],
      max: [90, 'Latitude must be between -90 and 90'],
      default: null,
    },
    longitude: {
      type: Number,
      min: [-180, 'Longitude must be between -180 and 180'],
      max: [180, 'Longitude must be between -180 and 180'],
      default: null,
    },
  },
  { _id: false }
);

const complaintSchema = new mongoose.Schema(
  {
    /** Human friendly public identifier, e.g. `SWM-4F9A2C`. */
    trackingId: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A complaint must belong to a citizen'],
      index: true,
    },
    wasteType: {
      type: String,
      enum: { values: WASTE_TYPES, message: '`{VALUE}` is not a supported waste type' },
      required: [true, 'Waste type is required'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    /** Relative public path of the reported image (`/uploads/xxx.jpg`). */
    image: {
      type: String,
      required: [true, 'A photo of the waste is required'],
    },
    /** Relative public path of the completion photo uploaded by the worker. */
    completionImage: { type: String, default: '' },
    location: { type: locationSchema, default: () => ({}) },
    status: {
      type: String,
      enum: COMPLAINT_STATUSES,
      default: 'pending',
      index: true,
    },
    priority: {
      type: String,
      enum: PRIORITIES,
      default: 'medium',
    },
    assignedWorker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    assignedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    resolutionNote: { type: String, trim: true, default: '', maxlength: 500 },
    aiVerification: { type: aiVerificationSchema, default: () => ({}) },
    timeline: { type: [timelineSchema], default: [] },
  },
  { timestamps: true }
);

// Common dashboard queries: newest first, filtered by status / area / type.
complaintSchema.index({ createdAt: -1 });
complaintSchema.index({ 'location.area': 1, status: 1 });
complaintSchema.index({ wasteType: 1, status: 1 });
// Free text search over the description and tracking id.
complaintSchema.index({ description: 'text', trackingId: 'text' });

/**
 * Generate a unique, human readable tracking id.
 * Uses crypto random bytes (2 bytes -> 4 hex chars) with a collision retry loop,
 * which is far safer than a counter or timestamp for a public identifier.
 */
complaintSchema.statics.generateTrackingId = async function generateTrackingId() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 hex chars
    const candidate = `SWM-${suffix}`;
    // eslint-disable-next-line no-await-in-loop
    const existing = await this.exists({ trackingId: candidate });
    if (!existing) return candidate;
  }
  // Extremely unlikely fallback - guarantees the document can still be created.
  return `SWM-${Date.now().toString(36).toUpperCase()}`;
};

/** Append a step to the immutable activity timeline. */
complaintSchema.methods.addTimelineEntry = function addTimelineEntry(status, note, userId) {
  this.timeline.push({ status, note: note || '', updatedBy: userId || null, timestamp: new Date() });
};

/** True when the given user id owns this complaint. */
complaintSchema.methods.isOwnedBy = function isOwnedBy(userId) {
  return String(this.user?._id || this.user) === String(userId);
};

module.exports = mongoose.model('Complaint', complaintSchema);
module.exports.COMPLAINT_STATUSES = COMPLAINT_STATUSES;
module.exports.WASTE_TYPES = WASTE_TYPES;
module.exports.PRIORITIES = PRIORITIES;
