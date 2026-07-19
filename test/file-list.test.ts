import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileListTopicProvider } from "../src/providers/topic/file-list.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("FileListTopicProvider", () => {
  it("removes only the selected occurrence when topics are duplicated", async () => {
    const directory = mkdtempSync(join(tmpdir(), "sns-image-poster-"));
    temporaryDirectories.push(directory);
    const filePath = join(directory, "topics.txt");
    writeFileSync(filePath, "猫の日\n猫の日\n犬の日\n", "utf-8");
    vi.spyOn(Math, "random").mockReturnValue(0);

    const provider = new FileListTopicProvider(filePath);
    const topic = await provider.getTopic();
    await provider.markUsed();

    expect(topic.topicText).toBe("猫の日");
    expect(readFileSync(filePath, "utf-8")).toBe("猫の日\n犬の日\n");
  });

  it("preserves externally replaced topics when the selection is missing", async () => {
    const directory = mkdtempSync(join(tmpdir(), "sns-image-poster-"));
    temporaryDirectories.push(directory);
    const filePath = join(directory, "topics.txt");
    writeFileSync(filePath, "猫の日\n", "utf-8");

    const provider = new FileListTopicProvider(filePath);
    await provider.getTopic();
    writeFileSync(filePath, "犬の日\n", "utf-8");
    await provider.markUsed();

    expect(readFileSync(filePath, "utf-8")).toBe("犬の日\n");
  });
});
