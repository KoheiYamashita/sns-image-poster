/**
 * キャラクター外見チェック用の共通スキーマとテンプレート
 * イラストモード・漫画モード両方で使用される
 */

import type { CharacterMap } from "../../types/character.js";

/**
 * キャラクター外見の記述インターフェース
 */
export interface ImageAppearance {
  characterId: string;
  characterName: string;
  hairStyle: string;
  headwear: string;
  eyewear: string;
  clothing: string;
  accessories: string;
  matchesReference: boolean;
  isPresent: boolean;
}

/**
 * JSON Schema（API呼び出し用）
 */
export const imageAppearanceSchema = {
  type: "object",
  properties: {
    characterId: { type: "string", description: "キャラクターID" },
    characterName: { type: "string", description: "キャラクター名" },
    hairStyle: { type: "string", description: "髪型・髪色の説明" },
    headwear: { type: "string", description: "帽子・ヘッドフォンの説明（なければ「なし」）" },
    eyewear: { type: "string", description: "サングラス・眼鏡の説明（なければ「なし」）" },
    clothing: { type: "string", description: "服装の説明" },
    accessories: { type: "string", description: "アクセサリー（ペンダント等）の説明（なければ「なし」）" },
    matchesReference: { type: "boolean", description: "参照キャラクターと一致しているか" },
    isPresent: { type: "boolean", description: "画像内にキャラクターが存在するか" },
  },
  required: ["characterId", "characterName", "hairStyle", "headwear", "eyewear", "clothing", "accessories", "matchesReference", "isPresent"],
} as const;

/**
 * 複数キャラクター用の外見定義テキストを生成
 */
export function buildCharacterAppearanceDefinitions(characters: CharacterMap): string {
  const definitions: string[] = [];
  for (const char of characters.values()) {
    definitions.push(`【${char.name}（ID: ${char.id}）】${char.isMain ? " ★主軸キャラクター" : ""}
${char.appearancePrompt || "参照画像を参照"}`);
  }
  return definitions.join("\n\n");
}

/**
 * プロンプト用の復唱手順テンプレートを生成（複数キャラクター対応）
 * @param characters キャラクターマップ
 */
export function buildAppearanceCheckInstructions(characters: CharacterMap): string {
  const characterDefinitions = buildCharacterAppearanceDefinitions(characters);
  const characterIds = Array.from(characters.keys()).join(", ");

  return `【登場キャラクター外見の定義（これが正解）】
${characterDefinitions}

【重要：外見評価の手順】
以下の手順で厳密に評価してください：

STEP 1: 各キャラクターの外見を詳細に記述
characterAppearancesに、画像内で実際に見える各キャラクターの外見を詳細に記述してください。
評価対象のキャラクターID: ${characterIds}

各キャラクターについて以下を記述：
- characterId: キャラクターID
- characterName: キャラクター名
- hairStyle: 髪型・髪色（例：「金髪のツインテール」）
- headwear: 帽子・ヘッドフォン（例：「青いキャップと青いヘッドフォン」、なければ「なし」）
- eyewear: サングラス・眼鏡（例：「黒い丸サングラス」、なければ「なし」「目が露出」など）
- clothing: 服装（例：「水色のパーカー」）
- accessories: アクセサリー（例：「緑のペンダント」、なければ「なし」）
- matchesReference: 上記すべてが【キャラクター外見の定義】と一致していればtrue、1つでも違えばfalse
- isPresent: 画像内にそのキャラクターが存在していればtrue

STEP 2: 比較・判定
- allCharactersPresent: 全キャラクターのisPresentがtrueならtrue
- allCharactersMatch: 全キャラクターのmatchesReferenceがtrueならtrue
- characterMatch: allCharactersPresentかつallCharactersMatchがtrueならtrue

【アクセサリー優先ルール】
顔にかかるアクセサリー（サングラス、マスク等）は表情表現より優先されます。
- 「白目」「青ざめる」などの表情でも、アクセサリーは外れたり透明になったりしてはいけません
- アクセサリーを通して目が見える場合は matchesReference = false`;
}

/**
 * 漫画モード用：複数コマの復唱手順テンプレートを生成（複数キャラクター対応）
 * @param characters キャラクターマップ
 */
export function buildPanelAppearanceCheckInstructions(characters: CharacterMap): string {
  const characterDefinitions = buildCharacterAppearanceDefinitions(characters);
  const characterIds = Array.from(characters.keys()).join(", ");

  return `【登場キャラクター外見の定義（これが正解）】
${characterDefinitions}

【重要：評価手順】
以下の手順で厳密に評価してください：

STEP 1: 各コマの各キャラクター外見を個別に記述
panelDescriptionsに、各コマで実際に見える各キャラクターの外見を詳細に記述してください。
評価対象のキャラクターID: ${characterIds}

各キャラクターについて以下を記述：
- characterId: キャラクターID
- characterName: キャラクター名
- hairStyle: 髪型・髪色（例：「金髪のツインテール」）
- headwear: 帽子・ヘッドフォン（例：「青いキャップと青いヘッドフォン」、なければ「なし」）
- eyewear: サングラス・眼鏡（例：「黒い丸サングラス」、なければ「なし」「目が露出」など）
- clothing: 服装（例：「水色のパーカー」）
- accessories: アクセサリー（例：「緑のペンダント」、なければ「なし」）
- matchesReference: 上記すべてが【キャラクター外見の定義】と一致していればtrue、1つでも違えばfalse
- isPresent: 画像内にそのキャラクターが存在していればtrue

STEP 2: 比較・判定
- 各コマで全キャラクターのisPresentとmatchesReferenceを確認
- 1つでもisPresent=falseまたはmatchesReference=falseがあればcharacterConsistency = false

【アクセサリー優先ルール】
顔にかかるアクセサリー（サングラス、マスク等）は表情表現より優先されます。
- 「白目」「青ざめる」などの表情でも、アクセサリーは外れたり透明になったりしてはいけません
- アクセサリーを通して目が見える場合は matchesReference = false`;
}
