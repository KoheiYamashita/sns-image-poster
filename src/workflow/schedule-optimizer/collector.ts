/**
 * メトリクス収集
 *
 * 投稿履歴から分析対象を抽出し、TwitterAPI.ioでメトリクスを取得する。
 */

import {
  loadPostHistory,
  getPostsToAnalyze,
  updatePostHistory,
  getAnalyzedPostsByWeek,
  type PostHistoryEntry,
  type PostMetrics,
} from "../../lib/post-history.js";
import { TwitterApiIoAnalyticsProvider } from "../../providers/analytics/index.js";
import { logger } from "../../lib/logger.js";

/**
 * 分析対象の投稿からメトリクスを収集し、履歴を更新
 *
 * @param presetName プリセット名
 * @returns 更新された投稿履歴
 */
export async function collectMetrics(
  presetName: string
): Promise<PostHistoryEntry[]> {
  const entries = loadPostHistory(presetName);

  if (entries.length === 0) {
    logger.info({ presetName }, "投稿履歴がありません");
    return [];
  }

  const postsToAnalyze = getPostsToAnalyze(entries);

  if (postsToAnalyze.length === 0) {
    logger.info({ presetName }, "分析対象の投稿がありません");
    return entries;
  }

  logger.info(
    { presetName, count: postsToAnalyze.length },
    "分析対象の投稿を検出"
  );

  const analyticsProvider = new TwitterApiIoAnalyticsProvider();

  for (const post of postsToAnalyze) {
    // Twitter投稿のみメトリクスを取得
    const twitterPost = post.platforms.find((p) => p.platform === "TWITTER");

    if (!twitterPost) {
      logger.info(
        { timestamp: post.timestamp },
        "Twitter投稿がないためスキップ"
      );
      continue;
    }

    try {
      const metrics = await analyticsProvider.getTweetMetrics(twitterPost.postId);

      // 投稿履歴にメトリクスを追加
      const entryIndex = entries.findIndex(
        (e) => e.timestamp === post.timestamp
      );
      if (entryIndex !== -1) {
        const postMetrics: PostMetrics = {
          viewCount: metrics.viewCount,
          likeCount: metrics.likeCount,
          retweetCount: metrics.retweetCount,
          replyCount: metrics.replyCount,
          quoteCount: metrics.quoteCount,
          bookmarkCount: metrics.bookmarkCount,
        };

        const existingEntry = entries[entryIndex]!;
        entries[entryIndex] = {
          timestamp: existingEntry.timestamp,
          topic: existingEntry.topic,
          isHoliday: existingEntry.isHoliday,
          platforms: existingEntry.platforms,
          analyzedAt: new Date().toISOString(),
          metrics: postMetrics,
        };

        logger.info(
          {
            tweetId: twitterPost.postId,
            viewCount: metrics.viewCount,
            likeCount: metrics.likeCount,
          },
          "メトリクスを取得・保存"
        );
      }
    } catch (error) {
      logger.error(
        { tweetId: twitterPost.postId, error },
        "メトリクス取得に失敗"
      );
    }
  }

  // 更新された履歴を保存
  updatePostHistory(presetName, entries);

  return entries;
}

/**
 * 投稿エントリを分析用のデータ形式に変換
 */
function toAnalysisPost(entry: PostHistoryEntry): AnalysisInput["posts"][number] {
  const postDate = new Date(entry.timestamp);
  return {
    timestamp: entry.timestamp,
    dayOfWeek: postDate.getDay(),
    hour: postDate.getHours(),
    isHoliday: entry.isHoliday,
    metrics: entry.metrics!,
  };
}

/**
 * Agent SDKに渡すための分析データを構築
 *
 * @param presetName プリセット名
 * @param currentSchedule 現在のスケジュール
 * @param historyWeeks 過去何週間分のデータを含めるか
 * @returns Agent SDKへの入力データ
 */
export function buildAnalysisInput(
  presetName: string,
  currentSchedule: string[],
  historyWeeks: number = 4
): AnalysisInput {
  const entries = loadPostHistory(presetName);

  // 分析済みの投稿（祝日を除く）
  const analyzedEntries = entries.filter(
    (e) => e.analyzedAt && e.metrics && !e.isHoliday
  );

  // 過去数週間分の分析済みデータ（metricsがあるもののみ）
  const historicalData = getAnalyzedPostsByWeek(entries, historyWeeks).map(
    ({ weekNumber, posts }) => ({
      weekNumber,
      posts: posts.filter((p) => p.metrics).map(toAnalysisPost),
    })
  );

  return {
    presetName,
    currentSchedule,
    posts: analyzedEntries.map(toAnalysisPost),
    historicalData,
  };
}

/**
 * Agent SDKへの入力データ型
 */
export interface AnalysisInput {
  presetName: string;
  currentSchedule: string[];
  posts: {
    timestamp: string;
    dayOfWeek: number;
    hour: number;
    isHoliday: boolean;
    metrics: PostMetrics;
  }[];
  historicalData: {
    weekNumber: number;
    posts: {
      timestamp: string;
      dayOfWeek: number;
      hour: number;
      isHoliday: boolean;
      metrics: PostMetrics;
    }[];
  }[];
}
