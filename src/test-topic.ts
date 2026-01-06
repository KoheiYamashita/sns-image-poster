import { TwitterApiIoProvider } from "./providers/topic/index.js";
import { logger } from "./lib/logger.js";

async function main() {
  logger.info("お題取得テストを開始します");

  const provider = new TwitterApiIoProvider();

  try {
    const topic = await provider.getTopic();
    logger.info({ topic }, "お題を取得しました");
    console.log("\n=== 取得結果 ===");
    console.log(`お題: ${topic.topicText}`);
    console.log(`元ツイート: ${topic.originalText}`);
    console.log(`URL: ${topic.tweetUrl}`);
    console.log(`アカウント: ${topic.accountHandle}`);
    console.log(`取得日時: ${topic.fetchedAt.toLocaleString("ja-JP")}`);
  } catch (error) {
    logger.error({ error }, "お題取得に失敗しました");
    if (error instanceof Error) {
      console.error(`エラー: ${error.message}`);
    }
    process.exit(1);
  }
}

main();
