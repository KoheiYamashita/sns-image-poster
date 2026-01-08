import pino from "pino";
import pinoPretty from "pino-pretty";
import { createWriteStream, mkdirSync } from "node:fs";
import { join } from "node:path";

const prettyOptions = {
  translateTime: "SYS:standard",
  ignore: "pid,hostname",
};

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
 * @returns ログファイルのパス
 */
export function initWorkflowLogger(): string {
  const logsDir = "./logs";
  mkdirSync(logsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  currentLogFilePath = join(logsDir, `workflow-${timestamp}.log`);

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
