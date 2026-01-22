/**
 * 投稿履歴管理
 *
 * 投稿IDと関連情報をJSON Lines形式で保存し、
 * 後の分析で利用可能にする。
 */

import { existsSync, readFileSync, appendFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { isJapaneseHoliday } from "./holidays.js";
import { logger } from "./logger.js";

/**
 * 投稿メトリクス（分析結果）
 */
export interface PostMetrics {
  viewCount: number;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  quoteCount: number;
  bookmarkCount: number;
}

/**
 * プラットフォーム別の投稿情報
 */
export interface PlatformPost {
  platform: string;
  postId: string;
  postUrl?: string;
}

/**
 * 投稿履歴エントリ
 */
export interface PostHistoryEntry {
  timestamp: string;
  topic: string;
  isHoliday: boolean;
  platforms: PlatformPost[];
  analyzedAt?: string;
  metrics?: PostMetrics;
}

/**
 * 投稿履歴ファイルのパスを取得
 * @param presetName プリセット名
 * @returns ファイルパス
 */
function getHistoryFilePath(presetName: string): string {
  const logsDir = join(process.cwd(), "logs");
  return join(logsDir, `post-history-${presetName}.jsonl`);
}

/**
 * ディレクトリが存在しない場合は作成
 * 並列実行時の競合を考慮し、EEXIST エラーを許容する
 */
function ensureDir(filePath: string): void {
  const dir = dirname(filePath);
  try {
    mkdirSync(dir, { recursive: true });
  } catch (error) {
    // recursive: true の場合、既存ディレクトリはエラーにならないはずだが、
    // 念のためEEXISTエラーは無視する
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error;
    }
  }
}

/**
 * 投稿履歴を保存
 * @param presetName プリセット名
 * @param entry 投稿履歴エントリ（isHolidayは自動設定）
 */
export function savePostHistory(
  presetName: string,
  entry: Omit<PostHistoryEntry, "isHoliday">
): void {
  const filePath = getHistoryFilePath(presetName);
  ensureDir(filePath);

  const postDate = new Date(entry.timestamp);
  const fullEntry: PostHistoryEntry = {
    ...entry,
    isHoliday: isJapaneseHoliday(postDate),
  };

  const line = JSON.stringify(fullEntry) + "\n";
  appendFileSync(filePath, line, "utf-8");

  logger.info(
    { presetName, postId: entry.platforms[0]?.postId, isHoliday: fullEntry.isHoliday },
    "投稿履歴を保存しました"
  );
}

/**
 * 投稿履歴を読み込み
 * @param presetName プリセット名
 * @returns 投稿履歴エントリの配列
 */
export function loadPostHistory(presetName: string): PostHistoryEntry[] {
  const filePath = getHistoryFilePath(presetName);

  if (!existsSync(filePath)) {
    return [];
  }

  const content = readFileSync(filePath, "utf-8");
  const lines = content.trim().split("\n").filter(Boolean);

  return lines.flatMap((line, index) => {
    try {
      return [JSON.parse(line) as PostHistoryEntry];
    } catch {
      logger.warn({ lineNumber: index + 1 }, "投稿履歴の行をパースできませんでした");
      return [];
    }
  });
}

/**
 * 分析対象の投稿を抽出
 * - 投稿から7日以上経過
 * - 未分析（analyzedAtがundefined）
 * - 祝日でない
 *
 * @param entries 投稿履歴エントリの配列
 * @returns 分析対象のエントリ
 */
export function getPostsToAnalyze(entries: PostHistoryEntry[]): PostHistoryEntry[] {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  return entries.filter((entry) => {
    const postDate = new Date(entry.timestamp);
    return (
      postDate <= oneWeekAgo &&
      !entry.analyzedAt &&
      !entry.isHoliday
    );
  });
}

/**
 * 投稿履歴を更新（分析結果を追記）
 * @param presetName プリセット名
 * @param updatedEntries 更新後のエントリ配列
 */
export function updatePostHistory(
  presetName: string,
  updatedEntries: PostHistoryEntry[]
): void {
  const filePath = getHistoryFilePath(presetName);
  ensureDir(filePath);

  const content = updatedEntries.map((entry) => JSON.stringify(entry)).join("\n") + "\n";
  writeFileSync(filePath, content, "utf-8");

  logger.info({ presetName, count: updatedEntries.length }, "投稿履歴を更新しました");
}

/**
 * 分析済みの投稿を取得（過去N週間分）
 * @param entries 投稿履歴エントリの配列
 * @param weeks 取得する週数
 * @returns 分析済みのエントリ（週ごとにグループ化）
 */
export function getAnalyzedPostsByWeek(
  entries: PostHistoryEntry[],
  weeks: number
): { weekNumber: number; posts: PostHistoryEntry[] }[] {
  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;

  // 分析済みかつ祝日でないエントリのみを対象
  const analyzedEntries = entries.filter(
    (entry) => entry.analyzedAt && !entry.isHoliday
  );

  const result: { weekNumber: number; posts: PostHistoryEntry[] }[] = [];

  for (let week = 1; week <= weeks; week++) {
    const weekStartMs = now - week * 7 * msPerDay;
    const weekEndMs = weekStartMs + 7 * msPerDay;

    const weekPosts = analyzedEntries.filter((entry) => {
      const postMs = new Date(entry.timestamp).getTime();
      return postMs >= weekStartMs && postMs < weekEndMs;
    });

    if (weekPosts.length > 0) {
      result.push({ weekNumber: week, posts: weekPosts });
    }
  }

  return result;
}
