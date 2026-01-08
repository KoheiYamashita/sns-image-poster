# SNS Image Poster

キャラクター設定に基づいて物語とイラスト／4コマ漫画を自動生成し、SNSに投稿するシステム。

## 機能

- **お題取得**: Xからお題を取得
- **物語生成**: ClaudeCodeでキャラクター設定に基づいた物語を生成
- **画像生成**: Gemini 3 Pro Imageで物語のワンシーンを画像化
- **4コマ漫画モード**: 起承転結の4コマ漫画+挿絵を自動生成
- **品質チェック**: 生成画像がキャラクター設定・物語・スタイルに合致しているか検証
- **自動リトライ**: 品質チェック不合格時にプロンプトを改善して再生成
- **投稿テキスト作成**: SNS投稿用のテキストとハッシュタグを生成
- **SNS投稿**: bundle.social API経由で複数SNSに投稿（X、Bluesky、Threads等）
- **定期実行**: 指定時刻に自動実行するデーモンモード

## 必要要件

- Node.js >= 22.0.0
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) がインストール済みであること（Claude Agent SDK用）
- [TwitterAPI.io](https://twitterapi.io/) APIキー（Xからお題を取得する場合）
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

APIキーと認証情報のみ`.env`に設定します。その他の設定はプリセットで管理します。

```bash
# TwitterAPI.io（お題取得用、任意）
TWITTER_API_IO_KEY=your_api_key

# Gemini API（画像生成用）
GEMINI_API_KEY=your_gemini_api_key

# bundle.social（SNS投稿用、任意）
BUNDLE_SOCIAL_API_KEY=your_api_key
BUNDLE_SOCIAL_TEAM_ID=your_team_id

# 通知設定（任意）
WEBHOOK_URL=https://example.com/webhook
LOG_FILE_PATH=./logs/workflow.jsonl
```

## プリセット

設定をJSONファイルで管理し、実行時に`-p`オプションで切り替えます。

### プリセットファイルの作成

`assets/presets/`にJSONファイルを作成:

```json
{
  "contentMode": "illustration",
  "charactersDir": "./assets/characters",
  "characterIds": ["kanon"],
  "mainCharacterId": "kanon",
  "characterSelectionMode": "all",
  "illustrationStyle": "3Dアニメーション",
  "aspectRatio": "1:1",
  "postStyle": "カジュアルでフレンドリー",
  "postBaseHashtags": ["イラスト", "AI"],
  "postTargetLength": 100,
  "postMaxLength": 140,
  "snsTargets": ["TWITTER", "BLUESKY"],
  "timezone": "Asia/Tokyo"
}
```

### プリセットで指定可能な項目

| 項目 | 説明 | デフォルト |
|------|------|-----------|
| `contentMode` | `illustration` または `manga` | `illustration` |
| `charactersDir` | キャラクターディレクトリ | - |
| `characterIds` | 使用キャラクターID（配列） | - |
| `mainCharacterId` | 主軸キャラクターID | - |
| `characterSelectionMode` | `all`（全員）または `auto`（AI選択） | `all` |
| `illustrationStyle` | イラストスタイル | - |
| `aspectRatio` | 画像比率 | イラスト:`1:1`, 漫画:`3:4` |
| `maxImageRetryCount` | 最大リトライ回数 | `3` |
| `postStyle` | 投稿文のスタイル | - |
| `postBaseHashtags` | 基本ハッシュタグ（配列） | - |
| `postTargetLength` | 目標文字数 | `100` |
| `postMaxLength` | 最大文字数 | `140` |
| `snsTargets` | 投稿先SNS（配列） | `[]` |
| `quoteUrlTargets` | 引用URL付与SNS（配列） | `[]` |
| `topicSourceAccount` | お題取得元アカウント | - |
| `topicSearchKeyword` | 検索キーワード | - |
| `topicPattern` | お題抽出パターン（正規表現） | - |
| `topicListFile` | お題リストファイル | - |
| `scheduleTimes` | 定期実行時刻（配列） | - |
| `timezone` | タイムゾーン | `Asia/Tokyo` |

### キャラクターディレクトリ構造

```
assets/characters/
├── kanon/
│   ├── prompt.txt        # キャラクター設定（名前、性格など）
│   ├── appearance.txt    # 外見プロンプト（英語）
│   └── images/           # 参照画像
│       ├── front.png
│       └── back.png
└── yuki/
    ├── prompt.txt
    ├── appearance.txt
    └── images/
```

### 対応SNSプラットフォーム

`snsTargets`に指定可能な値:
- `TWITTER` - Twitter/X
- `BLUESKY` - Bluesky
- `THREADS` - Threads
- `INSTAGRAM` - Instagram
- `FACEBOOK` - Facebook
- `LINKEDIN` - LinkedIn
- `TIKTOK` - TikTok
- `MASTODON` - Mastodon

### お題取得の優先順位

1. `--topic` 引数 → 手動指定
2. `topicListFile` → ファイルから（1行1お題、ランダム選択、使用後削除）
3. 上記なし → Twitter API

## 使い方

### 基本実行

```bash
# プリセットを指定して実行
npm run start -- -p my-preset

# プリセット + お題を直接指定
npm run start -- -p my-preset -t "猫の日"

# 複数プリセットを並列実行
npm run start -- -p preset1 -p preset2

# ヘルプ表示
npm run start -- --help
```

### 定期実行（デーモンモード）

```bash
# プリセットを指定してデーモンを起動
npm run daemon:start -- -p my-preset

# 複数プリセットで定期実行
npm run daemon:start -- -p preset1 -p preset2

# デーモンを停止
npm run daemon:stop
```

プリセットの`scheduleTimes`で指定した時刻に自動実行されます。

## ワークフロー

### イラストモード（デフォルト: `contentMode: "illustration"`）

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

ワークフロー実行ごとにログファイルが生成されます。コンソールと同じ内容がファイルにも保存されます。

- プリセット指定時: `logs/workflow-{プリセット名}-{タイムスタンプ}.log`
- 複数プリセット並列実行時は、各プリセットごとに独立したログファイルが作成されます

### 4コマ漫画モード（`contentMode: "manga"`）

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
│   ├── env.ts              # 環境変数管理
│   └── character-loader.ts # キャラクター読み込み
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
│   └── character.ts        # キャラクター関連型
├── errors/                 # エラークラス
└── lib/
    ├── logger.ts           # ロガー
    └── notification.ts     # Webhook通知・ログ保存

scripts/
├── daemon-start.sh         # デーモン起動スクリプト
└── daemon-stop.sh          # デーモン停止スクリプト
```

