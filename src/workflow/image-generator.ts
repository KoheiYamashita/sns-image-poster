import type { GeneratedStory, GeneratedImage } from "../types/index.js";
import type { CharacterMap } from "../types/character.js";
import { ImageGenerationError } from "../errors/index.js";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { GeminiProvider, loadReferenceImages } from "../providers/image-generation/index.js";
import { getAllImagePaths } from "../config/character-loader.js";

function buildCharacterAppearances(characters: CharacterMap): string {
  const appearances: string[] = [];
  let index = 1;
  for (const char of characters.values()) {
    const mainLabel = char.isMain ? " (MAIN CHARACTER)" : "";
    appearances.push(`CHARACTER ${index}${mainLabel} - ${char.name}: ${char.appearancePrompt || "See reference images"}`);
    index++;
  }
  return appearances.join("\n");
}

function buildImagePrompt(imagePrompt: string, characters: CharacterMap): string {
  const characterAppearances = buildCharacterAppearances(characters);
  const characterCount = characters.size;

  return `Generate an illustration based on the following prompt.
Use the provided reference images as character design reference.
ALL ${characterCount} characters must appear in the image.

=== CHARACTERS (${characterCount} total) ===
${characterAppearances}

=== SCENE ===
${imagePrompt}

Style: ${env.ILLUSTRATION_STYLE}

IMPORTANT:
- All ${characterCount} characters must be clearly visible
- Each character must match their reference images exactly
- Show character interactions and spatial relationships`;
}

export async function generateImage(
  story: GeneratedStory,
  characters: CharacterMap,
  customImagePrompt?: string
): Promise<GeneratedImage> {
  const imagePrompt = customImagePrompt ?? story.imagePrompt;
  logger.info({ imagePrompt, characterCount: characters.size }, "画像生成を開始");

  const provider = new GeminiProvider(env.GEMINI_API_KEY);

  try {
    // 全キャラクターの参照画像を読み込み
    const allImagePaths = getAllImagePaths(characters);
    const referenceImages = await loadReferenceImages(allImagePaths);
    logger.info({ count: referenceImages.length }, "参照画像を読み込み完了");

    // 画像生成
    const prompt = buildImagePrompt(imagePrompt, characters);
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
