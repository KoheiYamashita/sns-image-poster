# providers/

外部サービスとの連携を担当するプロバイダー群。

## サブディレクトリ

- `image-generation/` - 画像生成プロバイダー（Gemini Imagen）
- `sns/` - SNS直接連携（Twitter agent-twitter-client）
- `sns-post/` - SNS投稿サービス（Bundle Social）
- `topic/` - お題取得プロバイダー

## 設計パターン

各プロバイダーは以下のパターンに従う：
- `interface.ts` - インターフェース定義
- 具体実装ファイル（例：`gemini.ts`, `twitter.ts`）
- `index.ts` - エクスポート

## プロバイダー一覧

| ディレクトリ | 用途 | 実装 |
|------------|------|------|
| image-generation | 画像生成 | Gemini Imagen |
| sns | Twitter直接投稿 | agent-twitter-client |
| sns-post | マルチプラットフォーム投稿 | Bundle Social API |
| topic | お題取得 | Twitter API / ファイル / 手動 |
