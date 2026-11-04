/**
 * Authentication controller - registration, login, profile.
 */
const User = require('../models/User');
const Worker = require('../models/Worker');
const Admin = require('../models/Admin');
const ApiError = require('../utils/apiError');
const { buildAuthResponse } = require('../utils/generateToken');

/**
 * @route   POST /api/auth/register
 * @desc    Register a citizen or field worker account
 * @access  Public
 *
 * NOTE: administrator accounts are intentionally NOT self-service. Promoting a
 * public signup to 'admin' would be a privilege-escalation hole, so admin
 * accounts are only created by the seed script or by another admin.
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, phone = '', role, zone = '', address = '' } = req.body;

    const existing = await User.findOne({ email: String(email).toLowerCase() });
    if (existing) {
      throw new ApiError(409, 'An account with this email address already exists.');
    }

    // Only 'user' and 'worker' can be self-registered.
    const safeRole = role === 'worker' ? 'worker' : 'user';

    const user = await User.create({
      name,
      email,
      password,
      phone,
      role: safeRole,
      zone: safeRole === 'worker' ? zone : '',
      address,
      lastLoginAt: new Date(),
    });

    // Every field worker gets an operational profile document.
    if (safeRole === 'worker') {
      await Worker.create({
        user: user._id,
        zone: zone || '',
        employeeId: `W-${String(user._id).slice(-6).toUpperCase()}`,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      ...buildAuthResponse(user),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate with email + password and issue a JWT
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // `password` is `select: false`, so it must be requested explicitly.
    const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');

    // Same generic message for "no such user" and "wrong password" so the
    // endpoint cannot be used to enumerate registered email addresses.
    if (!user) {
      throw new ApiError(401, 'Invalid email or password.');
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      throw new ApiError(401, 'Invalid email or password.');
    }

    if (!user.isActive) {
      throw new ApiError(403, 'Your account has been deactivated. Please contact the municipal administrator.');
    }

    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    // Keep the admin profile audit trail fresh without blocking the response.
    if (user.role === 'admin') {
      Admin.findOneAndUpdate({ user: user._id }, { lastActionAt: new Date() }).catch(() => {});
    }

    return res.json({
      success: true,
      message: 'Logged in successfully.',
      ...buildAuthResponse(user),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @route   GET /api/auth/me
 * @desc    Return the currently authenticated profile
 * @access  Private
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) throw new ApiError(404, 'Account not found.');

    // Attach the role specific profile so the UI can show zone / department.
    const payload = { user: user.toJSON() };

    if (user.role === 'worker') {
      payload.profile = await Worker.findOne({ user: user._id });
    } else if (user.role === 'admin') {
      payload.profile = await Admin.findOne({ user: user._id });
    }

    return res.json({ success: true, ...payload });
  } catch (error) {
    return next(error);
  }
};

/**
 * @route   PUT /api/auth/profile
 * @desc    Update the authenticated user's own profile
 * @access  Private
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, address, avatar, zone } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) throw new ApiError(404, 'Account not found.');

    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (avatar !== undefined) user.avatar = avatar;

    // Only field workers may change their operating zone.
    if (zone !== undefined && user.role === 'worker') {
      user.zone = zone;
      await Worker.findOneAndUpdate({ user: user._id }, { zone }, { upsert: false });
    }

    await user.save();

    return res.json({
      success: true,
      message: 'Profile updated successfully.',
      user: user.toJSON(),
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { register, login, getMe, updateProfile };
