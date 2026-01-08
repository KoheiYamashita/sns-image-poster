/**
 * 後方互換性レイヤー
 *
 * 既存の `import { env } from "./config/env.js"` をそのまま動作させるための互換層。
 * 内部では config.ts の getConfig() を使用する。
 *
 * 使用パターン:
 * 1. 通常モード（.envから読み込み）: そのまま env を参照可能
 * 2. プリセットモード: initConfig(presetName) を呼び出した後に env を参照
 */

import { getConfig, initConfig, type AppConfig } from "./config.js";

// 設定が初期化されていない場合は従来どおり.envから読み込む
let _initialized = false;

function ensureInitialized(): AppConfig {
  if (!_initialized) {
    // 従来どおり.envから読み込み（プリセットなし）
    initConfig();
    _initialized = true;
  }
  return getConfig();
}

/**
 * 環境設定オブジェクト
 *
 * Proxyを使用して、アクセス時に設定を遅延評価する。
 * これにより、initConfig()が呼ばれる前でも後でも正しく動作する。
 */
export const env = new Proxy({} as AppConfig, {
  get(_, prop: string) {
    const config = ensureInitialized();
    return config[prop as keyof AppConfig];
  },
  has(_, prop: string) {
    const config = ensureInitialized();
    return prop in config;
  },
  ownKeys() {
    const config = ensureInitialized();
    return Object.keys(config);
  },
  getOwnPropertyDescriptor(_, prop: string) {
    const config = ensureInitialized();
    if (prop in config) {
      return {
        enumerable: true,
        configurable: true,
        value: config[prop as keyof AppConfig],
      };
    }
    return undefined;
  },
});

// 型のみを再エクスポート（後方互換性のため）
export type { AppConfig };
