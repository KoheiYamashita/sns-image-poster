import { query } from "@anthropic-ai/claude-agent-sdk";
import type { GeneratedStory, TopicSource, FormattedPost } from "../types/index.js";
import { PostFormatError } from "../errors/index.js";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

const MODEL = "claude-opus-4-5-20251101";

const outputSchema = {
  type: "object",
  properties: {
    text: { type: "string", description: "投稿テキスト（ハッシュタグ含む）" },
    hashtags: {
      type: "array",
      items: { type: "string" },
      description: "使用したハッシュタグの配列",
    },
  },
  required: ["text", "hashtags"],
} as const;

interface PostOutput {
  text: string;
  hashtags: string[];
}

function buildHashtags(topic: TopicSource): string[] {
  const baseHashtags = env.POST_BASE_HASHTAGS;
  const topicHashtag = `#${topic.topicText}`;
  return [...baseHashtags, topicHashtag];
}

function buildPrompt(topic: TopicSource, hashtags: string[]): string {
  const hashtagsText = hashtags.join(" ");

  return `あなたは先ほど物語を作成しました。
この物語をSNS投稿用のテキストにまとめてください。

【投稿スタイル】
${env.POST_STYLE}

【お題】
${topic.topicText}

【ハッシュタグ】
以下のハッシュタグを投稿の最後に付けてください：
${hashtagsText}

【文字数制限】
- 目標: ${env.POST_TARGET_LENGTH}文字程度
- 最大: ${env.POST_MAX_LENGTH}文字以内（ハッシュタグ含む）

投稿テキストを作成してください。`;
}

export async function formatPost(
  story: GeneratedStory,
  topic: TopicSource
): Promise<FormattedPost> {
  logger.info({ sessionId: story.sessionId }, "投稿テキスト作成を開始");

  const hashtags = buildHashtags(topic);
  const prompt = buildPrompt(topic, hashtags);

  try {
    let result: PostOutput | null = null;

    for await (const message of query({
      prompt,
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
          result = message.structured_output as PostOutput;
        } else if (message.subtype !== "success") {
          throw new PostFormatError("投稿テキスト作成に失敗しました", {
            subtype: message.subtype,
          });
        }
      }
    }

    if (!result) {
      throw new PostFormatError("投稿テキストの結果が取得できませんでした");
    }

    const characterCount = result.text.length;

    if (characterCount > env.POST_MAX_LENGTH) {
      logger.warn(
        { characterCount, maxLength: env.POST_MAX_LENGTH },
        "投稿テキストが最大文字数を超えています"
      );
    }

    logger.info(
      { characterCount, hashtagCount: result.hashtags.length },
      "投稿テキスト作成完了"
    );

    return {
      text: result.text,
      hashtags: result.hashtags,
      characterCount,
      createdAt: new Date(),
    };
  } catch (error) {
    if (error instanceof PostFormatError) {
      throw error;
    }
    throw new PostFormatError(
      `投稿テキスト作成中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
      { originalError: error }
    );
  }
}
