/**
 * Worker controller - the field worker's mobile-first workspace.
 */
const Complaint = require('../models/Complaint');
const Worker = require('../models/Worker');
const ApiError = require('../utils/apiError');
const { toPublicPath, removeUploadFile } = require('../utils/fileHelper');
const { notifyAdmins, notifyStatusChange } = require('../utils/notify');
const { populateComplaint } = require('./complaintController');

/** Statuses a field worker is allowed to set on their own jobs. */
const WORKER_ALLOWED_STATUSES = ['in_progress', 'resolved'];

/**
 * @route   GET /api/workers/assigned
 * @desc    Complaints assigned to the authenticated worker
 * @access  Private (worker)
 */
const getAssigned = async (req, res, next) => {
  try {
    const complaints = await populateComplaint(
      Complaint.find({ assignedWorker: req.user._id }).sort({ createdAt: -1 })
    );

    // Counters for the worker dashboard cards.
    const stats = {
      total: complaints.length,
      assigned: complaints.filter((c) => c.status === 'assigned').length,
      inProgress: complaints.filter((c) => c.status === 'in_progress').length,
      resolved: complaints.filter((c) => c.status === 'resolved').length,
    };

    return res.json({ success: true, count: complaints.length, complaints, stats });
  } catch (error) {
    return next(error);
  }
};

/**
 * @route   GET /api/workers/complaints/:id
 * @desc    Fetch one assigned complaint (the worker must own the assignment)
 * @access  Private (worker)
 */
const getComplaint = async (req, res, next) => {
  try {
    const complaint = await populateComplaint(Complaint.findById(req.params.id));
    if (!complaint) throw new ApiError(404, 'Complaint not found.');

    const assignedId = complaint.assignedWorker?._id || complaint.assignedWorker;
    if (String(assignedId) !== String(req.user._id)) {
      throw new ApiError(403, 'This complaint is not assigned to you.');
    }

    return res.json({ success: true, complaint });
  } catch (error) {
    return next(error);
  }
};

/**
 * @route   PUT /api/workers/complaints/:id/status
 * @desc    Start or finish an assigned complaint
 * @access  Private (worker)
 */
const updateStatus = async (req, res, next) => {
  try {
    const { status, note = '' } = req.body;

    if (!WORKER_ALLOWED_STATUSES.includes(status)) {
      throw new ApiError(400, `Workers may only set the status to: ${WORKER_ALLOWED_STATUSES.join(', ')}.`);
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) throw new ApiError(404, 'Complaint not found.');

    if (String(complaint.assignedWorker) !== String(req.user._id)) {
      throw new ApiError(403, 'This complaint is not assigned to you.');
    }
    if (complaint.status === 'rejected') {
      throw new ApiError(409, 'This complaint was rejected by an administrator and cannot be updated.');
    }
    if (complaint.status === status) {
      throw new ApiError(409, `This complaint is already "${status.replace('_', ' ')}".`);
    }

    complaint.status = status;
    if (status === 'resolved') {
      complaint.resolvedAt = new Date();
      complaint.resolutionNote = String(note || 'Resolved by the field team.').trim().slice(0, 500);
      await Worker.bumpCounters(req.user._id, { resolved: 1 });
    }
    complaint.addTimelineEntry(
      status,
      note || (status === 'in_progress' ? 'Field work has started.' : 'Marked as resolved by the field worker.'),
      req.user._id
    );
    await complaint.save();

    const populated = await populateComplaint(Complaint.findById(complaint._id));
    notifyStatusChange({ complaint: populated, status, note }).catch(() => {});

    return res.json({
      success: true,
      message: status === 'resolved' ? 'Complaint marked as resolved.' : 'Complaint marked as in progress.',
      complaint: populated,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @route   PUT /api/workers/complaints/:id/resolve
 * @desc    Upload the completion photo and close the complaint
 * @access  Private (worker)
 *
 * multipart/form-data fields: completionImage (file, required), note (required)
 */
const resolveComplaint = async (req, res, next) => {
  const uploadedPath = toPublicPath(req.file);

  try {
    if (!req.file) {
      throw new ApiError(400, 'A completion photo is required to close a complaint.');
    }

    const note = String(req.body.note || '').trim();
    if (note.length < 10) {
      throw new ApiError(400, 'Please provide a resolution note of at least 10 characters.');
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) throw new ApiError(404, 'Complaint not found.');

    if (String(complaint.assignedWorker) !== String(req.user._id)) {
      throw new ApiError(403, 'This complaint is not assigned to you.');
    }
    if (complaint.status === 'resolved') {
      throw new ApiError(409, 'This complaint has already been resolved.');
    }
    if (complaint.status === 'rejected') {
      throw new ApiError(409, 'This complaint was rejected by an administrator and cannot be resolved.');
    }

    // Replacing a previously uploaded completion photo must not leak the old file.
    if (complaint.completionImage) removeUploadFile(complaint.completionImage);

    complaint.completionImage = uploadedPath;
    complaint.resolutionNote = note.slice(0, 500);
    complaint.status = 'resolved';
    complaint.resolvedAt = new Date();
    complaint.addTimelineEntry('resolved', note, req.user._id);
    await complaint.save();

    await Worker.bumpCounters(req.user._id, { resolved: 1 });

    const populated = await populateComplaint(Complaint.findById(complaint._id));

    notifyStatusChange({ complaint: populated, status: 'resolved', note }).catch(() => {});
    notifyAdmins({
      title: `Complaint ${complaint.trackingId} resolved`,
      message: `${req.user.name} closed the ${complaint.wasteType} waste report in ${complaint.location?.area || 'the field'}.`,
      type: 'resolved',
      link: '/admin/complaints',
      complaint: complaint._id,
    }).catch(() => {});

    return res.json({ success: true, message: 'Complaint resolved successfully.', complaint: populated });
  } catch (error) {
    // Remove the orphaned upload when the request fails after the file landed.
    if (uploadedPath && error.statusCode && error.statusCode >= 400) {
      removeUploadFile(uploadedPath);
    }
    return next(error);
  }
};

/**
 * @route   GET /api/workers/profile
 * @desc    Operational profile and workload counters for the current worker
 * @access  Private (worker)
 */
const getProfile = async (req, res, next) => {
  try {
    const profile = await Worker.findOne({ user: req.user._id });
    const [assigned, resolved] = await Promise.all([
      Complaint.countDocuments({ assignedWorker: req.user._id, status: { $in: ['assigned', 'in_progress'] } }),
      Complaint.countDocuments({ assignedWorker: req.user._id, status: 'resolved' }),
    ]);

    return res.json({
      success: true,
      profile: profile || null,
      workload: { open: assigned, resolved },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getAssigned, getComplaint, updateStatus, resolveComplaint, getProfile };
