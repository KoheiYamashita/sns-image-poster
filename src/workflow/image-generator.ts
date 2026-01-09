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
    const mainLabel = char.isMain ? "（主人公）" : "";
    appearances.push(`キャラクター${index}${mainLabel} - ${char.name}: ${char.appearancePrompt || "参照画像を参照"}`);
    index++;
  }
  return appearances.join("\n");
}

function buildImagePrompt(imagePrompt: string, characters: CharacterMap): string {
  const characterAppearances = buildCharacterAppearances(characters);
  const characterCount = characters.size;

  return `以下のプロンプトに基づいてイラストを生成してください。
提供された参照画像をキャラクターデザインの参考として使用してください。
全${characterCount}名のキャラクターが画像に登場する必要があります。

=== キャラクター（全${characterCount}名） ===
${characterAppearances}

=== シーン ===
${imagePrompt}

スタイル: ${env.ILLUSTRATION_STYLE}

重要事項:
- 全${characterCount}名のキャラクターがはっきりと見えること
- 各キャラクターは参照画像と正確に一致させること
- キャラクター同士の関係性と空間的な配置を表現すること`;
}

export async function generateImage(
  story: GeneratedStory,
  characters: CharacterMap,
  customImagePrompt?: string
): Promise<GeneratedImage | null> {
  const imagePrompt = customImagePrompt ?? story.imagePrompt;
  logger.info({ characterCount: characters.size }, "画像生成を開始");

  try {
    // 全キャラクターの参照画像を読み込み
    const allImagePaths = getAllImagePaths(characters);
    const referenceImages = await loadReferenceImages(allImagePaths);
    logger.info({ count: referenceImages.length }, "参照画像を読み込み完了");

    // 画像生成プロンプトを構築
    const prompt = buildImagePrompt(imagePrompt, characters);
    logger.info("Geminiに渡す画像生成プロンプト:\n" + prompt);

    // APIキーがない場合はプロンプト出力のみで終了
    if (!env.GEMINI_API_KEY) {
      logger.info("GEMINI_API_KEYが設定されていないため、画像生成をスキップします");
      return null;
    }

    const provider = new GeminiProvider(env.GEMINI_API_KEY);
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
