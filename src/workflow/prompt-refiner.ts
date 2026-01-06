import { query } from "@anthropic-ai/claude-agent-sdk";
import { logger } from "../lib/logger.js";

const MODEL = "claude-opus-4-5-20251101";

const outputSchema = {
  type: "object",
  properties: {
    refinedPrompt: { type: "string", description: "改善された英語の画像生成プロンプト" },
  },
  required: ["refinedPrompt"],
} as const;

interface RefineOutput {
  refinedPrompt: string;
}

function buildRefinePrompt(
  originalPrompt: string,
  issues: string[],
  suggestions: string[]
): string {
  const issuesText = issues.length > 0 ? issues.map((i) => `- ${i}`).join("\n") : "- なし";
  const suggestionsText = suggestions.length > 0 ? suggestions.map((s) => `- ${s}`).join("\n") : "- なし";

  return `先ほどの品質チェックで以下の問題が見つかりました。

【問題点】
${issuesText}

【改善提案】
${suggestionsText}

【元のプロンプト】
${originalPrompt}

上記の問題を解決するよう、画像生成プロンプトを改善してください。
改善されたプロンプトは英語で出力してください。`;
}

export async function refineImagePrompt(
  sessionId: string,
  originalPrompt: string,
  issues: string[],
  suggestions: string[]
): Promise<string> {
  logger.info({ sessionId, issueCount: issues.length }, "プロンプト改善を開始");

  const prompt = buildRefinePrompt(originalPrompt, issues, suggestions);
  let result: RefineOutput | null = null;

  for await (const message of query({
    prompt,
    options: {
      model: MODEL,
      resume: sessionId,
      allowedTools: [],
      outputFormat: {
        type: "json_schema",
        schema: outputSchema,
      },
    },
  })) {
    if (message.type === "result") {
      if (message.subtype === "success" && message.structured_output) {
        result = message.structured_output as RefineOutput;
      }
    }
  }

  if (!result) {
    logger.warn("プロンプト改善の結果が取得できませんでした。元のプロンプトを使用します");
    return originalPrompt;
  }

  logger.info({ refinedPrompt: result.refinedPrompt.substring(0, 50) + "..." }, "プロンプト改善完了");

  return result.refinedPrompt;
}
