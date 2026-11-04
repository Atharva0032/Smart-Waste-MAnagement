/**
 * User model - the single authentication identity for every actor in the
 * system (citizen, municipal admin, field worker).
 *
 * Role specific data lives in companion profile documents:
 *   - role 'admin'  -> Admin profile  (models/Admin.js)
 *   - role 'worker' -> Worker profile (models/Worker.js)
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const env = require('../config/env');

/** Allowed account roles. `user` is the public citizen account. */
const USER_ROLES = ['user', 'admin', 'worker'];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [60, 'Name cannot exceed 60 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      // Never returned by default queries; opt-in with `.select('+password')`.
      select: false,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
      validate: {
        validator: (value) => !value || /^\+?[0-9\-\s]{7,15}$/.test(value),
        message: 'Please provide a valid phone number',
      },
    },
    role: {
      type: String,
      enum: { values: USER_ROLES, message: '`{VALUE}` is not a supported role' },
      default: 'user',
      index: true,
    },
    avatar: { type: String, default: '' },
    address: { type: String, trim: true, default: '' },
    // Used by field workers to describe their operating zone (mirrors Worker.zone).
    zone: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Helpful for admin listing screens sorted by newest accounts.
userSchema.index({ createdAt: -1 });

/** Hash the password whenever it is added or changed. */
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(env.BCRYPT_SALT_ROUNDS);
    this.password = await bcrypt.hash(this.password, salt);
    return next();
  } catch (error) {
    return next(error);
  }
});

/**
 * Compare a plaintext password with the stored hash.
 * Requires the document to have been loaded with `+password`.
 * @param {string} enteredPassword
 * @returns {Promise<boolean>}
 */
userSchema.methods.matchPassword = function matchPassword(enteredPassword) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(enteredPassword, this.password);
};

/** Two letter initials used by the dashboard avatar chips. */
userSchema.virtual('initials').get(function initials() {
  if (!this.name) return '?';
  return this.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
});

/** Strip the password hash from every serialised payload. */
userSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject({ virtuals: true });
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
module.exports.USER_ROLES = USER_ROLES;
