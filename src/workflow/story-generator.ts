import { query } from "@anthropic-ai/claude-agent-sdk";
import type { TopicSource, GeneratedStory } from "../types/index.js";
import type { CharacterMap } from "../types/character.js";
import { StoryGenerationError } from "../errors/index.js";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

const MODEL = "claude-opus-4-5-20251101";

const outputSchema = {
  type: "object",
  properties: {
    story: { type: "string", description: "物語（フルバージョン）200-300文字程度" },
    shortStory: { type: "string", description: "物語（短縮版）100文字以内のSNS投稿用" },
    imagePrompt: { type: "string", description: "物語のワンシーンを描くための日本語プロンプト" },
  },
  required: ["story", "shortStory", "imagePrompt"],
} as const;

interface StoryOutput {
  story: string;
  shortStory: string;
  imagePrompt: string;
}

function buildCharacterDescriptions(characters: CharacterMap): string {
  const descriptions: string[] = [];
  for (const char of characters.values()) {
    const mainLabel = char.isMain ? " ★主軸キャラクター（物語の視点）" : "";
    descriptions.push(`【${char.name}（ID: ${char.id}）】${mainLabel}
${char.prompt}`);
  }
  return descriptions.join("\n\n");
}

function buildSystemPrompt(characters: CharacterMap): string {
  const characterDescriptions = buildCharacterDescriptions(characters);
  const characterCount = characters.size;

  return `あなたは創造的な物語作家です。
与えられたキャラクター設定とお題に基づいて、短い物語を作成してください。

【登場キャラクター（${characterCount}人）】
${characterDescriptions}

【重要な指示】
- 全キャラクターを物語に登場させてください
- キャラクター間の掛け合い（会話）を含めてください
- 各キャラクターの個性・口調を反映してください
- 主軸キャラクターの視点で物語を描いてください

【イラストスタイル】
${env.ILLUSTRATION_STYLE}

【出力形式】
以下の3つをJSON形式で出力してください：
1. story: 物語（フルバージョン）200-300文字程度
2. shortStory: 物語（短縮版）100文字以内のSNS投稿用
3. imagePrompt: シーンの状況・構図・雰囲気を描写する日本語プロンプト（キャラクターの外見情報は別途追加するため含めないこと。シーンの描写のみ）`;
}

function buildUserPrompt(topic: TopicSource): string {
  return `【今日のお題】
${topic.topicText}

このお題に関連した物語を作成してください。`;
}

export async function generateStory(
  topic: TopicSource,
  characters: CharacterMap
): Promise<GeneratedStory> {
  logger.info({ topicText: topic.topicText, characterCount: characters.size }, "物語生成を開始");

  const systemPrompt = buildSystemPrompt(characters);
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

    logger.info({ story: result.story, shortStory: result.shortStory, sessionId }, "物語生成完了");

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
