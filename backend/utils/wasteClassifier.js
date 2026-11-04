/**
 * AI waste verification.
 * ---------------------------------------------------------------------------
 * Two engines are available and are selected automatically at runtime:
 *
 *   1. PRIMARY  - TensorFlow.js MobileNetV2 (`@tensorflow/tfjs-node` +
 *                 `@tensorflow-models/mobilenet`). MobileNet is trained on
 *                 ImageNet-1k, which has no dedicated "waste" class, so the
 *                 top-K predictions are matched against a curated dictionary of
 *                 waste related ImageNet concepts (bottles, cartons, cans,
 *                 plastic bags, appliances, syringes, refuse bins, ...). The
 *                 confidence is derived from the rank and probability of those
 *                 matches.
 *
 *   2. FALLBACK - a deterministic colour/texture heuristic implemented with
 *                 jimp. It decodes the real pixels and scores saturation,
 *                 edge density (clutter), vegetation/brown ratios and sky
 *                 ratio. This keeps the feature working even when the native
 *                 TensorFlow binding could not be installed (common on some
 *                 Windows / ARM hosts).
 *
 * Both engines return the same contract:
 *   { isWaste: boolean, confidence: 0-100, label: string, engine, labels[] }
 */
const env = require('../config/env');
const ApiError = require('./apiError');

/* -------------------------------------------------------------------------- */
/* 1. Waste concept dictionary (ImageNet label substrings)                    */
/* -------------------------------------------------------------------------- */
/**
 * Lower-case substrings matched against the MobileNet class names.
 * Kept deliberately broad: a substring match ("bottle" matches "pop bottle",
 * "beer bottle", "water bottle", "pill bottle") gives far better recall than
 * an exact-equality list against the full 1000-class vocabulary.
 */
const WASTE_KEYWORDS = [
  // Refuse containers / handling equipment
  'garbage', 'trash', 'ashcan', 'wastebin', 'dustbin', 'refuse', 'rubbish', 'bin',
  'dumpster', 'skip', 'wheelbarrow', 'shovel', 'broom', 'bucket', 'pail', 'crate',
  // Packaging
  'carton', 'packet', 'plastic bag', 'envelope', 'box', 'bottle', 'bottlecap',
  'pop bottle', 'beer bottle', 'wine bottle', 'water bottle', 'pill bottle',
  'jar', 'tin', 'can', 'barrel', 'cask', 'milk can', 'flask', 'vial', 'tube',
  'dish', 'plate', 'tray', 'cup', 'mug', 'bowl', 'pot', 'flowerpot', 'pitcher',
  // Cellulose / organics
  'paper towel', 'toilet tissue', 'toilet paper', 'bathroom tissue', 'napkin',
  'newspaper', 'book jacket', 'comic book', 'menu', 'postcard', 'wooden spoon',
  'corkscrew', 'cork', 'matchstick', 'candle', 'soap', 'sponge', 'wood',
  'banana', 'apple', 'orange', 'lemon', 'broccoli', 'cauliflower', 'cucumber',
  'bell pepper', 'mushroom', 'corn', 'cabbage', 'artichoke', 'pomegranate',
  'pineapple', 'strawberry', 'fig', 'hay', 'leaf', 'flowerpot',
  // E-waste and appliances
  'television', 'monitor', 'screen', 'computer', 'laptop', 'notebook',
  'keyboard', 'mouse', 'printer', 'photocopier', 'cellular telephone', 'cellphone',
  'mobile phone', 'radio', 'camera', 'hard disc', 'hard disk', 'cd player',
  'ipod', 'toaster', 'microwave', 'refrigerator', 'icebox', 'dishwasher',
  'washing machine', 'washer', 'vacuum', 'coffee maker', 'electric fan',
  'iron', 'smoothing iron', 'sewing machine', 'modem', 'router', 'remote control',
  'power drill', 'hair dryer', 'space heater', 'air conditioner', 'loudspeaker',
  // Hazardous / medical / construction
  'syringe', 'pill', 'medicine', 'gas mask', 'oxygen mask', 'lighter', 'igniter',
  'matchstick', 'battery', 'can opener', 'chain saw', 'hatchet', 'hammer',
  'screwdriver', 'wrench', 'plunger', 'padlock', 'nails', 'safety pin',
  'brick', 'tile roof', 'tile', 'concrete', 'rubble', 'sand', 'gravel',
  // Textiles / misc consumer goods commonly discarded
  'jersey', 't-shirt', 'tee shirt', 'jean', 'denim', 'sock', 'shoe', 'running shoe',
  'sandal', 'clog', 'backpack', 'handbag', 'purse', 'umbrella', 'straw',
];

/**
 * Concepts that strongly indicate the photo is NOT of waste. They subtract from
 * the score so a portrait or a landscape does not get reported as garbage.
 */
const NEGATIVE_KEYWORDS = [
  'person', 'man', 'woman', 'face', 'baby', 'bridegroom', 'groom', 'ballplayer',
  'sky', 'cloud', 'mountain', 'valley', 'seashore', 'lakeside', 'cliff', 'geyser',
  'volcano', 'coral reef', 'alp', 'promontory', 'lighthouse', 'pier', 'dam',
  'dog', 'cat', 'bird', 'fish', 'insect', 'butterfly', 'snake', 'lizard',
  'sports car', 'convertible', 'limousine', 'minivan', 'sports ball',
  'sunglasses', 'wig', 'lipstick', 'necklace', 'tie', 'bow tie',
];

/* -------------------------------------------------------------------------- */
/* 2. TensorFlow.js engine                                                    */
/* -------------------------------------------------------------------------- */
let tf = null;
let mobilenet = null;
let model = null;
let modelLoadPromise = null;
let modelUnavailable = false;
let modelError = '';

/** True when the NativeBinding failed to install and we fell back. */
const isModelUnavailable = () => modelUnavailable;

/**
 * Lazily load MobileNet. The first call downloads/initialises the weights
 * (cached by tfjs) and can take a few seconds; the promise is memoised so
 * concurrent uploads never trigger parallel loads.
 * @returns {Promise<object|null>} the mobilenet model or null when unavailable
 */
const loadModel = () => {
  if (model) return Promise.resolve(model);
  if (modelUnavailable) return Promise.resolve(null);
  if (modelLoadPromise) return modelLoadPromise;

  modelLoadPromise = (async () => {
    try {
      // Required lazily: these are optionalDependencies and may be absent.
      // eslint-disable-next-line global-require
      tf = require('@tensorflow/tfjs-node');
      // eslint-disable-next-line global-require
      mobilenet = require('@tensorflow-models/mobilenet');

      model = await mobilenet.load({ version: 2, alpha: 1.0 });
      console.log('[ai] MobileNetV2 (TensorFlow.js) loaded successfully.');
      return model;
    } catch (error) {
      modelUnavailable = true;
      modelError = error.message;
      console.warn(
        `[ai] TensorFlow.js MobileNet unavailable (${error.message}). ` +
          'Falling back to the jimp colour/texture heuristic.'
      );
      return null;
    }
  })();

  return modelLoadPromise;
};

/** Optional warm-up called during server bootstrap to hide the first-call latency. */
const warmupClassifier = async () => {
  if (!env.AI_VERIFY_ENABLED) return { engine: 'disabled' };
  const loaded = await loadModel();
  return { engine: loaded ? 'mobilenet-v2' : 'heuristic', error: modelError || undefined };
};

/** Does the label text contain any waste keyword? */
const isWasteLabel = (label = '') => {
  const lower = label.toLowerCase();
  return WASTE_KEYWORDS.some((keyword) => lower.includes(keyword));
};

/** Is the label text a strong "not waste" indicator? */
const isNegativeLabel = (label = '') => {
  const lower = label.toLowerCase();
  return NEGATIVE_KEYWORDS.some((keyword) => lower.includes(keyword));
};

/**
 * Convert MobileNet's top-K predictions into the shared result contract.
 * @param {Array<{className: string, probability: number}>} predictions
 */
const scorePredictions = (predictions = []) => {
  const top1 = predictions[0] || { className: 'unknown', probability: 0 };

  const matches = predictions.filter((p) => isWasteLabel(p.className));
  const negatives = predictions.filter((p) => isNegativeLabel(p.className));

  const matchedProbability = matches.reduce((sum, p) => sum + p.probability, 0);
  const negativeProbability = negatives.reduce((sum, p) => sum + p.probability, 0);

  const top1IsWaste = isWasteLabel(top1.className);
  const top1IsNegative = isNegativeLabel(top1.className);

  let confidence;
  if (matches.length === 0) {
    // Nothing in the top-K looks like refuse: very low confidence.
    confidence = Math.min(38, Math.round(top1.probability * 100));
  } else if (top1IsWaste) {
    // The single most likely concept is waste related.
    confidence = Math.min(99, Math.round(58 + top1.probability * 90));
  } else {
    // Waste concepts appear but are not dominant.
    confidence = Math.min(90, Math.round(40 + matchedProbability * 150));
  }

  // Penalise portraits / landscapes / wildlife.
  confidence = Math.max(5, Math.round(confidence - negativeProbability * 120));
  if (top1IsNegative && !top1IsWaste) confidence = Math.min(confidence, 32);

  const label = (matches[0] || top1).className;
  const isWaste = confidence >= env.AI_MIN_CONFIDENCE;

  // Confidence only counts as trustworthy when the concept actually matched.
  if (!isWaste) confidence = Math.min(confidence, env.AI_MIN_CONFIDENCE - 1);

  return {
    isWaste,
    confidence,
    label: isWaste ? label : `unverified: ${label}`,
    engine: 'mobilenet-v2',
    model: 'mobilenet-v2-imagenet-1k',
    labels: predictions.slice(0, 10).map((p) => ({
      label: p.className,
      probability: Number(p.probability.toFixed(4)),
    })),
    metrics: {
      matchedConcepts: matches.length,
      matchedProbability: Number(matchedProbability.toFixed(4)),
      negativeProbability: Number(negativeProbability.toFixed(4)),
    },
  };
};

/**
 * Analyse a buffer with MobileNet.
 * @returns {Promise<object|null>} null when the engine is unavailable/failed
 */
const classifyWithMobilenet = async (buffer) => {
  const loaded = await loadModel();
  if (!loaded || !tf) return null;

  let tensor = null;
  try {
    // tfjs-node decodes JPEG/PNG/BMP/GIF natively into a [h, w, 3] uint8 tensor.
    tensor = tf.node.decodeImage(buffer, 3);
    const predictions = await loaded.classify(tensor, 10);
    if (!Array.isArray(predictions) || predictions.length === 0) return null;
    return scorePredictions(predictions);
  } catch (error) {
    console.warn('[ai] MobileNet inference failed:', error.message);
    return null;
  } finally {
    // Always release GPU/CPU memory to avoid leaks under load.
    if (tensor) tensor.dispose();
  }
};

/* -------------------------------------------------------------------------- */
/* 3. jimp colour/texture heuristic engine                                    */
/* -------------------------------------------------------------------------- */

/** Convert 0-255 RGB into HSL with h in degrees and s/l in 0..1. */
const rgbToHsl = (r, g, b) => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const delta = max - min;

  let h = 0;
  let s = 0;
  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === rn) h = (gn - bn) / delta + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
  }
  return { h, s, l };
};

const clamp01 = (value) => Math.min(1, Math.max(0, value));

/**
 * Decode the image with jimp and derive hand-crafted waste indicators.
 * @param {Buffer} buffer
 */
const analysePixels = async (buffer) => {
  // eslint-disable-next-line global-require
  const Jimp = require('jimp');
  const image = await Jimp.read(buffer);

  // Downscale for a fast, resolution-independent analysis.
  if (image.bitmap.width > 160) {
    image.resize(160, Jimp.AUTO);
  }

  const { data, width, height } = image.bitmap;
  const totalPixels = width * height;

  let satSum = 0;
  let lightSum = 0;
  let vivid = 0;
  let green = 0;
  let brown = 0;
  let gray = 0;
  let sky = 0;
  let edgeSum = 0;
  let edgeSamples = 0;

  const luminance = new Float32Array(totalPixels);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const { h, s, l } = rgbToHsl(r, g, b);
      satSum += s;
      lightSum += l;

      if (s > 0.25 && l > 0.12 && l < 0.92) vivid += 1;
      if (h >= 70 && h <= 170 && s > 0.18) green += 1;
      // Browns / beiges: cardboard, soil, dead vegetation, rust.
      if (h >= 15 && h <= 50 && s > 0.12 && l < 0.62) brown += 1;
      if (s < 0.12) gray += 1;
      // Blue-dominant and bright -> likely sky, not waste.
      if (l > 0.55 && b > r + 10 && b > g + 5 && s > 0.08) sky += 1;

      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      luminance[y * width + x] = lum;
    }
  }

  // Local gradient magnitude -> proxy for visual "clutter" / texture detail.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const here = luminance[y * width + x];
      if (x + 1 < width) {
        edgeSum += Math.abs(here - luminance[y * width + (x + 1)]);
        edgeSamples += 1;
      }
      if (y + 1 < height) {
        edgeSum += Math.abs(here - luminance[(y + 1) * width + x]);
        edgeSamples += 1;
      }
    }
  }

  return {
    width,
    height,
    avgSaturation: satSum / totalPixels,
    avgLightness: lightSum / totalPixels,
    vividRatio: vivid / totalPixels,
    greenRatio: green / totalPixels,
    brownRatio: brown / totalPixels,
    grayRatio: gray / totalPixels,
    skyRatio: sky / totalPixels,
    edgeDensity: edgeSamples ? edgeSum / edgeSamples : 0,
  };
};

/**
 * Score the pixel metrics into a 0-100 waste confidence.
 * The weights below encode the intuition that genuine waste photos are busy
 * (high edge density), colourful (mixed packaging), frequently contain
 * vegetation/soil or cardboard tones, and are rarely dominated by flat sky.
 */
const scoreMetrics = (metrics) => {
  const clutter = clamp01(metrics.edgeDensity / 0.12);
  const vivid = clamp01(metrics.vividRatio / 0.55);
  const green = clamp01(metrics.greenRatio / 0.35);
  const brown = clamp01(metrics.brownRatio / 0.35);
  const sky = clamp01(metrics.skyRatio / 0.45);

  let score =
    0.30 * vivid +
    0.28 * clutter +
    0.17 * green +
    0.15 * brown -
    0.32 * sky;

  // Reject flat, near-single-colour images (screenshots, documents, walls).
  if (metrics.edgeDensity < 0.015 && metrics.vividRatio < 0.12) score *= 0.4;

  score = clamp01(score);

  // Map to a 26..92 band so the number reads like a probability but is never
  // presented as certain - this engine is a heuristic, not a trained model.
  const confidence = Math.round(26 + score * 66);
  const isWaste = confidence >= env.AI_MIN_CONFIDENCE;

  let label = 'mixed-solid-waste';
  if (metrics.greenRatio > 0.28) label = 'organic-vegetation-waste';
  else if (metrics.brownRatio > 0.22) label = 'cellulose-cardboard-waste';
  else if (metrics.vividRatio > 0.38) label = 'plastic-packaging-waste';
  else if (metrics.grayRatio > 0.62) label = 'inert-construction-debris';

  return {
    isWaste,
    confidence: isWaste ? confidence : Math.min(confidence, env.AI_MIN_CONFIDENCE - 1),
    label: isWaste ? label : `unverified: ${label}`,
    engine: 'heuristic',
    model: 'jimp-color-texture-heuristic',
    labels: [
      { label, probability: Number((confidence / 100).toFixed(4)) },
      { label: `avg-saturation ${metrics.avgSaturation.toFixed(3)}`, probability: Number(metrics.avgSaturation.toFixed(4)) },
      { label: `edge-density ${metrics.edgeDensity.toFixed(4)}`, probability: Number(clamp01(metrics.edgeDensity / 0.12).toFixed(4)) },
      { label: `sky-ratio ${metrics.skyRatio.toFixed(3)}`, probability: Number(metrics.skyRatio.toFixed(4)) },
    ],
    metrics: {
      avgSaturation: Number(metrics.avgSaturation.toFixed(4)),
      avgLightness: Number(metrics.avgLightness.toFixed(4)),
      vividRatio: Number(metrics.vividRatio.toFixed(4)),
      greenRatio: Number(metrics.greenRatio.toFixed(4)),
      brownRatio: Number(metrics.brownRatio.toFixed(4)),
      grayRatio: Number(metrics.grayRatio.toFixed(4)),
      skyRatio: Number(metrics.skyRatio.toFixed(4)),
      edgeDensity: Number(metrics.edgeDensity.toFixed(6)),
      width: metrics.width,
      height: metrics.height,
    },
  };
};

/**
 * Analyse a buffer with the jimp heuristic engine.
 * @returns {Promise<object|null>} null when the image cannot be decoded
 */
const classifyWithHeuristic = async (buffer) => {
  try {
    const metrics = await analysePixels(buffer);
    return scoreMetrics(metrics);
  } catch (error) {
    console.warn('[ai] Heuristic analysis failed:', error.message);
    return null;
  }
};

/* -------------------------------------------------------------------------- */
/* 4. Public API                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Classify an image buffer.
 *
 * @param {Buffer} buffer raw image bytes (from multer memory storage)
 * @returns {Promise<{isWaste: boolean, confidence: number, label: string,
 *   engine: string, model: string, labels: Array<{label: string, probability: number}>}>}
 * @throws {ApiError} 400 when no image was supplied, 503 when no engine could run
 */
const classifyImage = async (buffer) => {
  if (!buffer || !buffer.length) {
    throw new ApiError(400, 'No image was received for verification.');
  }
  if (!env.AI_VERIFY_ENABLED) {
    throw new ApiError(503, 'Automatic image verification is currently disabled on this server.');
  }
  if (buffer.length < 64) {
    throw new ApiError(400, 'The uploaded file is not a valid image.');
  }

  // 1st choice: TensorFlow.js MobileNetV2.
  const modelResult = await classifyWithMobilenet(buffer);
  if (modelResult) return modelResult;

  // 2nd choice: deterministic colour/texture heuristic.
  const heuristicResult = await classifyWithHeuristic(buffer);
  if (heuristicResult) return heuristicResult;

  // Neither engine could decode the image (e.g. an unsupported codec).
  throw new ApiError(
    503,
    'The image could not be analysed automatically. Please upload a JPEG or PNG photo.'
  );
};

/** Report which engine is currently active (used by GET /api/ai/status). */
const getClassifierInfo = () => ({
  enabled: env.AI_VERIFY_ENABLED,
  minConfidence: env.AI_MIN_CONFIDENCE,
  rejectInvalid: env.AI_REJECT_INVALID,
  engine: env.AI_VERIFY_ENABLED ? (model ? 'mobilenet-v2' : modelUnavailable ? 'heuristic' : 'not-loaded') : 'disabled',
  tensorflowAvailable: Boolean(model),
  tensorflowError: modelError || null,
  keywords: WASTE_KEYWORDS.length,
});

module.exports = {
  classifyImage,
  getClassifierInfo,
  warmupClassifier,
  isModelUnavailable,
};
