# SNS画像投稿サーバー 詳細設計書

**バージョン**: 1.0.0
**作成日**: 2026-01-06
**ステータス**: Draft

---

## 目次

1. [システムアーキテクチャ](#1-システムアーキテクチャ)
2. [モジュール設計](#2-モジュール設計)
3. [データ設計](#3-データ設計)
4. [インターフェース設計](#4-インターフェース設計)
5. [シーケンス設計](#5-シーケンス設計)
6. [エラーハンドリング設計](#6-エラーハンドリング設計)
7. [設定・環境変数設計](#7-設定環境変数設計)
8. [ディレクトリ構成](#8-ディレクトリ構成)
9. [依存パッケージ](#9-依存パッケージ)
10. [プロンプト設計](#10-プロンプト設計)

---

## 1. システムアーキテクチャ

### 1.1 全体構成図

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SNS Image Poster                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌──────────────────────────────────────────────────┐   │
│  │  Scheduler  │───▶│              Workflow Engine                     │   │
│  │  (node-cron)│    │                                                  │   │
│  └─────────────┘    │  ┌────────────┐  ┌────────────┐  ┌────────────┐  │   │
│                     │  │   Topic    │  │   Story    │  │   Image    │  │   │
│                     │  │  Fetcher   │─▶│ Generator  │─▶│ Generator  │  │   │
│                     │  └────────────┘  └────────────┘  └─────┬──────┘  │   │
│                     │                                        │         │   │
│                     │                                        ▼         │   │
│                     │  ┌────────────┐  ┌────────────┐  ┌────────────┐  │   │
│                     │  │    SNS     │◀─│    Post    │◀─│  Quality   │  │   │
│                     │  │   Poster   │  │ Formatter  │  │  Checker   │  │   │
│                     │  └────────────┘  └────────────┘  └────────────┘  │   │
│                     │                                                  │   │
│                     └──────────────────────────────────────────────────┘   │
│                                          │                                  │
│  ┌───────────────────────────────────────┼───────────────────────────────┐ │
│  │                     Providers Layer   │                               │ │
│  │                                       ▼                               │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │ │
│  │  │   Topic     │  │   Image     │  │    SNS      │  │Notification │  │ │
│  │  │  Provider   │  │  Provider   │  │  Provider   │  │  Provider   │  │ │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  │ │
│  │         │                │                │                │         │ │
│  │         ▼                ▼                ▼                ▼         │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │ │
│  │  │  X Account  │  │ NanaBanana  │  │   Buffer    │  │   Webhook   │  │ │
│  │  │  Provider   │  │  Provider   │  │  Provider   │  │  Provider   │  │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │ │
│  │                   ┌─────────────┐  ┌─────────────┐                   │ │
│  │                   │   (Future)  │  │  X Direct   │                   │ │
│  │                   │  Provider   │  │  Provider   │                   │ │
│  │                   └─────────────┘  └─────────────┘                   │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                        External Services                              │ │
│  │                                                                       │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │ │
│  │  │ Anthropic   │  │   X API     │  │ NanaBanana  │  │   Buffer    │  │ │
│  │  │ Claude API  │  │   (v2)      │  │    API      │  │    API      │  │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 レイヤー構成

| レイヤー | 責務 | 主要コンポーネント |
|---------|------|-------------------|
| Entry Layer | アプリケーション起動・スケジュール管理 | index.ts, scheduler.ts |
| Workflow Layer | ビジネスロジック・フロー制御 | workflow/*.ts |
| Provider Layer | 外部サービス抽象化 | providers/*/*.ts |
| Library Layer | 共通ユーティリティ | lib/*.ts |
| Config Layer | 設定・環境変数管理 | config/*.ts |

### 1.3 設計原則

| 原則 | 適用箇所 |
|------|---------|
| 依存性逆転の原則（DIP） | 上位モジュールは抽象（インターフェース）に依存 |
| 単一責任の原則（SRP） | 各モジュールは1つの責務のみ |
| 開放閉鎖の原則（OCP） | プロバイダーパターンで拡張に開き、修正に閉じる |
| インターフェース分離の原則（ISP） | 小さく焦点を絞ったインターフェース |

---

## 2. モジュール設計

### 2.1 エントリーポイント（index.ts）

| 項目 | 内容 |
|------|------|
| 責務 | アプリケーション起動・初期化・シャットダウン |
| 処理 | 環境変数読込 → バリデーション → プロバイダー初期化 → スケジューラー起動 |

**起動フロー:**
1. `dotenv.config()` で環境変数読み込み
2. `validateEnv()` で必須環境変数チェック
3. `initializeProviders()` でプロバイダー初期化
4. `startScheduler()` でcronジョブ開始
5. シグナルハンドラー設定（SIGTERM, SIGINT）

---

### 2.2 スケジューラー（scheduler.ts）

| 項目 | 内容 |
|------|------|
| 責務 | cronジョブの登録・管理・ワークフローの定期実行 |
| 設定 | cronExpression（.envから取得）, timezone（デフォルト: Asia/Tokyo） |

**公開メソッド:**

| メソッド | 説明 |
|---------|------|
| `start()` | スケジューラー開始 |
| `stop()` | スケジューラー停止 |
| `runNow()` | 即時実行（テスト用） |
| `getNextRun()` | 次回実行日時取得 |

---

### 2.3 ワークフローエンジン（workflow/index.ts）

| 項目 | 内容 |
|------|------|
| 責務 | 処理フロー全体の制御・Agent SDKセッション管理・リトライ制御 |
| セッション | 1つのAgent SDKセッションで全フロー実行 |

**ワークフロー結果:**

| フィールド | 型 | 説明 |
|-----------|---|------|
| success | boolean | 成功/失敗 |
| topic | TopicSource \| null | 取得したお題 |
| story | string \| null | 生成した物語 |
| image | Buffer \| null | 生成した画像 |
| postUrl | string \| null | 投稿URL |
| error | Error \| null | エラー情報 |
| retryCount | number | リトライ回数 |
| executionTime | number | 実行時間（ms） |

---

### 2.4 お題取得（workflow/topic-fetcher.ts）

| 項目 | 内容 |
|------|------|
| 責務 | TopicProviderを使用してお題を取得・正規化 |
| 取得元 | X（Twitter）の指定アカウント |
| パターン | 「今日は◯◯の日です！」から「◯◯の日」を抽出 |

**処理ロジック:**
1. X APIで指定アカウントの最新ツイートを取得
2. 「今日は◯◯の日です」パターンにマッチするツイートを検索
3. 「◯◯の日」部分を抽出
4. ツイートID（引用リポスト用）を保持
5. TopicSourceオブジェクトを構築して返却

---

### 2.5 物語生成（workflow/story-generator.ts）

| 項目 | 内容 |
|------|------|
| 責務 | Agent SDKを使用して物語を生成 |
| 使用API | Anthropic Claude API |

**インプット:**

| フィールド | 説明 |
|-----------|------|
| topic | お題情報（TopicSource） |
| characterPrompt | キャラクター設定テキスト |
| characterImage | キャラクター参照画像（Buffer） |

**アウトプット:**

| フィールド | 説明 |
|-----------|------|
| story | 生成された物語（フル版、200-300文字） |
| shortStory | 短縮版（SNS投稿用、100文字以内） |
| imagePrompt | 挿絵生成用プロンプト（英語） |

---

### 2.6 挿絵生成（workflow/image-generator.ts）

| 項目 | 内容 |
|------|------|
| 責務 | ImageGenerationProviderを使用して画像生成 |
| 使用サービス | nano banana pro（実装時決定） |

**インプット:**

| フィールド | 説明 |
|-----------|------|
| story | 物語テキスト |
| imagePrompt | 画像生成用プロンプト |
| characterImage | キャラクター参照画像 |
| illustrationStyle | イラストスタイル設定 |

**アウトプット:**

| フィールド | 説明 |
|-----------|------|
| image | 生成された画像（Buffer） |
| prompt | 実際に使用したプロンプト |

---

### 2.7 品質チェック（workflow/quality-checker.ts）

| 項目 | 内容 |
|------|------|
| 責務 | Claude Visionを使用した画像評価 |
| 使用API | Anthropic Claude Vision |

**インプット:**

| フィールド | 説明 |
|-----------|------|
| characterImage | 参照キャラクター画像 |
| characterPrompt | キャラクター設定 |
| story | 生成した物語 |
| generatedImage | 生成した挿絵 |

**アウトプット:**

| フィールド | 型 | 説明 |
|-----------|---|------|
| passed | boolean | 合格/不合格 |
| score | number | 品質スコア（0-100） |
| characterMatch | boolean | キャラクター一致 |
| storyMatch | boolean | 物語整合性 |
| issues | string[] | 検出された問題点 |
| suggestions | string[] | 改善提案 |

**判定基準:**
1. キャラクターの特徴（髪型、服装、特徴的なアイテム等）の一致
2. 物語のシーン・状況との整合性
3. イラストスタイルの一貫性
4. 全体的な品質（歪み、破綻がないか）

---

### 2.8 投稿フォーマット（workflow/post-formatter.ts）

| 項目 | 内容 |
|------|------|
| 責務 | SNSごとの文字数制限対応・フォーマット最適化 |
| 対象 | X（Twitter）: 280文字以内 |

**X（Twitter）フォーマットルール:**
- 最大280文字
- ハッシュタグは末尾に配置（2-3個）
- 絵文字で視覚的なアクセント
- 改行で読みやすく

**アウトプット:**

| フィールド | 説明 |
|-----------|------|
| text | フォーマット済みテキスト |
| hashtags | 使用したハッシュタグ |
| characterCount | 文字数 |

---

## 3. データ設計

### 3.1 お題関連

```
TopicSource
├── tweetId: string         # 元ツイートID（引用リポスト用）
├── tweetUrl: string        # 元ツイートURL
├── accountHandle: string   # 取得元アカウント（@xxx）
├── topicText: string       # 抽出したお題（「◯◯の日」）
├── originalText: string    # 元ツイートの全文
└── fetchedAt: Date         # 取得日時
```

### 3.2 物語関連

```
GeneratedStory
├── fullText: string        # フルバージョン
├── shortText: string       # 短縮版（SNS用）
├── imagePrompt: string     # 画像生成用プロンプト
└── generatedAt: Date       # 生成日時
```

### 3.3 画像関連

```
GeneratedImage
├── data: Buffer            # 画像バイナリ
├── mimeType: string        # MIMEタイプ
├── prompt: string          # 使用したプロンプト
└── generatedAt: Date       # 生成日時
```

### 3.4 投稿関連

```
PostContent
├── text: string            # 投稿テキスト
├── image: Buffer           # 添付画像
├── hashtags: string[]      # ハッシュタグ
└── quoteTweetId: string    # 引用元ツイートID

PostResult
├── success: boolean        # 成功/失敗
├── postId: string          # 投稿ID
├── postUrl: string         # 投稿URL
├── postedAt: Date          # 投稿日時
└── error?: string          # エラーメッセージ
```

### 3.5 ワークフロー関連

```
WorkflowResult
├── success: boolean
├── topic: TopicSource | null
├── story: GeneratedStory | null
├── image: GeneratedImage | null
├── post: PostResult | null
├── error: WorkflowError | null
├── retryCount: number
├── startedAt: Date
├── completedAt: Date
└── executionTimeMs: number

WorkflowError
├── step: WorkflowStep
├── message: string
├── details?: Record<string, unknown>
└── stack?: string

WorkflowStep =
  | 'topic_fetch'
  | 'story_generation'
  | 'image_generation'
  | 'quality_check'
  | 'post_format'
  | 'sns_post'
```

### 3.6 通知関連

```
NotificationData
├── type: 'success' | 'error'
├── timestamp: Date
├── workflowId: string
├── topic?: string
├── postUrl?: string
├── error?: {
│     step: WorkflowStep
│     message: string
│   }
└── metadata?: Record<string, unknown>
```

---

## 4. インターフェース設計

### 4.1 TopicProvider

```
TopicProvider
├── getName(): string
├── getTopic(): Promise<TopicSource>
├── initialize?(): Promise<void>
└── cleanup?(): Promise<void>
```

**実装クラス:**
| クラス | 説明 |
|--------|------|
| XAccountTopicProvider | Xアカウントからお題取得（本番用） |
| StaticTopicProvider | 固定リストからお題取得（テスト用） |
| RandomTopicProvider | ランダム生成（テスト用） |

**XAccountTopicProvider設定:**

| 設定項目 | 説明 |
|---------|------|
| bearerToken | X API Bearer Token |
| sourceAccount | 取得元アカウント（@なし） |
| searchPattern | 検索パターン（デフォルト: `/今日は(.+の日)です/`） |

---

### 4.2 ImageGenerationProvider

```
ImageGenerationProvider
├── getName(): string
├── generate(prompt, referenceImage, options?): Promise<GeneratedImage>
├── initialize?(): Promise<void>
└── cleanup?(): Promise<void>
```

**ImageGenerationOptions:**

| オプション | 型 | 説明 |
|-----------|---|------|
| style | string | イラストスタイル |
| width | number | 画像幅 |
| height | number | 画像高さ |
| negativePrompt | string | ネガティブプロンプト |

**実装クラス:**
| クラス | 説明 |
|--------|------|
| NanaBananaProvider | nano banana pro API（実装時追加） |
| (Future) | 他サービス対応時に追加 |

---

### 4.3 SNSPostProvider

```
SNSPostProvider
├── getName(): string
├── getPlatform(): 'x' | 'instagram' | 'facebook'
├── post(content, options?): Promise<PostResult>
├── uploadMedia?(image): Promise<string>
├── initialize?(): Promise<void>
└── cleanup?(): Promise<void>
```

**SNSPostOptions:**

| オプション | 型 | 説明 |
|-----------|---|------|
| quoteTweetId | string | 引用リポスト用ツイートID |
| scheduledAt | Date | 予約投稿日時 |

**実装クラス:**
| クラス | 説明 |
|--------|------|
| BufferProvider | Buffer API経由投稿 |
| XDirectProvider | X API v2直接投稿 |

---

### 4.4 NotificationProvider

```
NotificationProvider
├── getName(): string
├── notify(type, data): Promise<void>
├── initialize?(): Promise<void>
└── cleanup?(): Promise<void>
```

**実装クラス:**
| クラス | 説明 |
|--------|------|
| WebhookProvider | Webhook通知 |
| (Future) SlackProvider | Slack通知 |
| (Future) DiscordProvider | Discord通知 |

**WebhookProvider設定:**

| 設定項目 | 説明 |
|---------|------|
| url | Webhook URL |
| headers | カスタムヘッダー |
| timeout | タイムアウト（ms） |

---

## 5. シーケンス設計

### 5.1 正常系シーケンス

```
┌─────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ ┌───────┐ ┌─────────┐ ┌────────┐ ┌────────┐
│Scheduler│ │ Workflow │ │ Topic  │ │ Story  │ │ Image │ │ Quality │ │  Post  │ │  SNS   │
│         │ │  Engine  │ │Fetcher │ │  Gen   │ │  Gen  │ │ Checker │ │Formattr│ │Provider│
└────┬────┘ └────┬─────┘ └───┬────┘ └───┬────┘ └───┬───┘ └────┬────┘ └───┬────┘ └───┬────┘
     │           │           │          │          │          │          │          │
     │ execute() │           │          │          │          │          │          │
     │──────────▶│           │          │          │          │          │          │
     │           │           │          │          │          │          │          │
     │           │ fetch()   │          │          │          │          │          │
     │           │──────────▶│          │          │          │          │          │
     │           │           │──┐       │          │          │          │          │
     │           │           │  │X API  │          │          │          │          │
     │           │           │◀─┘       │          │          │          │          │
     │           │ TopicSource          │          │          │          │          │
     │           │◀──────────│          │          │          │          │          │
     │           │           │          │          │          │          │          │
     │           │  ════════ Agent SDK Session Start ════════ │          │          │
     │           │           │          │          │          │          │          │
     │           │ generate(topic, charPrompt, charImage)     │          │          │
     │           │─────────────────────▶│          │          │          │          │
     │           │           │          │──┐       │          │          │          │
     │           │           │          │  │Claude │          │          │          │
     │           │           │          │◀─┘       │          │          │          │
     │           │ StoryOutput          │          │          │          │          │
     │           │◀─────────────────────│          │          │          │          │
     │           │           │          │          │          │          │          │
     │           │ generate(story, imagePrompt, charImage)    │          │          │
     │           │────────────────────────────────▶│          │          │          │
     │           │           │          │          │──┐       │          │          │
     │           │           │          │          │  │ImageAPI│         │          │
     │           │           │          │          │◀─┘       │          │          │
     │           │ GeneratedImage       │          │          │          │          │
     │           │◀────────────────────────────────│          │          │          │
     │           │           │          │          │          │          │          │
     │           │ check(charImage, story, genImage)          │          │          │
     │           │───────────────────────────────────────────▶│          │          │
     │           │           │          │          │          │──┐       │          │
     │           │           │          │          │          │  │Vision │          │
     │           │           │          │          │          │◀─┘       │          │
     │           │ QualityCheckResult (passed=true)           │          │          │
     │           │◀───────────────────────────────────────────│          │          │
     │           │           │          │          │          │          │          │
     │           │ format(story, topic) │          │          │          │          │
     │           │─────────────────────────────────────────────────────▶│          │
     │           │ FormattedPost        │          │          │          │          │
     │           │◀─────────────────────────────────────────────────────│          │
     │           │           │          │          │          │          │          │
     │           │ post(content, quoteTweetId)     │          │          │          │
     │           │────────────────────────────────────────────────────────────────▶│
     │           │           │          │          │          │          │          │──┐
     │           │           │          │          │          │          │          │  │X
     │           │           │          │          │          │          │          │◀─┘
     │           │ PostResult           │          │          │          │          │
     │           │◀────────────────────────────────────────────────────────────────│
     │           │           │          │          │          │          │          │
     │           │  ════════ Agent SDK Session End ══════════ │          │          │
     │           │           │          │          │          │          │          │
     │ WorkflowResult        │          │          │          │          │          │
     │◀──────────│           │          │          │          │          │          │
```

### 5.2 リトライシーケンス（品質チェック失敗時）

```
┌──────────┐ ┌───────┐ ┌─────────┐
│ Workflow │ │ Image │ │ Quality │
│  Engine  │ │  Gen  │ │ Checker │
└────┬─────┘ └───┬───┘ └────┬────┘
     │           │          │
     │ generate()│          │
     │──────────▶│          │
     │ Image #1  │          │
     │◀──────────│          │
     │           │          │
     │ check()   │          │
     │─────────────────────▶│
     │ passed=false, suggestions
     │◀─────────────────────│
     │           │          │
     │ ══ Retry 1/3 ══════  │
     │           │          │
     │ generate() with adjusted prompt
     │──────────▶│          │
     │ Image #2  │          │
     │◀──────────│          │
     │           │          │
     │ check()   │          │
     │─────────────────────▶│
     │ passed=false         │
     │◀─────────────────────│
     │           │          │
     │ ══ Retry 2/3 ══════  │
     │           │          │
     │ generate() with adjusted prompt
     │──────────▶│          │
     │ Image #3  │          │
     │◀──────────│          │
     │           │          │
     │ check()   │          │
     │─────────────────────▶│
     │ passed=true          │
     │◀─────────────────────│
     │           │          │
     │ ══ Continue to post  │
```

### 5.3 エラーシーケンス（リトライ超過時）

```
┌──────────┐ ┌─────────┐ ┌────────────┐
│ Workflow │ │ Quality │ │Notification│
│  Engine  │ │ Checker │ │  Provider  │
└────┬─────┘ └────┬────┘ └─────┬──────┘
     │            │            │
     │ [MAX_RETRY_COUNT failures]
     │            │            │
     │ check()    │            │
     │───────────▶│            │
     │ passed=false            │
     │◀───────────│            │
     │            │            │
     │ ══ Max retries exceeded │
     │            │            │
     │ notify('error', data)   │
     │────────────────────────▶│
     │            │            │──┐
     │            │            │  │Webhook
     │            │            │◀─┘
     │            │            │
     │ ══ Workflow terminated  │
```

---

## 6. エラーハンドリング設計

### 6.1 エラー分類

| カテゴリ | エラークラス | 発生箇所 | 対応 |
|---------|-------------|---------|------|
| 設定エラー | ConfigError | 起動時 | 即時終了 |
| お題取得エラー | TopicFetchError | お題取得 | 通知 → 終了 |
| 物語生成エラー | StoryGenerationError | 物語生成 | 通知 → 終了 |
| 画像生成エラー | ImageGenerationError | 画像生成 | リトライ or 通知 → 終了 |
| 品質チェックエラー | QualityCheckError | 品質チェック | リトライ or 通知 → 終了 |
| 投稿エラー | SNSPostError | SNS投稿 | 通知 → 終了 |
| 通知エラー | NotificationError | 通知 | ログ出力（無視） |

### 6.2 エラークラス構造

```
WorkflowBaseError (abstract)
├── step: WorkflowStep
├── timestamp: Date
├── message: string
├── details?: Record<string, unknown>
└── toJSON(): Record<string, unknown>

継承クラス:
├── TopicFetchError       (step = 'topic_fetch')
├── StoryGenerationError  (step = 'story_generation')
├── ImageGenerationError  (step = 'image_generation')
├── QualityCheckError     (step = 'quality_check')
└── SNSPostError          (step = 'sns_post')
```

### 6.3 リトライ戦略

| 項目 | 設定 |
|------|------|
| 最大リトライ回数 | MAX_RETRY_COUNT（.envから取得） |
| リトライ対象 | 品質チェック失敗（QualityCheckError）のみ |
| リトライ時の動作 | 改善提案を反映してプロンプト調整 → 再生成 |

---

## 7. 設定・環境変数設計

### 7.1 環境変数一覧

| カテゴリ | 変数名 | 必須 | 説明 |
|---------|--------|------|------|
| **Anthropic** | ANTHROPIC_API_KEY | ✅ | Anthropic API Key |
| **キャラクター** | CHARACTER_PROMPT | ✅ | キャラクター設定テキスト |
| | CHARACTER_IMAGE_PATH | ✅ | キャラクター画像パス |
| | ILLUSTRATION_STYLE | ✅ | イラストスタイル設定 |
| **お題取得** | X_API_BEARER_TOKEN | ✅ | X API Bearer Token |
| | X_TOPIC_SOURCE_ACCOUNT | ✅ | お題取得元アカウント |
| **画像生成** | IMAGE_PROVIDER | ✅ | 使用プロバイダー（nanabanana） |
| | IMAGE_API_KEY | ✅ | 画像生成API Key |
| | IMAGE_API_ENDPOINT | ✅ | 画像生成APIエンドポイント |
| **SNS投稿** | SNS_PROVIDER | ✅ | 使用プロバイダー（buffer/x-direct） |
| | BUFFER_API_KEY | △ | Buffer API Key（buffer使用時） |
| | X_API_KEY | △ | X API Key（x-direct使用時） |
| | X_API_SECRET | △ | X API Secret（x-direct使用時） |
| | X_ACCESS_TOKEN | △ | X Access Token（x-direct使用時） |
| | X_ACCESS_TOKEN_SECRET | △ | X Access Token Secret（x-direct使用時） |
| **スケジュール** | CRON_SCHEDULE | ✅ | cron式スケジュール |
| | TZ | - | タイムゾーン（デフォルト: Asia/Tokyo） |
| **リトライ** | MAX_RETRY_COUNT | ✅ | 最大リトライ回数 |
| **通知** | NOTIFICATION_WEBHOOK_URL | ✅ | Webhook URL |
| | NOTIFICATION_ON_SUCCESS | - | 成功時通知（デフォルト: true） |
| | NOTIFICATION_ON_ERROR | - | エラー時通知（デフォルト: true） |

### 7.2 バリデーションルール

| 変数 | ルール |
|------|--------|
| ANTHROPIC_API_KEY | 必須、空文字不可 |
| X_TOPIC_SOURCE_ACCOUNT | 必須、`/^@?\w+$/` パターン |
| IMAGE_PROVIDER | 必須、`enum: ['nanabanana']` |
| SNS_PROVIDER | 必須、`enum: ['buffer', 'x-direct']` |
| IMAGE_API_ENDPOINT | 必須、URL形式 |
| NOTIFICATION_WEBHOOK_URL | 必須、URL形式 |
| MAX_RETRY_COUNT | 必須、整数、0-10の範囲 |
| CRON_SCHEDULE | 必須、cron形式 |

### 7.3 .env.example

```env
# ============================================
# Anthropic API
# ============================================
ANTHROPIC_API_KEY=sk-ant-xxxxx

# ============================================
# キャラクター設定
# ============================================
CHARACTER_PROMPT="明るく元気な魔法少女。中二病気味で「〜なのだ」が口癖。冒険と発見が大好き。"
CHARACTER_IMAGE_PATH=./assets/character.png
ILLUSTRATION_STYLE="アニメ風、明るい色調、パステルカラー、可愛らしい雰囲気"

# ============================================
# お題取得（X API）
# ============================================
X_API_BEARER_TOKEN=AAAAAxxxxxxxxxx
X_TOPIC_SOURCE_ACCOUNT=@today_anniversary

# ============================================
# 画像生成
# ============================================
IMAGE_PROVIDER=nanabanana
IMAGE_API_KEY=your-image-api-key
IMAGE_API_ENDPOINT=https://api.example.com/generate

# ============================================
# SNS投稿
# ============================================
# buffer または x-direct
SNS_PROVIDER=buffer

# Buffer API（SNS_PROVIDER=buffer の場合）
BUFFER_API_KEY=your-buffer-api-key

# X API直接（SNS_PROVIDER=x-direct の場合）
# X_API_KEY=
# X_API_SECRET=
# X_ACCESS_TOKEN=
# X_ACCESS_TOKEN_SECRET=

# ============================================
# スケジュール設定
# ============================================
# cron形式（秒なし、5フィールド）
# 分 時 日 月 曜日
# 例: "0 12 * * *"     = 毎日12:00
# 例: "0 9,18 * * *"   = 毎日9:00と18:00
# 例: "30 */3 * * *"   = 3時間おきの30分
# 例: "0 12 * * 1-5"   = 平日の12:00のみ
CRON_SCHEDULE=0 12 * * *

# タイムゾーン（オプション）
TZ=Asia/Tokyo

# ============================================
# リトライ設定
# ============================================
MAX_RETRY_COUNT=3

# ============================================
# 通知設定
# ============================================
NOTIFICATION_WEBHOOK_URL=https://hooks.example.com/webhook
NOTIFICATION_ON_SUCCESS=true
NOTIFICATION_ON_ERROR=true
```

---

## 8. ディレクトリ構成

```
sns-image-poster/
├── src/
│   ├── index.ts                       # エントリーポイント
│   ├── scheduler.ts                   # スケジュール管理
│   │
│   ├── workflow/
│   │   ├── index.ts                   # ワークフローエンジン
│   │   ├── topic-fetcher.ts           # お題取得
│   │   ├── story-generator.ts         # 物語生成
│   │   ├── image-generator.ts         # 挿絵生成
│   │   ├── quality-checker.ts         # 品質チェック
│   │   └── post-formatter.ts          # 投稿フォーマット
│   │
│   ├── providers/
│   │   ├── topic/
│   │   │   ├── interface.ts           # TopicProvider インターフェース
│   │   │   ├── x-account.ts           # X アカウントプロバイダー
│   │   │   └── index.ts               # プロバイダーファクトリー
│   │   │
│   │   ├── image-generation/
│   │   │   ├── interface.ts           # ImageGenerationProvider インターフェース
│   │   │   ├── nanabanana.ts          # NanaBanana プロバイダー
│   │   │   └── index.ts               # プロバイダーファクトリー
│   │   │
│   │   ├── sns/
│   │   │   ├── interface.ts           # SNSPostProvider インターフェース
│   │   │   ├── buffer.ts              # Buffer プロバイダー
│   │   │   ├── x-direct.ts            # X 直接投稿プロバイダー
│   │   │   └── index.ts               # プロバイダーファクトリー
│   │   │
│   │   └── notification/
│   │       ├── interface.ts           # NotificationProvider インターフェース
│   │       ├── webhook.ts             # Webhook プロバイダー
│   │       └── index.ts               # プロバイダーファクトリー
│   │
│   ├── lib/
│   │   ├── claude-session.ts          # Agent SDK セッション管理
│   │   ├── x-api.ts                   # X API クライアント
│   │   └── logger.ts                  # ロガー
│   │
│   ├── config/
│   │   ├── env.ts                     # 環境変数読み込み・バリデーション
│   │   └── constants.ts               # 定数定義
│   │
│   ├── types/
│   │   ├── topic.ts                   # お題関連型定義
│   │   ├── story.ts                   # 物語関連型定義
│   │   ├── image.ts                   # 画像関連型定義
│   │   ├── post.ts                    # 投稿関連型定義
│   │   ├── notification.ts            # 通知関連型定義
│   │   └── index.ts                   # 型エクスポート
│   │
│   └── errors/
│       ├── base.ts                    # ベースエラークラス
│       ├── topic.ts                   # お題エラー
│       ├── story.ts                   # 物語エラー
│       ├── image.ts                   # 画像エラー
│       ├── post.ts                    # 投稿エラー
│       └── index.ts                   # エラーエクスポート
│
├── assets/
│   └── character.png                  # キャラクター画像
│
├── logs/                              # ログ出力ディレクトリ
│   └── .gitkeep
│
├── .env                               # 環境変数（gitignore）
├── .env.example                       # 環境変数テンプレート
├── .gitignore
├── package.json
├── tsconfig.json
├── eslint.config.js
└── README.md
```

---

## 9. 依存パッケージ

### 9.1 本番依存（dependencies）

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| @anthropic-ai/sdk | ^0.35.0 | Claude API連携 |
| node-cron | ^3.0.3 | スケジュール実行 |
| zod | ^3.24.0 | バリデーション |
| dotenv | ^16.4.0 | 環境変数読み込み |
| twitter-api-v2 | ^1.18.0 | X API連携 |
| pino | ^9.0.0 | ロギング |
| pino-pretty | ^11.0.0 | ログ整形（開発用） |

### 9.2 開発依存（devDependencies）

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| typescript | ^5.7.0 | TypeScript |
| @types/node | ^22.0.0 | Node.js型定義 |
| @types/node-cron | ^3.0.11 | node-cron型定義 |
| tsx | ^4.19.0 | TypeScript実行 |
| eslint | ^9.0.0 | リンター |
| @eslint/js | ^9.0.0 | ESLint設定 |
| typescript-eslint | ^8.0.0 | TypeScript ESLint |
| vitest | ^2.1.0 | テストフレームワーク |

### 9.3 Node.jsバージョン

```
engines: {
  "node": ">=22.0.0"
}
```

---

## 10. プロンプト設計

### 10.1 物語生成プロンプト

**システムプロンプト:**
```
あなたは創造的な物語作家です。
与えられたキャラクター設定とお題に基づいて、短い物語を作成してください。

【キャラクター設定】
{characterPrompt}

【イラストスタイル】
{illustrationStyle}

【出力形式】
以下の3つをJSON形式で出力してください：

1. story: 物語（フルバージョン）200-300文字程度
2. shortStory: 物語（短縮版）100文字以内のSNS投稿用
3. imagePrompt: 物語のワンシーンを描くための英語プロンプト
```

**ユーザープロンプト:**
```
【今日のお題】
{topicText}

このお題に関連した物語を作成してください。
```

---

### 10.2 品質チェックプロンプト

**システムプロンプト:**
```
あなたは画像品質評価の専門家です。
生成された挿絵がキャラクター設定と物語に適合しているかを評価してください。

【評価基準】
1. キャラクターの特徴（髪型、服装、アクセサリー等）が一致しているか
2. 物語のシーン・状況と画像が整合しているか
3. イラストのスタイルが指定と一致しているか
4. 画像に歪みや破綻がないか

【出力形式】
JSON形式で以下を出力してください：
{
  "passed": boolean,
  "score": number (0-100),
  "characterMatch": boolean,
  "storyMatch": boolean,
  "issues": string[],
  "suggestions": string[]
}
```

**ユーザープロンプト:**
```
【キャラクター設定】
{characterPrompt}

【物語】
{story}

【画像プロンプト】
{imagePrompt}

添付の2つの画像を比較してください：
1枚目: 参照キャラクター画像
2枚目: 生成された挿絵

評価結果をJSON形式で出力してください。
```

---

### 10.3 投稿フォーマットプロンプト（X用）

```
以下の物語をX（Twitter）投稿用にフォーマットしてください。

【制約】
- 280文字以内
- ハッシュタグを2-3個含める（お題に関連したもの）
- 絵文字を適度に使用して視覚的に魅力的に
- 読みやすい改行を入れる
- キャラクターの口調を維持

【物語】
{story}

【お題】
{topicText}

フォーマット済みテキストのみを出力してください。
```

---

## 付録

### A. Webhook通知ペイロード

**成功時:**
```json
{
  "type": "success",
  "timestamp": "2026-01-06T12:00:00.000Z",
  "workflowId": "wf_xxx",
  "topic": {
    "text": "プログラマーの日",
    "sourceUrl": "https://x.com/xxx/status/123"
  },
  "post": {
    "url": "https://x.com/xxx/status/456",
    "text": "投稿テキスト..."
  },
  "stats": {
    "retryCount": 0,
    "executionTimeMs": 45000
  }
}
```

**エラー時:**
```json
{
  "type": "error",
  "timestamp": "2026-01-06T12:00:00.000Z",
  "workflowId": "wf_xxx",
  "error": {
    "step": "quality_check",
    "message": "Max retries exceeded",
    "details": {}
  },
  "topic": {
    "text": "プログラマーの日",
    "sourceUrl": "https://x.com/xxx/status/123"
  },
  "stats": {
    "retryCount": 3,
    "executionTimeMs": 120000
  }
}
```

---

### B. 投稿サンプル

```
┌─────────────────────────────────────────────┐
│  🎨 花音ちゃんの冒険日記                      │
│                                             │
│  魔法のコードを書いていたら、                 │
│  バグが可愛いモンスターになって飛び出した！    │
│  「デバッグは冒険なのだ！」✨                 │
│                                             │
│  #プログラマーの日 #AIイラスト               │
│                                             │
│  [生成した挿絵画像]                          │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ 引用元 @today_anniversary            │    │
│  │ 今日は #プログラマーの日 です！🎉     │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

---

**以上**
