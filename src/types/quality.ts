// 共通モジュールから再エクスポート
export type { ImageAppearance } from "../workflow/shared/appearance-schema.js";

export interface QualityCheckResult {
  passed: boolean;
  score: number;
  characterAppearances: import("../workflow/shared/appearance-schema.js").ImageAppearance[];
  allCharactersPresent: boolean;
  allCharactersMatch: boolean;
  characterMatch: boolean;
  storyMatch: boolean;
  styleMatch: boolean;
  qualityMatch: boolean;
  issues: string[];
  suggestions: string[];
  checkedAt: Date;
}
