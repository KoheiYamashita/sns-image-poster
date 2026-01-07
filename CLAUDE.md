# SNS Image Poster

お題に基づいてキャラクターイラストと物語を自動生成し、SNSに投稿するシステム。

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
│   ├── sns/               # Twitter直接連携
│   ├── sns-post/          # Bundle Social
│   └── topic/             # お題取得
├── types/            # 型定義
└── workflow/         # ワークフロー処理
scripts/              # デーモン管理スクリプト
assets/               # キャラクター参照画像
```

## コマンド

```bash
# 開発
npm run dev              # 開発モード（watch）
npm run build            # TypeScriptビルド
npm run lint             # ESLint実行
npm run lint:fix         # ESLint自動修正

# 実行
npm run start            # 単発実行（お題自動取得）
npm run start -- -t "お題"  # お題を指定して実行

# デーモン
npm run daemon:start     # 定期実行開始
npm run daemon:stop      # 定期実行停止

# テスト
npm run test             # Vitest実行
npm run test:topic       # お題取得テスト
npm run test:story       # 物語生成テスト
npm run test:workflow    # ワークフローテスト
```

## ワークフロー

1. **お題取得** - Twitter / ファイル / 手動指定
2. **物語生成** - Geminiでキャラクター設定を反映した短編を生成
3. **画像生成** - Gemini Imagenでイラスト生成
4. **品質チェック** - キャラクター一致、物語整合性を評価
5. **投稿テキスト作成** - 文字数制限、ハッシュタグ付与
6. **SNS投稿** - Bundle Social経由で複数プラットフォームへ

## 環境変数

### 必須
- `TWITTER_API_IO_KEY` - TwitterAPI.io APIキー
- `GEMINI_API_KEY` - Gemini APIキー
- `CHARACTER_PROMPT_PATH` - キャラクタープロンプトファイル

### 投稿設定
- `BUNDLE_SOCIAL_API_KEY` - Bundle Social APIキー
- `BUNDLE_SOCIAL_TEAM_ID` - チームID
- `SNS_TARGETS` - 投稿先（例：`TWITTER,BLUESKY`）

### 定期実行
- `SCHEDULE_TIMES` - 実行時刻（例：`08:00,12:00,18:00`）
- `TOPIC_LIST_FILE` - お題リストファイルパス

詳細は`src/config/env.ts`を参照。

## コーディング規約

- ESMモジュール（`import/export`）
- インポートパスに`.js`拡張子を付ける
- エラーは`src/errors/`のカスタムエラーを使用
- ログは`logger`を使用（`console.log`は結果表示のみ）
- 環境変数は`env`オブジェクト経由でアクセス
