import { parseCliArgs, printHelp } from "./cli/index.js";
import { runWorkflow } from "./workflow/runner.js";
import { logger } from "./lib/logger.js";

async function main() {
  const args = parseCliArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  logger.info("SNS Image Poster 起動");
  await runWorkflow(args.topic);
}

main().catch((error) => {
  logger.error({ error }, "エラーが発生しました");
  console.error(error);
  process.exit(1);
});
