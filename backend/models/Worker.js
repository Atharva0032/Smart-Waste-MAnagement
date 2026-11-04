/**
 * Worker profile model.
 *
 * The credentials and display name live on `User` (role = 'worker'); this
 * document stores the operational, municipal-side attributes of the field
 * worker such as their employee id, zone, availability and workload counters.
 */
const mongoose = require('mongoose');

const workerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A worker profile must be linked to a user account'],
      unique: true,
      index: true,
    },
    employeeId: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },
    /** Municipal zone the worker is responsible for, e.g. "Zone A - North". */
    zone: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    designation: {
      type: String,
      trim: true,
      default: 'Sanitation Worker',
    },
    department: {
      type: String,
      trim: true,
      default: 'Municipal Sanitation',
    },
    /** False while the worker is on leave / unavailable for new assignments. */
    isAvailable: { type: Boolean, default: true },
    /** Denormalised counters kept up to date when assignments change. */
    totalAssigned: { type: Number, default: 0, min: 0 },
    totalResolved: { type: Number, default: 0, min: 0 },
    rating: { type: Number, default: 4.5, min: 0, max: 5 },
    notes: { type: String, trim: true, default: '', maxlength: 500 },
  },
  { timestamps: true }
);

workerSchema.index({ createdAt: -1 });

/** Completion rate in percent (0 when nothing has been assigned yet). */
workerSchema.virtual('completionRate').get(function completionRate() {
  if (!this.totalAssigned) return 0;
  return Math.round((this.totalResolved / this.totalAssigned) * 100);
});

/**
 * Increment the counters when an admin assigns or a worker completes a job.
 * Uses atomic `$inc` operators so concurrent updates cannot lose counts.
 * @param {string} workerUserId the `User._id` of the worker
 * @param {{assigned?: number, resolved?: number}} deltas
 */
workerSchema.statics.bumpCounters = async function bumpCounters(workerUserId, deltas = {}) {
  const inc = {};
  if (deltas.assigned) inc.totalAssigned = deltas.assigned;
  if (deltas.resolved) inc.totalResolved = deltas.resolved;
  if (!Object.keys(inc).length) return null;
  return this.findOneAndUpdate({ user: workerUserId }, { $inc: inc }, { new: true });
};

module.exports = mongoose.model('Worker', workerSchema);
