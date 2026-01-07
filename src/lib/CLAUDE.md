# lib/

共通ユーティリティライブラリ。

## ファイル

- `logger.ts` - ロガー（pinoを使用）
- `notification.ts` - Webhook通知機能

## logger

pinoベースのロガー。構造化ログを出力。

```typescript
import { logger } from "./lib/logger.js";
logger.info({ key: "value" }, "メッセージ");
```

## notification

### 関数
- `notifySuccess(posted: boolean)` - 成功時のWebhook通知
- `notifyError(error: unknown)` - エラー時のWebhook通知

### 機能
- Webhook URLが設定されている場合、Discord形式のWebhookを送信
- ログファイルパスが設定されている場合、JSONログを保存
