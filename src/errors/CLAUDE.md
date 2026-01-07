# errors/

ワークフロー各ステップ用のカスタムエラークラス。

## ファイル

- `base.ts` - エラークラス定義
- `index.ts` - エクスポート

## エラークラス

### WorkflowBaseError（抽象基底クラス）
- `step` - エラーが発生したワークフローステップ
- `timestamp` - エラー発生日時
- `details` - 追加情報
- `toJSON()` - JSON形式での出力

### 派生クラス
- `TopicFetchError` - お題取得エラー
- `TopicListEmptyError` - お題リスト空エラー
- `StoryGenerationError` - 物語生成エラー
- `ImageGenerationError` - 画像生成エラー
- `QualityCheckError` - 品質チェックエラー
- `PostFormatError` - 投稿フォーマットエラー
- `SNSPostError` - SNS投稿エラー

## ワークフローステップ

`topic_fetch` → `story_generation` → `image_generation` → `quality_check` → `post_format` → `sns_post`
