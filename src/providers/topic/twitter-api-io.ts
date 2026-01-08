import type { TopicProvider } from "./interface.js";
import type { TopicSource } from "../../types/index.js";
import { TopicFetchError } from "../../errors/index.js";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";

interface TwitterApiIoTweet {
  id: string;
  text: string;
  createdAt: string;
  author: {
    userName: string;
  };
}

interface TwitterApiIoResponse {
  tweets: TwitterApiIoTweet[];
  has_next_page: boolean;
  next_cursor?: string;
}

export class TwitterApiIoProvider implements TopicProvider {
  private readonly apiKey: string;
  private readonly account: string;
  private readonly searchKeyword: string;
  private readonly pattern: RegExp;
  private readonly baseUrl = "https://api.twitterapi.io/twitter/tweet/advanced_search";

  constructor() {
    if (!env.TWITTER_API_IO_KEY) {
      throw new TopicFetchError(
        "TWITTER_API_IO_KEYが設定されていません。Xからお題を取得するには設定が必要です。"
      );
    }
    this.apiKey = env.TWITTER_API_IO_KEY;
    this.account = env.X_TOPIC_SOURCE_ACCOUNT;
    this.searchKeyword = env.TOPIC_SEARCH_KEYWORD;
    this.pattern = new RegExp(env.TOPIC_PATTERN);
  }

  getName(): string {
    return "TwitterApiIoProvider";
  }

  async getTopic(): Promise<TopicSource> {
    const sinceUTC = this.getLocalMidnightAsUTC();
    const query = `from:${this.account} ${this.searchKeyword} since:${sinceUTC}_UTC`;

    logger.info({ query }, "検索クエリを実行");

    const response = await this.searchTweets(query);

    if (!response.tweets || response.tweets.length === 0) {
      throw new TopicFetchError("今日の投稿が見つかりませんでした", { query });
    }

    for (const tweet of response.tweets) {
      const match = tweet.text.match(this.pattern);
      if (match?.[1]) {
        logger.info({ tweetId: tweet.id, topicText: match[1] }, "お題を取得しました");

        return {
          tweetId: tweet.id,
          tweetUrl: `https://x.com/${tweet.author.userName}/status/${tweet.id}`,
          accountHandle: `@${tweet.author.userName}`,
          topicText: match[1],
          originalText: tweet.text,
          fetchedAt: new Date(),
        };
      }
    }

    throw new TopicFetchError("パターンに一致する投稿が見つかりませんでした", {
      query,
      pattern: this.pattern.source,
      tweetsChecked: response.tweets.length,
    });
  }

  private async searchTweets(query: string): Promise<TwitterApiIoResponse> {
    const url = new URL(this.baseUrl);
    url.searchParams.set("query", query);
    url.searchParams.set("queryType", "Latest");

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "X-API-Key": this.apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new TopicFetchError(`TwitterAPI.io APIエラー: ${res.status}`, {
        status: res.status,
        statusText: res.statusText,
        body: errorText,
      });
    }

    return (await res.json()) as TwitterApiIoResponse;
  }

  /**
   * 設定されたタイムゾーンの今日0時をUTC時刻形式で返す
   * 例: Asia/Tokyo 2026-01-07 00:00:00 → UTC 2026-01-06_15:00:00
   */
  private getLocalMidnightAsUTC(): string {
    const tz = env.TZ;

    // 指定タイムゾーンでの今日の日付を取得
    const now = new Date();
    const localDateStr = now
      .toLocaleDateString("en-CA", { timeZone: tz })
      .split("T")[0]!;

    // タイムゾーンオフセットを計算してUTC時刻を取得
    const midnightInTZ = new Date(
      Date.UTC(
        parseInt(localDateStr.slice(0, 4)),
        parseInt(localDateStr.slice(5, 7)) - 1,
        parseInt(localDateStr.slice(8, 10)),
        0,
        0,
        0
      )
    );

    // タイムゾーンのオフセットを取得（分単位）
    const tzOffsetMs = this.getTimezoneOffsetMs(tz, midnightInTZ);
    midnightInTZ.setTime(midnightInTZ.getTime() - tzOffsetMs);

    // YYYY-MM-DD_HH:MM:SS 形式でフォーマット
    const year = midnightInTZ.getUTCFullYear();
    const month = String(midnightInTZ.getUTCMonth() + 1).padStart(2, "0");
    const day = String(midnightInTZ.getUTCDate()).padStart(2, "0");
    const hour = String(midnightInTZ.getUTCHours()).padStart(2, "0");
    const minute = String(midnightInTZ.getUTCMinutes()).padStart(2, "0");
    const second = String(midnightInTZ.getUTCSeconds()).padStart(2, "0");

    return `${year}-${month}-${day}_${hour}:${minute}:${second}`;
  }

  /**
   * 指定タイムゾーンのUTCからのオフセット（ミリ秒）を取得
   */
  private getTimezoneOffsetMs(tz: string, date: Date): number {
    const utcStr = date.toLocaleString("en-US", { timeZone: "UTC" });
    const tzStr = date.toLocaleString("en-US", { timeZone: tz });
    return new Date(tzStr).getTime() - new Date(utcStr).getTime();
  }
}
