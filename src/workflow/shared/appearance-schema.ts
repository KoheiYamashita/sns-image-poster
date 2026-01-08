/**
 * キャラクター外見チェック用の共通スキーマとテンプレート
 * イラストモード・漫画モード両方で使用される
 */

/**
 * キャラクター外見の記述インターフェース
 */
export interface ImageAppearance {
  hairStyle: string;
  headwear: string;
  eyewear: string;
  clothing: string;
  accessories: string;
  matchesReference: boolean;
}

/**
 * JSON Schema（API呼び出し用）
 */
export const imageAppearanceSchema = {
  type: "object",
  properties: {
    hairStyle: { type: "string", description: "髪型・髪色の説明" },
    headwear: { type: "string", description: "帽子・ヘッドフォンの説明（なければ「なし」）" },
    eyewear: { type: "string", description: "サングラス・眼鏡の説明（なければ「なし」）" },
    clothing: { type: "string", description: "服装の説明" },
    accessories: { type: "string", description: "アクセサリー（ペンダント等）の説明（なければ「なし」）" },
    matchesReference: { type: "boolean", description: "参照キャラクターと一致しているか" },
  },
  required: ["hairStyle", "headwear", "eyewear", "clothing", "accessories", "matchesReference"],
} as const;

/**
 * プロンプト用の復唱手順テンプレートを生成
 * @param characterAppearance キャラクター外見の定義テキスト
 */
export function buildAppearanceCheckInstructions(characterAppearance: string): string {
  return `【キャラクター外見の定義（これが正解）】
${characterAppearance}

【重要：外見評価の手順】
以下の手順で厳密に評価してください：

STEP 1: キャラクター外見を詳細に記述
imageAppearanceに、画像内で実際に見えるキャラクターの外見を詳細に記述してください。
- hairStyle: 髪型・髪色（例：「金髪のツインテール」）
- headwear: 帽子・ヘッドフォン（例：「青いキャップと青いヘッドフォン」、なければ「なし」）
- eyewear: サングラス・眼鏡（例：「黒い丸サングラス」、なければ「なし」「目が露出」など）
- clothing: 服装（例：「水色のパーカー」）
- accessories: アクセサリー（例：「緑のペンダント」、なければ「なし」）
- matchesReference: 上記すべてが【キャラクター外見の定義】と一致していればtrue、1つでも違えばfalse

STEP 2: 比較・判定
matchesReferenceがfalseの場合、characterMatch = false

【アクセサリー優先ルール】
顔にかかるアクセサリー（サングラス、マスク等）は表情表現より優先されます。
- 「白目」「青ざめる」などの表情でも、アクセサリーは外れたり透明になったりしてはいけません
- アクセサリーを通して目が見える場合は matchesReference = false`;
}

/**
 * 漫画モード用：複数コマの復唱手順テンプレートを生成
 * @param characterAppearance キャラクター外見の定義テキスト
 */
export function buildPanelAppearanceCheckInstructions(characterAppearance: string): string {
  return `【キャラクター外見の定義（これが正解）】
${characterAppearance}

【重要：評価手順】
以下の手順で厳密に評価してください：

STEP 1: 各コマのキャラクター外見を個別に記述
panelDescriptionsに、各コマで実際に見えるキャラクターの外見を詳細に記述してください。
- hairStyle: 髪型・髪色（例：「金髪のツインテール」）
- headwear: 帽子・ヘッドフォン（例：「青いキャップと青いヘッドフォン」、なければ「なし」）
- eyewear: サングラス・眼鏡（例：「黒い丸サングラス」、なければ「なし」「目が露出」など）
- clothing: 服装（例：「水色のパーカー」）
- accessories: アクセサリー（例：「緑のペンダント」、なければ「なし」）
- matchesReference: 上記すべてが【キャラクター外見の定義】と一致していればtrue、1つでも違えばfalse

STEP 2: 比較・判定
各コマのmatchesReferenceを確認し、1つでもfalseがあればcharacterConsistency = false

【アクセサリー優先ルール】
顔にかかるアクセサリー（サングラス、マスク等）は表情表現より優先されます。
- 「白目」「青ざめる」などの表情でも、アクセサリーは外れたり透明になったりしてはいけません
- アクセサリーを通して目が見える場合は matchesReference = false`;
}
