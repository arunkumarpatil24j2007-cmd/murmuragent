// models/types.ts — Model provider interface

import type { ModelMessage, ModelResponse, ModelProviderMetadata, ToolDefinition } from '@/lib/schemas';

export interface ModelProvider {
  readonly metadata: ModelProviderMetadata;

  /** Generate a response given conversation messages and optionally available tools */
  generate(
    messages: ModelMessage[],
    options?: GenerateOptions
  ): Promise<ModelResponse>;

  /** Check if this provider is available (API key configured, reachable) */
  isAvailable(): Promise<boolean>;
}

export interface GenerateOptions {
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}
