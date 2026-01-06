import type { TopicProvider } from "./interface.js";
import type { TopicSource } from "../../types/index.js";
import { logger } from "../../lib/logger.js";

export class ManualTopicProvider implements TopicProvider {
  private readonly topicText: string;

  constructor(topicText: string) {
    this.topicText = topicText;
  }

  getName(): string {
    return "ManualTopicProvider";
  }

  async getTopic(): Promise<TopicSource> {
    logger.info({ topicText: this.topicText }, "手動指定のお題を使用");

    return {
      tweetId: "manual",
      tweetUrl: "",
      accountHandle: "@manual",
      topicText: this.topicText,
      originalText: this.topicText,
      fetchedAt: new Date(),
    };
  }
}
