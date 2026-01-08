# SNS Image Poster

キャラクター設定に基づいて物語とイラスト／4コマ漫画を自動生成し、SNSに投稿するシステム。

## 機能

- **お題取得**: Twitter/Xから「今日は○○の日」形式のお題を取得
- **物語生成**: Claude Opus 4.5でキャラクター設定に基づいた物語を生成
- **画像生成**: Gemini 3 Pro Imageで物語のワンシーンを画像化
- **4コマ漫画モード**: 起承転結の4コマ漫画+挿絵を自動生成
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
```

※ `npm run start` 実行時に自動でビルドされるため、手動ビルドは不要です。

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
ASPECT_RATIO=1:1                         # 画像比率（未指定時：イラスト=1:1、漫画=3:4）

# コンテンツモード設定
CONTENT_MODE=illustration                # illustration または manga

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

# お題リストファイル設定（任意）
TOPIC_LIST_FILE=./data/topics.txt        # 設定時はファイルからお題取得

# タイムゾーン
TZ=Asia/Tokyo
```

### お題取得の優先順位

1. `--topic` 引数 → 手動指定
2. `TOPIC_LIST_FILE` → ファイルから（1行1お題、ランダム選択、使用後削除）
3. 上記なし → Twitter API

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

### イラストモード（デフォルト: `CONTENT_MODE=illustration`）

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
   └─ 画像アップロード → 指定SNSへ投稿

8. 完了通知 ※オプション
   └─ Webhook送信 / ログ保存
```

### ログ出力

ワークフロー実行ごとに `logs/workflow-{タイムスタンプ}.log` にログファイルが生成されます。
コンソールと同じ内容がファイルにも保存されるため、後から実行結果を確認できます。

### 4コマ漫画モード（`CONTENT_MODE=manga`）

```
1. お題取得 (TwitterAPI.io)
   └─ 指定アカウントから「今日は○○の日」を取得

2. プロット生成 (Claude Opus 4.5)
   └─ キャラクター設定 + お題 → 起承転結の4コマ構成 + 挿絵説明

3. 画像生成 (Gemini 3 Pro Image)
   └─ 参照画像 + プロンプト → 4コマ+挿絵レイアウトの画像

4. 品質チェック (Claude Opus 4.5)
   ├─ キャラクター一貫性（全コマで同じ外見か）
   ├─ セリフ可読性
   ├─ レイアウト正確性
   ├─ 物語の流れ
   └─ 挿絵整合性

5. リトライ（不合格時）
   └─ フィードバックを元にプロンプト改善 → 再生成

6. 投稿テキスト作成 (Claude Opus 4.5)
   └─ あらすじ + お題 → SNS投稿文 + ハッシュタグ

7. SNS投稿 (bundle.social) ※オプション
   └─ 画像アップロード → 指定SNSへ投稿

8. 完了通知 ※オプション
   └─ Webhook送信 / ログ保存
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
│   ├── runner.ts           # ワークフロー実行
│   └── manga/              # 4コマ漫画モード
│       ├── story-generator.ts  # プロット生成
│       ├── image-generator.ts  # 漫画画像生成
│       └── workflow.ts         # 漫画ワークフロー
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

