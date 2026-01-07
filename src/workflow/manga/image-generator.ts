import type { MangaStory, GeneratedImage } from "../../types/index.js";
import { MangaImageGenerationError } from "../../errors/index.js";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { GeminiProvider, loadReferenceImages } from "../../providers/image-generation/index.js";

function buildMangaImagePrompt(story: MangaStory, customPrompt?: string): string {
  const basePrompt = customPrompt ?? story.imagePrompt;
  const characterAppearance = env.CHARACTER_APPEARANCE_PROMPT || "";

  // 4コマ漫画のレイアウト指示を強化（各コマでキャラクター特徴を繰り返し）
  const layoutInstruction = `
Generate a single image containing a 4-panel manga (yonkoma) layout.

IMPORTANT: Use the provided reference images as character design reference.
The character must match the reference images exactly.

CHARACTER APPEARANCE (must appear in EVERY panel):
${characterAppearance}

LAYOUT STRUCTURE:
- Top of the left side: Title "${story.title}" in decorative Japanese text
- Left side (60%): 4 vertical panels stacked vertically
- Right side (40%): A single illustration
- Add panel borders/frames to clearly separate each panel
- Include speech bubbles with Japanese text in each panel

=== PANEL 1 (起/Introduction) ===
CHARACTER: ${characterAppearance}
ACTION: ${story.panels[0].description}
DIALOGUE: "${story.panels[0].dialogue}"

=== PANEL 2 (承/Development) ===
CHARACTER: ${characterAppearance}
ACTION: ${story.panels[1].description}
DIALOGUE: "${story.panels[1].dialogue}"

=== PANEL 3 (転/Twist) ===
CHARACTER: ${characterAppearance}
ACTION: ${story.panels[2].description}
DIALOGUE: "${story.panels[2].dialogue}"

=== PANEL 4 (結/Conclusion) ===
CHARACTER: ${characterAppearance}
ACTION: ${story.panels[3].description}
DIALOGUE: "${story.panels[3].dialogue}"

=== RIGHT SIDE ILLUSTRATION ===
CHARACTER: ${characterAppearance}
SCENE: ${story.illustration.description}

STYLE: 2D manga/anime style with clean linework and cel shading (even if reference images are 3D, draw in 2D manga style)

SPEECH BUBBLE RULES (in priority order):
1. [MUST] Position speech bubbles near the speaking character, not fixed to one side
2. [MUST] Japanese manga reads RIGHT to LEFT: if multiple bubbles in one panel, place the first dialogue on the RIGHT, second on the LEFT
3. [SHOULD] Diagonal placement across panels for natural eye flow (e.g., if Panel 1's bubble is top-right, Panel 2's should be bottom-left)
- Make speech bubble text clearly readable in Japanese
- Use clean panel borders

ACCESSORY PRIORITY RULE:
- If the character wears accessories that cover facial features (sunglasses, masks, etc.), always show the accessory even during emotional expressions
- Do NOT remove or make transparent any face-covering accessories to show expressions like "shocked eyes" or "pale face"
- Express emotions through body language, pose, sweat drops, and other visible features instead

${basePrompt}`;

  return layoutInstruction;
}

export async function generateMangaImage(
  story: MangaStory,
  customImagePrompt?: string
): Promise<GeneratedImage> {
  logger.info({ title: story.title }, "4コマ漫画画像生成を開始");

  const provider = new GeminiProvider(env.GEMINI_API_KEY);

  try {
    // 参照画像を読み込み
    const referenceImages = await loadReferenceImages(env.CHARACTER_IMAGE_PATHS);
    logger.info({ count: referenceImages.length }, "参照画像を読み込み完了");

    // 画像生成
    const prompt = buildMangaImagePrompt(story, customImagePrompt);
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
