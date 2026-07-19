import { z } from "zod";

// 時刻フォーマットのスキーマ（"HH:MM"形式）
const timeStringSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
  message: "時刻は HH:MM 形式で指定してください（例: 08:00, 18:30）",
});

// 曜日のスキーマ（英語3文字 or 数字0-6）
const dayOfWeekSchema = z.union([
  z.enum(["sun", "mon", "tue", "wed", "thu", "fri", "sat"]),
  z.number().int().min(0).max(6),
]);

// 曜日別スケジュールのスキーマ（オブジェクト形式）
const dayScheduleSchema = z.object({
  day: dayOfWeekSchema,
  times: z.array(timeStringSchema).min(1, "timesには少なくとも1つの時刻が必要です"),
});

// scheduleTimes の統合スキーマ（既存形式と新形式の両方をサポート）
const scheduleTimesSchema = z.union([
  // 既存形式: ["08:00", "18:00"] - 毎日実行
  z.array(timeStringSchema),
  // 新形式: [{ day: "mon", times: ["08:00"] }, ...] - 曜日別実行
  z.array(dayScheduleSchema),
]);

/**
 * プリセットで指定可能な項目のスキーマ（全てオプショナル）
 * プリセット使用時は、指定されていない項目はデフォルト値が適用される
 */
export const presetSchema = z
  .object({
    // コンテンツモード
    contentMode: z.enum(["illustration", "manga"]).optional(),
    mangaStyle: z.enum(["normal", "yuru_chara"]).optional(),

    // キャラクター設定
    charactersDir: z.string().optional(),
    characterIds: z.array(z.string()).optional(),
    mainCharacterId: z.string().optional(),
    characterSelectionMode: z.enum(["all", "auto"]).optional(),
    illustrationStyle: z.string().optional(),

    // 画像設定
    aspectRatio: z.string().optional(),
    maxImageRetryCount: z.number().int().min(1).optional(),

    // 投稿設定
    postStyle: z.string().optional(),
    postBaseHashtags: z.array(z.string()).optional(),
    postTargetLength: z.number().int().min(1).optional(),
    postMaxLength: z.number().int().min(1).optional(),

    // SNS設定
    snsTargets: z.array(z.string()).optional(),
    quoteUrlTargets: z.array(z.string()).optional(),
    snsProvider: z.enum(["bundle-social", "upload-post"]).optional(),
    uploadPostUserIds: z.record(z.string(), z.string()).optional(), // {"TWITTER": "user-id", ...}

    // お題取得設定
    topicProvider: z.enum(["twitter-api-io", "x-api", "xquik"]).optional(),
    topicSourceAccount: z.string().optional(),
    topicSourceUserId: z.string().optional(),
    xquikApiBase: z.string().url().optional(),
    topicSearchKeyword: z.string().optional(),
    topicPattern: z.string().optional(),
    topicListFile: z.string().optional(),

    // 定期実行設定
    scheduleTimes: scheduleTimesSchema.optional(),

    // 自動投稿時間最適化
    autoScheduleOptimization: z.boolean().optional(),

    // その他
    timezone: z.string().optional(),
  })
  .strict(); // 未知のキーを禁止（タイポ検出）

export type PresetConfig = z.infer<typeof presetSchema>;

// エクスポート用の型定義
export type DayOfWeek = z.infer<typeof dayOfWeekSchema>;
export type DaySchedule = z.infer<typeof dayScheduleSchema>;
export type ScheduleTimes = z.infer<typeof scheduleTimesSchema>;
