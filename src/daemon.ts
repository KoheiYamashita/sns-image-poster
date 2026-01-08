import cron from "node-cron";
import { spawn } from "node:child_process";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { parseCliArgs } from "./cli/index.js";
import { initConfig } from "./config/config.js";
import { env } from "./config/env.js";
import { runWorkflow } from "./workflow/runner.js";
import { logger } from "./lib/logger.js";

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

/**
 * 子プロセスでワークフローを実行
 */
function executeWorkflowInChild(preset: string): Promise<number | null> {
  return new Promise((resolve) => {
    const child = spawn("node", ["dist/index.js", "-p", preset], {
      stdio: "inherit",
      cwd: process.cwd(),
    });
    child.on("close", (code) => {
      resolve(code);
    });
  });
}

/**
 * スケジュール実行（単一プリセットまたはプリセットなし）
 */
async function executeScheduledWorkflow(preset?: string): Promise<void> {
  const now = new Date();
  logger.info(
    { time: now.toLocaleString("ja-JP", { timeZone: env.TZ }), preset },
    "スケジュール実行を開始"
  );

  try {
    if (preset) {
      // プリセット指定時は子プロセスで実行
      const code = await executeWorkflowInChild(preset);
      if (code !== 0) {
        logger.error({ preset, exitCode: code }, "スケジュール実行が失敗しました");
      } else {
        logger.info({ preset }, "スケジュール実行が完了しました");
      }
    } else {
      // プリセットなしは従来通り
      await runWorkflow();
      logger.info("スケジュール実行が完了しました");
    }
  } catch (error) {
    logger.error({ error, preset }, "スケジュール実行でエラーが発生しました");
  }
}

interface PresetSchedule {
  preset: string;
  scheduleTimes: string[];
  timezone: string;
}

function main(): void {
  // CLI引数を解析
  const args = parseCliArgs();
  const { presets } = args;

  // PIDファイルを保存
  savePidFile();

  // シグナルハンドラを設定
  setupSignalHandlers();

  if (presets.length === 0) {
    // プリセットなし: 従来通り
    initConfig(undefined);
    const scheduleTimes = env.SCHEDULE_TIMES;
    const timezone = env.TZ;

    if (scheduleTimes.length === 0) {
      logger.error("SCHEDULE_TIMESが設定されていません");
      console.error("エラー: SCHEDULE_TIMESを設定してください（例: SCHEDULE_TIMES=09:00,12:00,18:00）");
      removePidFile();
      process.exit(1);
    }

    for (const time of scheduleTimes) {
      const cronExpression = timeToCron(time);
      if (!cron.validate(cronExpression)) {
        logger.error({ time, cronExpression }, "無効な時刻形式です");
        continue;
      }
      cron.schedule(cronExpression, () => executeScheduledWorkflow(), { timezone });
      logger.info({ time, cronExpression, timezone }, "スケジュールを登録しました");
    }

    console.log(`\nデーモンを起動しました (PID: ${process.pid})`);
    console.log(`タイムゾーン: ${timezone}`);
    console.log(`スケジュール時刻: ${scheduleTimes.join(", ")}`);
    console.log("\n停止するには: npm run daemon:stop");

    logger.info({ pid: process.pid, scheduleTimes, timezone }, "デーモンを起動しました");
  } else {
    // プリセットあり: 各プリセットのスケジュールを個別に登録
    const schedules: PresetSchedule[] = [];

    for (const preset of presets) {
      initConfig(preset);
      schedules.push({
        preset,
        scheduleTimes: [...env.SCHEDULE_TIMES],
        timezone: env.TZ,
      });
    }

    // スケジュールが全て空かチェック
    if (schedules.every((s) => s.scheduleTimes.length === 0)) {
      logger.error("全てのプリセットでSCHEDULE_TIMESが設定されていません");
      console.error("エラー: SCHEDULE_TIMESを設定してください（例: scheduleTimes: [\"09:00\"]）");
      removePidFile();
      process.exit(1);
    }

    for (const { preset, scheduleTimes, timezone } of schedules) {
      if (scheduleTimes.length === 0) {
        logger.warn({ preset }, "SCHEDULE_TIMESが設定されていないためスキップします");
        continue;
      }

      for (const time of scheduleTimes) {
        const cronExpression = timeToCron(time);
        if (!cron.validate(cronExpression)) {
          logger.error({ time, cronExpression, preset }, "無効な時刻形式です");
          continue;
        }
        cron.schedule(
          cronExpression,
          () => executeScheduledWorkflow(preset),
          { timezone }
        );
        logger.info({ time, cronExpression, timezone, preset }, "スケジュールを登録しました");
      }
    }

    console.log(`\nデーモンを起動しました (PID: ${process.pid})`);
    console.log("スケジュール:");
    for (const { preset, scheduleTimes, timezone } of schedules) {
      if (scheduleTimes.length > 0) {
        console.log(`  ${preset}: ${scheduleTimes.join(", ")} (${timezone})`);
      }
    }
    console.log("\n停止するには: npm run daemon:stop");

    logger.info({ pid: process.pid, schedules }, "デーモンを起動しました");
  }
}

main();
