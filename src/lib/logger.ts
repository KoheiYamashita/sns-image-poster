import pino from "pino";
import pinoPretty from "pino-pretty";
import { createWriteStream, mkdirSync } from "node:fs";
import { join } from "node:path";
import { env } from "../config/env.js";

const prettyOptions = {
  translateTime: "SYS:standard",
  ignore: "pid,hostname",
};

/**
 * 設定されたタイムゾーンでタイムスタンプを生成
 * 形式: YYYY-MM-DDTHH-mm-ss
 */
export function getTimestamp(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: env.TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  // sv-SE locale produces "YYYY-MM-DD HH:mm:ss" format
  return formatter.format(now).replace(" ", "T").replace(/:/g, "-");
}

// 初期ロガー（コンソールのみ）
let currentLogger: pino.Logger = pino(
  pinoPretty({
    ...prettyOptions,
    colorize: true,
  })
);

let currentLogFilePath: string | null = null;

/**
 * ワークフロー用ロガーを初期化
 * コンソールとファイル両方に出力するように設定
 * @param presetName プリセット名（ログファイル名に含める）
 * @returns ログファイルのパス
 */
export function initWorkflowLogger(presetName?: string): string {
  const logsDir = "./logs";
  mkdirSync(logsDir, { recursive: true });

  const timestamp = getTimestamp();
  const fileName = presetName
    ? `workflow-${presetName}-${timestamp}.log`
    : `workflow-${timestamp}.log`;
  currentLogFilePath = join(logsDir, fileName);

  const fileWriteStream = createWriteStream(currentLogFilePath);

  // コンソール用ストリーム（カラー有り、stdout出力）
  const consoleStream = pinoPretty({
    ...prettyOptions,
    colorize: true,
  });

  // ファイル用ストリーム（カラー無し、ファイルのみに出力）
  const filePrettyStream = pinoPretty({
    ...prettyOptions,
    colorize: false,
    destination: fileWriteStream,
  });

  currentLogger = pino(
    {},
    pino.multistream([
      { stream: consoleStream },
      { stream: filePrettyStream },
    ])
  );

  return currentLogFilePath;
}

/**
 * 現在のログファイルパスを取得
 */
export function getLogFilePath(): string | null {
  return currentLogFilePath;
}

export { currentLogger as logger };
