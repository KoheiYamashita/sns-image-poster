import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  // TwitterAPI.io（お題をXから取得する場合のみ必要）
  TWITTER_API_IO_KEY: z.string().optional(),

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

  // コンテンツモード設定
  CONTENT_MODE: z.enum(["illustration", "manga"]).default("illustration"),

  // キャラクター設定
  CHARACTERS_DIR: z.string().min(1, "CHARACTERS_DIRは必須です"),
  CHARACTER_IDS: z
    .string()
    .min(1, "CHARACTER_IDSは必須です")
    .transform((val) => val.split(",").map((id) => id.trim())),
  MAIN_CHARACTER_ID: z.string().min(1, "MAIN_CHARACTER_IDは必須です"),
  // キャラクター選択モード: all=全員使用, auto=AIが選択
  CHARACTER_SELECTION_MODE: z.enum(["all", "auto"]).default("all"),
  ILLUSTRATION_STYLE: z.string().default("アニメ風、明るい色調"),

  // Gemini API (画像生成)
  GEMINI_API_KEY: z.string().min(1, "Gemini APIキーは必須です"),
  ASPECT_RATIO: z.string().optional(),

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

  // 通知設定
  WEBHOOK_URL: z.string().url().optional(),
  LOG_FILE_PATH: z.string().optional(),

  // 引用URL設定
  QUOTE_URL_TARGETS: z
    .string()
    .optional()
    .transform((val) =>
      val ? val.split(",").map((s) => s.trim().toUpperCase()) : []
    ),

  // 定期実行設定
  SCHEDULE_TIMES: z
    .string()
    .optional()
    .transform((val) =>
      val ? val.split(",").map((t) => t.trim()) : []
    ),

  // お題リストファイル設定
  TOPIC_LIST_FILE: z.string().optional(),
});

function loadEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("環境変数の検証に失敗しました:");
    for (const error of result.error.errors) {
      console.error(`  - ${error.path.join(".")}: ${error.message}`);
    }
    process.exit(1);
  }

  // ASPECT_RATIOが未指定の場合、CONTENT_MODEに応じたデフォルトを適用
  const ASPECT_RATIO =
    result.data.ASPECT_RATIO ??
    (result.data.CONTENT_MODE === "manga" ? "3:4" : "1:1");

  return {
    ...result.data,
    ASPECT_RATIO,
  };
}

export const env = loadEnv();
