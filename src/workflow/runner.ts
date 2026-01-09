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
import { selectCharacters } from "./character-selector.js";
import { formatPost } from "./post-formatter.js";
import { logger } from "../lib/logger.js";
import { notifySuccess, notifyError } from "../lib/notification.js";
import { env } from "../config/env.js";
import { loadCharacters } from "../config/character-loader.js";
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
    // Step 0: キャラクター設定を読み込み
    let characters = loadCharacters();
    logger.info({ characterCount: characters.size, characterIds: Array.from(characters.keys()) }, "キャラクター設定を読み込みました");

    // Step 1: お題を取得
    const topicData = await topicProvider.getTopic();
    logger.info({ topicText: topicData.topicText }, "お題を取得しました");

    // Step 1.5: キャラクター選択（autoモードの場合）
    if (env.CHARACTER_SELECTION_MODE === "auto") {
      logger.info("キャラクター自動選択モードで実行");
      const selectionResult = await selectCharacters(topicData, characters);
      characters = selectionResult.selectedCharacters;
    }

    const outputDir = "./output";
    let story: GeneratedStory;
    let imageBuffer: Buffer;
    let imageMimeType: string;

    if (env.CONTENT_MODE === "manga") {
      // 4コマ漫画モード
      logger.info("4コマ漫画モードで実行");

      // Step 2: 4コマ漫画プロットを生成
      const mangaStory = await generateMangaStory(topicData, characters);
      logger.info(
        { title: mangaStory.title, sessionId: mangaStory.sessionId },
        "4コマ漫画プロットを生成しました"
      );

      // Step 3: 4コマ漫画画像生成ワークフロー（リトライ込み）
      const mangaResult = await executeMangaWorkflow(mangaStory, outputDir, characters);

      // APIキーがない場合はnullが返される（プロンプトは既にログ出力済み）
      if (mangaResult === null) {
        return;
      }

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
      logger.info("=== 4コマ漫画 生成結果 ===");
      logger.info({ お題: topicData.topicText }, "【お題】");
      logger.info({ タイトル: mangaStory.title }, "【タイトル】");
      logger.info({ あらすじ: mangaStory.synopsis }, "【あらすじ】");
      logger.info("【4コマ構成】");
      for (const panel of mangaStory.panels) {
        const typeLabel = { ki: "起", sho: "承", ten: "転", ketsu: "結" }[panel.panelType];
        const dialoguesText = panel.dialogues.length > 0
          ? panel.dialogues.map(d => `${d.characterName}「${d.text}」`).join(" / ")
          : "(セリフなし)";
        logger.info({
          コマ: `${panel.panelNumber}コマ目（${typeLabel}）`,
          内容: panel.description,
          セリフ: dialoguesText,
        }, "コマ情報");
      }
      logger.info({ 挿絵: mangaStory.illustration.description }, "【挿絵】");
      logger.info({ 試行回数: mangaResult.attempts }, "【試行回数】");
      logger.info({ ファイル: mangaResult.imagePath }, "【生成画像】");

      logger.info("=== 品質チェック結果 ===");
      const qr = mangaResult.qualityResult;
      logger.info({ 判定: qr.passed ? "✅ 合格" : "❌ 不合格", スコア: `${qr.score}/100` }, "【判定】");
      logger.info({
        キャラクター一貫性: qr.characterConsistency ? "✅" : "❌",
        セリフ可読性: qr.dialogueReadability ? "✅" : "❌",
        レイアウト正確性: qr.layoutAccuracy ? "✅" : "❌",
        物語の流れ: qr.narrativeFlow ? "✅" : "❌",
        挿絵整合性: qr.illustrationMatch ? "✅" : "❌",
      }, "【詳細】");

      if (qr.issues.length > 0) {
        logger.info({ 問題点: qr.issues }, "【問題点】");
      }

      if (qr.suggestions.length > 0) {
        logger.info({ 改善提案: qr.suggestions }, "【改善提案】");
      }
    } else {
      // イラストモード（既存）
      logger.info("イラストモードで実行");

      // Step 2: 物語を生成
      story = await generateStory(topicData, characters);
      logger.info(
        { imagePrompt: story.imagePrompt, sessionId: story.sessionId },
        "物語を生成しました"
      );

      // Step 3: 画像生成ワークフロー（リトライ込み）
      const result = await executeImageWorkflow(story, outputDir, characters);

      // APIキーがない場合はnullが返される（プロンプトは既にログ出力済み）
      if (result === null) {
        return;
      }

      imageBuffer = result.image.data;
      imageMimeType = result.image.mimeType;

      logger.info("=== 生成結果 ===");
      logger.info({ お題: topicData.topicText }, "【お題】");
      logger.info({ 物語: story.shortText }, "【物語（短縮版）】");
      logger.info({ 試行回数: result.attempts }, "【試行回数】");

      logger.info({ プロンプト履歴: result.promptHistory }, "【プロンプト履歴】");

      logger.info({
        ファイル: result.outputPath,
        形式: result.image.mimeType,
        サイズ: `${(result.image.data.length / 1024).toFixed(1)} KB`,
      }, "【生成画像】");

      logger.info("=== 品質チェック結果 ===");
      logger.info({
        判定: result.qualityResult.passed ? "✅ 合格" : "❌ 不合格",
        スコア: `${result.qualityResult.score}/100`,
      }, "【判定】");
      logger.info({
        キャラクター一致: result.qualityResult.characterMatch ? "✅" : "❌",
        物語との整合性: result.qualityResult.storyMatch ? "✅" : "❌",
        スタイル一致: result.qualityResult.styleMatch ? "✅" : "❌",
        画像品質: result.qualityResult.qualityMatch ? "✅" : "❌",
      }, "【詳細】");

      if (result.qualityResult.issues.length > 0) {
        logger.info({ 問題点: result.qualityResult.issues }, "【問題点】");
      }

      if (result.qualityResult.suggestions.length > 0) {
        logger.info({ 改善提案: result.qualityResult.suggestions }, "【改善提案】");
      }
    }

    // Step 4: 投稿テキスト作成
    const post = await formatPost(story, topicData);
    logger.info({ characterCount: post.characterCount }, "投稿テキストを作成しました");

    logger.info("=== 投稿テキスト ===");
    logger.info({ テキスト: post.text }, "【投稿内容】");
    logger.info({
      文字数: `${post.characterCount}文字`,
      ハッシュタグ: post.hashtags.join(" "),
    }, "【投稿情報】");
    logger.info({ 生成日時: new Date().toLocaleString("ja-JP") }, "【生成日時】");

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

      logger.info("=== SNS投稿結果 ===");
      for (const r of snsResults) {
        if (r.success) {
          logger.info({ platform: r.platform, postUrl: r.postUrl }, "✅ 投稿成功");
          posted = true;
        } else {
          logger.error({ platform: r.platform, error: r.error }, "❌ 投稿失敗");
        }
      }
    } else {
      logger.info("SNS投稿はスキップされました（API KEYまたは投稿先が未設定）");
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
