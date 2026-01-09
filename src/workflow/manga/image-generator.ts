import type { MangaStory, GeneratedImage } from "../../types/index.js";
import type { CharacterMap } from "../../types/character.js";
import { MangaImageGenerationError } from "../../errors/index.js";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { GeminiProvider, loadReferenceImages } from "../../providers/image-generation/index.js";
import { getAllImagePaths } from "../../config/character-loader.js";

function buildCharacterAppearances(characters: CharacterMap): string {
  const appearances: string[] = [];
  let index = 1;
  for (const char of characters.values()) {
    const mainLabel = char.isMain ? "（主人公）" : "";
    appearances.push(`キャラクター${index}${mainLabel} - ${char.name}: ${char.appearancePrompt || "参照画像を参照"}`);
    index++;
  }
  return appearances.join("\n");
}

function formatDialogues(dialogues: Array<{ characterName: string; text: string }>): string {
  if (dialogues.length === 0) return "（セリフなし）";
  return dialogues.map(d => `${d.characterName}:「${d.text}」`).join(" / ");
}

function buildMangaImagePrompt(story: MangaStory, characters: CharacterMap, customPrompt?: string): string {
  const basePrompt = customPrompt ?? story.imagePrompt;
  const characterAppearances = buildCharacterAppearances(characters);
  const characterCount = characters.size;

  // 4コマ漫画のレイアウト指示を強化（各コマでキャラクター特徴を繰り返し）
  const layoutInstruction = `4コマ漫画のレイアウトを含む1枚の画像を生成してください。

重要: 提供された参照画像をキャラクターデザインの参考として使用してください。
全${characterCount}名のキャラクターが全てのコマに登場し、参照画像と正確に一致させてください。

=== 全キャラクター（全コマに登場必須） ===
${characterAppearances}

レイアウト構成:
- 左側上部: タイトル「${story.title}」を装飾的な日本語で配置
- 左側（60%）: 4つのコマを縦に並べる
- 右側（40%）: 全キャラクターが登場する1枚イラスト
- 各コマを明確に区切るコマ枠を追加
- 各コマに日本語のセリフを含む吹き出しを配置

=== コマ1（起） ===
キャラクター: 全${characterCount}名が登場
アクション: ${story.panels[0].description}
セリフ: ${formatDialogues(story.panels[0].dialogues)}

=== コマ2（承） ===
キャラクター: 全${characterCount}名が登場
アクション: ${story.panels[1].description}
セリフ: ${formatDialogues(story.panels[1].dialogues)}

=== コマ3（転） ===
キャラクター: 全${characterCount}名が登場
アクション: ${story.panels[2].description}
セリフ: ${formatDialogues(story.panels[2].dialogues)}

=== コマ4（結） ===
キャラクター: 全${characterCount}名が登場
アクション: ${story.panels[3].description}
セリフ: ${formatDialogues(story.panels[3].dialogues)}

=== 右側イラスト ===
キャラクター: 全${characterCount}名が一緒に
シーン: ${story.illustration.description}

スタイル: 2D漫画/アニメ風、クリーンな線画とセルシェーディング（参照画像が3Dでも2D漫画スタイルで描く）

吹き出しのルール（優先順）:
1. 【必須】吹き出しは話しているキャラクターの近くに配置（片側固定ではない）
2. 【必須】各キャラクターのセリフは個別の吹き出しに
3. 【必須】日本の漫画は右から左に読む: 1コマに複数の吹き出しがある場合、最初のセリフを右側、2番目を左側に配置
4. 【推奨】自然な視線の流れのため、コマをまたいで斜めに配置
- 吹き出し内の日本語テキストは読みやすく
- コマ枠はクリーンに

アクセサリー優先ルール:
- 顔を覆うアクセサリー（サングラス、マスクなど）を着用しているキャラクターは、感情表現時でも常にアクセサリーを表示
- 「驚いた目」や「青ざめた顔」などの表現のために顔を覆うアクセサリーを外したり透明にしたりしないこと
- 感情はボディランゲージ、ポーズ、汗のしずくなど他の視覚的要素で表現

${basePrompt}`;

  return layoutInstruction;
}

export async function generateMangaImage(
  story: MangaStory,
  characters: CharacterMap,
  customImagePrompt?: string
): Promise<GeneratedImage | null> {
  logger.info({ title: story.title, characterCount: characters.size }, "4コマ漫画画像生成を開始");

  try {
    // 全キャラクターの参照画像を読み込み
    const allImagePaths = getAllImagePaths(characters);
    const referenceImages = await loadReferenceImages(allImagePaths);
    logger.info({ count: referenceImages.length }, "参照画像を読み込み完了");

    // 画像生成プロンプトを構築
    const prompt = buildMangaImagePrompt(story, characters, customImagePrompt);
    logger.info("Geminiに渡す画像生成プロンプト:\n" + prompt);

    // APIキーがない場合はプロンプト出力のみで終了
    if (!env.GEMINI_API_KEY) {
      logger.info("GEMINI_API_KEYが設定されていないため、画像生成をスキップします");
      return null;
    }

    const provider = new GeminiProvider(env.GEMINI_API_KEY);
    const image = await provider.generate({
      prompt,
      referenceImages,
      aspectRatio: env.ASPECT_RATIO,
    });

    logger.info(
      { mimeType: image.mimeType, size: image.data.length },
      "4コマ漫画画像生成完了"
    );

    return image;
  } catch (error) {
    if (error instanceof MangaImageGenerationError) {
      throw error;
    }
    throw new MangaImageGenerationError(
      `4コマ漫画画像生成中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
      { originalError: error }
    );
  }
}
