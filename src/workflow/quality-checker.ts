import { resolve } from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { GeneratedStory, GeneratedImage, QualityCheckResult } from "../types/index.js";
import type { CharacterMap } from "../types/character.js";
import { QualityCheckError } from "../errors/index.js";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { getAllImagePaths } from "../config/character-loader.js";
import {
  type ImageAppearance,
  imageAppearanceSchema,
  buildAppearanceCheckInstructions,
} from "./shared/appearance-schema.js";

const MODEL = "claude-opus-4-5-20251101";

const outputSchema = {
  type: "object",
  properties: {
    characterAppearances: {
      type: "array",
      items: imageAppearanceSchema,
      description: "各キャラクターの外見評価",
    },
    allCharactersPresent: { type: "boolean", description: "全キャラクターが画像内に存在するか" },
    allCharactersMatch: { type: "boolean", description: "全キャラクターが参照画像と一致するか" },
    passed: { type: "boolean", description: "全項目が満たされている場合のみtrue" },
    score: { type: "number", description: "総合スコア（0-100）" },
    characterMatch: { type: "boolean", description: "キャラクターの特徴が一致しているか" },
    storyMatch: { type: "boolean", description: "物語のシーン・状況と整合しているか" },
    styleMatch: { type: "boolean", description: "イラストスタイルが一致しているか" },
    qualityMatch: { type: "boolean", description: "画像に歪みや破綻がないか" },
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
  required: ["characterAppearances", "allCharactersPresent", "allCharactersMatch", "passed", "score", "characterMatch", "storyMatch", "styleMatch", "qualityMatch", "issues", "suggestions"],
} as const;

interface QualityCheckOutput {
  characterAppearances: ImageAppearance[];
  allCharactersPresent: boolean;
  allCharactersMatch: boolean;
  passed: boolean;
  score: number;
  characterMatch: boolean;
  storyMatch: boolean;
  styleMatch: boolean;
  qualityMatch: boolean;
  issues: string[];
  suggestions: string[];
}

function buildUserPrompt(
  generatedImagePath: string,
  referenceImagePaths: string[],
  characters: CharacterMap
): string {
  const refPathsText = referenceImagePaths.map((p, i) => `${i + 2}枚目: ${p}`).join("\n");
  const appearanceInstructions = buildAppearanceCheckInstructions(characters);

  return `あなたは先ほど物語を作成しました。
生成された挿絵がキャラクター設定と物語に適合しているかを評価してください。

${appearanceInstructions}

【その他の評価基準】
2. 物語のシーン・状況と画像が整合しているか
3. イラストのスタイル（${env.ILLUSTRATION_STYLE}）が一致しているか
4. 画像に歪みや破綻がないか

【判定】
- allCharactersPresent かつ allCharactersMatch かつ その他全項目がtrueの場合のみpassedをtrueにしてください
- 1つでも問題があればpassedはfalseです

以下の画像を評価してください：
1枚目（評価対象）: ${generatedImagePath}
${refPathsText}`;
}

export async function checkQuality(
  story: GeneratedStory,
  image: GeneratedImage,
  generatedImagePath: string,
  characters: CharacterMap
): Promise<QualityCheckResult> {
  logger.info({ sessionId: story.sessionId, characterCount: characters.size }, "品質チェックを開始");

  try {
    // 全キャラクターの参照画像のパスを絶対パスに変換
    const allImagePaths = getAllImagePaths(characters);
    const referenceImagePaths = allImagePaths.map((p) => resolve(p));
    const absoluteGeneratedImagePath = resolve(generatedImagePath);

    logger.info({ generatedImagePath: absoluteGeneratedImagePath, referenceCount: referenceImagePaths.length }, "画像パスを設定");

    const userPrompt = buildUserPrompt(absoluteGeneratedImagePath, referenceImagePaths, characters);
    let result: QualityCheckOutput | null = null;

    // セッションを再開して品質チェックを実行
    for await (const message of query({
      prompt: userPrompt,
      options: {
        model: MODEL,
        resume: story.sessionId,
        allowedTools: [],
        outputFormat: {
          type: "json_schema",
          schema: outputSchema,
        },
      },
    })) {
      if (message.type === "result") {
        if (message.subtype === "success" && message.structured_output) {
          result = message.structured_output as QualityCheckOutput;
        } else if (message.subtype !== "success") {
          throw new QualityCheckError("品質チェックに失敗しました", {
            subtype: message.subtype,
          });
        }
      }
    }

    if (!result) {
      throw new QualityCheckError("品質チェックの結果が取得できませんでした");
    }

    logger.info(
      {
        passed: result.passed,
        score: result.score,
        allCharactersPresent: result.allCharactersPresent,
        allCharactersMatch: result.allCharactersMatch,
        characterMatch: result.characterMatch,
        storyMatch: result.storyMatch,
        styleMatch: result.styleMatch,
        qualityMatch: result.qualityMatch,
      },
      "品質チェック完了"
    );

    return {
      passed: result.passed,
      score: result.score,
      characterAppearances: result.characterAppearances,
      allCharactersPresent: result.allCharactersPresent,
      allCharactersMatch: result.allCharactersMatch,
      characterMatch: result.characterMatch,
      storyMatch: result.storyMatch,
      styleMatch: result.styleMatch,
      qualityMatch: result.qualityMatch,
      issues: result.issues,
      suggestions: result.suggestions,
      checkedAt: new Date(),
    };
  } catch (error) {
    if (error instanceof QualityCheckError) {
      throw error;
    }
    throw new QualityCheckError(
      `品質チェック中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
      { originalError: error }
    );
  }
}
