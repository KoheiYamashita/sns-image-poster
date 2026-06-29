import type { TopicProvider } from "./interface.js";
import type { TopicSource } from "../../types/index.js";
import { TopicFetchError } from "../../errors/index.js";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";

interface XquikTweet {
  id?: unknown;
  text?: unknown;
  createdAt?: unknown;
  url?: unknown;
  author?: {
    username?: unknown;
  };
}

interface XquikSearchResponse {
  tweets?: XquikTweet[];
  has_next_page?: boolean;
  next_cursor?: unknown;
}

const MAX_PAGES = 10;

export class XquikProvider implements TopicProvider {
  private readonly apiKey: string;
  private readonly account: string;
  private readonly searchKeyword: string;
  private readonly pattern: RegExp;
  private readonly baseUrl: string;

  constructor() {
    if (!env.XQUIK_API_KEY) {
      throw new TopicFetchError(
        "XQUIK_API_KEYが設定されていません。Xquikからお題を取得するには設定が必要です。"
      );
    }
    this.apiKey = env.XQUIK_API_KEY;
    this.account = env.X_TOPIC_SOURCE_ACCOUNT;
    this.searchKeyword = env.TOPIC_SEARCH_KEYWORD;
    this.pattern = new RegExp(env.TOPIC_PATTERN);
    this.baseUrl = env.XQUIK_API_BASE.replace(/\/$/, "");
  }

  getName(): string {
    return "XquikProvider";
  }

  async getTopic(): Promise<TopicSource> {
    const sinceDate = this.getLocalMidnightIso();
    let cursor: string | undefined;
    let totalChecked = 0;

    logger.info(
      { account: this.account, keyword: this.searchKeyword, sinceDate },
      "Xquik検索を実行"
    );

    for (let page = 0; page < MAX_PAGES; page++) {
      const response = await this.searchTweets(sinceDate, cursor);

      if (!Array.isArray(response.tweets) || response.tweets.length === 0) {
        break;
      }

      for (const tweet of response.tweets) {
        if (typeof tweet.id !== "string" || typeof tweet.text !== "string") {
          continue;
        }

        const match = tweet.text.match(this.pattern);
        const topicText = match?.[1];
        if (topicText) {
          const authorUsername =
            typeof tweet.author?.username === "string"
              ? tweet.author.username
              : this.account;
          const tweetUrl =
            typeof tweet.url === "string" && tweet.url.length > 0
              ? tweet.url
              : `https://x.com/${authorUsername}/status/${tweet.id}`;
          logger.info(
            { tweetId: tweet.id, topicText, page: page + 1 },
            "お題を取得しました"
          );

          return {
            tweetId: tweet.id,
            tweetUrl,
            accountHandle: `@${authorUsername}`,
            topicText,
            originalText: tweet.text,
            fetchedAt: this.parseDateOrNow(tweet.createdAt),
          };
        }
      }

      totalChecked += response.tweets.length;
      cursor =
        typeof response.next_cursor === "string"
          ? response.next_cursor
          : undefined;

      if (response.has_next_page !== true || !cursor) {
        break;
      }

      logger.info(
        { page: page + 1, checkedSoFar: totalChecked },
        "パターン未一致、次のページを取得"
      );
    }

    throw new TopicFetchError("パターンに一致する投稿が見つかりませんでした", {
      account: this.account,
      keyword: this.searchKeyword,
      sinceDate,
      pattern: this.pattern.source,
      tweetsChecked: totalChecked,
    });
  }

  private async searchTweets(
    sinceDate: string,
    cursor?: string
  ): Promise<XquikSearchResponse> {
    const url = new URL(`${this.baseUrl}/x/tweets/search`);
    url.searchParams.set("q", this.searchKeyword);
    url.searchParams.set("fromUser", this.account);
    url.searchParams.set("sinceDate", sinceDate);
    url.searchParams.set("queryType", "Latest");
    url.searchParams.set("limit", "20");

    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "X-API-Key": this.apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new TopicFetchError(`Xquik APIエラー: ${res.status}`, {
        status: res.status,
        statusText: res.statusText,
        body: errorText,
      });
    }

    try {
      return (await res.json()) as XquikSearchResponse;
    } catch (error) {
      throw new TopicFetchError(
        "Xquik APIのレスポンスをJSONとして解析できませんでした",
        { error }
      );
    }
  }

  private parseDateOrNow(value: unknown): Date {
    if (typeof value !== "string") {
      return new Date();
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  private getLocalMidnightIso(): string {
    try {
      const { year, month, day } = this.getLocalDateParts(new Date());
      const localMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
      const timezoneOffsetMs = this.getTimezoneOffsetMs(env.TZ, localMidnight);
      return new Date(localMidnight.getTime() - timezoneOffsetMs).toISOString();
    } catch (error) {
      throw new TopicFetchError(
        "Xquik検索用の日付を生成できませんでした。タイムゾーンの設定を確認してください。",
        { timezone: env.TZ, error }
      );
    }
  }

  private getLocalDateParts(date: Date): {
    year: number;
    month: number;
    day: number;
  } {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: env.TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    if (!year || !month || !day) {
      throw new Error("Missing local date parts");
    }

    return {
      year: Number.parseInt(year, 10),
      month: Number.parseInt(month, 10),
      day: Number.parseInt(day, 10),
    };
  }

  private getTimezoneOffsetMs(timeZone: string, date: Date): number {
    const utcDate = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
    const localDate = new Date(date.toLocaleString("en-US", { timeZone }));
    return localDate.getTime() - utcDate.getTime();
  }
}
