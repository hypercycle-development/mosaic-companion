/**
 * Taste-Skill Preset Auto-Detection
 *
 * Scans user prompts / briefs for signal keywords and auto-selects
 * the best matching preset dial configuration.
 */

export interface PresetSignals {
  /** Signal phrases mapped to preset names */
  signals: Record<string, string[]>;
  /** Preset name → dial configuration */
  presets: Record<string, { designVariance: number; motionIntensity: number; visualDensity: number }>;
}

export const DEFAULT_PRESET_SIGNALS: PresetSignals = {
  signals: {
    "minimal-clean": [
      "minimal", "clean", "simple", "white space", "airy", "sparse",
      "gallery", "elegant", "refined", "subtle", "quiet",
    ],
    "exploratory-creative": [
      "explore", "concept", "mood", "artistic", "creative", "wild",
      "experimental", "sketch", "draft", "brainstorm", "playful",
      "artsy", "chaos",
    ],
    "brand-consistent": [
      "brand", "marketing", "product", "consistent", "corporate",
      "on-brand", "guideline", "identity", "logo", "professional",
      "commercial", "asset",
    ],
    "dense-complex": [
      "dense", "packed", "complex", "detailed", "rich", "maximalist",
      "cockpit", "dashboard", "data", "information", "heavy",
      "full", "busy",
    ],
    "motion-cinematic": [
      "motion", "animation", "video", "cinematic", "dynamic", "physics",
      "movement", "alive", "kinetic", "flow", "timeline", "sequence",
    ],
    "ui-landing": [
      "landing page", "hero", "cta", "saas", "conversion", "funnel",
      "mainstream", "web", "homepage", "splash",
    ],
    "tech-dark": [
      "dark mode", "cyberpunk", "neon", "terminal", "code", "dev",
      "tech", "hacker", "matrix", "glow", "futuristic",
    ],
  },

  presets: {
    "minimal-clean": { designVariance: 2, motionIntensity: 0, visualDensity: 2 },
    "exploratory-creative": { designVariance: 8, motionIntensity: 0, visualDensity: 6 },
    "brand-consistent": { designVariance: 3, motionIntensity: 0, visualDensity: 4 },
    "dense-complex": { designVariance: 9, motionIntensity: 0, visualDensity: 8 },
    "motion-cinematic": { designVariance: 6, motionIntensity: 10, visualDensity: 5 },
    "ui-landing": { designVariance: 7, motionIntensity: 0, visualDensity: 4 },
    "tech-dark": { designVariance: 8, motionIntensity: 3, visualDensity: 7 },
  },
};

/**
 * Scan text for signal keywords and return best-matching preset.
 */
export function detectPreset(
  text: string,
  signals: PresetSignals = DEFAULT_PRESET_SIGNALS
): {
  presetName: string;
  dials: { designVariance: number; motionIntensity: number; visualDensity: number };
  confidence: number;
  matchedSignals: string[];
} | null {
  const lowerText = text.toLowerCase();
  let bestPreset = "";
  let bestScore = 0;
  const matchedSignals: string[] = [];

  for (const [presetName, keywords] of Object.entries(signals.signals)) {
    let score = 0;
    for (const kw of keywords) {
      if (lowerText.includes(kw.toLowerCase())) {
        score += 1;
        if (!matchedSignals.includes(kw)) matchedSignals.push(kw);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestPreset = presetName;
    }
  }

  if (bestScore === 0) return null;

  const presetDials = signals.presets[bestPreset];
  if (!presetDials) return null;

  // Confidence = score / total unique keywords for that preset
  const totalKeywords = signals.signals[bestPreset].length;
  const confidence = Math.min(1.0, bestScore / Math.max(1, totalKeywords * 0.3));

  return {
    presetName: bestPreset,
    dials: presetDials,
    confidence,
    matchedSignals,
  };
}

/**
 * Auto-adjust Krea parameters based on detected preset.
 */
export function kreaParamsFromPreset(
  presetName: string,
  basePrompt: string
): {
  creativity: number;
  aspectRatio: string;
  numImages: number;
} {
  const signals = DEFAULT_PRESET_SIGNALS;
  const dials = signals.presets[presetName];
  if (!dials) return { creativity: 0.5, aspectRatio: "1:1", numImages: 1 };

  // Map DESIGN_VARIANCE (1-10) → creativity (0.0-1.0)
  const creativity = dials.designVariance / 10;

  // Aspect ratio based on prompt content
  let aspectRatio = "1:1";
  if (/landing|hero|banner|header|wide|panorama/i.test(basePrompt)) {
    aspectRatio = "16:9";
  } else if (/portrait|mobile|phone|vertical|story/i.test(basePrompt)) {
    aspectRatio = "9:16";
  } else if (/product|square|icon|avatar|profile/i.test(basePrompt)) {
    aspectRatio = "1:1";
  } else if (/slide|presentation|document|pdf/i.test(basePrompt)) {
    aspectRatio = "4:3";
  }

  // More images for exploratory, fewer for brand-consistent
  let numImages = 1;
  if (presetName === "exploratory-creative") numImages = 4;
  else if (presetName === "brand-consistent") numImages = 2;
  else if (presetName === "ui-landing") numImages = 3;

  return { creativity, aspectRatio, numImages };
}

export default { detectPreset, kreaParamsFromPreset };
