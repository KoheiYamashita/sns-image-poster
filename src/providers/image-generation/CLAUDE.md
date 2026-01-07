# providers/image-generation/

画像生成プロバイダー。

## ファイル

- `interface.ts` - `ImageGenerationProvider`インターフェース
- `gemini.ts` - Gemini Imagen実装
- `index.ts` - エクスポート

## ImageGenerationProvider インターフェース

```typescript
interface ImageGenerationProvider {
  generateImage(prompt: string): Promise<GeneratedImage>;
}
```

## GeminiImageProvider

Gemini APIの`imagen-3.0-generate-002`モデルを使用。

### 機能
- テキストプロンプトから画像生成
- アスペクト比設定（`IMAGE_ASPECT_RATIO`環境変数）
- Base64エンコード画像を返却

### 使用方法

```typescript
import { GeminiImageProvider } from "./providers/image-generation/index.js";

const provider = new GeminiImageProvider();
const image = await provider.generateImage("猫がソファで寝ている");
// image.data: Buffer, image.mimeType: string
```
