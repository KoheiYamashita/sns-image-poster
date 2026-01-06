import type { GeneratedImage } from "../../types/index.js";

export interface ReferenceImage {
  data: Buffer;
  mimeType: string;
}

export interface ImageGenerationInput {
  prompt: string;
  referenceImages: ReferenceImage[];
  aspectRatio?: string;
}

export interface ImageGenerationProvider {
  generate(input: ImageGenerationInput): Promise<GeneratedImage>;
}
