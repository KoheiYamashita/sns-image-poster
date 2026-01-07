export type SupportedPlatform =
  | "TWITTER"
  | "BLUESKY"
  | "THREADS"
  | "INSTAGRAM"
  | "FACEBOOK"
  | "LINKEDIN"
  | "TIKTOK"
  | "MASTODON";

export interface SNSPostContent {
  text: string;
  imageBuffer: Buffer;
  imageMimeType: string;
  quoteTweetId?: string; // 引用リポスト用（Twitter/Xのみ）
  quoteUrl?: string; // 引用元URL（指定したプラットフォームのみテキスト先頭に追加）
}

export interface SNSPostResult {
  success: boolean;
  platform: SupportedPlatform;
  postId?: string;
  postUrl?: string;
  error?: string;
}

export interface SNSPostProvider {
  getName(): string;
  post(
    content: SNSPostContent,
    platforms: SupportedPlatform[]
  ): Promise<SNSPostResult[]>;
  uploadImage(imageBuffer: Buffer, mimeType: string): Promise<string>;
}
