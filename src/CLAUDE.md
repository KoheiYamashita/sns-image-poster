# src/

SNS Image Posterのメインソースコードディレクトリ。

## 構成

- `index.ts` - エントリーポイント（CLIから実行される）
- `daemon.ts` - 定期実行（デーモン）モード
- `cli/` - コマンドライン引数の解析
- `config/` - 環境変数の設定とバリデーション
- `errors/` - カスタムエラークラス
- `lib/` - ユーティリティ（ログ、通知）
- `providers/` - 外部サービスプロバイダー
- `types/` - TypeScript型定義
- `workflow/` - ワークフロー処理

## ワークフロー

1. お題取得（Twitter API / ファイル / 手動指定）
2. 物語生成（Gemini API）
3. 画像生成（Gemini Imagen）
4. 品質チェック
5. 投稿テキスト作成
6. SNS投稿（Bundle Social経由）

## テストファイル

- `test-*.ts` - 各機能のテスト用スクリプト
- `twitter-login.ts` - Twitter認証テスト
