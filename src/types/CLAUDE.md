# types/

TypeScript型定義。

## ファイル

- `topic.ts` - お題関連の型
- `story.ts` - 物語関連の型
- `image.ts` - 画像関連の型
- `post.ts` - 投稿関連の型
- `quality.ts` - 品質チェック関連の型
- `index.ts` - 一括エクスポート

## 主な型

### TopicResult
お題取得結果。お題テキストと元ツイートURL。

### StoryResult
物語生成結果。セッションID、短縮テキスト、画像プロンプトなど。

### GeneratedImage
生成画像。Bufferデータ、MIMEタイプ、生成日時。

### PostResult
投稿テキスト。本文、文字数、ハッシュタグ。

### QualityCheckResult
品質チェック結果。合否、スコア、各項目のマッチ状況。
