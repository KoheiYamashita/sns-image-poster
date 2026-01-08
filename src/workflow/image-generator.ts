import type { GeneratedStory, GeneratedImage } from "../types/index.js";
import { ImageGenerationError } from "../errors/index.js";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { GeminiProvider, loadReferenceImages } from "../providers/image-generation/index.js";

function buildImagePrompt(imagePrompt: string): string {
  const appearanceSection = env.CHARACTER_APPEARANCE_PROMPT
    ? `\nCharacter appearance: ${env.CHARACTER_APPEARANCE_PROMPT}\n`
    : "";

  return `Generate an illustration based on the following prompt.
Use the provided reference images as character design reference.
${appearanceSection}
${imagePrompt}

Style: ${env.ILLUSTRATION_STYLE}`;
}

export async function generateImage(
  story: GeneratedStory,
  customImagePrompt?: string
): Promise<GeneratedImage> {
  const imagePrompt = customImagePrompt ?? story.imagePrompt;
  logger.info({ imagePrompt }, "画像生成を開始");

  const provider = new GeminiProvider(env.GEMINI_API_KEY);

  try {
    // 参照画像を読み込み
    const referenceImages = await loadReferenceImages(env.CHARACTER_IMAGE_PATHS);
    logger.info({ count: referenceImages.length }, "参照画像を読み込み完了");

    // 画像生成
    const prompt = buildImagePrompt(imagePrompt);
    const image = await provider.generate({
      prompt,
      referenceImages,
      aspectRatio: env.ASPECT_RATIO,
    });

    logger.info(
      { mimeType: image.mimeType, size: image.data.length },
      "画像生成完了"
    );

    return image;
  } catch (error) {
    if (error instanceof ImageGenerationError) {
      throw error;
    }
    throw new ImageGenerationError(
      `画像生成中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
      { originalError: error }
    );
  }
}
