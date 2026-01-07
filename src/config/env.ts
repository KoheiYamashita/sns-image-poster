import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  // TwitterAPI.io
  TWITTER_API_IO_KEY: z.string().min(1, "TwitterAPI.io APIキーは必須です"),

  // Twitter ログイン情報
  TWITTER_USERNAME: z.string().optional(),
  TWITTER_EMAIL: z.string().optional(),
  TWITTER_PASSWORD: z.string().optional(),
  TWITTER_TOTP_SECRET: z.string().optional(),
  TWITTER_PROXY_URL: z.string().optional(),

  // お題取得設定
  X_TOPIC_SOURCE_ACCOUNT: z.string().default("today_norma"),
  TOPIC_SEARCH_KEYWORD: z.string().default("今日は"),
  TOPIC_PATTERN: z.string().default("^今日は(.+の日)です！"),
  TZ: z.string().default("Asia/Tokyo"),

  // キャラクター設定
  CHARACTER_PROMPT_PATH: z.string().min(1, "CHARACTER_PROMPT_PATHは必須です"),
  CHARACTER_APPEARANCE_PROMPT: z.string().optional(),
  CHARACTER_IMAGE_PATHS: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",").map((p) => p.trim()) : [])),
  ILLUSTRATION_STYLE: z.string().default("アニメ風、明るい色調"),

  // Gemini API (画像生成)
  GEMINI_API_KEY: z.string().min(1, "Gemini APIキーは必須です"),
  IMAGE_ASPECT_RATIO: z.string().default("1:1"),

  // リトライ設定
  MAX_IMAGE_RETRY_COUNT: z.coerce.number().int().min(1).default(3),

  // 投稿設定
  POST_STYLE: z.string().default("カジュアル"),

  // bundle.social設定（任意）
  BUNDLE_SOCIAL_API_KEY: z.string().optional(),
  BUNDLE_SOCIAL_TEAM_ID: z.string().optional(),
  SNS_TARGETS: z
    .string()
    .optional()
    .transform((val) =>
      val ? val.split(",").map((s) => s.trim().toUpperCase()) : []
    ),
  POST_BASE_HASHTAGS: z
    .string()
    .optional()
    .transform((val) =>
      val
        ? val.split(",").map((p) => {
            const tag = p.trim();
            return tag.startsWith("#") ? tag : `#${tag}`;
          })
        : []
    ),
  POST_TARGET_LENGTH: z.coerce.number().int().min(1).default(100),
  POST_MAX_LENGTH: z.coerce.number().int().min(1).default(140),
});

function loadCharacterPrompt(path: string): string {
  try {
    return readFileSync(path, "utf-8").trim();
  } catch (error) {
    console.error(`キャラクタープロンプトファイルの読み込みに失敗しました: ${path}`);
    process.exit(1);
  }
}

function loadEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("環境変数の検証に失敗しました:");
    for (const error of result.error.errors) {
      console.error(`  - ${error.path.join(".")}: ${error.message}`);
    }
    process.exit(1);
  }

  const CHARACTER_PROMPT = loadCharacterPrompt(result.data.CHARACTER_PROMPT_PATH);

  return {
    ...result.data,
    CHARACTER_PROMPT,
  };
}

export const env = loadEnv();
