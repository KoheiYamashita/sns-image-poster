// 共通モジュールから再エクスポート
export type { ImageAppearance } from "../workflow/shared/appearance-schema.js";

export interface QualityCheckResult {
  passed: boolean;
  score: number;
  imageAppearance: import("../workflow/shared/appearance-schema.js").ImageAppearance;
  characterMatch: boolean;
  storyMatch: boolean;
  styleMatch: boolean;
  qualityMatch: boolean;
  issues: string[];
  suggestions: string[];
  checkedAt: Date;
}
