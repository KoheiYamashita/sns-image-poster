export type WorkflowStep =
  | "topic_fetch"
  | "character_selection"
  | "story_generation"
  | "image_generation"
  | "quality_check"
  | "post_format"
  | "sns_post"
  | "manga_story_generation"
  | "manga_image_generation"
  | "manga_quality_check";

export abstract class WorkflowBaseError extends Error {
  abstract readonly step: WorkflowStep;
  readonly timestamp: Date;
  readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.details = details;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      step: this.step,
      message: this.message,
      timestamp: this.timestamp.toISOString(),
      details: this.details,
      stack: this.stack,
    };
  }
}

export class TopicFetchError extends WorkflowBaseError {
  readonly step = "topic_fetch" as const;
}

export class TopicListEmptyError extends WorkflowBaseError {
  readonly step = "topic_fetch" as const;
}

export class StoryGenerationError extends WorkflowBaseError {
  readonly step = "story_generation" as const;
}

export class ImageGenerationError extends WorkflowBaseError {
  readonly step = "image_generation" as const;
}

export class QualityCheckError extends WorkflowBaseError {
  readonly step = "quality_check" as const;
}

export class PostFormatError extends WorkflowBaseError {
  readonly step = "post_format" as const;
}

export class SNSPostError extends WorkflowBaseError {
  readonly step = "sns_post" as const;
}

export class MangaStoryGenerationError extends WorkflowBaseError {
  readonly step = "manga_story_generation" as const;
}

export class MangaImageGenerationError extends WorkflowBaseError {
  readonly step = "manga_image_generation" as const;
}

export class MangaQualityCheckError extends WorkflowBaseError {
  readonly step = "manga_quality_check" as const;
}

export class CharacterSelectionError extends WorkflowBaseError {
  readonly step = "character_selection" as const;
}

// 設定エラー（ワークフローとは別系統）
export class ConfigError extends Error {
  readonly timestamp: Date;
  readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.details = details;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      timestamp: this.timestamp.toISOString(),
      details: this.details,
      stack: this.stack,
    };
  }
}

export class PresetLoadError extends ConfigError {}
export class PresetValidationError extends ConfigError {}
