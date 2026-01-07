import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { SNSPostError } from "../../errors/base.js";
import type {
  SNSPostProvider,
  SNSPostContent,
  SNSPostResult,
  SupportedPlatform,
} from "./interface.js";

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

interface UploadResponse {
  id: string;
  type: string;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  fileSize?: number;
  createdAt: string;
  updatedAt: string;
}

interface PostResponse {
  id: string;
  status: string;
  data: Record<string, unknown>;
  externalData?: Record<
    string,
    {
      postId?: string;
      postUrl?: string;
      error?: {
        code: string;
        errorMessage: string;
        isTransient: boolean;
        httpStatus?: number;
      };
    }
  >;
  createdAt: string;
  updatedAt: string;
}

export class BundleSocialProvider implements SNSPostProvider {
  private apiKey: string;
  private teamId: string;
  private baseUrl = "https://api.bundle.social/api/v1";

  constructor() {
    if (!env.BUNDLE_SOCIAL_API_KEY) {
      throw new SNSPostError("BUNDLE_SOCIAL_API_KEY is not set");
    }
    if (!env.BUNDLE_SOCIAL_TEAM_ID) {
      throw new SNSPostError("BUNDLE_SOCIAL_TEAM_ID is not set");
    }
    this.apiKey = env.BUNDLE_SOCIAL_API_KEY;
    this.teamId = env.BUNDLE_SOCIAL_TEAM_ID;
  }

  getName(): string {
    return "bundle.social";
  }

  async uploadImage(imageBuffer: Buffer, mimeType: string): Promise<string> {
    logger.info({ mimeType, size: imageBuffer.length }, "画像をアップロード中");

    const formData = new FormData();
    formData.append("teamId", this.teamId);

    // BufferをBlobに変換
    const blob = new Blob([imageBuffer], { type: mimeType });
    const extension = mimeType.split("/")[1] || "png";
    formData.append("file", blob, `image.${extension}`);

    const response = await fetch(`${this.baseUrl}/upload/`, {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new SNSPostError(
        `画像アップロードに失敗しました: ${response.status}`,
        { errorText }
      );
    }

    const data = (await response.json()) as UploadResponse;
    logger.info({ uploadId: data.id }, "画像アップロード完了");

    return data.id;
  }

  async post(
    content: SNSPostContent,
    platforms: SupportedPlatform[]
  ): Promise<SNSPostResult[]> {
    logger.info({ platforms }, "SNS投稿を開始");

    // 画像をアップロード
    const uploadId = await this.uploadImage(
      content.imageBuffer,
      content.imageMimeType
    );

    // プラットフォーム別のデータを構築
    const data: Record<string, object> = {};
    for (const platform of platforms) {
      const platformText = buildTextForPlatform(
        platform,
        content.text,
        content.quoteUrl
      );
      const platformData: Record<string, unknown> = {
        text: platformText,
        uploadIds: [uploadId],
      };

      // Twitter/Xの場合は引用リポスト情報を追加
      if (platform === "TWITTER" && content.quoteTweetId) {
        platformData["quoteTweetId"] = content.quoteTweetId;
      }

      data[platform] = platformData;
    }

    const postDate = new Date();
    // 1分後に投稿（即時投稿の代わり）
    postDate.setMinutes(postDate.getMinutes() + 1);

    const requestBody = {
      teamId: this.teamId,
      title: `SNS Post ${new Date().toISOString()}`,
      postDate: postDate.toISOString(),
      status: "SCHEDULED",
      socialAccountTypes: platforms,
      data,
    };

    logger.debug({ requestBody }, "投稿リクエスト");

    const response = await fetch(`${this.baseUrl}/post/`, {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new SNSPostError(`投稿の作成に失敗しました: ${response.status}`, {
        errorText,
      });
    }

    const postData = (await response.json()) as PostResponse;
    logger.info({ postId: postData.id, status: postData.status }, "投稿作成完了");

    // 結果を構築
    const results: SNSPostResult[] = platforms.map((platform) => {
      const externalInfo = postData.externalData?.[platform];

      if (externalInfo?.error) {
        return {
          success: false,
          platform,
          error: externalInfo.error.errorMessage,
        };
      }

      return {
        success: true,
        platform,
        postId: externalInfo?.postId || postData.id,
        postUrl: externalInfo?.postUrl,
      };
    });

    return results;
  }
}
