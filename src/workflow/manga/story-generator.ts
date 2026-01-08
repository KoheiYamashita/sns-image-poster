import { query } from "@anthropic-ai/claude-agent-sdk";
import type { TopicSource, MangaStory, MangaPanel, MangaIllustration } from "../../types/index.js";
import { MangaStoryGenerationError } from "../../errors/index.js";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";

const MODEL = "claude-opus-4-5-20251101";

const outputSchema = {
  type: "object",
  properties: {
    title: { type: "string", description: "4コマ漫画のタイトル" },
    synopsis: { type: "string", description: "あらすじ（50文字以内）" },
    panels: {
      type: "array",
      description: "4コマの各コマ",
      items: {
        type: "object",
        properties: {
          panelNumber: { type: "number", description: "コマ番号（1-4）" },
          panelType: {
            type: "string",
            enum: ["ki", "sho", "ten", "ketsu"],
            description: "起承転結のタイプ",
          },
          description: { type: "string", description: "シーンの説明" },
          dialogue: { type: "string", description: "キャラクターのセリフ（20文字以内）" },
        },
        required: ["panelNumber", "panelType", "description", "dialogue"],
      },
      minItems: 4,
      maxItems: 4,
    },
    illustration: {
      type: "object",
      description: "右側の情景挿絵",
      properties: {
        description: { type: "string", description: "挿絵の説明" },
      },
      required: ["description"],
    },
    imagePrompt: {
      type: "string",
      description: "4コマ漫画全体を1枚の画像として生成するための英語プロンプト",
    },
    shortText: { type: "string", description: "SNS投稿用テキスト（100文字以内）" },
  },
  required: ["title", "synopsis", "panels", "illustration", "imagePrompt", "shortText"],
} as const;

interface MangaStoryOutput {
  title: string;
  synopsis: string;
  panels: Array<{
    panelNumber: number;
    panelType: "ki" | "sho" | "ten" | "ketsu";
    description: string;
    dialogue: string;
  }>;
  illustration: {
    description: string;
  };
  imagePrompt: string;
  shortText: string;
}

function buildSystemPrompt(): string {
  return `あなたは4コマ漫画の作家です。
与えられたキャラクター設定とお題に基づいて、4コマ漫画のプロットを作成してください。

【キャラクター設定】
${env.CHARACTER_PROMPT}

【イラストスタイル】
2D漫画/アニメスタイル（参照画像が3Dでも2D漫画スタイルで描画）

【物語構造】
起承転結

【4コマ漫画のレイアウト】
- 左側60%: 4コマが縦に並ぶ（起・承・転・結）
- 右側40%: 物語の情景を描いた挿絵

【出力形式】
以下をJSON形式で出力してください：
1. title: 4コマ漫画のタイトル
2. synopsis: あらすじ（50文字以内）
3. panels: 4コマの配列（各コマにpanelNumber, panelType, description, dialogue）
4. illustration: 右側の情景挿絵の説明
5. imagePrompt: 4コマ漫画全体を1枚の画像として生成するための英語プロンプト
   - レイアウト指示（左60%に4コマ縦並び、右40%に挿絵）を含める
   - 各コマの内容とセリフを含める
   - キャラクターの外見を含める
6. shortText: SNS投稿用テキスト（100文字以内）

【重要】
- 各コマのセリフは20文字以内で簡潔に
- imagePromptは英語で、Geminiが1枚の画像として生成できるよう詳細に記述

【面白い4コマを作るコツ】
1. オチから逆算: まず4コマ目の面白いオチを考え、そこに至る流れを逆算して設計する
2. 「転」で意外性: 3コマ目で読者の予想を裏切る展開を入れる（「そんなバカな！」と思わせる）
3. 日常からの逸脱: ありふれた状況から予想外の方向に話を転がす
4. シンプルに: 複雑な設定説明は避け、すぐに笑いに入る`;
}

function buildUserPrompt(topic: TopicSource): string {
  return `【今日のお題】
${topic.topicText}

このお題に関連した4コマ漫画のプロットを作成してください。`;
}

export async function generateMangaStory(topic: TopicSource): Promise<MangaStory> {
  logger.info({ topicText: topic.topicText }, "4コマ漫画プロット生成を開始");

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(topic);

  try {
    let result: MangaStoryOutput | null = null;
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
          result = message.structured_output as MangaStoryOutput;
        } else if (message.subtype !== "success") {
          throw new MangaStoryGenerationError("4コマ漫画プロット生成に失敗しました", {
            subtype: message.subtype,
          });
        }
      }
    }

    if (!result) {
      throw new MangaStoryGenerationError("4コマ漫画プロット生成の結果が取得できませんでした");
    }

    if (!sessionId) {
      throw new MangaStoryGenerationError("セッションIDが取得できませんでした");
    }

    // 型変換
    const panels = result.panels.map((p) => ({
      panelNumber: p.panelNumber as 1 | 2 | 3 | 4,
      panelType: p.panelType,
      description: p.description,
      dialogue: p.dialogue,
    })) as [MangaPanel, MangaPanel, MangaPanel, MangaPanel];

    const illustration: MangaIllustration = {
      description: result.illustration.description,
    };

    logger.info(
      {
        title: result.title,
        synopsis: result.synopsis,
        panels: result.panels,
        illustration: result.illustration,
        imagePrompt: result.imagePrompt,
        shortText: result.shortText,
        sessionId,
      },
      "4コマ漫画プロット生成完了"
    );

    return {
      title: result.title,
      synopsis: result.synopsis,
      panels,
      illustration,
      imagePrompt: result.imagePrompt,
      shortText: result.shortText,
      sessionId,
      generatedAt: new Date(),
    };
  } catch (error) {
    if (error instanceof MangaStoryGenerationError) {
      throw error;
    }
    throw new MangaStoryGenerationError(
      `4コマ漫画プロット生成中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
      { originalError: error }
    );
  }
}
