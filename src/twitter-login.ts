import { login, hasCookie } from "./providers/sns/twitter.js";
import { logger } from "./lib/logger.js";

async function main() {
  logger.info("Twitter ログインスクリプト開始");

  if (hasCookie()) {
    console.log("\n既存のCookieが見つかりました。再ログインしますか？");
    console.log("続行するには Enter を押してください（Ctrl+C でキャンセル）\n");

    await new Promise<void>((resolve) => {
      process.stdin.once("data", () => resolve());
    });
  }

  try {
    const cookie = await login();
    console.log("\n=== ログイン成功 ===");
    console.log(`Cookie: ${cookie.substring(0, 50)}...`);
    console.log("\nCookieは .twitter-cookie.json に保存されました。");
  } catch (error) {
    logger.error({ error }, "ログイン失敗");
    console.error("\nログインに失敗しました。");
    console.error("以下を確認してください：");
    console.error("  - TWITTER_USERNAME, TWITTER_EMAIL, TWITTER_PASSWORD が正しいか");
    console.error("  - TWITTER_PROXY_URL が設定されているか");
    console.error("  - プロキシサーバーが起動しているか");
    process.exit(1);
  }
}

main();
