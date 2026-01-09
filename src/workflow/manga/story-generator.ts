import { query } from "@anthropic-ai/claude-agent-sdk";
import type { TopicSource, MangaStory, MangaPanel, MangaIllustration } from "../../types/index.js";
import type { CharacterMap, CharacterDialogue } from "../../types/character.js";
import { MangaStoryGenerationError } from "../../errors/index.js";
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
          dialogues: {
            type: "array",
            description: "キャラクターのセリフ（複数キャラクターの会話）",
            items: {
              type: "object",
              properties: {
                characterId: { type: "string", description: "キャラクターID" },
                characterName: { type: "string", description: "キャラクター名" },
                text: { type: "string", description: "セリフ（15文字以内）" },
              },
              required: ["characterId", "characterName", "text"],
            },
          },
        },
        required: ["panelNumber", "panelType", "description", "dialogues"],
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
    dialogues: Array<{
      characterId: string;
      characterName: string;
      text: string;
    }>;
  }>;
  illustration: {
    description: string;
  };
  imagePrompt: string;
  shortText: string;
}

function buildCharacterDescriptions(characters: CharacterMap): string {
  const descriptions: string[] = [];
  for (const char of characters.values()) {
    const mainLabel = char.isMain ? " ★主軸キャラクター" : "";
    descriptions.push(`【${char.name}（ID: ${char.id}）】${mainLabel}
${char.prompt}`);
  }
  return descriptions.join("\n\n");
}

function buildSystemPrompt(characters: CharacterMap): string {
  const characterDescriptions = buildCharacterDescriptions(characters);
  const characterCount = characters.size;
  const characterIds = Array.from(characters.values()).map(c => `${c.id}（${c.name}）`).join(", ");

  return `あなたは4コマ漫画の作家です。
与えられたキャラクター設定とお題に基づいて、4コマ漫画のプロットを作成してください。

【登場キャラクター（${characterCount}人）】
${characterDescriptions}

【キャラクターID一覧】
${characterIds}

【重要な指示】
- 全キャラクターを4コマ内で活躍させてください
- キャラクター間の掛け合い・ボケとツッコミを活かしてください
- 各キャラクターの個性・口調・関係性を反映してください
- 主軸キャラクターを中心に物語を描いてください

【イラストスタイル】
2D漫画/アニメスタイル（参照画像が3Dでも2D漫画スタイルで描画）

【物語構造】
起承転結

【4コマ漫画のレイアウト】
- 左側60%: 4コマが縦に並ぶ（起・承・転・結）
- 右側40%: 物語の情景を描いた挿絵（全キャラクターを含む）

【出力形式】
以下をJSON形式で出力してください：
1. title: 4コマ漫画のタイトル
2. synopsis: あらすじ（50文字以内）
3. panels: 4コマの配列（各コマにpanelNumber, panelType, description, dialogues）
   - dialoguesは複数キャラクターの会話配列（characterId, characterName, text）
4. illustration: 右側の情景挿絵の説明（全キャラクターを含む）
5. imagePrompt: 4コマ漫画のスタイル・雰囲気を指定する英語プロンプト（レイアウト指示、各コマの詳細、キャラクター外見は別途追加するため含めないこと。全体の雰囲気・トーンのみ）
6. shortText: SNS投稿用テキスト（100文字以内）

【重要】
- 各セリフは15文字以内で簡潔に
- 1コマに複数キャラクターのセリフを入れることができます
- imagePromptは英語で簡潔に（詳細なレイアウトやキャラクター情報は後から追加される）

【面白い4コマを作るコツ】
1. オチから逆算: まず4コマ目の面白いオチを考え、そこに至る流れを逆算して設計する
2. 「転」で意外性: 3コマ目で読者の予想を裏切る展開を入れる（「そんなバカな！」と思わせる）
3. 日常からの逸脱: ありふれた状況から予想外の方向に話を転がす
4. シンプルに: 複雑な設定説明は避け、すぐに笑いに入る
5. 掛け合いを活かす: キャラクター間のボケとツッコミで笑いを生む`;
}

function buildUserPrompt(topic: TopicSource): string {
  return `【今日のお題】
${topic.topicText}

このお題に関連した4コマ漫画のプロットを作成してください。`;
}

export async function generateMangaStory(
  topic: TopicSource,
  characters: CharacterMap
): Promise<MangaStory> {
  logger.info({ topicText: topic.topicText, characterCount: characters.size }, "4コマ漫画プロット生成を開始");

  const systemPrompt = buildSystemPrompt(characters);
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
      dialogues: p.dialogues.map((d) => ({
        characterId: d.characterId,
        characterName: d.characterName,
        text: d.text,
      })) as CharacterDialogue[],
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
