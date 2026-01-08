import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { presetSchema, type PresetConfig } from "./preset-schema.js";
import { PresetLoadError, PresetValidationError } from "../errors/index.js";

const DEFAULT_PRESETS_DIR = "./assets/presets";

/**
 * プリセットファイルを読み込んでバリデーションする
 */
export function loadPreset(presetName: string): PresetConfig {
  // パスの解決（.json拡張子の自動付与）
  const fileName = presetName.endsWith(".json")
    ? presetName
    : `${presetName}.json`;

  const presetPath = resolve(DEFAULT_PRESETS_DIR, fileName);

  // ファイル存在確認
  if (!existsSync(presetPath)) {
    throw new PresetLoadError(
      `プリセットファイルが見つかりません: ${presetPath}`,
      { presetName, resolvedPath: presetPath }
    );
  }

  // JSON読み込み
  let rawData: unknown;
  try {
    const content = readFileSync(presetPath, "utf-8");
    rawData = JSON.parse(content);
  } catch (error) {
    throw new PresetLoadError(
      `プリセットファイルの読み込みに失敗しました: ${presetPath}`,
      { presetName, error: error instanceof Error ? error.message : error }
    );
  }

  // Zodバリデーション
  const result = presetSchema.safeParse(rawData);
  if (!result.success) {
    throw new PresetValidationError(
      `プリセットのバリデーションに失敗しました: ${presetPath}`,
      {
        presetName,
        errors: result.error.errors.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      }
    );
  }

  return result.data;
}

/**
 * 利用可能なプリセット一覧を取得
 */
export function listPresets(): string[] {
  const presetsDir = resolve(DEFAULT_PRESETS_DIR);
  if (!existsSync(presetsDir)) {
    return [];
  }

  return readdirSync(presetsDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}
