import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { SNSPostError } from "../../errors/base.js";
import type {
  SNSPostProvider,
  SNSPostContent,
  SNSPostResult,
  SupportedPlatform,
} from "./interface.js";

/**
 * SupportedPlatform（大文字）からUpload-Post APIのプラットフォーム名（小文字）へのマッピング
 */
const PLATFORM_MAP: Record<SupportedPlatform, string> = {
  TWITTER: "x",
  INSTAGRAM: "instagram",
  BLUESKY: "bluesky",
  THREADS: "threads",
  FACEBOOK: "facebook",
  LINKEDIN: "linkedin",
  TIKTOK: "tiktok",
  MASTODON: "mastodon",
};

function buildTextForPlatform(
  platform: SupportedPlatform,
  text: string,
  quoteUrl?: string
): string {
  if (!quoteUrl) {
    return text;
  }
  const targets = env.QUOTE_URL_TARGETS;
  if (targets.includes(platform)) {
    return `${quoteUrl}\n\n${text}`;
  }
  return text;
}

interface UploadPhotosResponse {
  success: boolean;
  results?: Record<
    string,
    {
      success: boolean;
      url?: string;
      error?: string;
    }
  >;
  error?: string;
}

export class UploadPostProvider implements SNSPostProvider {
  private apiKey: string;
  private defaultUserId: string | undefined;
  private userIds: Record<string, string>;
  private baseUrl = "https://api.upload-post.com/api";

  constructor() {
    if (!env.UPLOAD_POST_API_KEY) {
      throw new SNSPostError("UPLOAD_POST_API_KEY is not set");
    }
    this.apiKey = env.UPLOAD_POST_API_KEY;
    this.defaultUserId = env.UPLOAD_POST_USER_ID;
    this.userIds = env.UPLOAD_POST_USER_IDS;

    // デフォルトユーザーIDもプラットフォーム別ユーザーIDも両方なければエラー
    if (!this.defaultUserId && Object.keys(this.userIds).length === 0) {
      throw new SNSPostError(
        "UPLOAD_POST_USER_ID または UPLOAD_POST_USER_IDS のいずれかが必要です"
      );
    }
  }

  getName(): string {
    return "upload-post";
  }

  /**
   * プラットフォームに対応するユーザーIDを取得
   */
  private getUserIdForPlatform(platform: SupportedPlatform): string {
    // プラットフォーム別設定があればそれを優先
    const platformUserId = this.userIds[platform];
    if (platformUserId) {
      return platformUserId;
    }
    // なければデフォルト
    if (this.defaultUserId) {
      return this.defaultUserId;
    }
    throw new SNSPostError(
      `プラットフォーム ${platform} のユーザーIDが設定されていません`
    );
  }

  /**
   * Upload-Postは画像を事前アップロードしないため、post時に一緒に送信する
   * このメソッドは空の実装
   */
  async uploadImage(_imageBuffer: Buffer, _mimeType: string): Promise<string> {
    return "";
  }

  /**
   * 指定されたプラットフォームとユーザーIDで投稿を実行
   */
  private async postToGroup(
    content: SNSPostContent,
    platforms: SupportedPlatform[],
    userId: string
  ): Promise<SNSPostResult[]> {
    // プラットフォーム名を変換
    const uploadPostPlatforms = platforms.map((p) => PLATFORM_MAP[p]);

    // FormDataを構築
    const formData = new FormData();

    // 画像をBlobとして追加
    const extension = content.imageMimeType.split("/")[1] || "png";
    const blob = new Blob([content.imageBuffer], { type: content.imageMimeType });
    formData.append("photos[]", blob, `image.${extension}`);

    // ユーザーIDを追加
    formData.append("user", userId);

    // 各プラットフォームを追加
    for (const platform of uploadPostPlatforms) {
      formData.append("platform[]", platform);
    }

    // 投稿テキストを追加（プラットフォームごとに異なる場合は最初のものを使用）
    const firstPlatform = platforms[0];
    if (!firstPlatform) {
      throw new SNSPostError("投稿先プラットフォームが指定されていません");
    }
    const postText = buildTextForPlatform(
      firstPlatform,
      content.text,
      content.quoteUrl
    );
    formData.append("title", postText);

    logger.debug(
      {
        platforms: uploadPostPlatforms,
        userId,
        textLength: postText.length,
        imageSize: content.imageBuffer.length,
      },
      "Upload-Post投稿リクエスト"
    );

    const response = await fetch(`${this.baseUrl}/upload_photos`, {
      method: "POST",
      headers: {
        Authorization: `Apikey ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new SNSPostError(
        `Upload-Post投稿に失敗しました: ${response.status}`,
        { errorText }
      );
    }

    const data = (await response.json()) as UploadPhotosResponse;
    logger.info({ success: data.success, platforms }, "Upload-Post投稿完了");

    if (!data.success) {
      throw new SNSPostError("Upload-Post投稿に失敗しました", {
        error: data.error,
      });
    }

    // 結果を構築
    return platforms.map((platform) => {
      const uploadPostPlatform = PLATFORM_MAP[platform];
      const platformResult = data.results?.[uploadPostPlatform];

      if (!platformResult) {
        return {
          success: false,
          platform,
          error: "プラットフォームの結果が見つかりません",
        };
      }

      if (!platformResult.success) {
        return {
          success: false,
          platform,
          error: platformResult.error || "投稿に失敗しました",
        };
      }

      return {
        success: true,
        platform,
        postUrl: platformResult.url,
      };
    });
  }

  async post(
    content: SNSPostContent,
    platforms: SupportedPlatform[]
  ): Promise<SNSPostResult[]> {
    logger.info({ platforms }, "Upload-Post SNS投稿を開始");

    // プラットフォームをユーザーIDごとにグループ化
    const groups = new Map<string, SupportedPlatform[]>();
    for (const platform of platforms) {
      const userId = this.getUserIdForPlatform(platform);
      const group = groups.get(userId) || [];
      group.push(platform);
      groups.set(userId, group);
    }

    logger.debug(
      { groupCount: groups.size },
      "ユーザーIDごとにグループ化"
    );

    // 各グループに対して投稿
    const allResults: SNSPostResult[] = [];
    for (const [userId, groupPlatforms] of groups) {
      const results = await this.postToGroup(content, groupPlatforms, userId);
      allResults.push(...results);
    }

    return allResults;
  }
}
