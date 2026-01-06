import { TwitterApiIoProvider } from "./providers/topic/index.js";
import { generateStory } from "./workflow/story-generator.js";
import { logger } from "./lib/logger.js";

async function main() {
  logger.info("物語生成テストを開始します");

  // Step 1: お題を取得
  const topicProvider = new TwitterApiIoProvider();
  const topic = await topicProvider.getTopic();
  logger.info({ topicText: topic.topicText }, "お題を取得しました");

  // Step 2: 物語を生成
  const story = await generateStory(topic);

  console.log("\n=== 生成結果 ===");
  console.log(`\n【お題】${topic.topicText}`);
  console.log(`\n【物語（フル版）】\n${story.fullText}`);
  console.log(`\n【物語（短縮版）】\n${story.shortText}`);
  console.log(`\n【画像プロンプト】\n${story.imagePrompt}`);
  console.log(`\n生成日時: ${story.generatedAt.toLocaleString("ja-JP")}`);
}

main().catch((error) => {
  logger.error({ error }, "テスト中にエラーが発生しました");
  console.error(error);
  process.exit(1);
});
