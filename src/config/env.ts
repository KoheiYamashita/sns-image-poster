import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  TWITTER_API_IO_KEY: z.string().min(1, "TwitterAPI.io APIキーは必須です"),
  X_TOPIC_SOURCE_ACCOUNT: z.string().default("today_norma"),
  TOPIC_SEARCH_KEYWORD: z.string().default("今日は"),
  TOPIC_PATTERN: z.string().default("^今日は(.+の日)です！"),
  TZ: z.string().default("Asia/Tokyo"),
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

  return result.data;
}

export const env = loadEnv();
