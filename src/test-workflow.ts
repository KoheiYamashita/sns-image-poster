import { TwitterApiIoProvider } from "./providers/topic/index.js";
import { generateStory } from "./workflow/story-generator.js";
import { executeImageWorkflow } from "./workflow/image-workflow.js";
import { formatPost } from "./workflow/post-formatter.js";
import { loadCharacters } from "./config/character-loader.js";
import { logger } from "./lib/logger.js";

async function main() {
  logger.info("画像生成テストを開始します");

  // Step 0: キャラクター読み込み
  const characters = loadCharacters();
  logger.info({ characterCount: characters.size }, "キャラクター読み込み完了");

  // Step 1: お題を取得
  const topicProvider = new TwitterApiIoProvider();
  const topic = await topicProvider.getTopic();
  logger.info({ topicText: topic.topicText }, "お題を取得しました");

  // Step 2: 物語を生成
  const story = await generateStory(topic, characters);
  logger.info({ imagePrompt: story.imagePrompt, sessionId: story.sessionId }, "物語を生成しました");

  // Step 3: 画像生成ワークフロー（リトライ込み）
  const outputDir = "./output";
  const result = await executeImageWorkflow(story, outputDir, characters);

  // Step 4: 投稿テキスト作成
  const post = await formatPost(story, topic);
  logger.info({ characterCount: post.characterCount }, "投稿テキストを作成しました");

  console.log("\n=== 生成結果 ===");
  console.log(`\n【お題】${topic.topicText}`);
  console.log(`\n【物語（短縮版）】\n${story.shortText}`);
  console.log(`\n【試行回数】${result.attempts}回`);

  console.log(`\n【プロンプト履歴】`);
  for (const [i, prompt] of result.promptHistory.entries()) {
    console.log(`  ${i + 1}回目: ${prompt.substring(0, 80)}...`);
  }

  console.log(`\n【生成画像】`);
  console.log(`  ファイル: ${result.outputPath}`);
  console.log(`  形式: ${result.image.mimeType}`);
  console.log(`  サイズ: ${(result.image.data.length / 1024).toFixed(1)} KB`);

  console.log("\n=== 品質チェック結果 ===");
  console.log(`\n【判定】${result.qualityResult.passed ? "✅ 合格" : "❌ 不合格"}`);
  console.log(`【スコア】${result.qualityResult.score}/100`);
  console.log(`\n【詳細】`);
  console.log(`  キャラクター一致: ${result.qualityResult.characterMatch ? "✅" : "❌"}`);
  console.log(`  物語との整合性:   ${result.qualityResult.storyMatch ? "✅" : "❌"}`);
  console.log(`  スタイル一致:     ${result.qualityResult.styleMatch ? "✅" : "❌"}`);
  console.log(`  画像品質:         ${result.qualityResult.qualityMatch ? "✅" : "❌"}`);

  if (result.qualityResult.issues.length > 0) {
    console.log(`\n【問題点】`);
    for (const issue of result.qualityResult.issues) {
      console.log(`  - ${issue}`);
    }
  }

  if (result.qualityResult.suggestions.length > 0) {
    console.log(`\n【改善提案】`);
    for (const suggestion of result.qualityResult.suggestions) {
      console.log(`  - ${suggestion}`);
    }
  }

  console.log("\n=== 投稿テキスト ===");
  console.log(`\n${post.text}`);
  console.log(`\n【文字数】${post.characterCount}文字`);
  console.log(`【ハッシュタグ】${post.hashtags.join(" ")}`);

  console.log(`\n生成日時: ${result.image.generatedAt.toLocaleString("ja-JP")}`);
}

main().catch((error) => {
  logger.error({ error }, "テスト中にエラーが発生しました");
  console.error(error);
  process.exit(1);
});
