import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { GeneratedStory, GeneratedImage, QualityCheckResult } from "../types/index.js";
import type { CharacterMap } from "../types/character.js";
import { ImageGenerationError } from "../errors/index.js";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { generateImage } from "./image-generator.js";
import { checkQuality } from "./quality-checker.js";
import { refineImagePrompt } from "./prompt-refiner.js";

export interface ImageWorkflowResult {
  image: GeneratedImage;
  qualityResult: QualityCheckResult;
  attempts: number;
  promptHistory: string[];
  outputPath: string;
}

async function saveImage(
  image: GeneratedImage,
  outputDir: string,
  attempt: number
): Promise<string> {
  await mkdir(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const ext = image.mimeType === "image/png" ? "png" : "jpg";
  const outputPath = join(outputDir, `generated-${timestamp}-attempt${attempt}.${ext}`);

  await writeFile(outputPath, image.data);

  return outputPath;
}

export async function executeImageWorkflow(
  story: GeneratedStory,
  outputDir: string,
  characters: CharacterMap
): Promise<ImageWorkflowResult> {
  const maxRetries = env.MAX_IMAGE_RETRY_COUNT;
  let currentPrompt = story.imagePrompt;
  const promptHistory: string[] = [];

  logger.info({ maxRetries, sessionId: story.sessionId, characterCount: characters.size }, "画像生成ワークフロー開始");

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    logger.info({ attempt, maxRetries }, `画像生成試行 ${attempt}/${maxRetries}`);

    // 1. 画像生成
    const image = await generateImage(story, characters, currentPrompt);
    promptHistory.push(image.prompt);

    // 2. 画像保存
    const outputPath = await saveImage(image, outputDir, attempt);
    logger.info({ outputPath }, "画像を保存しました");

    // 3. 品質チェック
    const qualityResult = await checkQuality(story, image, outputPath, characters);

    if (qualityResult.passed) {
      logger.info({ attempt, score: qualityResult.score }, "品質チェック合格");
      return {
        image,
        qualityResult,
        attempts: attempt,
        promptHistory,
        outputPath,
      };
    }

    logger.warn(
      {
        attempt,
        score: qualityResult.score,
        issues: qualityResult.issues,
      },
      "品質チェック不合格"
    );

    // 4. 最終試行でなければプロンプト調整
    if (attempt < maxRetries) {
      logger.info("プロンプトを改善して再試行します");
      currentPrompt = await refineImagePrompt(
        story.sessionId,
        currentPrompt,
        qualityResult.issues,
        qualityResult.suggestions
      );
    }
  }

  throw new ImageGenerationError(
    `${maxRetries}回の試行後も品質基準を満たせませんでした`,
    { promptHistory, maxRetries }
  );
}
