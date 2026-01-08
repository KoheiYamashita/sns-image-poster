import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CharacterDefinition, CharacterMap } from "../types/character.js";
import { logger } from "../lib/logger.js";
import { env } from "./env.js";

/**
 * キャラクター名をprompt.txtから抽出
 * "名前: XXX" または "名前：XXX" の形式を想定
 */
function extractCharacterName(prompt: string, fallbackId: string): string {
  const nameMatch = prompt.match(/名前[:：]\s*(.+)/);
  return nameMatch?.[1]?.trim() ?? fallbackId;
}

/**
 * 環境変数を使ってキャラクターを読み込む（便利関数）
 */
export function loadCharacters(): CharacterMap {
  return loadCharactersFromDir(
    env.CHARACTERS_DIR,
    env.CHARACTER_IDS,
    env.MAIN_CHARACTER_ID
  );
}

/**
 * 指定されたキャラクターIDのキャラクターを読み込む
 */
export function loadCharactersFromDir(
  charactersDir: string,
  characterIds: string[],
  mainCharacterId: string
): CharacterMap {
  const absoluteDir = resolve(charactersDir);
  const characters: CharacterMap = new Map();

  if (!existsSync(absoluteDir)) {
    logger.error({ path: absoluteDir }, "キャラクターディレクトリが見つかりません");
    process.exit(1);
  }

  for (const charId of characterIds) {
    const charDir = join(absoluteDir, charId);
    const promptPath = join(charDir, "prompt.txt");
    const appearancePath = join(charDir, "appearance.txt");
    const imagesDir = join(charDir, "images");

    if (!existsSync(charDir)) {
      logger.error({ charId, path: charDir }, "キャラクターディレクトリが見つかりません");
      process.exit(1);
    }

    if (!existsSync(promptPath)) {
      logger.error({ charId, path: promptPath }, "prompt.txtが見つかりません");
      process.exit(1);
    }

    const prompt = readFileSync(promptPath, "utf-8").trim();
    const appearancePrompt = existsSync(appearancePath)
      ? readFileSync(appearancePath, "utf-8").trim()
      : "";

    const name = extractCharacterName(prompt, charId);

    // 画像パスを取得
    const imagePaths: string[] = [];
    if (existsSync(imagesDir)) {
      const images = readdirSync(imagesDir).filter((f) =>
        /\.(png|jpg|jpeg|webp|gif)$/i.test(f)
      );
      for (const img of images) {
        imagePaths.push(join(imagesDir, img));
      }
    }

    const isMain = charId === mainCharacterId;

    characters.set(charId, {
      id: charId,
      name,
      prompt,
      appearancePrompt,
      imagePaths,
      isMain,
    });

    logger.info(
      { charId, name, imageCount: imagePaths.length, isMain },
      "キャラクター読み込み完了"
    );
  }

  // 主軸キャラクターが存在するか確認
  if (!characters.has(mainCharacterId)) {
    logger.error(
      { mainCharacterId, availableIds: characterIds },
      "主軸キャラクターがCHARACTER_IDSに含まれていません"
    );
    process.exit(1);
  }

  return characters;
}

/**
 * CharacterMapから主軸キャラクターを取得
 */
export function getMainCharacter(characters: CharacterMap): CharacterDefinition {
  for (const char of characters.values()) {
    if (char.isMain) {
      return char;
    }
  }
  throw new Error("主軸キャラクターが見つかりません");
}

/**
 * CharacterMapから全キャラクターの参照画像パスを取得
 */
export function getAllImagePaths(characters: CharacterMap): string[] {
  const allPaths: string[] = [];
  for (const char of characters.values()) {
    allPaths.push(...char.imagePaths);
  }
  return allPaths;
}
