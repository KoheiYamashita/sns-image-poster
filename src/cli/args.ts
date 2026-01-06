import { parseArgs } from "node:util";

export interface CliOptions {
  topic?: string;
  help: boolean;
}

export function parseCliArgs(): CliOptions {
  const { values } = parseArgs({
    options: {
      topic: { type: "string", short: "t" },
      help: { type: "boolean", short: "h", default: false },
    },
    strict: true,
  });

  return {
    topic: values.topic,
    help: values.help ?? false,
  };
}

export function printHelp(): void {
  console.log(`
SNS Image Poster - 画像生成・投稿システム

使用方法:
  npm run start [options]

オプション:
  -t, --topic <text>   お題を直接指定（Twitter取得をスキップ）
  -h, --help           このヘルプを表示

例:
  npm run start                        # Twitterからお題を自動取得
  npm run start -- --topic "猫の日"    # お題を直接指定
  npm run start -- -t "犬の日"
`);
}
