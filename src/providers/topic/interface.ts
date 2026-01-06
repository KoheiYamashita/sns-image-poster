import type { TopicSource } from "../../types/index.js";

export interface TopicProvider {
  getName(): string;
  getTopic(): Promise<TopicSource>;
  initialize?(): Promise<void>;
  cleanup?(): Promise<void>;
}
