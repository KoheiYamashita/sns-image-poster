/**
 * 単一キャラクターの定義
 */
export interface CharacterDefinition {
  /** キャラクターID（ディレクトリ名） */
  id: string;
  /** キャラクター名（prompt.txtから抽出） */
  name: string;
  /** キャラクタープロンプト（性格・設定） */
  prompt: string;
  /** 外見プロンプト（英語推奨） */
  appearancePrompt: string;
  /** 参照画像のパス配列 */
  imagePaths: string[];
  /** 主軸キャラクターかどうか */
  isMain: boolean;
}

/**
 * 複数キャラクターのマップ（ID -> CharacterDefinition）
 */
export type CharacterMap = Map<string, CharacterDefinition>;

/**
 * キャラクター別のセリフ
 */
export interface CharacterDialogue {
  characterId: string;
  characterName: string;
  text: string;
}
