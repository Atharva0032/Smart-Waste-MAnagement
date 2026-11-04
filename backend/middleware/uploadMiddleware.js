/**
 * Multer upload middleware.
 *
 * Two storage engines are exposed:
 *   - disk   : waste images / completion photos persisted under `uploads/`
 *   - memory : one-shot buffers used by the AI verification endpoint so that
 *              rejected images are never written to disk
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const env = require('../config/env');
const ApiError = require('../utils/apiError');

/** Image mime types accepted by the upload pipeline. */
const ALLOWED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/bmp', 'image/gif'];

/** Map the mime type to a canonical extension (never trust the client's one). */
const MIME_EXTENSION = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/bmp': '.bmp',
  'image/gif': '.gif',
};

const MAX_FILE_SIZE = env.MAX_FILE_UPLOAD_MB * 1024 * 1024;

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Guarantee the directory exists even on a cold deploy.
    fs.mkdirSync(env.UPLOAD_PATH, { recursive: true });
    cb(null, env.UPLOAD_PATH);
  },
  filename: (req, file, cb) => {
    const ext = MIME_EXTENSION[file.mimetype] || path.extname(file.originalname).toLowerCase() || '.jpg';
    // Slug of the original name keeps the directory human readable.
    const base = path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .toLowerCase();
    const unique = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    cb(null, `${unique}${base ? `-${base}` : ''}${ext}`);
  },
});

/** Reject anything that is not an image before it hits the disk. */
const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true);
  return cb(
    new ApiError(
      400,
      `Unsupported file type "${file.mimetype}". Please upload a JPEG, PNG, WEBP, BMP or GIF image.`
    )
  );
};

const diskUpload = multer({
  storage: diskStorage,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter,
});

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter,
});

/**
 * Wrap a multer instance so its callbacks are surfaced as ApiError instances
 * handled by the central error middleware.
 */
const buildMiddleware = (instance) => (field) => (req, res, next) => {
  instance.single(field)(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(
          new ApiError(400, `The uploaded image is too large. Maximum allowed size is ${env.MAX_FILE_UPLOAD_MB} MB.`)
        );
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(new ApiError(400, `Unexpected file field "${err.field}". Expected "${field}".`));
      }
      return next(new ApiError(400, `Upload failed: ${err.message}`));
    }
    return next(err);
  });
};

const diskMiddleware = buildMiddleware(diskUpload);
const memoryMiddleware = buildMiddleware(memoryUpload);

/** Waste image for POST /api/complaints -> `req.file` */
const uploadImage = diskMiddleware('image');
/** Completion photo for PUT /api/workers/complaints/:id/resolve -> `req.file` */
const uploadCompletionImage = diskMiddleware('completionImage');
/** In-memory image for POST /api/ai/verify -> `req.file.buffer` */
const uploadMemoryImage = memoryMiddleware('image');

module.exports = {
  uploadImage,
  uploadCompletionImage,
  uploadMemoryImage,
  ALLOWED_MIME,
  MAX_FILE_SIZE,
};
