/**
 * 投稿メトリクス
 */
export interface TweetMetrics {
  id: string;
  text: string;
  createdAt: Date;
  viewCount: number;
  likeCount: number;
  retweetCount: number;
  quoteCount: number;
  replyCount: number;
  bookmarkCount: number;
}

/**
 * 分析プロバイダーインターフェース
 */
export interface AnalyticsProvider {
  getName(): string;

  /**
   * 投稿IDからメトリクスを取得
   * @param tweetId 投稿ID
   * @returns メトリクス
   */
  getTweetMetrics(tweetId: string): Promise<TweetMetrics>;
}
