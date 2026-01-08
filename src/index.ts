import { spawn } from "node:child_process";
import { parseCliArgs, printHelp } from "./cli/index.js";
import { initConfig } from "./config/config.js";
import { runWorkflow } from "./workflow/runner.js";
import { initWorkflowLogger, logger } from "./lib/logger.js";

/**
 * 子プロセスの終了を待つ
 */
function waitForProcess(
  child: ReturnType<typeof spawn>
): Promise<{ code: number | null; preset: string }> {
  const preset = child.spawnargs.find((_, i, arr) => arr[i - 1] === "-p") ?? "";
  return new Promise((resolve) => {
    child.on("close", (code) => {
      resolve({ code, preset });
    });
  });
}

async function main() {
  const args = parseCliArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const { presets, topic } = args;

  // 複数プリセット指定時は子プロセスで並列実行
  if (presets.length > 1) {
    console.log(`複数プリセットを並列実行: ${presets.join(", ")}`);

    const children = presets.map((preset) => {
      const childArgs = ["dist/index.js", "-p", preset];
      if (topic) {
        childArgs.push("-t", topic);
      }
      const child = spawn("node", childArgs, {
        stdio: "inherit",
        cwd: process.cwd(),
      });
      return child;
    });

    const results = await Promise.all(children.map(waitForProcess));

    const failed = results.filter((r) => r.code !== 0);
    if (failed.length > 0) {
      console.error(`失敗したプリセット: ${failed.map((f) => f.preset).join(", ")}`);
      process.exit(1);
    }

    console.log("全てのプリセットが完了しました");
    return;
  }

  // 単一プリセットまたはプリセットなし: 従来通り
  const preset = presets[0];
  initConfig(preset);

  const logFile = initWorkflowLogger(preset);
  logger.info({ logFile, preset }, "SNS Image Poster 起動");
  await runWorkflow(topic);
}

main().catch((error) => {
  logger.error({ error }, "エラーが発生しました");
  console.error(error);
  process.exit(1);
});
