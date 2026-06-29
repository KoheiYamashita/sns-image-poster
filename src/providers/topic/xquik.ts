import type { TopicProvider } from "./interface.js";
import type { TopicSource } from "../../types/index.js";
import { TopicFetchError } from "../../errors/index.js";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";

interface XquikTweet {
  id: string;
  text: string;
  createdAt?: string;
  url?: string;
  author?: {
    username?: string;
  };
}

interface XquikSearchResponse {
  tweets: XquikTweet[];
  has_next_page: boolean;
  next_cursor?: string;
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
    const sinceDate = this.getLocalDate();
    let cursor: string | undefined;
    let totalChecked = 0;

    logger.info(
      { account: this.account, keyword: this.searchKeyword, sinceDate },
      "Xquik検索を実行"
    );

    for (let page = 0; page < MAX_PAGES; page++) {
      const response = await this.searchTweets(sinceDate, cursor);

      if (!response.tweets || response.tweets.length === 0) {
        break;
      }

      for (const tweet of response.tweets) {
        const match = tweet.text.match(this.pattern);
        if (match?.[1]) {
          const authorUsername = tweet.author?.username ?? this.account;
          logger.info(
            { tweetId: tweet.id, topicText: match[1], page: page + 1 },
            "お題を取得しました"
          );

          return {
            tweetId: tweet.id,
            tweetUrl: tweet.url ?? `https://x.com/${authorUsername}/status/${tweet.id}`,
            accountHandle: `@${authorUsername}`,
            topicText: match[1],
            originalText: tweet.text,
            fetchedAt: tweet.createdAt ? new Date(tweet.createdAt) : new Date(),
          };
        }
      }

      totalChecked += response.tweets.length;
      cursor = response.next_cursor;

      if (!response.has_next_page || !cursor) {
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

    return (await res.json()) as XquikSearchResponse;
  }

  private getLocalDate(): string {
    const localDateStr = new Date()
      .toLocaleDateString("en-CA", { timeZone: env.TZ })
      .split("T")[0];

    if (!localDateStr) {
      throw new TopicFetchError("Xquik検索用の日付を生成できませんでした", {
        timezone: env.TZ,
      });
    }

    return localDateStr;
  }
}
