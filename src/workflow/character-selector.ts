import { resolve } from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { TopicSource } from "../types/index.js";
import type { CharacterMap } from "../types/character.js";
import type {
  CharacterSelectionResult,
  CharacterSelectionDetail,
} from "../types/character-selection.js";
import { CharacterSelectionError } from "../errors/index.js";
import { logger } from "../lib/logger.js";

const MODEL = "claude-opus-4-5-20251101";

const outputSchema = {
  type: "object",
  properties: {
    selectedCharacterIds: {
      type: "array",
      items: { type: "string" },
      description: "選択されたキャラクターIDの配列",
    },
    selections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          characterId: { type: "string", description: "キャラクターID" },
          characterName: { type: "string", description: "キャラクター名" },
          selected: { type: "boolean", description: "選択されたかどうか" },
          reasoning: { type: "string", description: "選択/非選択の理由" },
          relevanceScore: {
            type: "number",
            description: "お題との関連度スコア（1-10）",
          },
        },
        required: [
          "characterId",
          "characterName",
          "selected",
          "reasoning",
          "relevanceScore",
        ],
      },
      description: "各キャラクターの選択判定詳細",
    },
    overallReasoning: {
      type: "string",
      description: "キャラクター選択の総合的な理由",
    },
  },
  required: ["selectedCharacterIds", "selections", "overallReasoning"],
} as const;

interface SelectionOutput {
  selectedCharacterIds: string[];
  selections: CharacterSelectionDetail[];
  overallReasoning: string;
}

function buildSystemPrompt(): string {
  return `あなたはキャラクターキャスティングの専門家です。
与えられたお題に対して、最も適したキャラクターを選択してください。

【役割】
- 各キャラクターの性格、設定、外見を総合的に分析する
- お題との関連性を評価する
- 物語として面白くなるキャラクターの組み合わせを選ぶ
- 参照画像からキャラクターのビジュアル特徴も考慮する

【重要な原則】
1. 主軸キャラクター（★マーク付き）は必ず選択に含めること
2. 単に人数を減らすのではなく、お題に最適な組み合わせを選ぶこと
3. 全員が適切な場合は全員選択してもよい
4. 各キャラクターについて、選択/非選択の理由を明確に説明すること
5. 主軸キャラクター1人のみでも可（ソロ活動に適したお題の場合）

【評価観点】
- お題との直接的な関連性（例：料理のお題→料理が得意なキャラ）
- 性格の適合性（例：競争系のお題→負けず嫌いなキャラ）
- キャラクター間のケミストリー（相性、掛け合いの面白さ）
- ビジュアルバランス（色彩、デザインの調和）`;
}

function buildUserPrompt(topic: TopicSource, characters: CharacterMap): string {
  const characterDetails: string[] = [];

  for (const char of characters.values()) {
    const mainLabel = char.isMain ? " ★主軸キャラクター（必ず選択）" : "";
    const imagePathsText =
      char.imagePaths.length > 0
        ? char.imagePaths
            .map((p, i) => `  - 参照画像${i + 1}: ${resolve(p)}`)
            .join("\n")
        : "  - 参照画像: なし";

    characterDetails.push(`【${char.name}（ID: ${char.id}）】${mainLabel}
性格・設定:
${char.prompt}

外見:
${char.appearancePrompt || "参照画像を参照"}

参照画像:
${imagePathsText}`);
  }

  return `【今日のお題】
${topic.topicText}

【登場候補キャラクター一覧（${characters.size}人）】

${characterDetails.join("\n\n---\n\n")}

上記のお題と各キャラクターの設定・外見・参照画像を分析し、
このお題に最も適したキャラクターを選択してください。

【選択基準】
1. お題との関連性（性格、興味、特技との親和性）
2. キャラクター同士の掛け合いの面白さ
3. ビジュアル的な多様性・調和
4. 物語の展開しやすさ

【制約】
- 主軸キャラクターは必ず選択してください
- ソロ活動向きのお題なら主軸キャラクター1人のみでもOK`;
}

export async function selectCharacters(
  topic: TopicSource,
  characters: CharacterMap
): Promise<CharacterSelectionResult> {
  logger.info(
    { topicText: topic.topicText, candidateCount: characters.size },
    "キャラクター選択を開始"
  );

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(topic, characters);

  try {
    let result: SelectionOutput | null = null;

    for await (const message of query({
      prompt: userPrompt,
      options: {
        model: MODEL,
        systemPrompt,
        allowedTools: [],
        outputFormat: {
          type: "json_schema",
          schema: outputSchema,
        },
      },
    })) {
      if (message.type === "result") {
        if (message.subtype === "success" && message.structured_output) {
          result = message.structured_output as SelectionOutput;
        } else if (message.subtype !== "success") {
          throw new CharacterSelectionError("キャラクター選択に失敗しました", {
            subtype: message.subtype,
          });
        }
      }
    }

    if (!result) {
      throw new CharacterSelectionError(
        "キャラクター選択の結果が取得できませんでした"
      );
    }

    // 主軸キャラクターが選択されているか確認
    const mainCharacter = [...characters.values()].find((c) => c.isMain);
    if (mainCharacter && !result.selectedCharacterIds.includes(mainCharacter.id)) {
      logger.warn(
        { mainCharacterId: mainCharacter.id },
        "主軸キャラクターが選択されていなかったため追加"
      );
      result.selectedCharacterIds.push(mainCharacter.id);
      // selectionsにも追加
      const existingSelection = result.selections.find(
        (s) => s.characterId === mainCharacter.id
      );
      if (existingSelection) {
        existingSelection.selected = true;
        existingSelection.reasoning += "（主軸キャラクターのため必須選択）";
      }
    }

    // 選択されたキャラクターのみのCharacterMapを作成
    const selectedCharacters: CharacterMap = new Map();
    for (const charId of result.selectedCharacterIds) {
      const char = characters.get(charId);
      if (char) {
        selectedCharacters.set(charId, char);
      }
    }

    // 選択結果をログ出力
    for (const detail of result.selections) {
      if (detail.selected) {
        logger.info(
          {
            characterId: detail.characterId,
            characterName: detail.characterName,
            relevanceScore: detail.relevanceScore,
            reasoning: detail.reasoning,
          },
          "✅ 選択"
        );
      } else {
        logger.info(
          {
            characterId: detail.characterId,
            characterName: detail.characterName,
            relevanceScore: detail.relevanceScore,
            reasoning: detail.reasoning,
          },
          "⏭️ スキップ"
        );
      }
    }

    logger.info(
      {
        selectedCount: selectedCharacters.size,
        selectedIds: Array.from(selectedCharacters.keys()),
        overallReasoning: result.overallReasoning,
      },
      "キャラクター選択完了"
    );

    return {
      selectedCharacters,
      selections: result.selections,
      overallReasoning: result.overallReasoning,
      selectionTimestamp: new Date(),
    };
  } catch (error) {
    if (error instanceof CharacterSelectionError) {
      throw error;
    }
    throw new CharacterSelectionError(
      `キャラクター選択中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
      { originalError: error }
    );
  }
}
