import type { TopicProvider } from "./interface.js";
import type { TopicSource } from "../../types/index.js";
import { TopicFetchError } from "../../errors/index.js";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";

interface XApiTweet {
  id: string;
  text: string;
  author_id: string;
  created_at?: string;
}

interface XApiUser {
  id: string;
  username: string;
  name: string;
}

interface XApiTimelineResponse {
  data?: XApiTweet[];
  meta?: {
    result_count: number;
    newest_id?: string;
    oldest_id?: string;
    next_token?: string;
  };
  errors?: Array<{ message: string; type: string }>;
}

interface XApiUserLookupResponse {
  data?: XApiUser;
  errors?: Array<{ message: string; type: string }>;
}

const MAX_PAGES = 10;

// ユーザーIDキャッシュ（デーモンモードでプロセス内再利用）
const userIdCache = new Map<string, string>();

export class XApiProvider implements TopicProvider {
  private readonly bearerToken: string;
  private readonly account: string;
  private readonly configuredUserId: string | undefined;
  private readonly pattern: RegExp;
  private readonly baseUrl = "https://api.x.com/2";

  constructor() {
    if (!env.X_API_BEARER_TOKEN) {
      throw new TopicFetchError(
        "X_API_BEARER_TOKENが設定されていません。X APIからお題を取得するには設定が必要です。"
      );
    }
    this.bearerToken = env.X_API_BEARER_TOKEN;
    this.account = env.X_TOPIC_SOURCE_ACCOUNT;
    this.configuredUserId = env.X_TOPIC_SOURCE_USER_ID;
    this.pattern = new RegExp(env.TOPIC_PATTERN);
  }

  getName(): string {
    return "XApiProvider";
  }

  async getTopic(): Promise<TopicSource> {
    const userId = await this.resolveUserId();
    let paginationToken: string | undefined;
    let totalChecked = 0;

    logger.info(
      { account: this.account, userId },
      "X API v2 ユーザータイムラインからお題を取得"
    );

    for (let page = 0; page < MAX_PAGES; page++) {
      const response = await this.getUserTweets(userId, paginationToken);

      if (!response.data || response.data.length === 0) {
        break;
      }

      for (const tweet of response.data) {
        const match = tweet.text.match(this.pattern);
        if (match?.[1]) {
          logger.info(
            { tweetId: tweet.id, topicText: match[1], page: page + 1 },
            "お題を取得しました"
          );

          return {
            tweetId: tweet.id,
            tweetUrl: `https://x.com/${this.account}/status/${tweet.id}`,
            accountHandle: `@${this.account}`,
            topicText: match[1],
            originalText: tweet.text,
            fetchedAt: new Date(),
          };
        }
      }

      totalChecked += response.data.length;
      paginationToken = response.meta?.next_token;

      if (!paginationToken) {
        break;
      }

      logger.info(
        { page: page + 1, checkedSoFar: totalChecked },
        "パターン未一致、次のページを取得"
      );
    }

    throw new TopicFetchError("パターンに一致する投稿が見つかりませんでした", {
      account: this.account,
      pattern: this.pattern.source,
      tweetsChecked: totalChecked,
    });
  }

  /**
   * ユーザーIDを解決する
   * 優先順位: プリセット設定 → メモリキャッシュ → APIルックアップ
   */
  private async resolveUserId(): Promise<string> {
    if (this.configuredUserId) {
      return this.configuredUserId;
    }

    const cached = userIdCache.get(this.account);
    if (cached) {
      logger.info({ username: this.account, userId: cached }, "キャッシュからユーザーIDを取得");
      return cached;
    }

    const url = `${this.baseUrl}/users/by/username/${this.account}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new TopicFetchError(
        `X API ユーザー検索エラー: ${res.status}`,
        { status: res.status, statusText: res.statusText, body: errorText }
      );
    }

    const body = (await res.json()) as XApiUserLookupResponse;
    if (!body.data) {
      throw new TopicFetchError(
        `ユーザー @${this.account} が見つかりませんでした`,
        { errors: body.errors }
      );
    }

    userIdCache.set(this.account, body.data.id);
    logger.info({ username: this.account, userId: body.data.id }, "ユーザーIDを取得");
    return body.data.id;
  }

  private async getUserTweets(
    userId: string,
    paginationToken?: string
  ): Promise<XApiTimelineResponse> {
    const url = new URL(`${this.baseUrl}/users/${userId}/tweets`);
    url.searchParams.set("max_results", "5");
    url.searchParams.set("exclude", "retweets,replies");
    url.searchParams.set("tweet.fields", "created_at,author_id");

    if (paginationToken) {
      url.searchParams.set("pagination_token", paginationToken);
    }

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new TopicFetchError(`X API エラー: ${res.status}`, {
        status: res.status,
        statusText: res.statusText,
        body: errorText,
      });
    }

    return (await res.json()) as XApiTimelineResponse;
  }
}
