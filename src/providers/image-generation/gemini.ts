import type { GeneratedImage } from "../../types/index.js";
import { ImageGenerationError } from "../../errors/base.js";
import type {
  ImageGenerationProvider,
  ImageGenerationInput,
  ReferenceImage,
} from "./interface.js";

interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
  error?: {
    message: string;
    code: number;
  };
}

export class GeminiProvider implements ImageGenerationProvider {
  private readonly apiKey: string;
  private readonly endpoint =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generate(input: ImageGenerationInput): Promise<GeneratedImage> {
    const parts: GeminiPart[] = [];

    // テキストプロンプトを追加
    parts.push({ text: input.prompt });

    // 参照画像を追加
    for (const ref of input.referenceImages) {
      parts.push({
        inlineData: {
          mimeType: ref.mimeType,
          data: ref.data.toString("base64"),
        },
      });
    }

    const requestBody = {
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          aspectRatio: input.aspectRatio,
        },
      },
    };

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new ImageGenerationError(
          `Gemini API error: ${response.status} ${response.statusText}`,
          { response: errorText }
        );
      }

      const data = (await response.json()) as GeminiResponse;

      if (data.error) {
        throw new ImageGenerationError(`Gemini API error: ${data.error.message}`, {
          code: data.error.code,
        });
      }

      // レスポンスから画像データを抽出
      const imagePart = data.candidates?.[0]?.content?.parts?.find(
        (part) => part.inlineData?.mimeType?.startsWith("image/")
      );

      if (!imagePart?.inlineData) {
        throw new ImageGenerationError("No image generated in response", {
          response: data,
        });
      }

      return {
        data: Buffer.from(imagePart.inlineData.data, "base64"),
        mimeType: imagePart.inlineData.mimeType,
        prompt: input.prompt,
        generatedAt: new Date(),
      };
    } catch (error) {
      if (error instanceof ImageGenerationError) {
        throw error;
      }
      throw new ImageGenerationError(
        `Failed to generate image: ${error instanceof Error ? error.message : "Unknown error"}`,
        { originalError: error }
      );
    }
  }
}

export async function loadReferenceImages(
  imagePaths: string[]
): Promise<ReferenceImage[]> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");

  const images: ReferenceImage[] = [];

  for (const imagePath of imagePaths) {
    try {
      const absolutePath = path.resolve(imagePath);
      const data = await fs.readFile(absolutePath);
      const ext = path.extname(imagePath).toLowerCase();

      let mimeType: string;
      switch (ext) {
        case ".png":
          mimeType = "image/png";
          break;
        case ".jpg":
        case ".jpeg":
          mimeType = "image/jpeg";
          break;
        case ".gif":
          mimeType = "image/gif";
          break;
        case ".webp":
          mimeType = "image/webp";
          break;
        default:
          mimeType = "image/png";
      }

      images.push({ data, mimeType });
    } catch (error) {
      throw new ImageGenerationError(`Failed to load reference image: ${imagePath}`, {
        originalError: error,
      });
    }
  }

  return images;
}
