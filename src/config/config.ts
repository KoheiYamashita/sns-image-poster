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
  X_API_BEARER_TOKEN: z.string().optional(),
  UPLOAD_POST_API_KEY: z.string().optional(),
  UPLOAD_POST_USER_ID: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  WEBHOOK_URL: z.string().url().optional(),
  LOG_FILE_PATH: z.string().optional(),
});

// 動作設定のスキーマ（.envまたはプリセットから）
const settingsSchema = z.object({
  // お題取得設定
  TOPIC_PROVIDER: z.enum(["twitter-api-io", "x-api"]).default("twitter-api-io"),
  X_TOPIC_SOURCE_ACCOUNT: z.string().default("today_norma"),
  X_TOPIC_SOURCE_USER_ID: z.string().optional(),
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

  // SNSプロバイダー設定
  SNS_PROVIDER: z.enum(["bundle-social", "upload-post"]).default("bundle-social"),
  UPLOAD_POST_USER_IDS: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return {} as Record<string, string>;
      try {
        return JSON.parse(val) as Record<string, string>;
      } catch {
        return {} as Record<string, string>;
      }
    }),

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

  // 自動投稿時間最適化
  AUTO_SCHEDULE_OPTIMIZATION: z
    .string()
    .optional()
    .transform((val) => val === "true"),

  // プリセット名（ランタイムで設定）
  PRESET_NAME: z.string().optional(),
});

/**
 * プリセット値を環境変数形式にマッピング
 * undefinedの項目はスキップ（デフォルト値が適用される）
 */
function mapPresetToEnv(preset: PresetConfig): Record<string, string> {
  const result: Record<string, string> = {};

  // 単純な文字列マッピング
  const stringMappings: [keyof PresetConfig, string][] = [
    ["contentMode", "CONTENT_MODE"],
    ["mangaStyle", "MANGA_STYLE"],
    ["charactersDir", "CHARACTERS_DIR"],
    ["mainCharacterId", "MAIN_CHARACTER_ID"],
    ["characterSelectionMode", "CHARACTER_SELECTION_MODE"],
    ["illustrationStyle", "ILLUSTRATION_STYLE"],
    ["aspectRatio", "ASPECT_RATIO"],
    ["postStyle", "POST_STYLE"],
    ["snsProvider", "SNS_PROVIDER"],
    ["topicProvider", "TOPIC_PROVIDER"],
    ["topicSourceAccount", "X_TOPIC_SOURCE_ACCOUNT"],
    ["topicSourceUserId", "X_TOPIC_SOURCE_USER_ID"],
    ["topicSearchKeyword", "TOPIC_SEARCH_KEYWORD"],
    ["topicPattern", "TOPIC_PATTERN"],
    ["topicListFile", "TOPIC_LIST_FILE"],
    ["timezone", "TZ"],
  ];

  for (const [presetKey, envKey] of stringMappings) {
    const value = preset[presetKey];
    if (value !== undefined) {
      result[envKey] = String(value);
    }
  }

  // 数値マッピング
  const numberMappings: [keyof PresetConfig, string][] = [
    ["maxImageRetryCount", "MAX_IMAGE_RETRY_COUNT"],
    ["postTargetLength", "POST_TARGET_LENGTH"],
    ["postMaxLength", "POST_MAX_LENGTH"],
  ];

  for (const [presetKey, envKey] of numberMappings) {
    const value = preset[presetKey];
    if (value !== undefined) {
      result[envKey] = String(value);
    }
  }

  // 配列マッピング（カンマ区切り）
  const arrayMappings: [keyof PresetConfig, string][] = [
    ["characterIds", "CHARACTER_IDS"],
    ["postBaseHashtags", "POST_BASE_HASHTAGS"],
    ["snsTargets", "SNS_TARGETS"],
    ["quoteUrlTargets", "QUOTE_URL_TARGETS"],
  ];

  for (const [presetKey, envKey] of arrayMappings) {
    const value = preset[presetKey] as string[] | undefined;
    if (value !== undefined) {
      result[envKey] = value.join(",");
    }
  }

  // ブール値マッピング
  if (preset.autoScheduleOptimization !== undefined) {
    result["AUTO_SCHEDULE_OPTIMIZATION"] = String(preset.autoScheduleOptimization);
  }

  // スケジュール設定（既存形式と新形式の両方をサポート）
  if (preset.scheduleTimes !== undefined) {
    if (isLegacyScheduleTimes(preset.scheduleTimes)) {
      result["SCHEDULE_TIMES"] = preset.scheduleTimes.join(",");
    } else {
      result["SCHEDULE_TIMES_JSON"] = JSON.stringify(preset.scheduleTimes);
    }
  }

  // Upload-PostのユーザーID（プラットフォームごと）
  if (preset.uploadPostUserIds !== undefined) {
    result["UPLOAD_POST_USER_IDS"] = JSON.stringify(preset.uploadPostUserIds);
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
    // NOTE: ここではconsole.errorを使用（loggerは設定読み込み後に初期化されるため）
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
    settingsSource = {
      ...mapPresetToEnv(preset),
      PRESET_NAME: presetName,
    };
  } else {
    // 通常モード: .envから読み込み
    settingsSource = process.env as Record<string, string | undefined>;
  }

  // 動作設定のバリデーション
  const settingsResult = settingsSchema.safeParse(settingsSource);
  if (!settingsResult.success) {
    // NOTE: ここではconsole.errorを使用（loggerは設定読み込み後に初期化されるため）
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
