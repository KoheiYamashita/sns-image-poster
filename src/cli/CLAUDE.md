# cli/

コマンドライン引数の解析を担当。

## ファイル

- `args.ts` - 引数のパース（`node:util`の`parseArgs`を使用）
- `index.ts` - エクスポート

## オプション

- `-t, --topic <text>` - お題を直接指定
- `-h, --help` - ヘルプ表示

## 使用例

```bash
npm run start                      # Twitterからお題を自動取得
npm run start -- --topic "猫の日"  # お題を直接指定
```
