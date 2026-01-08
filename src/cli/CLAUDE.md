# cli/

コマンドライン引数の解析を担当。

## ファイル

- `args.ts` - 引数のパース（`node:util`の`parseArgs`を使用）
- `index.ts` - エクスポート

## オプション

- `-t, --topic <text>` - お題を直接指定
- `-p, --preset <name>` - プリセットを使用（複数指定可、並列実行）
- `-h, --help` - ヘルプ表示

## 使用例

```bash
npm run start                          # Twitterからお題を自動取得
npm run start -- --topic "猫の日"       # お題を直接指定
npm run start -- -p kanon              # プリセットを使用
npm run start -- -p preset1 -p preset2 # 複数プリセットを並列実行
```
