import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { env } from "../config/env.js";
import { logger } from "./logger.js";
import type { WorkflowBaseError, WorkflowStep } from "../errors/base.js";

export interface NotificationPayload {
  status: "success" | "error";
  message: string;
  step?: WorkflowStep;
  timestamp: string;
}

function createSuccessPayload(posted: boolean): NotificationPayload {
  return {
    status: "success",
    message: posted ? "投稿が完了しました" : "投稿の準備ができました",
    timestamp: new Date().toISOString(),
  };
}

function createErrorPayload(error: unknown): NotificationPayload {
  const timestamp = new Date().toISOString();

  if (isWorkflowError(error)) {
    return {
      status: "error",
      message: error.message,
      step: error.step,
      timestamp,
    };
  }

  return {
    status: "error",
    message: error instanceof Error ? error.message : String(error),
    timestamp,
  };
}

function isWorkflowError(error: unknown): error is WorkflowBaseError {
  return (
    error !== null &&
    typeof error === "object" &&
    "step" in error &&
    "message" in error
  );
}

async function sendWebhook(payload: NotificationPayload): Promise<void> {
  if (!env.WEBHOOK_URL) {
    return;
  }

  try {
    const response = await fetch(env.WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      logger.warn(
        { status: response.status, url: env.WEBHOOK_URL },
        "Webhook送信に失敗しました"
      );
    } else {
      logger.info({ url: env.WEBHOOK_URL }, "Webhook送信成功");
    }
  } catch (error) {
    logger.warn(
      { error, url: env.WEBHOOK_URL },
      "Webhook送信中にエラーが発生しました"
    );
  }
}

function saveLog(payload: NotificationPayload): void {
  if (!env.LOG_FILE_PATH) {
    return;
  }

  try {
    const dir = dirname(env.LOG_FILE_PATH);
    mkdirSync(dir, { recursive: true });

    const logLine = JSON.stringify(payload) + "\n";
    appendFileSync(env.LOG_FILE_PATH, logLine, "utf-8");

    logger.info({ path: env.LOG_FILE_PATH }, "ログを保存しました");
  } catch (error) {
    logger.warn(
      { error, path: env.LOG_FILE_PATH },
      "ログ保存中にエラーが発生しました"
    );
  }
}

export async function notifySuccess(posted: boolean): Promise<void> {
  const payload = createSuccessPayload(posted);
  saveLog(payload);
  await sendWebhook(payload);
}

export async function notifyError(error: unknown): Promise<void> {
  const payload = createErrorPayload(error);
  saveLog(payload);
  await sendWebhook(payload);
}
