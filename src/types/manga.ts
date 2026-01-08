import type { CharacterDialogue } from "./character.js";

/** コンテンツ生成モード */
export type ContentMode = "illustration" | "manga";

/** 4コマの各コマ */
export interface MangaPanel {
  panelNumber: 1 | 2 | 3 | 4;
  panelType: "ki" | "sho" | "ten" | "ketsu";
  description: string;
  dialogues: CharacterDialogue[];
}

/** 情景挿絵 */
export interface MangaIllustration {
  description: string;
}

/** 4コマ漫画のプロット */
export interface MangaStory {
  title: string;
  synopsis: string;
  panels: [MangaPanel, MangaPanel, MangaPanel, MangaPanel];
  illustration: MangaIllustration;
  imagePrompt: string;
  shortText: string;
  sessionId: string;
  generatedAt: Date;
}

/** 4コマ漫画ワークフロー結果 */
export interface MangaWorkflowResult {
  story: MangaStory;
  imagePath: string;
  qualityResult: MangaQualityCheckResult;
  attempts: number;
}

/** 4コマ漫画品質チェック結果 */
export interface MangaQualityCheckResult {
  passed: boolean;
  score: number;
  characterConsistency: boolean;
  dialogueReadability: boolean;
  layoutAccuracy: boolean;
  narrativeFlow: boolean;
  illustrationMatch: boolean;
  issues: string[];
  suggestions: string[];
  checkedAt: Date;
}
