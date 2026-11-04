/**
 * Admin profile model.
 *
 * Auth credentials live on `User` (role = 'admin'). This document describes the
 * municipal officer: their department, designation and fine grained permissions.
 */
const mongoose = require('mongoose');

/** Granular capabilities an admin profile may hold. */
const ADMIN_PERMISSIONS = [
  'complaints:read',
  'complaints:assign',
  'complaints:update',
  'complaints:delete',
  'workers:manage',
  'users:read',
  'analytics:read',
];

const adminSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'An admin profile must be linked to a user account'],
      unique: true,
      index: true,
    },
    employeeId: { type: String, trim: true, uppercase: true, default: '' },
    department: { type: String, trim: true, default: 'Municipal Corporation' },
    designation: { type: String, trim: true, default: 'Waste Management Officer' },
    /** Zone the officer supervises; empty means the whole municipality. */
    jurisdiction: { type: String, trim: true, default: 'All Zones' },
    /** `super` admins bypass the permission list. */
    level: {
      type: String,
      enum: ['super', 'officer', 'viewer'],
      default: 'officer',
    },
    permissions: {
      type: [String],
      enum: ADMIN_PERMISSIONS,
      default: ADMIN_PERMISSIONS,
    },
    lastActionAt: { type: Date, default: null },
  },
  { timestamps: true }
);

adminSchema.index({ createdAt: -1 });

/** Check a capability, honouring the `super` level override. */
adminSchema.methods.can = function can(permission) {
  if (this.level === 'super') return true;
  return this.permissions.includes(permission);
};

module.exports = mongoose.model('Admin', adminSchema);
module.exports.ADMIN_PERMISSIONS = ADMIN_PERMISSIONS;
