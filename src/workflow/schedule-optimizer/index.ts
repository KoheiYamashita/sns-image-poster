/**
 * 投稿時間最適化ワークフロー
 *
 * 投稿履歴からメトリクスを収集し、Agent SDKで分析して
 * プリセットの投稿時間を最適化する。
 */

import { collectMetrics, buildAnalysisInput } from "./collector.js";
import { analyzeWithAgent } from "./agent-analyzer.js";
import { updatePresetSchedule } from "./updater.js";
import { logger } from "../../lib/logger.js";

export { collectMetrics, buildAnalysisInput } from "./collector.js";
export { analyzeWithAgent, type AnalysisOutput } from "./agent-analyzer.js";
export { updatePresetSchedule, type UpdateResult } from "./updater.js";

/**
 * 最適化ワークフロー実行オプション
 */
export interface OptimizeOptions {
  dryRun?: boolean;
  backupOriginal?: boolean;
  historyWeeks?: number;
  currentSchedule: string[];
}

/**
 * 投稿時間最適化ワークフローを実行
 *
 * @param presetName プリセット名
 * @param options オプション
 */
export async function runScheduleOptimization(
  presetName: string,
  options: OptimizeOptions
): Promise<void> {
  logger.info({ presetName }, "投稿時間最適化ワークフローを開始");

  // Step 1: メトリクス収集
  const entries = await collectMetrics(presetName);

  if (entries.length === 0) {
    logger.info("投稿履歴がないため最適化をスキップ");
    return;
  }

  // 分析済みの投稿があるか確認
  const analyzedPosts = entries.filter((e) => e.analyzedAt && e.metrics);

  if (analyzedPosts.length === 0) {
    logger.info("分析済みの投稿がないため最適化をスキップ");
    return;
  }

  // Step 2: 分析データを構築
  const analysisInput = buildAnalysisInput(
    presetName,
    options.currentSchedule,
    options.historyWeeks ?? 4
  );

  if (analysisInput.posts.length === 0 && analysisInput.historicalData.length === 0) {
    logger.info("分析に使えるデータがないため最適化をスキップ");
    return;
  }

  // Step 3: Agent SDKで分析
  const analysisResult = await analyzeWithAgent(analysisInput);

  // Step 4: プリセット更新
  const updateResult = updatePresetSchedule(presetName, analysisResult, {
    dryRun: options.dryRun,
    backupOriginal: options.backupOriginal,
  });

  if (updateResult.updated) {
    logger.info(
      {
        previousSchedule: updateResult.previousSchedule,
        newSchedule: updateResult.newSchedule,
      },
      "投稿時間を最適化しました"
    );
  } else {
    logger.info(
      { reason: updateResult.reason },
      "投稿時間の更新はありませんでした"
    );
  }
}
