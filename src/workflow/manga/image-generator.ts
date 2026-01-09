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
    const mainLabel = char.isMain ? " (MAIN CHARACTER)" : "";
    appearances.push(`CHARACTER ${index}${mainLabel} - ${char.name}: ${char.appearancePrompt || "See reference images"}`);
    index++;
  }
  return appearances.join("\n");
}

function formatDialogues(dialogues: Array<{ characterName: string; text: string }>): string {
  if (dialogues.length === 0) return "(no dialogue)";
  return dialogues.map(d => `${d.characterName}: "${d.text}"`).join(" / ");
}

function buildMangaImagePrompt(story: MangaStory, characters: CharacterMap, customPrompt?: string): string {
  const basePrompt = customPrompt ?? story.imagePrompt;
  const characterAppearances = buildCharacterAppearances(characters);
  const characterCount = characters.size;

  // 4コマ漫画のレイアウト指示を強化（各コマでキャラクター特徴を繰り返し）
  const layoutInstruction = `
Generate a single image containing a 4-panel manga (yonkoma) layout.

IMPORTANT: Use the provided reference images as character design reference.
ALL ${characterCount} characters must appear in EVERY panel and match the reference images exactly.

=== ALL CHARACTERS (must appear in EVERY panel) ===
${characterAppearances}

LAYOUT STRUCTURE:
- Top of the left side: Title "${story.title}" in decorative Japanese text
- Left side (60%): 4 vertical panels stacked vertically
- Right side (40%): A single illustration with ALL characters
- Add panel borders/frames to clearly separate each panel
- Include speech bubbles with Japanese text in each panel

=== PANEL 1 (起/Introduction) ===
CHARACTERS: ALL ${characterCount} characters present
ACTION: ${story.panels[0].description}
DIALOGUES: ${formatDialogues(story.panels[0].dialogues)}

=== PANEL 2 (承/Development) ===
CHARACTERS: ALL ${characterCount} characters present
ACTION: ${story.panels[1].description}
DIALOGUES: ${formatDialogues(story.panels[1].dialogues)}

=== PANEL 3 (転/Twist) ===
CHARACTERS: ALL ${characterCount} characters present
ACTION: ${story.panels[2].description}
DIALOGUES: ${formatDialogues(story.panels[2].dialogues)}

=== PANEL 4 (結/Conclusion) ===
CHARACTERS: ALL ${characterCount} characters present
ACTION: ${story.panels[3].description}
DIALOGUES: ${formatDialogues(story.panels[3].dialogues)}

=== RIGHT SIDE ILLUSTRATION ===
CHARACTERS: ALL ${characterCount} characters together
${characterAppearances}
SCENE: ${story.illustration.description}

STYLE: 2D manga/anime style with clean linework and cel shading (even if reference images are 3D, draw in 2D manga style)

SPEECH BUBBLE RULES (in priority order):
1. [MUST] Position speech bubbles near the speaking character, not fixed to one side
2. [MUST] Each character's dialogue gets their own speech bubble
3. [MUST] Japanese manga reads RIGHT to LEFT: if multiple bubbles in one panel, place the first dialogue on the RIGHT, second on the LEFT
4. [SHOULD] Diagonal placement across panels for natural eye flow
- Make speech bubble text clearly readable in Japanese
- Use clean panel borders

ACCESSORY PRIORITY RULE:
- If any character wears accessories that cover facial features (sunglasses, masks, etc.), always show the accessory even during emotional expressions
- Do NOT remove or make transparent any face-covering accessories to show expressions like "shocked eyes" or "pale face"
- Express emotions through body language, pose, sweat drops, and other visible features instead

${basePrompt}`;

  return layoutInstruction;
}

export async function generateMangaImage(
  story: MangaStory,
  characters: CharacterMap,
  customImagePrompt?: string
): Promise<GeneratedImage> {
  logger.info({ title: story.title, characterCount: characters.size }, "4コマ漫画画像生成を開始");

  const provider = new GeminiProvider(env.GEMINI_API_KEY);

  try {
    // 全キャラクターの参照画像を読み込み
    const allImagePaths = getAllImagePaths(characters);
    const referenceImages = await loadReferenceImages(allImagePaths);
    logger.info({ count: referenceImages.length }, "参照画像を読み込み完了");

    // 画像生成
    const prompt = buildMangaImagePrompt(story, characters, customImagePrompt);
    logger.info({ imagePrompt: prompt }, "Geminiに渡す画像生成プロンプト");
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
