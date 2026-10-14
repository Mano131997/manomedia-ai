import { PROVIDERS, anyProviderEnabled, type ProviderId } from "./providers";

// Model catalogue. To add or swap a model, add an entry here.
// Endpoint IDs and input fields come from each model's API page:
//   Higgsfield: https://docs.higgsfield.ai/docs/models   fal.ai: https://fal.ai/models
// Costs are estimates in US dollar cents, for the usage overview and budget limits.
// Only models whose provider has a key in .env are shown (all of them in demo mode).

export const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4"] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export type ImageParams = {
  prompt: string;
  aspectRatio: AspectRatio;
  count: number; // only used when the model supports batches
  referenceUrls: string[];
};

export type VideoParams = {
  prompt: string;
  aspectRatio: AspectRatio;
  duration: 5 | 10;
  startImageUrl?: string;
};

export type ImageModel = {
  id: string;
  type: "image";
  provider: ProviderId;
  label: string;
  description: string;
  centsPerImage: number;
  /** Max reference images; 0 = text only. */
  maxReferences: number;
  /** True when one request can return several images; otherwise we send one request per image. */
  batch: boolean;
  endpoint: (p: ImageParams) => string;
  input: (p: ImageParams) => Record<string, unknown>;
};

export type VideoModel = {
  id: string;
  type: "video";
  provider: ProviderId;
  label: string;
  description: string;
  centsPerSecond: number;
  aspectRatios: AspectRatio[];
  supportsStartImage: boolean;
  requiresStartImage: boolean;
  endpoint: (p: VideoParams) => string;
  input: (p: VideoParams) => Record<string, unknown>;
};

export type Model = ImageModel | VideoModel;

const FLUX_SIZE: Record<AspectRatio, string> = {
  "1:1": "square_hd",
  "16:9": "landscape_16_9",
  "9:16": "portrait_16_9",
  "4:3": "landscape_4_3",
  "3:4": "portrait_4_3",
};

export const IMAGE_MODELS: ImageModel[] = [
  // --- Higgsfield ---
  {
    id: "hf-seedream-4",
    type: "image",
    provider: "higgsfield",
    label: "Seedream 4.0",
    description: "ByteDance. Veelzijdig, scherp in 2K, kan foto's bewerken met referenties.",
    centsPerImage: 3,
    maxReferences: 4,
    batch: false,
    // Text-to-image is confirmed in Higgsfield's SDK; the edit endpoint follows the same naming.
    endpoint: (p) => (p.referenceUrls.length ? "bytedance/seedream/v4/edit" : "bytedance/seedream/v4/text-to-image"),
    input: (p) =>
      p.referenceUrls.length
        ? { prompt: p.prompt, image_urls: p.referenceUrls, resolution: "2K" }
        : { prompt: p.prompt, resolution: "2K", aspect_ratio: p.aspectRatio, camera_fixed: false },
  },
  {
    id: "hf-flux-kontext-max",
    type: "image",
    provider: "higgsfield",
    label: "FLUX Kontext Max",
    description: "Black Forest Labs. Fotorealistisch, sterk in compositie en tekst.",
    centsPerImage: 8,
    maxReferences: 0,
    batch: false,
    endpoint: () => "flux-pro/kontext/max/text-to-image",
    input: (p) => ({ prompt: p.prompt, aspect_ratio: p.aspectRatio, safety_tolerance: 2 }),
  },
  // --- fal.ai ---
  {
    id: "nano-banana",
    type: "image",
    provider: "fal",
    label: "Nano Banana (fal)",
    description: "Google. Sterk in tekst in beelden en in bewerken met referentiefoto's.",
    centsPerImage: 4,
    maxReferences: 4,
    batch: true,
    endpoint: (p) => (p.referenceUrls.length ? "fal-ai/nano-banana/edit" : "fal-ai/nano-banana"),
    input: (p) =>
      p.referenceUrls.length
        ? { prompt: p.prompt, image_urls: p.referenceUrls, num_images: p.count }
        : { prompt: p.prompt, num_images: p.count, aspect_ratio: p.aspectRatio },
  },
  {
    id: "flux-schnell",
    type: "image",
    provider: "fal",
    label: "FLUX Schnell (fal)",
    description: "Snel en goedkoop, goed voor schetsen en ideeën.",
    centsPerImage: 1,
    maxReferences: 0,
    batch: true,
    endpoint: () => "fal-ai/flux/schnell",
    input: (p) => ({ prompt: p.prompt, image_size: FLUX_SIZE[p.aspectRatio], num_images: p.count }),
  },
];

export const VIDEO_MODELS: VideoModel[] = [
  // --- Higgsfield ---
  {
    id: "hf-kling-2.6-pro",
    type: "video",
    provider: "higgsfield",
    label: "Kling 2.6 Pro",
    description: "Vloeiende, filmische beweging. Tekst of startbeeld naar video.",
    centsPerSecond: 7,
    aspectRatios: ["16:9", "9:16", "1:1"],
    supportsStartImage: true,
    requiresStartImage: false,
    endpoint: (p) =>
      p.startImageUrl ? "kling-video/v2.6/pro/image-to-video" : "kling-video/v2.6/pro/text-to-video",
    input: (p) =>
      p.startImageUrl
        ? { prompt: p.prompt, image_url: p.startImageUrl, duration: p.duration }
        : { prompt: p.prompt, duration: p.duration, aspect_ratio: p.aspectRatio },
  },
  {
    id: "hf-kling-3.0-std",
    type: "video",
    provider: "higgsfield",
    label: "Kling 3.0",
    description: "Nieuwste Kling. Start vanaf een beeld.",
    centsPerSecond: 10,
    aspectRatios: [],
    supportsStartImage: true,
    requiresStartImage: true,
    endpoint: () => "kling-video/v3.0/std/image-to-video",
    input: (p) => ({ prompt: p.prompt, image_url: p.startImageUrl, duration: p.duration }),
  },
  // --- fal.ai ---
  {
    id: "kling-2.6-pro",
    type: "video",
    provider: "fal",
    label: "Kling 2.6 Pro (fal)",
    description: "Zelfde model via fal.ai.",
    centsPerSecond: 7,
    aspectRatios: ["16:9", "9:16", "1:1"],
    supportsStartImage: true,
    requiresStartImage: false,
    endpoint: (p) =>
      p.startImageUrl ? "fal-ai/kling-video/v2.6/pro/image-to-video" : "fal-ai/kling-video/v2.6/pro/text-to-video",
    input: (p) =>
      p.startImageUrl
        ? { prompt: p.prompt, image_url: p.startImageUrl, duration: String(p.duration) }
        : { prompt: p.prompt, duration: String(p.duration), aspect_ratio: p.aspectRatio },
  },
];

export function getModel(id: string): Model | undefined {
  return [...IMAGE_MODELS, ...VIDEO_MODELS].find((m) => m.id === id);
}

/** Models whose provider has a key; everything in demo mode. */
export function availableModels() {
  const demo = !anyProviderEnabled();
  const ok = (m: Model) => demo || PROVIDERS[m.provider].enabled();
  return { image: IMAGE_MODELS.filter(ok), video: VIDEO_MODELS.filter(ok) };
}

/** What the browser needs to render the pickers (no functions). */
export function publicModels() {
  const { image, video } = availableModels();
  return {
    image: image.map(({ id, label, description, centsPerImage, maxReferences }) => ({
      id, label, description, centsPerImage, maxReferences,
    })),
    video: video.map(({ id, label, description, centsPerSecond, aspectRatios, supportsStartImage, requiresStartImage }) => ({
      id, label, description, centsPerSecond, aspectRatios, supportsStartImage, requiresStartImage,
    })),
  };
}
export type PublicModels = ReturnType<typeof publicModels>;
