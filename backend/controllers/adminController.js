/**
 * Admin controller - municipal command centre.
 * Dashboard analytics, complaint triage/assignment and worker management.
 */
const Complaint = require('../models/Complaint');
const { COMPLAINT_STATUSES } = require('../models/Complaint');
const User = require('../models/User');
const Worker = require('../models/Worker');
const Admin = require('../models/Admin');
const ApiError = require('../utils/apiError');
const { removeUploadFile } = require('../utils/fileHelper');
const { createNotification, notifyStatusChange } = require('../utils/notify');
const { templates } = require('../utils/sendEmail');
const { populateComplaint } = require('./complaintController');

/** Escape user supplied text before building a RegExp (prevents ReDoS / injection). */
const escapeRegex = (text = '') => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Round to one decimal place without floating point noise. */
const round1 = (value) => Math.round((Number(value) || 0) * 10) / 10;

/* ========================================================================== */
/* Dashboard analytics                                                        */
/* ========================================================================== */

/**
 * @route   GET /api/admin/stats
 * @desc    Aggregated KPIs, distributions and a 7 day trend
 * @access  Private (admin)
 */
const getStats = async (req, res, next) => {
  try {
    // Build the same 7 day window the charts render (today inclusive).
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - 6);

    const [statusRows, wasteRows, areaRows, trendRows, resolutionRows, total, recentComplaints, workerCount, citizenCount] =
      await Promise.all([
        Complaint.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        Complaint.aggregate([{ $group: { _id: '$wasteType', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
        Complaint.aggregate([
          { $group: { _id: '$location.area', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Complaint.aggregate([
          { $match: { createdAt: { $gte: since } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              count: { $sum: 1 },
              resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        Complaint.aggregate([
          { $match: { status: 'resolved', resolvedAt: { $ne: null } } },
          {
            $project: {
              hours: { $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 1000 * 60 * 60] },
            },
          },
          { $group: { _id: null, averageHours: { $avg: '$hours' }, count: { $sum: 1 } } },
        ]),
        Complaint.countDocuments(),
        populateComplaint(Complaint.find().sort({ createdAt: -1 }).limit(5)),
        User.countDocuments({ role: 'worker', isActive: true }),
        User.countDocuments({ role: 'user' }),
      ]);

    // --- Totals with every status defaulted to 0 --------------------------
    const totals = {
      total,
      pending: 0,
      assigned: 0,
      inProgress: 0,
      resolved: 0,
      rejected: 0,
    };
    statusRows.forEach((row) => {
      if (row._id === 'in_progress') totals.inProgress = row.count;
      else if (row._id && Object.prototype.hasOwnProperty.call(totals, row._id)) totals[row._id] = row.count;
    });

    // --- Merge empty / missing areas into "Unspecified" -------------------
    const areaMap = new Map();
    areaRows.forEach((row) => {
      const key = row._id && String(row._id).trim() ? row._id : 'Unspecified';
      areaMap.set(key, (areaMap.get(key) || 0) + row.count);
    });
    const byArea = Array.from(areaMap, ([_id, count]) => ({ _id, count })).sort((a, b) => b.count - a.count);

    // --- Fill the 7 day trend so the chart never has gaps ----------------
    const trendMap = new Map(trendRows.map((row) => [row._id, row]));
    const weeklyTrend = [];
    for (let i = 0; i < 7; i += 1) {
      const day = new Date(since);
      day.setDate(since.getDate() + i);
      const key = day.toISOString().slice(0, 10);
      const row = trendMap.get(key);
      weeklyTrend.push({ _id: key, count: row?.count || 0, resolved: row?.resolved || 0 });
    }

    const averageResolutionHours = round1(resolutionRows[0]?.averageHours || 0);
    const resolutionRate = total ? round1((totals.resolved / total) * 100) : 0;

    return res.json({
      success: true,
      stats: {
        totals,
        byWasteType: wasteRows,
        byArea,
        weeklyTrend,
        averageResolutionHours,
        resolutionRate,
        resolvedCount: resolutionRows[0]?.count || 0,
        activeWorkers: workerCount,
        registeredCitizens: citizenCount,
        recentComplaints,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/* ========================================================================== */
/* Complaint management                                                       */
/* ========================================================================== */

/**
 * @route   GET /api/admin/complaints
 * @desc    Paginated, filterable complaint list
 * @access  Private (admin)
 *
 * Query: status, area, wasteType, search, page, limit, sort (newest|oldest)
 */
const getComplaints = async (req, res, next) => {
  try {
    const {
      status = 'all',
      area = 'all',
      wasteType = 'all',
      search = '',
      sort = 'newest',
      page = 1,
      limit = 10,
    } = req.query;

    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (wasteType && wasteType !== 'all') filter.wasteType = wasteType;
    if (area && area !== 'all') filter['location.area'] = area;

    if (search && String(search).trim()) {
      const rx = new RegExp(escapeRegex(String(search).trim()), 'i');
      filter.$or = [
        { trackingId: rx },
        { description: rx },
        { 'location.address': rx },
        { 'location.area': rx },
      ];
    }

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const sortSpec = sort === 'oldest' ? { createdAt: 1 } : { createdAt: -1 };

    const [complaints, total] = await Promise.all([
      populateComplaint(Complaint.find(filter).sort(sortSpec).skip((currentPage - 1) * perPage).limit(perPage)),
      Complaint.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      complaints,
      page: currentPage,
      pages: Math.max(1, Math.ceil(total / perPage)),
      total,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @route   PUT /api/admin/complaints/:id/assign
 * @desc    Assign (or reassign) a complaint to a field worker
 * @access  Private (admin)
 */
const assignComplaint = async (req, res, next) => {
  try {
    const { workerId } = req.body;
    if (!workerId) throw new ApiError(400, 'A worker must be selected.');

    const [complaint, worker] = await Promise.all([
      Complaint.findById(req.params.id),
      User.findById(workerId),
    ]);

    if (!complaint) throw new ApiError(404, 'Complaint not found.');
    if (!worker || worker.role !== 'worker') throw new ApiError(404, 'The selected field worker does not exist.');
    if (!worker.isActive) throw new ApiError(409, 'The selected field worker account is deactivated.');

    // A resolved or rejected complaint is terminal and cannot be reassigned.
    if (['resolved', 'rejected'].includes(complaint.status)) {
      throw new ApiError(409, `A complaint that is already "${complaint.status}" cannot be reassigned.`);
    }

    const previousWorkerId = complaint.assignedWorker;

    complaint.assignedWorker = worker._id;
    complaint.assignedAt = new Date();
    // Re-assigning an in-progress job restarts the workflow at "assigned".
    if (complaint.status === 'pending' || String(previousWorkerId) !== String(worker._id)) {
      complaint.status = 'assigned';
    }
    complaint.addTimelineEntry(
      'assigned',
      `Assigned to ${worker.name}${complaint.location?.area ? ` (${complaint.location.area})` : ''}.`,
      req.user._id
    );
    await complaint.save();

    // Maintain the denormalised worker workload counters.
    if (String(previousWorkerId) !== String(worker._id)) {
      if (previousWorkerId) await Worker.bumpCounters(previousWorkerId, { assigned: -1 });
      await Worker.bumpCounters(worker._id, { assigned: 1 });
    }

    const populated = await populateComplaint(Complaint.findById(complaint._id));

    // Notify the worker (in-app + email) and the reporting citizen.
    createNotification({
      recipient: worker._id,
      title: `New assignment: ${complaint.trackingId}`,
      message: `${complaint.priority} priority ${complaint.wasteType} waste reported in ${complaint.location?.area || 'your zone'}.`,
      type: 'complaint_assigned',
      link: '/worker/complaints',
      complaint: complaint._id,
      emailTemplate: templates.workerAssigned({ complaint: populated, worker }),
    }).catch((err) => console.error('[admin] Worker notification failed:', err.message));

    notifyStatusChange({ complaint: populated, status: 'assigned', note: `A field worker (${worker.name}) has been assigned to your report.` }).catch(
      () => {}
    );

    return res.json({ success: true, message: `Complaint assigned to ${worker.name}.`, complaint: populated });
  } catch (error) {
    return next(error);
  }
};

/**
 * @route   PUT /api/admin/complaints/:id/status
 * @desc    Move a complaint through the workflow
 * @access  Private (admin)
 */
const updateComplaintStatus = async (req, res, next) => {
  try {
    const { status, note = '' } = req.body;

    if (!COMPLAINT_STATUSES.includes(status)) {
      throw new ApiError(400, `Invalid status "${status}". Allowed: ${COMPLAINT_STATUSES.join(', ')}.`);
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) throw new ApiError(404, 'Complaint not found.');

    if (complaint.status === status) {
      throw new ApiError(409, `This complaint is already marked as "${status.replace('_', ' ')}".`);
    }

    // 'assigned' without a worker would leave the workflow in an invalid state.
    if (status === 'assigned' && !complaint.assignedWorker) {
      throw new ApiError(400, 'Assign a field worker before setting the status to "assigned".');
    }

    complaint.status = status;
    if (note) complaint.resolutionNote = String(note).trim().slice(0, 500);

    if (status === 'resolved') {
      complaint.resolvedAt = new Date();
      if (complaint.assignedWorker) {
        await Worker.bumpCounters(complaint.assignedWorker, { resolved: 1 });
      }
    }
    if (status === 'rejected') {
      complaint.rejectedAt = new Date();
    }

    const STATUS_NOTE = {
      pending: 'Moved back to pending for re-triage.',
      assigned: 'Marked as assigned.',
      in_progress: 'Field work has started.',
      resolved: 'The reported issue has been resolved.',
      rejected: 'The report was reviewed and marked as invalid.',
    };

    complaint.addTimelineEntry(status, note || STATUS_NOTE[status], req.user._id);
    await complaint.save();

    const populated = await populateComplaint(Complaint.findById(complaint._id));

    notifyStatusChange({ complaint: populated, status, note }).catch((err) =>
      console.error('[admin] Status notification failed:', err.message)
    );

    return res.json({ success: true, message: `Status updated to "${status.replace('_', ' ')}".`, complaint: populated });
  } catch (error) {
    return next(error);
  }
};

/**
 * @route   DELETE /api/admin/complaints/:id
 * @desc    Permanently delete a false complaint and its images
 * @access  Private (admin)
 */
const deleteComplaint = async (req, res, next) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) throw new ApiError(404, 'Complaint not found.');

    removeUploadFile(complaint.image);
    removeUploadFile(complaint.completionImage);
    await complaint.deleteOne();

    return res.json({ success: true, message: `Complaint ${complaint.trackingId} was deleted.`, id: complaint._id });
  } catch (error) {
    return next(error);
  }
};

/* ========================================================================== */
/* Worker management                                                          */
/* ========================================================================== */

/**
 * @route   GET /api/admin/workers
 * @desc    List field workers with their profile and workload counters
 * @access  Private (admin)
 */
const getWorkers = async (req, res, next) => {
  try {
    const workers = await User.find({ role: 'worker' }).sort({ createdAt: -1 });
    const profiles = await Worker.find({ user: { $in: workers.map((w) => w._id) } });
    const profileByUser = new Map(profiles.map((p) => [String(p.user), p]));

    // Live workload straight from the complaints collection (source of truth).
    const workload = await Complaint.aggregate([
      { $match: { assignedWorker: { $ne: null } } },
      {
        $group: {
          _id: '$assignedWorker',
          assignedCount: { $sum: { $cond: [{ $in: ['$status', ['assigned', 'in_progress']] }, 1, 0] } },
          resolvedCount: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
        },
      },
    ]);
    const workloadByUser = new Map(workload.map((row) => [String(row._id), row]));

    const payload = workers.map((worker) => {
      const profile = profileByUser.get(String(worker._id));
      const stats = workloadByUser.get(String(worker._id));
      return {
        ...worker.toJSON(),
        employeeId: profile?.employeeId || '',
        zone: profile?.zone || worker.zone || '',
        designation: profile?.designation || 'Sanitation Worker',
        department: profile?.department || 'Municipal Sanitation',
        isAvailable: profile?.isAvailable ?? true,
        rating: profile?.rating ?? 4.5,
        assignedCount: stats?.assignedCount || 0,
        resolvedCount: stats?.resolvedCount || 0,
        completionRate: profile?.completionRate ?? 0,
      };
    });

    return res.json({ success: true, count: payload.length, workers: payload });
  } catch (error) {
    return next(error);
  }
};

/**
 * @route   POST /api/admin/workers
 * @desc    Create a worker account plus its operational profile
 * @access  Private (admin)
 */
const createWorker = async (req, res, next) => {
  try {
    const { name, email, password, phone = '', zone = '', designation, department, employeeId } = req.body;

    const existing = await User.findOne({ email: String(email).toLowerCase() });
    if (existing) throw new ApiError(409, 'An account with this email address already exists.');

    const user = await User.create({
      name,
      email,
      password,
      phone,
      role: 'worker',
      zone,
    });

    const profile = await Worker.create({
      user: user._id,
      zone,
      employeeId: employeeId || `W-${String(user._id).slice(-6).toUpperCase()}`,
      ...(designation ? { designation } : {}),
      ...(department ? { department } : {}),
    });

    return res.status(201).json({
      success: true,
      message: `Field worker ${user.name} created successfully.`,
      worker: { ...user.toJSON(), employeeId: profile.employeeId, zone: profile.zone, assignedCount: 0, resolvedCount: 0 },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @route   PUT /api/admin/workers/:id
 * @desc    Update a worker's account and profile details
 * @access  Private (admin)
 */
const updateWorker = async (req, res, next) => {
  try {
    const { name, phone, zone, isActive, designation, department, isAvailable } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) throw new ApiError(404, 'Worker not found.');
    if (user.role !== 'worker') throw new ApiError(400, 'The selected account is not a field worker.');

    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (zone !== undefined) user.zone = zone;
    if (isActive !== undefined) user.isActive = Boolean(isActive);
    await user.save();

    const profileUpdate = {};
    if (zone !== undefined) profileUpdate.zone = zone;
    if (designation !== undefined) profileUpdate.designation = designation;
    if (department !== undefined) profileUpdate.department = department;
    if (isAvailable !== undefined) profileUpdate.isAvailable = Boolean(isAvailable);

    const profile = await Worker.findOneAndUpdate({ user: user._id }, profileUpdate, {
      new: true,
      upsert: Object.keys(profileUpdate).length > 0,
      setDefaultsOnInsert: true,
    });

    return res.json({
      success: true,
      message: 'Worker updated successfully.',
      worker: { ...user.toJSON(), employeeId: profile?.employeeId || '', zone: profile?.zone || user.zone },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @route   DELETE /api/admin/workers/:id
 * @desc    Remove a worker, release their open jobs and delete the profile
 * @access  Private (admin)
 */
const deleteWorker = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) throw new ApiError(404, 'Worker not found.');
    if (user.role !== 'worker') throw new ApiError(400, 'The selected account is not a field worker.');

    // Release open assignments back into the triage queue so no report is lost.
    const openJobs = await Complaint.find({
      assignedWorker: user._id,
      status: { $in: ['assigned', 'in_progress'] },
    });

    await Promise.all(
      openJobs.map((job) => {
        job.assignedWorker = null;
        job.assignedAt = null;
        job.status = 'pending';
        job.addTimelineEntry('pending', `Returned to the queue after ${user.name} was removed from the team.`, req.user._id);
        return job.save();
      })
    );

    await Worker.findOneAndDelete({ user: user._id });
    await user.deleteOne();

    return res.json({
      success: true,
      message: `Worker removed. ${openJobs.length} open complaint(s) returned to the queue.`,
      releasedComplaints: openJobs.length,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @route   GET /api/admin/users
 * @desc    List registered citizens
 * @access  Private (admin)
 */
const getUsers = async (req, res, next) => {
  try {
    const users = await User.find({ role: 'user' }).sort({ createdAt: -1 }).limit(500);
    return res.json({ success: true, count: users.length, users });
  } catch (error) {
    return next(error);
  }
};

/**
 * @route   PUT /api/admin/users/:id/status
 * @desc    Activate / deactivate a citizen account
 * @access  Private (admin)
 */
const toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) throw new ApiError(404, 'User not found.');
    if (user.role === 'admin') throw new ApiError(403, 'Administrator accounts cannot be modified here.');

    user.isActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : !user.isActive;
    await user.save();

    return res.json({
      success: true,
      message: `Account ${user.isActive ? 'activated' : 'deactivated'}.`,
      user: user.toJSON(),
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getStats,
  getComplaints,
  assignComplaint,
  updateComplaintStatus,
  deleteComplaint,
  getWorkers,
  createWorker,
  updateWorker,
  deleteWorker,
  getUsers,
  toggleUserStatus,
};
