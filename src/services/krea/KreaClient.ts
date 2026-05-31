/**
 * Krea AI Image Generation Integration
 *
 * Hermes tool + skill for Krea 2: foundation model with style transfer,
 * moodboard input, and adjustable creativity settings.
 *
 * Uses native fetch (no axios dependency).
 */

// ─── Configuration ─────────────────────────────────────────────────

const KREA_API_BASE = "https://api.krea.ai/v1";

export interface KreaConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
}

// ─── Types ───────────────────────────────────────────────────────────

export interface KreaGenerationParams {
  /** Text prompt */
  prompt: string;
  /** Negative prompt (what to avoid) */
  negativePrompt?: string;
  /** Aspect ratio: "1:1", "16:9", "9:16", "4:3", "3:4" */
  aspectRatio?: string;
  /** Width in pixels (overrides aspectRatio) */
  width?: number;
  /** Height in pixels (overrides aspectRatio) */
  height?: number;
  /** Number of images: 1-4 */
  numImages?: number;
  /** Creativity / randomness: 0.0-1.0 (default 0.5) */
  creativity?: number;
  /** Style preset or reference image URL for style transfer */
  styleReference?: string;
  /** Moodboard image URLs for visual guidance */
  moodboard?: string[];
  /** Seed for reproducibility */
  seed?: number;
  /** Output format: "png" | "jpeg" | "webp" */
  outputFormat?: string;
}

export interface KreaGenerationResult {
  id: string;
  images: Array<{
    url: string;
    seed: number;
    width: number;
    height: number;
  }>;
  status: "completed" | "pending" | "failed";
  prompt: string;
  createdAt: string;
}

// ─── Client ──────────────────────────────────────────────────────────

export class KreaClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: KreaConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || KREA_API_BASE;
  }

  /**
   * Generate images from text prompt.
   */
  async generate(params: KreaGenerationParams): Promise<KreaGenerationResult> {
    const url = `${this.baseUrl}/images/generations`;
    const payload = this.buildPayload(params);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(
        `Krea generation failed: ${response.status} ${response.statusText} — ${err}`
      );
    }

    return (await response.json()) as KreaGenerationResult;
  }

  /**
   * Generate with style transfer (reference image URL).
   */
  async generateWithStyleReference(
    params: KreaGenerationParams,
    styleImageUrl: string
  ): Promise<KreaGenerationResult> {
    // Use multipart/form-data via native FormData (browser/electron compatible)
    const url = `${this.baseUrl}/images/generations`;
    const form = new FormData();

    form.append("prompt", params.prompt);
    if (params.negativePrompt) form.append("negative_prompt", params.negativePrompt);
    if (params.aspectRatio) form.append("aspect_ratio", params.aspectRatio);
    if (params.numImages) form.append("num_images", String(params.numImages));
    if (params.creativity !== undefined) form.append("creativity", String(params.creativity));
    if (params.seed !== undefined) form.append("seed", String(params.seed));
    form.append("style_reference", styleImageUrl);

    if (params.moodboard?.length) {
      for (const mbUrl of params.moodboard) {
        form.append("moodboard", mbUrl);
      }
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: form,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(
        `Krea style-transfer failed: ${response.status} ${response.statusText} — ${err}`
      );
    }

    return (await response.json()) as KreaGenerationResult;
  }

  /**
   * Poll for generation status (async jobs).
   */
  async getStatus(generationId: string): Promise<KreaGenerationResult> {
    const url = `${this.baseUrl}/images/generations/${generationId}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!response.ok) {
      throw new Error(`Krea status check failed: ${response.status}`);
    }

    return (await response.json()) as KreaGenerationResult;
  }

  // ─── Helpers ───────────────────────────────────────────────────────

  private buildPayload(params: KreaGenerationParams): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      prompt: params.prompt,
    };

    if (params.negativePrompt) payload.negative_prompt = params.negativePrompt;
    if (params.aspectRatio) payload.aspect_ratio = params.aspectRatio;
    if (params.width) payload.width = params.width;
    if (params.height) payload.height = params.height;
    if (params.numImages) payload.num_images = params.numImages;
    if (params.creativity !== undefined) payload.creativity = params.creativity;
    if (params.styleReference) payload.style_reference = params.styleReference;
    if (params.moodboard?.length) payload.moodboard = params.moodboard;
    if (params.seed !== undefined) payload.seed = params.seed;
    if (params.outputFormat) payload.output_format = params.outputFormat;

    return payload;
  }
}

// ─── Singleton / Factory ─────────────────────────────────────────────

let _kreaClient: KreaClient | null = null;

export function getKreaClient(config?: KreaConfig): KreaClient {
  if (_kreaClient) return _kreaClient;
  if (!config?.apiKey) {
    const apiKey =
      (typeof process !== "undefined" && process.env?.KREA_API_KEY) ||
      "";
    if (!apiKey) {
      throw new Error(
        "Krea API key not configured. Set KREA_API_KEY env var or pass config.apiKey."
      );
    }
    config = { apiKey, baseUrl: KREA_API_BASE };
  }
  _kreaClient = new KreaClient(config);
  return _kreaClient;
}

export function resetKreaClient(): void {
  _kreaClient = null;
}

// ─── Convenience ───────────────────────────────────────────────────────

export async function generateImage(
  prompt: string,
  options?: Omit<KreaGenerationParams, "prompt">
): Promise<KreaGenerationResult> {
  const client = getKreaClient();
  return client.generate({ prompt, ...options });
}

export async function generateWithStyle(
  prompt: string,
  styleImageUrl: string,
  options?: Omit<KreaGenerationParams, "prompt">
): Promise<KreaGenerationResult> {
  const client = getKreaClient();
  return client.generateWithStyleReference({ prompt, ...options }, styleImageUrl);
}

export default KreaClient;
