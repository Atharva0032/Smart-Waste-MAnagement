/**
 * AI controller - exposes the TensorFlow.js waste verification pipeline.
 */
const ApiError = require('../utils/apiError');
const { classifyImage, getClassifierInfo } = require('../utils/wasteClassifier');

/**
 * @route   POST /api/ai/verify
 * @desc    Classify an uploaded image as waste / not-waste and return a confidence
 * @access  Public (used from the "Report waste" form before submitting)
 *
 * multipart/form-data field: image (file, required)
 *
 * The image is held in memory (multer memoryStorage) so a rejected photo is
 * never written to disk.
 */
const verifyImage = async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      throw new ApiError(400, 'An image file is required in the "image" field.');
    }

    const result = await classifyImage(req.file.buffer);

    return res.json({
      success: true,
      isWaste: result.isWaste,
      confidence: result.confidence,
      label: result.label,
      engine: result.engine,
      model: result.model,
      labels: result.labels,
      message: result.isWaste
        ? `Waste detected with ${result.confidence}% confidence.`
        : `This image does not look like waste (${result.confidence}% confidence).`,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @route   GET /api/ai/status
 * @desc    Report which inference engine is active (useful for diagnostics)
 * @access  Public
 */
const getStatus = async (req, res, next) => {
  try {
    return res.json({ success: true, ...getClassifierInfo() });
  } catch (error) {
    return next(error);
  }
};

module.exports = { verifyImage, getStatus };
