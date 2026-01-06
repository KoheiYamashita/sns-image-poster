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
    this.apiKey = env.TWITTER_API_IO_KEY;
    this.account = env.X_TOPIC_SOURCE_ACCOUNT;
    this.searchKeyword = env.TOPIC_SEARCH_KEYWORD;
    this.pattern = new RegExp(env.TOPIC_PATTERN);
  }

  getName(): string {
    return "TwitterApiIoProvider";
  }

  async getTopic(): Promise<TopicSource> {
    const todayJST = this.getTodayJST();
    const query = `from:${this.account} ${this.searchKeyword} since:${todayJST}_00:00:00_UTC`;

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

  private getTodayJST(): string {
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstDate = new Date(now.getTime() + jstOffset);
    return jstDate.toISOString().split("T")[0]!;
  }
}
