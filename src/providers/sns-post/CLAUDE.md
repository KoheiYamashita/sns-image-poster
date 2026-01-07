# providers/sns-post/

マルチプラットフォームSNS投稿プロバイダー。

## ファイル

- `interface.ts` - `SNSPostProvider`インターフェース、型定義
- `bundle-social.ts` - Bundle Social API実装
- `index.ts` - エクスポート

## サポートプラットフォーム

- `TWITTER` - Twitter/X
- `INSTAGRAM` - Instagram
- `THREADS` - Threads
- `BLUESKY` - Bluesky
- `FACEBOOK` - Facebook
- `YOUTUBE` - YouTube
- `TIKTOK` - TikTok
- `LINKEDIN` - LinkedIn
- `PINTEREST` - Pinterest
- `TELEGRAM` - Telegram

## BundleSocialProvider

Bundle Social APIを使用した投稿。

### 機能
- 複数プラットフォームへの同時投稿
- 画像アップロード対応
- 引用URL設定（プラットフォームごとに有効/無効可能）

### 必要な環境変数

```
BUNDLE_SOCIAL_API_KEY=
BUNDLE_SOCIAL_TEAM_ID=
SNS_TARGETS=TWITTER,BLUESKY  # 投稿先
QUOTE_URL_TARGETS=TWITTER    # 引用URLを付ける対象
```
