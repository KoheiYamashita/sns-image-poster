import cron from "node-cron";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { runWorkflow } from "./workflow/runner.js";
import { logger } from "./lib/logger.js";
import { env } from "./config/env.js";

const PID_FILE = ".daemon.pid";

function timeToCron(time: string): string {
  const [hour, minute] = time.split(":");
  return `${minute} ${hour} * * *`;
}

function savePidFile(): void {
  writeFileSync(PID_FILE, process.pid.toString());
  logger.info({ pid: process.pid, pidFile: PID_FILE }, "PIDファイルを保存しました");
}

function removePidFile(): void {
  if (existsSync(PID_FILE)) {
    unlinkSync(PID_FILE);
    logger.info({ pidFile: PID_FILE }, "PIDファイルを削除しました");
  }
}

function setupSignalHandlers(): void {
  const shutdown = (signal: string) => {
    logger.info({ signal }, "シグナルを受信、シャットダウンします");
    removePidFile();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

async function executeScheduledWorkflow(): Promise<void> {
  const now = new Date();
  logger.info(
    { time: now.toLocaleString("ja-JP", { timeZone: env.TZ }) },
    "スケジュール実行を開始"
  );

  try {
    await runWorkflow();
    logger.info("スケジュール実行が完了しました");
  } catch (error) {
    logger.error({ error }, "スケジュール実行でエラーが発生しました");
  }
}

function main(): void {
  const scheduleTimes = env.SCHEDULE_TIMES;

  if (scheduleTimes.length === 0) {
    logger.error("SCHEDULE_TIMESが設定されていません");
    console.error("エラー: SCHEDULE_TIMESを設定してください（例: SCHEDULE_TIMES=09:00,12:00,18:00）");
    process.exit(1);
  }

  // PIDファイルを保存
  savePidFile();

  // シグナルハンドラを設定
  setupSignalHandlers();

  // 各時刻にスケジュールを設定
  for (const time of scheduleTimes) {
    const cronExpression = timeToCron(time);

    if (!cron.validate(cronExpression)) {
      logger.error({ time, cronExpression }, "無効な時刻形式です");
      continue;
    }

    cron.schedule(cronExpression, executeScheduledWorkflow, {
      timezone: env.TZ,
    });

    logger.info({ time, cronExpression, timezone: env.TZ }, "スケジュールを登録しました");
  }

  console.log(`\nデーモンを起動しました (PID: ${process.pid})`);
  console.log(`タイムゾーン: ${env.TZ}`);
  console.log(`スケジュール時刻: ${scheduleTimes.join(", ")}`);
  console.log("\n停止するには: npm run daemon:stop");

  logger.info(
    { pid: process.pid, scheduleTimes, timezone: env.TZ },
    "デーモンを起動しました"
  );
}

main();
