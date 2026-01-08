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

function main(): void {
  // CLI引数を解析
  const args = parseCliArgs();
  const { presets } = args;

  // プリセットなしまたは単一プリセットの場合は設定を初期化
  if (presets.length <= 1) {
    initConfig(presets[0]);
  }

  // スケジュール時刻を取得（複数プリセット時は各プリセットから、それ以外はenvから）
  let scheduleTimes: string[];
  let timezone: string;

  if (presets.length > 1) {
    // 複数プリセット時は最初のプリセットのスケジュールを使用（共通設定想定）
    initConfig(presets[0]);
    scheduleTimes = env.SCHEDULE_TIMES;
    timezone = env.TZ;
  } else {
    scheduleTimes = env.SCHEDULE_TIMES;
    timezone = env.TZ;
  }

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

    if (presets.length > 1) {
      // 複数プリセット: 各プリセットを並列で実行
      cron.schedule(
        cronExpression,
        async () => {
          logger.info({ time, presets }, "複数プリセットのスケジュール実行を開始");
          await Promise.all(presets.map((preset) => executeScheduledWorkflow(preset)));
          logger.info({ presets }, "複数プリセットのスケジュール実行が完了");
        },
        { timezone }
      );
      logger.info({ time, cronExpression, timezone, presets }, "スケジュールを登録しました（複数プリセット）");
    } else if (presets.length === 1) {
      // 単一プリセット: 子プロセスで実行
      cron.schedule(
        cronExpression,
        () => executeScheduledWorkflow(presets[0]),
        { timezone }
      );
      logger.info({ time, cronExpression, timezone, preset: presets[0] }, "スケジュールを登録しました");
    } else {
      // プリセットなし: 従来通り
      cron.schedule(cronExpression, () => executeScheduledWorkflow(), { timezone });
      logger.info({ time, cronExpression, timezone }, "スケジュールを登録しました");
    }
  }

  console.log(`\nデーモンを起動しました (PID: ${process.pid})`);
  console.log(`タイムゾーン: ${timezone}`);
  console.log(`スケジュール時刻: ${scheduleTimes.join(", ")}`);
  if (presets.length > 0) {
    console.log(`プリセット: ${presets.join(", ")}`);
  }
  console.log("\n停止するには: npm run daemon:stop");

  logger.info(
    { pid: process.pid, scheduleTimes, timezone, presets },
    "デーモンを起動しました"
  );
}

main();
