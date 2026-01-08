import type { CharacterMap } from "./character.js";

/**
 * キャラクター選択の詳細情報
 */
export interface CharacterSelectionDetail {
  characterId: string;
  characterName: string;
  selected: boolean;
  reasoning: string;
  relevanceScore: number; // 1-10
}

/**
 * キャラクター選択の結果
 */
export interface CharacterSelectionResult {
  selectedCharacters: CharacterMap;
  selections: CharacterSelectionDetail[];
  overallReasoning: string;
  selectionTimestamp: Date;
}
