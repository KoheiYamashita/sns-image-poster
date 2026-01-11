import { config as loadDotenv } from "dotenv";
import { z } from "zod";
import type { DaySchedule, PresetConfig, ScheduleTimes } from "./preset-schema.js";
import { loadPreset } from "./preset.js";

/**
 * スケジュールが既存形式（時刻のみの配列）かどうかを判定
 */
function isLegacyScheduleTimes(value: ScheduleTimes): value is string[] {
  return value.length === 0 || typeof value[0] === "string";
}

// .envから読み込む認証情報のスキーマ（プリセット有無に関わらず常に.envから）
const credentialsSchema = z.object({
  GEMINI_API_KEY: z.string().optional(),
  TWITTER_API_IO_KEY: z.string().optional(),
  BUNDLE_SOCIAL_API_KEY: z.string().optional(),
  BUNDLE_SOCIAL_TEAM_ID: z.string().optional(),
  WEBHOOK_URL: z.string().url().optional(),
  LOG_FILE_PATH: z.string().optional(),
});

// 動作設定のスキーマ（.envまたはプリセットから）
const settingsSchema = z.object({
  // お題取得設定
  X_TOPIC_SOURCE_ACCOUNT: z.string().default("today_norma"),
  TOPIC_SEARCH_KEYWORD: z.string().default("今日は"),
  TOPIC_PATTERN: z.string().default("^今日は(.+の日)です！"),
  TZ: z.string().default("Asia/Tokyo"),

  // コンテンツモード
  CONTENT_MODE: z.enum(["illustration", "manga"]).default("illustration"),
  MANGA_STYLE: z.enum(["normal", "yuru_chara"]).default("normal"),

  // キャラクター設定
  CHARACTERS_DIR: z.string().min(1, "CHARACTERS_DIRは必須です"),
  CHARACTER_IDS: z
    .string()
    .min(1, "CHARACTER_IDSは必須です")
    .transform((val) => val.split(",").map((id) => id.trim())),
  MAIN_CHARACTER_ID: z.string().min(1, "MAIN_CHARACTER_IDは必須です"),
  CHARACTER_SELECTION_MODE: z.enum(["all", "auto"]).default("all"),
  ILLUSTRATION_STYLE: z.string().default("アニメ風、明るい色調"),

  // 画像設定
  ASPECT_RATIO: z.string().optional(),
  MAX_IMAGE_RETRY_COUNT: z.coerce.number().int().min(1).default(3),

  // 投稿設定
  POST_STYLE: z.string().default("カジュアル"),
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

  // SNS設定
  SNS_TARGETS: z
    .string()
    .optional()
    .transform((val) =>
      val ? val.split(",").map((s) => s.trim().toUpperCase()) : []
    ),
  QUOTE_URL_TARGETS: z
    .string()
    .optional()
    .transform((val) =>
      val ? val.split(",").map((s) => s.trim().toUpperCase()) : []
    ),

  // 定期実行設定
  // 既存形式: カンマ区切りの時刻文字列（毎日実行）
  SCHEDULE_TIMES: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",").map((t) => t.trim()) : [])),
  // 新形式: 曜日別スケジュールのJSON文字列
  SCHEDULE_TIMES_JSON: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      try {
        return JSON.parse(val) as DaySchedule[];
      } catch {
        return undefined;
      }
    }),

  // お題リストファイル
  TOPIC_LIST_FILE: z.string().optional(),
});

/**
 * プリセット値を環境変数形式にマッピング
 * undefinedの項目はスキップ（デフォルト値が適用される）
 */
function mapPresetToEnv(preset: PresetConfig): Record<string, string> {
  const result: Record<string, string> = {};

  if (preset.contentMode !== undefined) {
    result["CONTENT_MODE"] = preset.contentMode;
  }
  if (preset.mangaStyle !== undefined) {
    result["MANGA_STYLE"] = preset.mangaStyle;
  }
  if (preset.charactersDir !== undefined) {
    result["CHARACTERS_DIR"] = preset.charactersDir;
  }
  if (preset.characterIds !== undefined) {
    result["CHARACTER_IDS"] = preset.characterIds.join(",");
  }
  if (preset.mainCharacterId !== undefined) {
    result["MAIN_CHARACTER_ID"] = preset.mainCharacterId;
  }
  if (preset.characterSelectionMode !== undefined) {
    result["CHARACTER_SELECTION_MODE"] = preset.characterSelectionMode;
  }
  if (preset.illustrationStyle !== undefined) {
    result["ILLUSTRATION_STYLE"] = preset.illustrationStyle;
  }
  if (preset.aspectRatio !== undefined) {
    result["ASPECT_RATIO"] = preset.aspectRatio;
  }
  if (preset.maxImageRetryCount !== undefined) {
    result["MAX_IMAGE_RETRY_COUNT"] = String(preset.maxImageRetryCount);
  }
  if (preset.postStyle !== undefined) {
    result["POST_STYLE"] = preset.postStyle;
  }
  if (preset.postBaseHashtags !== undefined) {
    result["POST_BASE_HASHTAGS"] = preset.postBaseHashtags.join(",");
  }
  if (preset.postTargetLength !== undefined) {
    result["POST_TARGET_LENGTH"] = String(preset.postTargetLength);
  }
  if (preset.postMaxLength !== undefined) {
    result["POST_MAX_LENGTH"] = String(preset.postMaxLength);
  }
  if (preset.snsTargets !== undefined) {
    result["SNS_TARGETS"] = preset.snsTargets.join(",");
  }
  if (preset.quoteUrlTargets !== undefined) {
    result["QUOTE_URL_TARGETS"] = preset.quoteUrlTargets.join(",");
  }
  if (preset.topicSourceAccount !== undefined) {
    result["X_TOPIC_SOURCE_ACCOUNT"] = preset.topicSourceAccount;
  }
  if (preset.topicSearchKeyword !== undefined) {
    result["TOPIC_SEARCH_KEYWORD"] = preset.topicSearchKeyword;
  }
  if (preset.topicPattern !== undefined) {
    result["TOPIC_PATTERN"] = preset.topicPattern;
  }
  if (preset.topicListFile !== undefined) {
    result["TOPIC_LIST_FILE"] = preset.topicListFile;
  }
  if (preset.scheduleTimes !== undefined) {
    if (isLegacyScheduleTimes(preset.scheduleTimes)) {
      // 既存形式: string[] → カンマ区切り文字列
      result["SCHEDULE_TIMES"] = preset.scheduleTimes.join(",");
    } else {
      // 新形式: DaySchedule[] → JSON文字列
      result["SCHEDULE_TIMES_JSON"] = JSON.stringify(preset.scheduleTimes);
    }
  }
  if (preset.timezone !== undefined) {
    result["TZ"] = preset.timezone;
  }

  return result;
}

/**
 * 設定を読み込む
 * @param presetName プリセット名（省略時は.envから全て読み込み）
 */
export function loadConfig(presetName?: string) {
  // .envを読み込み
  loadDotenv();

  // 認証情報は常に.envから
  const credentialsResult = credentialsSchema.safeParse(process.env);
  if (!credentialsResult.success) {
    console.error("認証情報の検証に失敗しました:");
    for (const error of credentialsResult.error.errors) {
      console.error(`  - ${error.path.join(".")}: ${error.message}`);
    }
    process.exit(1);
  }

  // 動作設定のソースを決定
  let settingsSource: Record<string, string | undefined>;

  if (presetName) {
    // プリセットモード: プリセット値のみ使用（.envの動作設定は無視）
    const preset = loadPreset(presetName);
    settingsSource = mapPresetToEnv(preset);
  } else {
    // 通常モード: .envから読み込み
    settingsSource = process.env as Record<string, string | undefined>;
  }

  // 動作設定のバリデーション
  const settingsResult = settingsSchema.safeParse(settingsSource);
  if (!settingsResult.success) {
    console.error("設定の検証に失敗しました:");
    for (const error of settingsResult.error.errors) {
      console.error(`  - ${error.path.join(".")}: ${error.message}`);
    }
    if (presetName) {
      console.error(`プリセット「${presetName}」に必須項目が不足している可能性があります`);
    }
    process.exit(1);
  }

  // ASPECT_RATIOのデフォルト適用
  const ASPECT_RATIO =
    settingsResult.data.ASPECT_RATIO ??
    (settingsResult.data.CONTENT_MODE === "manga" ? "3:4" : "1:1");

  return {
    ...credentialsResult.data,
    ...settingsResult.data,
    ASPECT_RATIO,
  };
}

// 設定のシングルトン
let _config: ReturnType<typeof loadConfig> | null = null;

/**
 * 設定を取得（初期化済みであること）
 */
export function getConfig() {
  if (!_config) {
    throw new Error(
      "設定が初期化されていません。initConfig()を先に呼び出してください。"
    );
  }
  return _config;
}

/**
 * 設定が初期化されているか
 */
export function isConfigInitialized(): boolean {
  return _config !== null;
}

/**
 * 設定を初期化
 * @param presetName プリセット名（省略時は.envから全て読み込み）
 *
 * 注意: プリセット指定ありで呼び出す場合、すでに初期化されていても再初期化される。
 * これにより、エントリーポイントでプリセットを指定する前に他のモジュールが
 * envを参照しても、後からプリセット設定で上書きできる。
 */
export function initConfig(presetName?: string) {
  // プリセット指定ありの場合、または未初期化の場合のみ初期化
  if (presetName || !_config) {
    _config = loadConfig(presetName);
  }
  return _config;
}

export type AppConfig = ReturnType<typeof loadConfig>;
