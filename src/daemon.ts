import cron from "node-cron";
import { spawn } from "node:child_process";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { parseCliArgs } from "./cli/index.js";
import { initConfig } from "./config/config.js";
import { env } from "./config/env.js";
import type { DayOfWeek, DaySchedule } from "./config/preset-schema.js";
import { runWorkflow } from "./workflow/runner.js";
import { logger } from "./lib/logger.js";

const PID_FILE = ".daemon.pid";

// 曜日の日本語表記
const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

/**
 * 曜日を数字に変換（cronは0=日曜）
 */
function dayToNumber(day: DayOfWeek): number {
  if (typeof day === "number") return day;

  const dayMap = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  } as const;
  return dayMap[day as keyof typeof dayMap];
}

/**
 * 時刻と曜日からcron式を生成
 */
function timeToCron(time: string, dayOfWeek?: DayOfWeek): string {
  const [hour, minute] = time.split(":");
  const day = dayOfWeek !== undefined ? dayToNumber(dayOfWeek) : "*";
  return `${minute} ${hour} * * ${day}`;
}

interface ParsedSchedule {
  time: string;
  dayOfWeek?: DayOfWeek;
}

/**
 * スケジュール設定をパースして登録用の配列に変換
 */
function parseScheduleTimes(
  legacyTimes: string[],
  daySchedules?: DaySchedule[]
): ParsedSchedule[] {
  const result: ParsedSchedule[] = [];

  // 新形式（曜日別スケジュール）が指定されている場合
  if (daySchedules && daySchedules.length > 0) {
    for (const schedule of daySchedules) {
      for (const time of schedule.times) {
        result.push({ time, dayOfWeek: schedule.day });
      }
    }
    return result;
  }

  // 既存形式（時刻のみ）の場合
  for (const time of legacyTimes) {
    result.push({ time });
  }
  return result;
}

/**
 * 曜日ラベルを取得
 */
function getDayLabel(dayOfWeek?: DayOfWeek): string {
  if (dayOfWeek === undefined) return "毎日";
  const num = dayToNumber(dayOfWeek);
  return `${DAY_LABELS[num]}曜`;
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
  schedules: ParsedSchedule[];
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
    const parsedSchedules = parseScheduleTimes(
      env.SCHEDULE_TIMES,
      env.SCHEDULE_TIMES_JSON
    );
    const timezone = env.TZ;

    if (parsedSchedules.length === 0) {
      logger.error("SCHEDULE_TIMESが設定されていません");
      console.error("エラー: SCHEDULE_TIMESを設定してください（例: SCHEDULE_TIMES=09:00,12:00,18:00）");
      removePidFile();
      process.exit(1);
    }

    for (const { time, dayOfWeek } of parsedSchedules) {
      const cronExpression = timeToCron(time, dayOfWeek);
      if (!cron.validate(cronExpression)) {
        logger.error({ time, dayOfWeek, cronExpression }, "無効な時刻形式です");
        continue;
      }
      cron.schedule(cronExpression, () => executeScheduledWorkflow(), { timezone });
      const dayLabel = getDayLabel(dayOfWeek);
      logger.info({ time, dayOfWeek, cronExpression, timezone }, `スケジュールを登録しました (${dayLabel})`);
    }

    console.log(`\nデーモンを起動しました (PID: ${process.pid})`);
    console.log(`タイムゾーン: ${timezone}`);
    console.log("スケジュール:");
    for (const { time, dayOfWeek } of parsedSchedules) {
      console.log(`  ${getDayLabel(dayOfWeek)}: ${time}`);
    }
    console.log("\n停止するには: npm run daemon:stop");

    logger.info({ pid: process.pid, parsedSchedules, timezone }, "デーモンを起動しました");
  } else {
    // プリセットあり: 各プリセットのスケジュールを個別に登録
    const presetSchedules: PresetSchedule[] = [];

    for (const preset of presets) {
      initConfig(preset);
      presetSchedules.push({
        preset,
        schedules: parseScheduleTimes(env.SCHEDULE_TIMES, env.SCHEDULE_TIMES_JSON),
        timezone: env.TZ,
      });
    }

    // スケジュールが全て空かチェック
    if (presetSchedules.every((s) => s.schedules.length === 0)) {
      logger.error("全てのプリセットでSCHEDULE_TIMESが設定されていません");
      console.error("エラー: SCHEDULE_TIMESを設定してください（例: scheduleTimes: [\"09:00\"]）");
      removePidFile();
      process.exit(1);
    }

    for (const { preset, schedules, timezone } of presetSchedules) {
      if (schedules.length === 0) {
        logger.warn({ preset }, "SCHEDULE_TIMESが設定されていないためスキップします");
        continue;
      }

      for (const { time, dayOfWeek } of schedules) {
        const cronExpression = timeToCron(time, dayOfWeek);
        if (!cron.validate(cronExpression)) {
          logger.error({ time, dayOfWeek, cronExpression, preset }, "無効な時刻形式です");
          continue;
        }
        cron.schedule(
          cronExpression,
          () => executeScheduledWorkflow(preset),
          { timezone }
        );
        const dayLabel = getDayLabel(dayOfWeek);
        logger.info({ time, dayOfWeek, cronExpression, timezone, preset }, `スケジュールを登録しました (${dayLabel})`);
      }
    }

    console.log(`\nデーモンを起動しました (PID: ${process.pid})`);
    console.log("スケジュール:");
    for (const { preset, schedules, timezone } of presetSchedules) {
      if (schedules.length > 0) {
        const scheduleStr = schedules
          .map(({ time, dayOfWeek }) => `${getDayLabel(dayOfWeek)} ${time}`)
          .join(", ");
        console.log(`  ${preset}: ${scheduleStr} (${timezone})`);
      }
    }
    console.log("\n停止するには: npm run daemon:stop");

    logger.info({ pid: process.pid, presetSchedules }, "デーモンを起動しました");
  }
}

main();
