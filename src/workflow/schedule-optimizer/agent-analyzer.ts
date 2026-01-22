/**
 * Agent SDK連携
 *
 * メトリクスデータをAgent SDKに渡して分析し、
 * 最適な投稿時間を算出する。
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { AnalysisInput } from "./collector.js";
import { logger } from "../../lib/logger.js";
import { ScheduleOptimizationError } from "../../errors/index.js";

/**
 * Agent SDKからの出力データ型
 */
export interface AnalysisOutput {
  recommendedSchedule: string[];
  reasoning: string;
}

/**
 * AIレスポンスのZodスキーマ
 */
const analysisOutputSchema = z.object({
  recommendedSchedule: z.array(z.string()),
  reasoning: z.string(),
});

/**
 * AIレスポンスからJSON部分を抽出してパース
 */
function extractJsonFromResponse(responseText: string): AnalysisOutput {
  const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
  if (!jsonMatch?.[1]) {
    throw new ScheduleOptimizationError(
      "Agent SDKのレスポンスからJSONを抽出できませんでした"
    );
  }

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    return analysisOutputSchema.parse(parsed);
  } catch (error) {
    throw new ScheduleOptimizationError(
      `Agent SDKレスポンスのJSON解析に失敗しました: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Agent SDKを呼び出して分析を実行
 *
 * @param input 分析入力データ
 * @returns 分析結果
 */
export async function analyzeWithAgent(
  input: AnalysisInput
): Promise<AnalysisOutput> {
  logger.info(
    {
      presetName: input.presetName,
      postsCount: input.posts.length,
      historicalWeeks: input.historicalData.length,
    },
    "Agent SDKで分析を開始"
  );

  const client = new Anthropic();

  const systemPrompt = `あなたはSNS投稿の最適化エキスパートです。
投稿のエンゲージメントデータを分析し、最適な投稿時間を推奨します。

分析時の考慮事項：
1. エンゲージメント率 = (いいね + RT + リプライ + 引用) / 閲覧数
2. 閲覧数が多い時間帯はリーチが大きい
3. 曜日による傾向の違い
4. 過去データの信頼性（データ量が多いほど信頼できる）

出力形式：
必ず以下のJSON形式で回答してください。
\`\`\`json
{
  "recommendedSchedule": ["HH:MM", "HH:MM", ...],
  "reasoning": "分析理由の説明"
}
\`\`\`

重要：
- recommendedScheduleの件数は、入力のcurrentScheduleと同じ件数にしてください
- 時刻は "HH:MM" 形式（例: "08:00", "19:30"）で指定してください`;

  const userPrompt = `以下のデータを分析し、最適な投稿時間を推奨してください。

## 現在のスケジュール
${JSON.stringify(input.currentSchedule)}
（この件数を維持してください）

## 最近の投稿データ
${JSON.stringify(input.posts, null, 2)}

## 過去の投稿データ（週別）
${JSON.stringify(input.historicalData, null, 2)}

上記のデータを分析し、最適な投稿時間とその理由をJSON形式で回答してください。`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: userPrompt,
      },
    ],
    system: systemPrompt,
  });

  // レスポンスからテキストを抽出
  const textContent = message.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new ScheduleOptimizationError("Agent SDKからのレスポンスが不正です");
  }

  const result = extractJsonFromResponse(textContent.text);

  // 件数の検証
  if (result.recommendedSchedule.length !== input.currentSchedule.length) {
    logger.warn(
      {
        expected: input.currentSchedule.length,
        received: result.recommendedSchedule.length,
      },
      "推奨スケジュールの件数が一致しません。現在のスケジュールを維持します"
    );
    result.recommendedSchedule = input.currentSchedule;
  }

  logger.info(
    {
      recommendedSchedule: result.recommendedSchedule,
      reasoning:
        result.reasoning.length > 100
          ? result.reasoning.slice(0, 100) + "..."
          : result.reasoning,
    },
    "Agent SDK分析完了"
  );

  return result;
}
