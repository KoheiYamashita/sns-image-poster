import { readFileSync, writeFileSync } from "node:fs";
import type { TopicProvider } from "./interface.js";
import type { TopicSource } from "../../types/index.js";
import { TopicListEmptyError } from "../../errors/base.js";
import { logger } from "../../lib/logger.js";

export class FileListTopicProvider implements TopicProvider {
  private filePath: string;
  private selectedTopic?: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  getName(): string {
    return "FileListTopicProvider";
  }

  private readTopics(): string[] {
    const content = readFileSync(this.filePath, "utf-8");
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  private writeTopics(topics: string[]): void {
    writeFileSync(this.filePath, topics.join("\n") + "\n", "utf-8");
  }

  async getTopic(): Promise<TopicSource> {
    logger.info({ filePath: this.filePath }, "お題リストファイルを読み込み中");

    const topics = this.readTopics();

    if (topics.length === 0) {
      throw new TopicListEmptyError("お題リストが空です", {
        filePath: this.filePath,
      });
    }

    // ランダムに1つ選択
    const randomIndex = Math.floor(Math.random() * topics.length);
    // topics.length > 0 は上でチェック済みなので必ず存在する
    const selected = topics[randomIndex] as string;
    this.selectedTopic = selected;

    logger.info(
      { topicText: selected, remaining: topics.length - 1 },
      "お題をランダム選択しました"
    );

    return {
      tweetId: "file-list",
      tweetUrl: "",
      accountHandle: "@file-list",
      topicText: selected,
      originalText: selected,
      fetchedAt: new Date(),
    };
  }

  async markUsed(): Promise<void> {
    if (!this.selectedTopic) {
      logger.warn("markUsed() が呼ばれましたが、選択済みのお題がありません");
      return;
    }

    const topics = this.readTopics();
    const updatedTopics = topics.filter((t) => t !== this.selectedTopic);

    this.writeTopics(updatedTopics);

    logger.info(
      { topicText: this.selectedTopic, remaining: updatedTopics.length },
      "使用済みお題をファイルから削除しました"
    );

    this.selectedTopic = undefined;
  }
}
