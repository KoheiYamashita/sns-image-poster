import { z } from "zod";

/**
 * プリセットで指定可能な項目のスキーマ（全てオプショナル）
 * プリセット使用時は、指定されていない項目はデフォルト値が適用される
 */
export const presetSchema = z
  .object({
    // コンテンツモード
    contentMode: z.enum(["illustration", "manga"]).optional(),

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

    // お題取得設定
    topicSourceAccount: z.string().optional(),
    topicSearchKeyword: z.string().optional(),
    topicPattern: z.string().optional(),
    topicListFile: z.string().optional(),

    // 定期実行設定
    scheduleTimes: z.array(z.string()).optional(),

    // その他
    timezone: z.string().optional(),
  })
  .strict(); // 未知のキーを禁止（タイポ検出）

export type PresetConfig = z.infer<typeof presetSchema>;
