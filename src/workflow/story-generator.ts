import { query } from "@anthropic-ai/claude-agent-sdk";
import type { TopicSource, GeneratedStory } from "../types/index.js";
import { StoryGenerationError } from "../errors/index.js";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

const MODEL = "claude-opus-4-5-20251101";

const outputSchema = {
  type: "object",
  properties: {
    story: { type: "string", description: "物語（フルバージョン）200-300文字程度" },
    shortStory: { type: "string", description: "物語（短縮版）100文字以内のSNS投稿用" },
    imagePrompt: { type: "string", description: "物語のワンシーンを描くための英語プロンプト" },
  },
  required: ["story", "shortStory", "imagePrompt"],
} as const;

interface StoryOutput {
  story: string;
  shortStory: string;
  imagePrompt: string;
}

function buildSystemPrompt(): string {
  return `あなたは創造的な物語作家です。
与えられたキャラクター設定とお題に基づいて、短い物語を作成してください。

【キャラクター設定】
${env.CHARACTER_PROMPT}

【イラストスタイル】
${env.ILLUSTRATION_STYLE}

【出力形式】
以下の3つをJSON形式で出力してください：
1. story: 物語（フルバージョン）200-300文字程度
2. shortStory: 物語（短縮版）100文字以内のSNS投稿用
3. imagePrompt: 物語のワンシーンを描くための英語プロンプト`;
}

function buildUserPrompt(topic: TopicSource): string {
  return `【今日のお題】
${topic.topicText}

このお題に関連した物語を作成してください。`;
}

export async function generateStory(topic: TopicSource): Promise<GeneratedStory> {
  logger.info({ topicText: topic.topicText }, "物語生成を開始");

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(topic);

  try {
    let result: StoryOutput | null = null;
    let sessionId: string | null = null;

    for await (const message of query({
      prompt: userPrompt,
      options: {
        model: MODEL,
        systemPrompt,
        allowedTools: [],
        persistSession: true,
        outputFormat: {
          type: "json_schema",
          schema: outputSchema,
        },
      },
    })) {
      if (message.type === "result") {
        sessionId = message.session_id;
        if (message.subtype === "success" && message.structured_output) {
          result = message.structured_output as StoryOutput;
        } else if (message.subtype !== "success") {
          throw new StoryGenerationError("物語生成に失敗しました", {
            subtype: message.subtype,
          });
        }
      }
    }

    if (!result) {
      throw new StoryGenerationError("物語生成の結果が取得できませんでした");
    }

    if (!sessionId) {
      throw new StoryGenerationError("セッションIDが取得できませんでした");
    }

    logger.info({ story: result.story, shortStory: result.shortStory, imagePrompt: result.imagePrompt, sessionId }, "物語生成完了");

    return {
      fullText: result.story,
      shortText: result.shortStory,
      imagePrompt: result.imagePrompt,
      sessionId,
      generatedAt: new Date(),
    };
  } catch (error) {
    if (error instanceof StoryGenerationError) {
      throw error;
    }
    throw new StoryGenerationError(
      `物語生成中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
      { originalError: error }
    );
  }
}
