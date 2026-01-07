# providers/topic/

お題取得プロバイダー。

## ファイル

- `interface.ts` - `TopicProvider`インターフェース
- `twitter-api-io.ts` - TwitterAPI.io経由でのお題取得
- `file-list.ts` - ファイルからのお題読み込み
- `manual.ts` - 手動指定
- `index.ts` - エクスポート

## TopicProvider インターフェース

```typescript
interface TopicProvider {
  getName(): string;
  getTopic(): Promise<TopicResult>;
}
```

## プロバイダー

### TwitterApiIoProvider
- TwitterAPI.ioを使用して特定アカウントの投稿からお題を抽出
- 正規表現パターンでお題をマッチング
- 環境変数：`TWITTER_API_IO_KEY`, `X_TOPIC_SOURCE_ACCOUNT`, `TOPIC_PATTERN`

### FileListTopicProvider
- テキストファイルからお題を読み込み（1行1お題）
- 使用後は`markUsed()`でファイルから削除
- 環境変数：`TOPIC_LIST_FILE`

### ManualTopicProvider
- コマンドライン引数で指定されたお題を使用
- `--topic "お題テキスト"`で指定

## 優先順位

1. 引数指定（`--topic`）
2. ファイルリスト（`TOPIC_LIST_FILE`）
3. Twitter API
