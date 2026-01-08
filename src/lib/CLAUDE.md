# lib/

共通ユーティリティライブラリ。

## ファイル

- `logger.ts` - ロガー（pinoを使用）
- `notification.ts` - Webhook通知機能

## logger

pinoベースのロガー。構造化ログをコンソールとファイルに出力。

```typescript
import { logger, initWorkflowLogger } from "./lib/logger.js";

// ワークフロー開始時にログファイルを初期化
const logFile = initWorkflowLogger();
// → logs/workflow-{タイムスタンプ}.log が作成される

logger.info({ key: "value" }, "メッセージ");
```

### 関数
- `initWorkflowLogger()` - ワークフロー用ロガーを初期化（コンソール+ファイル出力）
- `getLogFilePath()` - 現在のログファイルパスを取得

## notification

### 関数
- `notifySuccess(posted: boolean)` - 成功時のWebhook通知
- `notifyError(error: unknown)` - エラー時のWebhook通知

### 機能
- Webhook URLが設定されている場合、Discord形式のWebhookを送信
- ログファイルパスが設定されている場合、JSONログを保存
