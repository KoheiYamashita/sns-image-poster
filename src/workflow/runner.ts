import {
  TwitterApiIoProvider,
  ManualTopicProvider,
  FileListTopicProvider,
  type TopicProvider,
} from "../providers/topic/index.js";
import {
  BundleSocialProvider,
  type SupportedPlatform,
} from "../providers/sns-post/index.js";
import { generateStory } from "./story-generator.js";
import { executeImageWorkflow } from "./image-workflow.js";
import { formatPost } from "./post-formatter.js";
import { logger } from "../lib/logger.js";
import { notifySuccess, notifyError } from "../lib/notification.js";
import { env } from "../config/env.js";

export async function runWorkflow(topic?: string): Promise<void> {
  logger.info("SNS Image Poster ワークフロー開始");

  // TopicProviderの選択
  // 優先順位: 1. 引数指定 → 2. ファイルリスト → 3. Twitter API
  const topicProvider: TopicProvider = topic
    ? new ManualTopicProvider(topic)
    : env.TOPIC_LIST_FILE
      ? new FileListTopicProvider(env.TOPIC_LIST_FILE)
      : new TwitterApiIoProvider();

  logger.info({ provider: topicProvider.getName() }, "お題プロバイダーを選択");

  try {
    // Step 1: お題を取得
    const topicData = await topicProvider.getTopic();
    logger.info({ topicText: topicData.topicText }, "お題を取得しました");

    // Step 2: 物語を生成
    const story = await generateStory(topicData);
    logger.info(
      { imagePrompt: story.imagePrompt, sessionId: story.sessionId },
      "物語を生成しました"
    );

    // Step 3: 画像生成ワークフロー（リトライ込み）
    const outputDir = "./output";
    const result = await executeImageWorkflow(story, outputDir);

    // Step 4: 投稿テキスト作成
    const post = await formatPost(story, topicData);
    logger.info({ characterCount: post.characterCount }, "投稿テキストを作成しました");

    console.log("\n=== 生成結果 ===");
    console.log(`\n【お題】${topicData.topicText}`);
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
    console.log(
      `\n【判定】${result.qualityResult.passed ? "✅ 合格" : "❌ 不合格"}`
    );
    console.log(`【スコア】${result.qualityResult.score}/100`);
    console.log(`\n【詳細】`);
    console.log(
      `  キャラクター一致: ${result.qualityResult.characterMatch ? "✅" : "❌"}`
    );
    console.log(
      `  物語との整合性:   ${result.qualityResult.storyMatch ? "✅" : "❌"}`
    );
    console.log(
      `  スタイル一致:     ${result.qualityResult.styleMatch ? "✅" : "❌"}`
    );
    console.log(
      `  画像品質:         ${result.qualityResult.qualityMatch ? "✅" : "❌"}`
    );

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

    // Step 5: SNS投稿（オプション）
    let posted = false;
    if (env.BUNDLE_SOCIAL_API_KEY && env.SNS_TARGETS.length > 0) {
      logger.info({ targets: env.SNS_TARGETS }, "SNS投稿を開始");

      const snsProvider = new BundleSocialProvider();

      const snsResults = await snsProvider.post(
        {
          text: post.text,
          imageBuffer: result.image.data,
          imageMimeType: result.image.mimeType,
          quoteUrl: topicData.tweetUrl,
        },
        env.SNS_TARGETS as SupportedPlatform[]
      );

      console.log("\n=== SNS投稿結果 ===");
      for (const r of snsResults) {
        if (r.success) {
          console.log(`\n✅ ${r.platform}: 投稿成功`);
          if (r.postUrl) {
            console.log(`   URL: ${r.postUrl}`);
          }
          logger.info({ platform: r.platform, postUrl: r.postUrl }, "投稿成功");
          posted = true;
        } else {
          console.log(`\n❌ ${r.platform}: 投稿失敗`);
          console.log(`   エラー: ${r.error}`);
          logger.error({ platform: r.platform, error: r.error }, "投稿失敗");
        }
      }
    } else {
      logger.info("SNS投稿はスキップされました（API KEYまたは投稿先が未設定）");
      console.log("\n※ SNS投稿はスキップされました（BUNDLE_SOCIAL_API_KEYまたはSNS_TARGETSが未設定）");
    }

    // FileListTopicProviderの場合、使用済みお題をファイルから削除
    if (topicProvider instanceof FileListTopicProvider) {
      await topicProvider.markUsed();
    }

    // 成功通知
    await notifySuccess(posted);
  } catch (error) {
    logger.error({ error }, "ワークフローでエラーが発生しました");
    await notifyError(error);
    throw error;
  }
}
