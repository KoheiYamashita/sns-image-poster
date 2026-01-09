# SNS Image Poster

お題に基づいてキャラクターイラスト／4コマ漫画と物語を自動生成し、SNSに投稿するシステム。

## 技術スタック

- **Runtime**: Node.js 22+
- **Language**: TypeScript (ESM)
- **AI**: Gemini API (物語・画像生成、品質チェック)
- **SNS投稿**: Bundle Social API
- **お題取得**: TwitterAPI.io
- **ログ**: Pino
- **バリデーション**: Zod

## ディレクトリ構成

```
src/
├── index.ts          # エントリーポイント
├── daemon.ts         # 定期実行モード
├── cli/              # コマンドライン引数
├── config/           # 環境変数設定
├── errors/           # カスタムエラー
├── lib/              # ユーティリティ
├── providers/        # 外部サービス連携
│   ├── image-generation/  # 画像生成（Gemini）
│   ├── sns-post/          # Bundle Social
│   └── topic/             # お題取得
├── types/            # 型定義
└── workflow/         # ワークフロー処理
    └── manga/        # 4コマ漫画モード
scripts/              # デーモン管理スクリプト
assets/
├── characters/       # キャラクター設定
│   └── {id}/         # キャラクターID（ディレクトリ名）
│       ├── prompt.txt      # キャラクター設定プロンプト
│       ├── appearance.txt  # 外見プロンプト（英語）
│       └── images/         # 参照画像
└── presets/          # プリセット設定
    └── {name}.json   # プリセットファイル
```

## コマンド

```bash
# 開発
npm run dev              # 開発モード（watch）
npm run build            # TypeScriptビルド
npm run lint             # ESLint実行
npm run lint:fix         # ESLint自動修正

# 実行（自動ビルド付き）
npm run start                          # 単発実行（お題自動取得）
npm run start -- -t "お題"              # お題を指定して実行
npm run start -- -p example            # プリセットを使用
npm run start -- -p example -t "お題"  # プリセット + お題指定
npm run start -- -p preset1 -p preset2 # 複数プリセットを並列実行

# デーモン（自動ビルド付き）
npm run daemon:start                   # 定期実行開始
npm run daemon:start -- -p example     # プリセットを使用して定期実行
npm run daemon:start -- -p p1 -p p2    # 複数プリセットで定期実行
npm run daemon:stop                    # 定期実行停止

# テスト
npm run test             # Vitest実行
npm run test:topic       # お題取得テスト
npm run test:story       # 物語生成テスト
npm run test:workflow    # ワークフローテスト

# テスト用（APIキー無効化）
npm run prompt-only -- -t "お題"  # プロンプト出力のみ（画像生成なし）
npm run no-post -- -t "お題"      # 画像生成まで（SNS投稿なし）
```

## ワークフロー

### イラストモード（デフォルト）
1. **お題取得** - Twitter / ファイル / 手動指定
2. **物語生成** - キャラクター設定を反映した短編を生成
3. **画像生成** - Gemini Imagenでイラスト生成
4. **品質チェック** - キャラクター一致、物語整合性を評価
5. **投稿テキスト作成** - 文字数制限、ハッシュタグ付与
6. **SNS投稿** - Bundle Social経由で複数プラットフォームへ

### 4コマ漫画モード（`contentMode: "manga"`）
1. **お題取得** - Twitter / ファイル / 手動指定
2. **プロット生成** - 起承転結の4コマ構成を生成
3. **画像生成** - 4コマ+挿絵レイアウトの画像を生成
4. **品質チェック** - キャラクター一貫性、セリフ可読性、レイアウト等を評価
5. **投稿テキスト作成** - 文字数制限、ハッシュタグ付与
6. **SNS投稿** - Bundle Social経由で複数プラットフォームへ

## 環境変数

APIキーと認証情報のみ`.env`に設定。その他の設定はプリセットで管理。

### APIキー
- `GEMINI_API_KEY` - Gemini APIキー（任意：未設定時はプロンプト出力のみ）
- `TWITTER_API_IO_KEY` - TwitterAPI.io APIキー（お題取得時）
- `BUNDLE_SOCIAL_API_KEY` - Bundle Social APIキー（SNS投稿時）
- `BUNDLE_SOCIAL_TEAM_ID` - Bundle Social チームID

### 通知設定（任意）
- `WEBHOOK_URL` - 成功/エラー時のWebhook送信先
- `LOG_FILE_PATH` - ログ保存先（JSONL形式）

## プリセット

設定をJSON形式のプリセットファイルとして保存し、実行時に`-p`オプションで切り替え可能。

### プリセットの動作

| モード | APIキー・認証情報 | 動作設定 |
|--------|------------------|----------|
| `-p` なし | .env | .env |
| `-p` あり | .env | プリセット + デフォルト値 |

- プリセット使用時は`.env`の動作設定は無視される
- APIキー（`GEMINI_API_KEY`等）は常に`.env`から読み込み

### 複数プリセットの並列実行

`-p`オプションを複数回指定すると、各プリセットが独立した子プロセスとして並列実行される。

```bash
# 2つのプリセットを並列実行
npm run start -- -p tibi-kanon-illustration -p tibi-kanon-manga -t "猫の日"
```

- 各プリセットは独立したNode.jsプロセスで実行
- ログファイルはプリセットごとに分離（`workflow-{プリセット名}-{タイムスタンプ}.log`）
- デーモンモードでも複数プリセットを指定可能

### プリセットファイルの作成

`assets/presets/` にJSONファイルを作成:

```json
{
  "contentMode": "illustration",
  "charactersDir": "./assets/characters",
  "characterIds": ["kanon"],
  "mainCharacterId": "kanon",
  "illustrationStyle": "アニメ風、明るい色調",
  "snsTargets": ["TWITTER", "BLUESKY"]
}
```

### 指定可能な項目

- `contentMode` - `illustration` / `manga`
- `charactersDir` - キャラクターディレクトリ
- `characterIds` - 使用キャラクターID（配列）
- `mainCharacterId` - 主軸キャラクターID
- `characterSelectionMode` - `all` / `auto`
- `illustrationStyle` - イラストスタイル
- `aspectRatio` - 画像比率
- `maxImageRetryCount` - 画像生成リトライ回数
- `postStyle` - 投稿スタイル
- `postBaseHashtags` - 基本ハッシュタグ（配列）
- `postTargetLength` - 目標文字数
- `postMaxLength` - 最大文字数
- `snsTargets` - 投稿先SNS（配列）
- `quoteUrlTargets` - 引用URL付与SNS（配列）
- `topicSourceAccount` - お題取得元アカウント
- `topicSearchKeyword` - 検索キーワード
- `topicPattern` - お題抽出パターン
- `topicListFile` - お題リストファイル
- `scheduleTimes` - 定期実行時刻（配列）
- `timezone` - タイムゾーン

## 設計方針

**品質優先**: 処理時間よりも出力品質を最優先する。API呼び出し回数や処理時間が増えても、品質向上に繋がる施策は積極的に採用する。

## ログ出力

ワークフロー実行ごとにログファイルが生成される。コンソールと同じ内容がファイルにも保存される。

- プリセット指定時: `logs/workflow-{プリセット名}-{タイムスタンプ}.log`
- プリセット未指定時: `logs/workflow-{タイムスタンプ}.log`

## コーディング規約

- ESMモジュール（`import/export`）
- インポートパスに`.js`拡張子を付ける
- エラーは`src/errors/`のカスタムエラーを使用
- ログはすべて`logger`を使用（`console.log`禁止）
- 環境変数は`env`オブジェクト経由でアクセス
