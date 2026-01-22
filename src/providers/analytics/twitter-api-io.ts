/**
 * TwitterAPI.ioを使用したメトリクス取得
 *
 * 投稿IDからエンゲージメントメトリクスを取得する。
 * 料金: 詳細取得は約 $0.15 / 1,000ツイート
 */

import type { AnalyticsProvider, TweetMetrics } from "./interface.js";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { AnalyticsFetchError } from "../../errors/index.js";

/**
 * TwitterAPI.ioのツイート詳細レスポンス
 */
interface TweetDetailsResponse {
  id: string;
  text: string;
  createdAt: string;
  author: {
    userName: string;
    name: string;
  };
  viewCount?: number;
  likeCount?: number;
  retweetCount?: number;
  quoteCount?: number;
  replyCount?: number;
  bookmarkCount?: number;
}

export class TwitterApiIoAnalyticsProvider implements AnalyticsProvider {
  private readonly apiKey: string;
  private readonly baseUrl = "https://api.twitterapi.io/twitter/tweet";

  constructor() {
    if (!env.TWITTER_API_IO_KEY) {
      throw new AnalyticsFetchError(
        "TWITTER_API_IO_KEYが設定されていません。メトリクス取得には設定が必要です。"
      );
    }
    this.apiKey = env.TWITTER_API_IO_KEY;
  }

  getName(): string {
    return "TwitterApiIoAnalyticsProvider";
  }

  /**
   * 投稿IDからメトリクスを取得
   */
  async getTweetMetrics(tweetId: string): Promise<TweetMetrics> {
    if (!tweetId || tweetId.trim() === "") {
      throw new AnalyticsFetchError("tweetIdが空です", { tweetId });
    }

    logger.info({ tweetId }, "メトリクスを取得中");

    const url = new URL(`${this.baseUrl}/details`);
    url.searchParams.set("id", tweetId);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "X-API-Key": this.apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new AnalyticsFetchError(
        `TwitterAPI.io APIエラー: ${res.status} - ${errorText}`,
        { tweetId, status: res.status }
      );
    }

    const data = (await res.json()) as TweetDetailsResponse;

    if (!data.id || !data.text || !data.createdAt) {
      throw new AnalyticsFetchError("APIレスポンスが不正です", {
        tweetId,
        hasId: !!data.id,
        hasText: !!data.text,
        hasCreatedAt: !!data.createdAt,
      });
    }

    const metrics: TweetMetrics = {
      id: data.id,
      text: data.text,
      createdAt: new Date(data.createdAt),
      viewCount: data.viewCount ?? 0,
      likeCount: data.likeCount ?? 0,
      retweetCount: data.retweetCount ?? 0,
      quoteCount: data.quoteCount ?? 0,
      replyCount: data.replyCount ?? 0,
      bookmarkCount: data.bookmarkCount ?? 0,
    };

    logger.info(
      {
        tweetId,
        viewCount: metrics.viewCount,
        likeCount: metrics.likeCount,
      },
      "メトリクスを取得しました"
    );

    return metrics;
  }
}
