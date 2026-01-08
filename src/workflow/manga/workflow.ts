import { writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
  MangaStory,
  MangaWorkflowResult,
  MangaQualityCheckResult,
  GeneratedImage,
} from "../../types/index.js";
import {
  MangaImageGenerationError,
  MangaQualityCheckError,
} from "../../errors/index.js";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { generateMangaImage } from "./image-generator.js";
import {
  type ImageAppearance,
  imageAppearanceSchema,
  buildPanelAppearanceCheckInstructions,
} from "../shared/appearance-schema.js";

const MODEL = "claude-opus-4-5-20251101";

// 品質チェックのスキーマ（外見スキーマは共通モジュールから取得）
const qualityCheckSchema = {
  type: "object",
  properties: {
    panelDescriptions: {
      type: "object",
      description: "各コマのキャラクター外見を詳細に記述",
      properties: {
        panel1: imageAppearanceSchema,
        panel2: imageAppearanceSchema,
        panel3: imageAppearanceSchema,
        panel4: imageAppearanceSchema,
        illustration: imageAppearanceSchema,
      },
      required: ["panel1", "panel2", "panel3", "panel4", "illustration"],
    },
    passed: { type: "boolean", description: "全項目が満たされている場合のみtrue" },
    score: { type: "number", description: "総合スコア（0-100）" },
    characterConsistency: { type: "boolean", description: "全コマでキャラクターの外見が一貫しているか" },
    dialogueReadability: { type: "boolean", description: "セリフが読みやすいか" },
    layoutAccuracy: { type: "boolean", description: "4コマ+挿絵のレイアウトが正確か" },
    narrativeFlow: { type: "boolean", description: "起承転結の流れが自然か" },
    illustrationMatch: { type: "boolean", description: "挿絵が物語のテーマに合っているか" },
    issues: {
      type: "array",
      items: { type: "string" },
      description: "検出された問題点",
    },
    suggestions: {
      type: "array",
      items: { type: "string" },
      description: "改善提案",
    },
  },
  required: [
    "panelDescriptions",
    "passed",
    "score",
    "characterConsistency",
    "dialogueReadability",
    "layoutAccuracy",
    "narrativeFlow",
    "illustrationMatch",
    "issues",
    "suggestions",
  ],
} as const;

interface QualityCheckOutput {
  panelDescriptions: {
    panel1: ImageAppearance;
    panel2: ImageAppearance;
    panel3: ImageAppearance;
    panel4: ImageAppearance;
    illustration: ImageAppearance;
  };
  passed: boolean;
  score: number;
  characterConsistency: boolean;
  dialogueReadability: boolean;
  layoutAccuracy: boolean;
  narrativeFlow: boolean;
  illustrationMatch: boolean;
  issues: string[];
  suggestions: string[];
}

// プロンプト改善のスキーマ
const refinePromptSchema = {
  type: "object",
  properties: {
    refinedPrompt: { type: "string", description: "改善された英語の画像生成プロンプト" },
  },
  required: ["refinedPrompt"],
} as const;

interface RefineOutput {
  refinedPrompt: string;
}

async function saveImage(
  image: GeneratedImage,
  outputDir: string,
  attempt: number
): Promise<string> {
  await mkdir(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const ext = image.mimeType === "image/png" ? "png" : "jpg";
  const outputPath = join(outputDir, `manga-${timestamp}-attempt${attempt}.${ext}`);

  await writeFile(outputPath, image.data);

  return outputPath;
}

function buildQualityCheckPrompt(story: MangaStory, generatedImagePath: string, referenceImagePaths: string[]): string {
  const refPathsText = referenceImagePaths.map((p, i) => `${i + 2}枚目: ${p}`).join("\n");
  const characterAppearance = env.CHARACTER_APPEARANCE_PROMPT || "参照画像を参照";
  const appearanceInstructions = buildPanelAppearanceCheckInstructions(characterAppearance);

  return `あなたは先ほど4コマ漫画のプロットを作成しました。
生成された4コマ漫画画像が正しく生成されているかを評価してください。

${appearanceInstructions}

【その他の評価基準】
2. セリフ可読性: 各コマのセリフが吹き出し内に読みやすく表示されているか
3. レイアウト正確性: 左側に4コマが縦並び、右側に挿絵というレイアウトになっているか
4. 物語の流れ: 起承転結の流れが自然で、物語として成立しているか
5. 挿絵整合性: 右側の挿絵が物語のテーマ・雰囲気に合っているか

【期待されるプロット】
タイトル: ${story.title}
1コマ目（起）: ${story.panels[0].description} / セリフ: ${story.panels[0].dialogue}
2コマ目（承）: ${story.panels[1].description} / セリフ: ${story.panels[1].dialogue}
3コマ目（転）: ${story.panels[2].description} / セリフ: ${story.panels[2].dialogue}
4コマ目（結）: ${story.panels[3].description} / セリフ: ${story.panels[3].dialogue}
挿絵: ${story.illustration.description}

【判定】
- characterConsistencyを含む全項目がtrueの場合のみpassedをtrueにしてください
- 1つでも問題があればpassedはfalseです

以下の画像を評価してください：
1枚目（評価対象）: ${generatedImagePath}
${refPathsText}`;
}

async function checkMangaQuality(
  story: MangaStory,
  generatedImagePath: string
): Promise<MangaQualityCheckResult> {
  logger.info({ sessionId: story.sessionId }, "4コマ漫画品質チェックを開始");

  try {
    const referenceImagePaths = env.CHARACTER_IMAGE_PATHS.map((p) => resolve(p));
    const absoluteGeneratedImagePath = resolve(generatedImagePath);

    const userPrompt = buildQualityCheckPrompt(story, absoluteGeneratedImagePath, referenceImagePaths);
    let result: QualityCheckOutput | null = null;

    for await (const message of query({
      prompt: userPrompt,
      options: {
        model: MODEL,
        resume: story.sessionId,
        allowedTools: [],
        outputFormat: {
          type: "json_schema",
          schema: qualityCheckSchema,
        },
      },
    })) {
      if (message.type === "result") {
        if (message.subtype === "success" && message.structured_output) {
          result = message.structured_output as QualityCheckOutput;
        } else if (message.subtype !== "success") {
          throw new MangaQualityCheckError("4コマ漫画品質チェックに失敗しました", {
            subtype: message.subtype,
          });
        }
      }
    }

    if (!result) {
      throw new MangaQualityCheckError("4コマ漫画品質チェックの結果が取得できませんでした");
    }

    logger.info(
      {
        passed: result.passed,
        score: result.score,
        characterConsistency: result.characterConsistency,
        dialogueReadability: result.dialogueReadability,
        layoutAccuracy: result.layoutAccuracy,
        narrativeFlow: result.narrativeFlow,
        illustrationMatch: result.illustrationMatch,
      },
      "4コマ漫画品質チェック完了"
    );

    return {
      passed: result.passed,
      score: result.score,
      characterConsistency: result.characterConsistency,
      dialogueReadability: result.dialogueReadability,
      layoutAccuracy: result.layoutAccuracy,
      narrativeFlow: result.narrativeFlow,
      illustrationMatch: result.illustrationMatch,
      issues: result.issues,
      suggestions: result.suggestions,
      checkedAt: new Date(),
    };
  } catch (error) {
    if (error instanceof MangaQualityCheckError) {
      throw error;
    }
    throw new MangaQualityCheckError(
      `4コマ漫画品質チェック中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
      { originalError: error }
    );
  }
}

function buildRefinePrompt(
  originalPrompt: string,
  issues: string[],
  suggestions: string[]
): string {
  const issuesText = issues.length > 0 ? issues.map((i) => `- ${i}`).join("\n") : "- なし";
  const suggestionsText = suggestions.length > 0 ? suggestions.map((s) => `- ${s}`).join("\n") : "- なし";

  return `先ほどの4コマ漫画品質チェックで以下の問題が見つかりました。

【問題点】
${issuesText}

【改善提案】
${suggestionsText}

【元のプロンプト】
${originalPrompt}

上記の問題を解決するよう、4コマ漫画画像生成プロンプトを改善してください。
特に以下の点に注意してください：
- 4コマのレイアウト（左60%に4コマ縦並び、右40%に挿絵）を明確に指示
- 各コマのセリフを吹き出し内に読みやすく配置する指示
- キャラクターの外見一貫性の指示

改善されたプロンプトは英語で出力してください。`;
}

async function refineMangaPrompt(
  sessionId: string,
  originalPrompt: string,
  issues: string[],
  suggestions: string[]
): Promise<string> {
  logger.info({ sessionId, issueCount: issues.length }, "4コマ漫画プロンプト改善を開始");

  const prompt = buildRefinePrompt(originalPrompt, issues, suggestions);
  let result: RefineOutput | null = null;

  for await (const message of query({
    prompt,
    options: {
      model: MODEL,
      resume: sessionId,
      allowedTools: [],
      outputFormat: {
        type: "json_schema",
        schema: refinePromptSchema,
      },
    },
  })) {
    if (message.type === "result") {
      if (message.subtype === "success" && message.structured_output) {
        result = message.structured_output as RefineOutput;
      }
    }
  }

  if (!result) {
    logger.warn("プロンプト改善の結果が取得できませんでした。元のプロンプトを使用します");
    return originalPrompt;
  }

  logger.info({ refinedPrompt: result.refinedPrompt.substring(0, 50) + "..." }, "プロンプト改善完了");

  return result.refinedPrompt;
}

export async function executeMangaWorkflow(
  story: MangaStory,
  outputDir: string
): Promise<MangaWorkflowResult> {
  const maxRetries = env.MAX_IMAGE_RETRY_COUNT;
  let currentPrompt = story.imagePrompt;

  logger.info({ maxRetries, sessionId: story.sessionId, title: story.title }, "4コマ漫画ワークフロー開始");

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    logger.info({ attempt, maxRetries }, `4コマ漫画生成試行 ${attempt}/${maxRetries}`);

    // 1. 画像生成
    const image = await generateMangaImage(story, currentPrompt);

    // 2. 画像保存
    const outputPath = await saveImage(image, outputDir, attempt);
    logger.info({ outputPath }, "4コマ漫画画像を保存しました");

    // 3. 品質チェック
    const qualityResult = await checkMangaQuality(story, outputPath);

    if (qualityResult.passed) {
      logger.info({ attempt, score: qualityResult.score }, "4コマ漫画品質チェック合格");
      return {
        story,
        imagePath: outputPath,
        qualityResult,
        attempts: attempt,
      };
    }

    logger.warn(
      {
        attempt,
        score: qualityResult.score,
        issues: qualityResult.issues,
      },
      "4コマ漫画品質チェック不合格"
    );

    // 4. 最終試行でなければプロンプト調整
    if (attempt < maxRetries) {
      logger.info("プロンプトを改善して再試行します");
      currentPrompt = await refineMangaPrompt(
        story.sessionId,
        currentPrompt,
        qualityResult.issues,
        qualityResult.suggestions
      );
    }
  }

  throw new MangaImageGenerationError(
    `${maxRetries}回の試行後も4コマ漫画の品質基準を満たせませんでした`,
    { maxRetries }
  );
}
