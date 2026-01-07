# config/

環境変数の設定とバリデーション。

## ファイル

- `env.ts` - 環境変数のスキーマ定義と検証（Zodを使用）

## 主な環境変数

### API設定
- `TWITTER_API_IO_KEY` - TwitterAPI.ioのAPIキー
- `GEMINI_API_KEY` - Gemini APIキー
- `BUNDLE_SOCIAL_API_KEY` - Bundle Social APIキー

### キャラクター設定
- `CHARACTER_PROMPT_PATH` - キャラクタープロンプトファイルのパス
- `CHARACTER_APPEARANCE_PROMPT` - キャラクターの外見説明
- `CHARACTER_IMAGE_PATHS` - 参照画像のパス（カンマ区切り）
- `ILLUSTRATION_STYLE` - イラストスタイル

### 投稿設定
- `SNS_TARGETS` - 投稿先SNS（カンマ区切り）
- `POST_BASE_HASHTAGS` - 基本ハッシュタグ
- `POST_TARGET_LENGTH` - 目標文字数
- `POST_MAX_LENGTH` - 最大文字数

### 定期実行
- `SCHEDULE_TIMES` - 実行時刻（HH:MM形式、カンマ区切り）
- `TOPIC_LIST_FILE` - お題リストファイルのパス
