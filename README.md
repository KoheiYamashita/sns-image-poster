# SNS Image Poster

キャラクター設定に基づいて物語と画像を自動生成し、SNSに投稿するシステム。

## 機能

- **お題取得**: Twitter/Xから「今日は○○の日」形式のお題を取得
- **物語生成**: Claude Opus 4.5でキャラクター設定に基づいた物語を生成
- **画像生成**: Gemini 3 Pro Imageで物語のワンシーンを画像化
- **品質チェック**: 生成画像がキャラクター設定・物語・スタイルに合致しているか検証
- **自動リトライ**: 品質チェック不合格時にプロンプトを改善して再生成
- **投稿テキスト作成**: SNS投稿用のテキストとハッシュタグを生成
- **SNS投稿**: bundle.social API経由で複数SNSに投稿（Twitter/X、Bluesky、Threads等）
- **定期実行**: 指定時刻に自動実行するデーモンモード

## 必要要件

- Node.js >= 22.0.0
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) がインストール済みであること（Claude Agent SDK用）
- [TwitterAPI.io](https://twitterapi.io/) APIキー
- [Gemini API](https://ai.google.dev/) APIキー
- [bundle.social](https://bundle.social/) APIキー（SNS投稿機能を使用する場合）

## セットアップ

```bash
# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
# .envを編集

# ビルド
npm run build
```

## 環境変数

```bash
# TwitterAPI.io
TWITTER_API_IO_KEY=your_api_key

# お題取得設定
X_TOPIC_SOURCE_ACCOUNT=today_norma      # お題取得元アカウント
TOPIC_SEARCH_KEYWORD=今日は              # 検索キーワード
TOPIC_PATTERN=^今日は(.+の日)です！      # お題抽出パターン（正規表現）

# キャラクター設定
CHARACTER_PROMPT_PATH=./assets/character.txt  # キャラクター設定ファイル
CHARACTER_IMAGE_PATHS=./assets/ref1.png,./assets/ref2.png  # 参照画像（カンマ区切り）
CHARACTER_APPEARANCE_PROMPT=blonde hair, blue eyes...  # 英語の外見プロンプト
ILLUSTRATION_STYLE=3Dアニメーション      # イラストスタイル

# Gemini API
GEMINI_API_KEY=your_gemini_api_key
IMAGE_ASPECT_RATIO=1:1                   # 画像比率

# リトライ設定
MAX_IMAGE_RETRY_COUNT=3                  # 最大リトライ回数

# 投稿設定
POST_STYLE=カジュアルでフレンドリー      # 投稿文のスタイル
POST_BASE_HASHTAGS=イラスト,AI           # 基本ハッシュタグ（#なしでOK）
POST_TARGET_LENGTH=100                   # 目標文字数
POST_MAX_LENGTH=140                      # 最大文字数

# bundle.social設定（任意：設定しなければ投稿スキップ）
BUNDLE_SOCIAL_API_KEY=your_api_key       # bundle.social APIキー
BUNDLE_SOCIAL_TEAM_ID=your_team_id       # bundle.social チームID
SNS_TARGETS=TWITTER,BLUESKY              # 投稿先SNS（カンマ区切り）

# 引用URL設定（任意）
QUOTE_URL_TARGETS=TWITTER                # 引用URLを先頭に追加するSNS（カンマ区切り）

# 通知設定（任意）
WEBHOOK_URL=https://example.com/webhook  # 成功/エラー時のWebhook送信先
LOG_FILE_PATH=./logs/workflow.jsonl      # ログ保存先（JSONL形式で追記）

# 定期実行設定（任意）
SCHEDULE_TIMES=09:00,12:00,18:00         # 定期実行時刻（TZに基づく）

# タイムゾーン
TZ=Asia/Tokyo
```

### 対応SNSプラットフォーム

`SNS_TARGETS` に指定可能な値:
- `TWITTER` - Twitter/X
- `BLUESKY` - Bluesky
- `THREADS` - Threads
- `INSTAGRAM` - Instagram
- `FACEBOOK` - Facebook
- `LINKEDIN` - LinkedIn
- `TIKTOK` - TikTok
- `MASTODON` - Mastodon

## 使い方

### 基本実行

```bash
# Twitterからお題を自動取得して実行
npm run start

# お題を直接指定して実行
npm run start -- --topic "猫の日"
npm run start -- -t "犬の日"

# ヘルプ表示
npm run start -- --help
```

### 定期実行（デーモンモード）

```bash
# デーモンを起動（バックグラウンド実行）
npm run daemon:start

# デーモンを停止
npm run daemon:stop
```

SCHEDULE_TIMESで指定した時刻に自動実行されます。

### テストコマンド

```bash
# 全ワークフローのテスト（お題取得 → 物語生成 → 画像生成 → 投稿テキスト作成）
npm run test:workflow

# お題取得のみ
npm run test:topic

# 物語生成のみ
npm run test:story
```

## ワークフロー

```
1. お題取得 (TwitterAPI.io)
   └─ 指定アカウントから「今日は○○の日」を取得

2. 物語生成 (Claude Opus 4.5)
   └─ キャラクター設定 + お題 → 物語 + 画像プロンプト

3. 画像生成 (Gemini 3 Pro Image)
   └─ 参照画像 + プロンプト → 挿絵

4. 品質チェック (Claude Opus 4.5)
   ├─ キャラクター一致
   ├─ 物語との整合性
   ├─ スタイル一致
   └─ 画像品質

5. リトライ（不合格時）
   └─ フィードバックを元にプロンプト改善 → 再生成

6. 投稿テキスト作成 (Claude Opus 4.5)
   └─ 物語 + お題 → SNS投稿文 + ハッシュタグ

7. SNS投稿 (bundle.social) ※オプション
   ├─ 画像アップロード
   ├─ 指定SNSへ投稿
   │   └─ QUOTE_URL_TARGETS指定のSNSのみ引用URLを先頭に追加
   └─ API KEY未設定時はスキップ

8. 完了通知 ※オプション
   ├─ 成功時: "投稿が完了しました" / "投稿の準備ができました"
   ├─ エラー時: エラー内容（step + message）
   ├─ Webhook送信（WEBHOOK_URL設定時）
   └─ ログ保存（LOG_FILE_PATH設定時、JSONL形式で追記）
```

## プロジェクト構成

```
src/
├── cli/
│   └── args.ts             # CLI引数パース
├── config/
│   └── env.ts              # 環境変数管理
├── providers/
│   ├── topic/              # お題取得プロバイダー
│   │   ├── twitter-api-io.ts  # Twitter自動取得
│   │   └── manual.ts          # CLI引数指定
│   ├── image-generation/   # 画像生成プロバイダー
│   │   └── gemini.ts
│   ├── sns/                # SNSログイン管理
│   │   └── twitter.ts
│   └── sns-post/           # SNS投稿プロバイダー
│       ├── interface.ts       # インターフェース定義
│       └── bundle-social.ts   # bundle.social実装
├── workflow/
│   ├── story-generator.ts  # 物語生成
│   ├── image-generator.ts  # 画像生成
│   ├── quality-checker.ts  # 品質チェック
│   ├── prompt-refiner.ts   # プロンプト改善
│   ├── image-workflow.ts   # 画像生成ワークフロー（リトライ込み）
│   ├── post-formatter.ts   # 投稿テキスト作成
│   └── runner.ts           # ワークフロー実行
├── daemon.ts               # デーモンエントリーポイント
├── types/                  # 型定義
├── errors/                 # エラークラス
└── lib/
    ├── logger.ts           # ロガー
    └── notification.ts     # Webhook通知・ログ保存

scripts/
├── daemon-start.sh         # デーモン起動スクリプト
└── daemon-stop.sh          # デーモン停止スクリプト
```

