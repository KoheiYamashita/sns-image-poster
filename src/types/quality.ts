export interface QualityCheckResult {
  passed: boolean;
  score: number;
  characterMatch: boolean;
  storyMatch: boolean;
  styleMatch: boolean;
  qualityMatch: boolean;
  issues: string[];
  suggestions: string[];
  checkedAt: Date;
}
