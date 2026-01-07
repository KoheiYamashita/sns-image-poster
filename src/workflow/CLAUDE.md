# workflow/

ワークフロー処理の中核。

## ファイル

- `runner.ts` - メインワークフロー実行
- `story-generator.ts` - 物語生成（Gemini）
- `image-workflow.ts` - 画像生成ワークフロー（リトライ込み）
- `image-generator.ts` - 画像生成
- `prompt-refiner.ts` - プロンプト改善
- `quality-checker.ts` - 品質チェック
- `post-formatter.ts` - 投稿テキストフォーマット

## ワークフローフロー

```
runWorkflow()
  ├── TopicProvider.getTopic()
  ├── generateStory()
  ├── executeImageWorkflow()
  │     ├── generateImage()
  │     ├── checkQuality()
  │     └── (不合格時) refinePrompt() → 再生成
  ├── formatPost()
  └── BundleSocialProvider.post()
```

## 各ステップ

### generateStory
- Geminiでお題から物語を生成
- キャラクター設定を組み込み

### executeImageWorkflow
- 画像生成と品質チェックをループ
- 最大リトライ回数まで繰り返し

### checkQuality
- 生成画像をGeminiで分析
- キャラクター一致、物語整合性、スタイル、品質を評価

### formatPost
- 物語から投稿用テキストを生成
- 文字数制限、ハッシュタグ付与
