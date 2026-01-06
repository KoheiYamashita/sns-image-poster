import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";

const API_BASE = "https://api.twitterapi.io";
const COOKIE_FILE = resolve(import.meta.dirname, "../../../.twitter-cookie.json");

interface LoginResponse {
  status: string;
  msg: string;
  login_cookie?: string;
}

interface TwitterCookie {
  login_cookie: string;
  created_at: string;
  username: string;
}

export async function login(): Promise<string> {
  const { TWITTER_USERNAME, TWITTER_EMAIL, TWITTER_PASSWORD, TWITTER_TOTP_SECRET, TWITTER_PROXY_URL, TWITTER_API_IO_KEY } = env;

  if (!TWITTER_USERNAME || !TWITTER_EMAIL || !TWITTER_PASSWORD) {
    throw new Error("TWITTER_USERNAME, TWITTER_EMAIL, TWITTER_PASSWORD を .env に設定してください");
  }

  if (!TWITTER_PROXY_URL) {
    throw new Error("TWITTER_PROXY_URL を .env に設定してください");
  }

  logger.info({ username: TWITTER_USERNAME }, "Twitterログイン開始");

  const body: Record<string, string> = {
    user_name: TWITTER_USERNAME,
    email: TWITTER_EMAIL,
    password: TWITTER_PASSWORD,
    proxy: TWITTER_PROXY_URL,
  };

  if (TWITTER_TOTP_SECRET) {
    body["totp_secret"] = TWITTER_TOTP_SECRET;
  }

  const response = await fetch(`${API_BASE}/twitter/user_login_v2`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": TWITTER_API_IO_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ログインAPIエラー: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as LoginResponse;

  if (data.status !== "success" || !data.login_cookie) {
    throw new Error(`ログイン失敗: ${data.msg}`);
  }

  logger.info("ログイン成功、Cookieを保存中");

  // Cookieをファイルに保存
  const cookieData: TwitterCookie = {
    login_cookie: data.login_cookie,
    created_at: new Date().toISOString(),
    username: TWITTER_USERNAME,
  };

  await mkdir(dirname(COOKIE_FILE), { recursive: true });
  await writeFile(COOKIE_FILE, JSON.stringify(cookieData, null, 2));

  logger.info({ path: COOKIE_FILE }, "Cookie保存完了");

  return data.login_cookie;
}

export async function getLoginCookie(): Promise<string> {
  if (!existsSync(COOKIE_FILE)) {
    throw new Error(`Cookieファイルが見つかりません。先に npm run twitter:login を実行してください`);
  }

  const content = await readFile(COOKIE_FILE, "utf-8");
  const data = JSON.parse(content) as TwitterCookie;

  logger.info({ username: data.username, created_at: data.created_at }, "Cookie読み込み完了");

  return data.login_cookie;
}

export function hasCookie(): boolean {
  return existsSync(COOKIE_FILE);
}
