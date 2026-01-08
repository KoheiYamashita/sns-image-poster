import { parseArgs } from "node:util";

export interface CliOptions {
  topic?: string;
  presets: string[];
  help: boolean;
}

export function parseCliArgs(): CliOptions {
  const { values } = parseArgs({
    options: {
      topic: { type: "string", short: "t" },
      preset: { type: "string", short: "p", multiple: true },
      help: { type: "boolean", short: "h", default: false },
    },
    strict: true,
  });

  return {
    topic: values.topic,
    presets: values.preset ?? [],
    help: values.help ?? false,
  };
}

export function printHelp(): void {
  console.log(`
SNS Image Poster - 画像生成・投稿システム

使用方法:
  npm run start [options]

オプション:
  -t, --topic <text>    お題を直接指定（Twitter取得をスキップ）
  -p, --preset <name>   プリセット設定を読み込み（複数指定可、並列実行）
  -h, --help            このヘルプを表示

例:
  npm run start                              # Twitterからお題を自動取得
  npm run start -- --topic "猫の日"          # お題を直接指定
  npm run start -- --preset kanon            # kanonプリセットを使用
  npm run start -- -p manga -t "犬の日"      # プリセット + お題指定
  npm run start -- -p preset1 -p preset2     # 複数プリセットを並列実行

プリセットファイル:
  assets/presets/ ディレクトリにJSONファイルを配置
  例: assets/presets/kanon.json
`);
}
