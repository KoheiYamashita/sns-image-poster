/**
 * プリセット更新
 *
 * 分析結果に基づいてプリセットのscheduleTimesを更新する。
 * 投稿回数（件数）は変更せず、時間のみを最適化する。
 */

import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import type { AnalysisOutput } from "./agent-analyzer.js";
import { logger } from "../../lib/logger.js";
import { ScheduleOptimizationError } from "../../errors/index.js";

/**
 * 更新結果
 */
export interface UpdateResult {
  presetPath: string;
  previousSchedule: string[];
  newSchedule: string[];
  updated: boolean;
  reason?: string;
}

/**
 * プリセットのscheduleTimesを更新
 *
 * @param presetName プリセット名
 * @param analysisResult 分析結果
 * @param options オプション
 * @returns 更新結果
 */
export function updatePresetSchedule(
  presetName: string,
  analysisResult: AnalysisOutput,
  options: {
    dryRun?: boolean;
    backupOriginal?: boolean;
  } = {}
): UpdateResult {
  const presetsDir = join(process.cwd(), "assets", "presets");
  const presetPath = join(presetsDir, `${presetName}.json`);

  if (!existsSync(presetPath)) {
    throw new ScheduleOptimizationError(
      `プリセットファイルが見つかりません: ${presetPath}`
    );
  }

  // プリセットを読み込み
  const content = readFileSync(presetPath, "utf-8");
  let preset: Record<string, unknown>;
  try {
    preset = JSON.parse(content) as Record<string, unknown>;
  } catch (error) {
    throw new ScheduleOptimizationError(
      `プリセットファイルの解析に失敗しました: ${presetPath}`,
      { error: error instanceof Error ? error.message : String(error) }
    );
  }

  // 現在のスケジュールを取得
  const currentSchedule = (preset["scheduleTimes"] as string[] | undefined) ?? [];

  const recommended = analysisResult.recommendedSchedule;

  // 件数が一致するか確認
  if (recommended.length !== currentSchedule.length) {
    return {
      presetPath,
      previousSchedule: currentSchedule,
      newSchedule: currentSchedule,
      updated: false,
      reason: `件数が一致しません（現在: ${currentSchedule.length}, 推奨: ${recommended.length}）`,
    };
  }

  // 変更がない場合はスキップ
  const hasChanges = currentSchedule.some((time, i) => time !== recommended[i]);

  if (!hasChanges) {
    return {
      presetPath,
      previousSchedule: currentSchedule,
      newSchedule: currentSchedule,
      updated: false,
      reason: "スケジュールに変更がありません",
    };
  }

  if (options.dryRun) {
    logger.info(
      {
        presetName,
        previousSchedule: currentSchedule,
        newSchedule: recommended,
      },
      "[DRY RUN] プリセットを更新します"
    );

    return {
      presetPath,
      previousSchedule: currentSchedule,
      newSchedule: recommended,
      updated: false,
      reason: "ドライランモードのため更新しませんでした",
    };
  }

  // バックアップを作成
  if (options.backupOriginal) {
    const backupPath = `${presetPath}.bak`;
    copyFileSync(presetPath, backupPath);
    logger.info({ backupPath }, "バックアップを作成しました");
  }

  // プリセットを更新
  preset["scheduleTimes"] = recommended;
  writeFileSync(presetPath, JSON.stringify(preset, null, 2) + "\n", "utf-8");

  logger.info(
    {
      presetName,
      previousSchedule: currentSchedule,
      newSchedule: recommended,
      reasoning: analysisResult.reasoning,
    },
    "プリセットを更新しました"
  );

  return {
    presetPath,
    previousSchedule: currentSchedule,
    newSchedule: recommended,
    updated: true,
  };
}
