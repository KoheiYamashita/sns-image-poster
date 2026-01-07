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
import { generateMangaStory, executeMangaWorkflow } from "./manga/index.js";
import { formatPost } from "./post-formatter.js";
import { logger } from "../lib/logger.js";
import { notifySuccess, notifyError } from "../lib/notification.js";
import { env } from "../config/env.js";
import type { GeneratedStory } from "../types/index.js";

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

    const outputDir = "./output";
    let story: GeneratedStory;
    let imageBuffer: Buffer;
    let imageMimeType: string;

    if (env.CONTENT_MODE === "manga") {
      // 4コマ漫画モード
      logger.info("4コマ漫画モードで実行");

      // Step 2: 4コマ漫画プロットを生成
      const mangaStory = await generateMangaStory(topicData);
      logger.info(
        { title: mangaStory.title, sessionId: mangaStory.sessionId },
        "4コマ漫画プロットを生成しました"
      );

      // Step 3: 4コマ漫画画像生成ワークフロー（リトライ込み）
      const mangaResult = await executeMangaWorkflow(mangaStory, outputDir);

      // formatPost用にGeneratedStory形式に変換
      story = {
        fullText: mangaStory.synopsis,
        shortText: mangaStory.shortText,
        imagePrompt: mangaStory.imagePrompt,
        sessionId: mangaStory.sessionId,
        generatedAt: mangaStory.generatedAt,
      };

      // 結果表示用
      const fs = await import("node:fs/promises");
      imageBuffer = await fs.readFile(mangaResult.imagePath);
      imageMimeType = mangaResult.imagePath.endsWith(".png") ? "image/png" : "image/jpeg";

      // 4コマ漫画モードの結果表示
      console.log("\n=== 4コマ漫画 生成結果 ===");
      console.log(`\n【お題】${topicData.topicText}`);
      console.log(`\n【タイトル】${mangaStory.title}`);
      console.log(`\n【あらすじ】${mangaStory.synopsis}`);
      console.log(`\n【4コマ構成】`);
      for (const panel of mangaStory.panels) {
        const typeLabel = { ki: "起", sho: "承", ten: "転", ketsu: "結" }[panel.panelType];
        console.log(`  ${panel.panelNumber}コマ目（${typeLabel}）: ${panel.description}`);
        console.log(`    セリフ: 「${panel.dialogue}」`);
      }
      console.log(`\n【挿絵】${mangaStory.illustration.description}`);
      console.log(`\n【試行回数】${mangaResult.attempts}回`);

      console.log(`\n【生成画像】`);
      console.log(`  ファイル: ${mangaResult.imagePath}`);

      console.log("\n=== 品質チェック結果 ===");
      const qr = mangaResult.qualityResult;
      console.log(`\n【判定】${qr.passed ? "✅ 合格" : "❌ 不合格"}`);
      console.log(`【スコア】${qr.score}/100`);
      console.log(`\n【詳細】`);
      console.log(`  キャラクター一貫性: ${qr.characterConsistency ? "✅" : "❌"}`);
      console.log(`  セリフ可読性:       ${qr.dialogueReadability ? "✅" : "❌"}`);
      console.log(`  レイアウト正確性:   ${qr.layoutAccuracy ? "✅" : "❌"}`);
      console.log(`  物語の流れ:         ${qr.narrativeFlow ? "✅" : "❌"}`);
      console.log(`  挿絵整合性:         ${qr.illustrationMatch ? "✅" : "❌"}`);

      if (qr.issues.length > 0) {
        console.log(`\n【問題点】`);
        for (const issue of qr.issues) {
          console.log(`  - ${issue}`);
        }
      }

      if (qr.suggestions.length > 0) {
        console.log(`\n【改善提案】`);
        for (const suggestion of qr.suggestions) {
          console.log(`  - ${suggestion}`);
        }
      }
    } else {
      // イラストモード（既存）
      logger.info("イラストモードで実行");

      // Step 2: 物語を生成
      story = await generateStory(topicData);
      logger.info(
        { imagePrompt: story.imagePrompt, sessionId: story.sessionId },
        "物語を生成しました"
      );

      // Step 3: 画像生成ワークフロー（リトライ込み）
      const result = await executeImageWorkflow(story, outputDir);

      imageBuffer = result.image.data;
      imageMimeType = result.image.mimeType;

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
    }

    // Step 4: 投稿テキスト作成
    const post = await formatPost(story, topicData);
    logger.info({ characterCount: post.characterCount }, "投稿テキストを作成しました");

    console.log("\n=== 投稿テキスト ===");
    console.log(`\n${post.text}`);
    console.log(`\n【文字数】${post.characterCount}文字`);
    console.log(`【ハッシュタグ】${post.hashtags.join(" ")}`);

    console.log(`\n生成日時: ${new Date().toLocaleString("ja-JP")}`);

    // Step 5: SNS投稿（オプション）
    let posted = false;
    if (env.BUNDLE_SOCIAL_API_KEY && env.SNS_TARGETS.length > 0) {
      logger.info({ targets: env.SNS_TARGETS }, "SNS投稿を開始");

      const snsProvider = new BundleSocialProvider();

      const snsResults = await snsProvider.post(
        {
          text: post.text,
          imageBuffer,
          imageMimeType,
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
