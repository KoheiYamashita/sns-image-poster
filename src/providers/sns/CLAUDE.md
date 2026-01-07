# providers/sns/

SNS直接連携プロバイダー（現在はTwitterのみ）。

## ファイル

- `twitter.ts` - Twitter投稿機能（agent-twitter-clientを使用）
- `index.ts` - エクスポート

## TwitterProvider

`agent-twitter-client`ライブラリを使用したTwitter投稿。

### 注意
- 認証情報はCookieファイルにキャッシュされる
- プロキシ設定可能（`TWITTER_PROXY_URL`）
- TOTP（2段階認証）対応

### 必要な環境変数

```
TWITTER_USERNAME=
TWITTER_EMAIL=
TWITTER_PASSWORD=
TWITTER_TOTP_SECRET=  # 任意
TWITTER_PROXY_URL=    # 任意
```

### 使用例

```typescript
import { TwitterProvider } from "./providers/sns/index.js";

const provider = new TwitterProvider();
await provider.postTweet("投稿テキスト", imageBuffer);
```
