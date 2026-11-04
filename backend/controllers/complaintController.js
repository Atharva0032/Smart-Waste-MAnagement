/**
 * Complaint controller - the citizen facing side of the platform.
 */
const fs = require('fs');
const Complaint = require('../models/Complaint');
const { WASTE_TYPES, PRIORITIES } = require('../models/Complaint');
const ApiError = require('../utils/apiError');
const env = require('../config/env');
const { toPublicPath, removeUploadFile } = require('../utils/fileHelper');
const { classifyImage } = require('../utils/wasteClassifier');
const { notifyAdmins, notifyStatusChange } = require('../utils/notify');
const { templates } = require('../utils/sendEmail');

/**
 * Reusable populate chain so every complaint payload has the same shape the
 * React client expects (`user`, `assignedWorker`, `timeline[].updatedBy`).
 */
const populateComplaint = (query) =>
  query
    .populate('user', 'name email phone role')
    .populate('assignedWorker', 'name email phone zone role')
    .populate('timeline.updatedBy', 'name role');

/**
 * @route   POST /api/complaints
 * @desc    Submit a new waste complaint with a photo and GPS coordinates
 * @access  Private (citizen)
 *
 * multipart/form-data fields:
 *   image (file, required), wasteType, description, address, area,
 *   latitude, longitude, priority, aiConfidence, aiLabel, phone
 */
const createComplaint = async (req, res, next) => {
  const uploadedPath = toPublicPath(req.file);

  try {
    // --- 1. Validate the upload -------------------------------------------
    if (!req.file) {
      throw new ApiError(400, 'A photo of the waste is required.');
    }

    const {
      wasteType,
      description,
      address = '',
      area = '',
      latitude,
      longitude,
      priority = 'medium',
      aiConfidence,
      aiLabel = '',
      phone = '',
    } = req.body;

    // --- 2. Validate the payload ------------------------------------------
    if (!WASTE_TYPES.includes(wasteType)) {
      throw new ApiError(400, `Invalid waste type "${wasteType}". Allowed: ${WASTE_TYPES.join(', ')}.`);
    }
    if (!description || String(description).trim().length < 10) {
      throw new ApiError(400, 'Description must be at least 10 characters long.');
    }
    if (latitude === null || longitude === null || latitude === undefined || longitude === undefined) {
      throw new ApiError(400, 'GPS location is required. Please pick the location on the map.');
    }
    if (priority && !PRIORITIES.includes(priority)) {
      throw new ApiError(400, `Invalid priority "${priority}".`);
    }

    // --- 3. AI verification -----------------------------------------------
    // The client normally performs verification before submitting and sends the
    // result back. When it does not (older clients, or a failed client-side
    // call) the server analyses the saved file itself so the data is never lost.
    let aiVerification = {
      isWaste: false,
      confidence: 0,
      label: '',
      model: '',
      verifiedAt: new Date(),
    };

    if (aiConfidence !== null && aiConfidence !== undefined && Number.isFinite(Number(aiConfidence))) {
      const confidence = Math.max(0, Math.min(100, Math.round(Number(aiConfidence))));
      aiVerification = {
        isWaste: confidence >= env.AI_MIN_CONFIDENCE,
        confidence,
        label: aiLabel || '',
        model: 'client-side-verification',
        verifiedAt: new Date(),
      };
    } else if (env.AI_VERIFY_ENABLED) {
      try {
        const buffer = await fs.promises.readFile(req.file.path);
        const result = await classifyImage(buffer);
        aiVerification = {
          isWaste: result.isWaste,
          confidence: result.confidence,
          label: result.label,
          model: result.model,
          verifiedAt: new Date(),
        };
      } catch (aiError) {
        // Verification is best-effort: never block a legitimate report.
        console.warn('[complaints] Server-side AI verification skipped:', aiError.message);
      }
    }

    // Optional hard gate (AI_REJECT_INVALID=true) for strict deployments.
    if (env.AI_REJECT_INVALID && !aiVerification.isWaste) {
      removeUploadFile(uploadedPath);
      throw new ApiError(
        422,
        `The uploaded photo does not appear to contain waste (confidence ${aiVerification.confidence}%). Please upload a clear photo of the waste.`
      );
    }

    // --- 4. Persist --------------------------------------------------------
    const complaint = new Complaint({
      trackingId: await Complaint.generateTrackingId(),
      user: req.user._id,
      wasteType,
      description: String(description).trim(),
      image: uploadedPath,
      location: {
        address: String(address || '').trim(),
        area: String(area || '').trim() || 'Unspecified',
        latitude: Number(latitude),
        longitude: Number(longitude),
      },
      status: 'pending',
      priority,
      aiVerification,
    });

    complaint.addTimelineEntry('pending', 'Complaint submitted by citizen.', req.user._id);
    await complaint.save();

    // Keep the citizen's contact number in sync the first time they supply one.
    if (phone && !req.user.phone) {
      req.user.phone = phone;
      await req.user.save({ validateBeforeSave: false });
    }

    const populated = await populateComplaint(Complaint.findById(complaint._id));

    // --- 5. Notify administrators (in-app + email, never blocking) ---------
    notifyAdmins({
      title: `New waste report ${complaint.trackingId}`,
      message: `${req.user.name} reported ${wasteType.replace('_', ' ')} waste in ${complaint.location.area}.`,
      type: 'complaint_created',
      link: '/admin/complaints',
      complaint: complaint._id,
      emailTemplate: templates.complaintCreated({ complaint: populated, reporter: req.user }),
    }).catch((err) => console.error('[complaints] Admin notification failed:', err.message));

    return res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully.',
      complaint: populated,
    });
  } catch (error) {
    // Clean up the orphaned upload whenever the request ultimately fails.
    if (uploadedPath && error.statusCode && error.statusCode >= 400) {
      removeUploadFile(uploadedPath);
    }
    return next(error);
  }
};

/**
 * @route   GET /api/complaints/my
 * @desc    List the authenticated citizen's own complaints
 * @access  Private (citizen)
 */
const getMyComplaints = async (req, res, next) => {
  try {
    const complaints = await populateComplaint(
      Complaint.find({ user: req.user._id }).sort({ createdAt: -1 })
    );

    return res.json({ success: true, count: complaints.length, complaints });
  } catch (error) {
    return next(error);
  }
};

/**
 * @route   GET /api/complaints/:id
 * @desc    Fetch a single complaint
 * @access  Private (owner, admin or the assigned worker)
 */
const getComplaint = async (req, res, next) => {
  try {
    const complaint = await populateComplaint(Complaint.findById(req.params.id));
    if (!complaint) throw new ApiError(404, 'Complaint not found.');

    const isOwner = complaint.isOwnedBy(req.user._id);
    const isPrivileged = ['admin', 'worker'].includes(req.user.role);

    if (!isOwner && !isPrivileged) {
      throw new ApiError(403, 'You do not have permission to view this complaint.');
    }

    return res.json({ success: true, complaint });
  } catch (error) {
    return next(error);
  }
};

/**
 * @route   GET /api/complaints/track/:trackingId
 * @desc    Public complaint tracker (no authentication required)
 * @access  Public
 */
const trackComplaint = async (req, res, next) => {
  try {
    const trackingId = String(req.params.trackingId || '').trim().toUpperCase();
    if (!trackingId) throw new ApiError(400, 'A tracking id is required.');

    const complaint = await Complaint.findOne({ trackingId })
      .populate('assignedWorker', 'name phone zone')
      .populate('timeline.updatedBy', 'name role');

    if (!complaint) {
      throw new ApiError(404, `No complaint was found for tracking id "${trackingId}".`);
    }

    // Public payload: deliberately omits the reporter's contact details.
    const publicPayload = {
      _id: complaint._id,
      trackingId: complaint.trackingId,
      wasteType: complaint.wasteType,
      description: complaint.description,
      image: complaint.image,
      completionImage: complaint.completionImage,
      status: complaint.status,
      priority: complaint.priority,
      resolutionNote: complaint.resolutionNote,
      location: complaint.location,
      assignedWorker: complaint.assignedWorker
        ? { name: complaint.assignedWorker.name, zone: complaint.assignedWorker.zone }
        : null,
      timeline: complaint.timeline,
      resolvedAt: complaint.resolvedAt,
      createdAt: complaint.createdAt,
      updatedAt: complaint.updatedAt,
    };

    return res.json({ success: true, complaint: publicPayload });
  } catch (error) {
    return next(error);
  }
};

/**
 * @route   DELETE /api/complaints/:id
 * @desc    Withdraw an own complaint while it is still pending
 * @access  Private (owner)
 */
const deleteComplaint = async (req, res, next) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) throw new ApiError(404, 'Complaint not found.');

    if (!complaint.isOwnedBy(req.user._id)) {
      throw new ApiError(403, 'You can only withdraw your own complaints.');
    }
    // Once the municipality has acted, a citizen can no longer delete it.
    if (complaint.status !== 'pending') {
      throw new ApiError(
        409,
        `A complaint that is already "${complaint.status.replace('_', ' ')}" cannot be withdrawn. Please contact the municipal office.`
      );
    }

    removeUploadFile(complaint.image);
    removeUploadFile(complaint.completionImage);
    await complaint.deleteOne();

    return res.json({ success: true, message: 'Complaint withdrawn successfully.' });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createComplaint,
  getMyComplaints,
  getComplaint,
  trackComplaint,
  deleteComplaint,
  populateComplaint,
  notifyStatusChange,
};
