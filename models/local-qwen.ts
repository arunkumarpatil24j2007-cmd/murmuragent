// models/local-qwen.ts — Local Qwen 3.5 Model Provider via Ollama
// All inference runs 100% locally on macOS. Zero cloud leakage.

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import type { ModelMessage, ModelResponse, ModelProviderMetadata, ToolDefinition } from '@/lib/schemas';
import type { ModelProvider, GenerateOptions } from './types';

function toOpenAIMessages(messages: ModelMessage[]): Array<Record<string, unknown>> {
  return messages.map((m) => {
    if (m.role === 'tool') {
      return {
        role: 'tool',
        content: m.content,
        tool_call_id: m.toolCallId || '',
        name: m.toolName || '',
      };
    }
    const msg: Record<string, unknown> = {
      role: m.role === 'system' ? 'system' : m.role === 'user' ? 'user' : 'assistant',
      content: m.content || (m.toolCalls && m.toolCalls.length > 0 ? null : ''),
    };
    if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
      msg.tool_calls = m.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.tool,
          arguments: typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments),
        },
      }));
    }
    return msg;
  });
}

function toOpenAITools(tools: ToolDefinition[]): Array<Record<string, unknown>> {
  return tools.map((toolObj) => {
    const t = (toolObj as any).definition || toolObj;
    let parametersSchema: Record<string, unknown>;

    if (t.parameters && typeof t.parameters === 'object' && !Array.isArray(t.parameters) && 'properties' in t.parameters) {
      parametersSchema = t.parameters;
    } else if (Array.isArray(t.parameters)) {
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const p of t.parameters) {
        properties[p.name] = {
          type: p.type,
          description: p.description,
          ...(p.enum ? { enum: p.enum } : {}),
        };
        if (p.required) required.push(p.name);
      }
      parametersSchema = {
        type: 'object',
        properties,
        required,
      };
    } else {
      parametersSchema = {
        type: 'object',
        properties: {},
        required: [],
      };
    }

    return {
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: parametersSchema,
      },
    };
  });
}

export class LocalQwenProvider implements ModelProvider {
  readonly metadata: ModelProviderMetadata = {
    id: 'local',
    name: 'Local — Qwen 3.5',
    provider: 'ollama',
    supportsTool: true,
    supportsStreaming: true,
    maxTokens: 8192,
    costTier: 'low',
  };

  get baseUrl(): string {
    return (env.local.baseUrl || 'http://127.0.0.1:11434/v1').replace(/\/+$/, '');
  }

  get modelName(): string {
    return env.local.model || 'qwen3.5:latest';
  }

  get providerName(): string {
    return env.local.provider || 'ollama';
  }

  /**
   * Probe the local Ollama instance to check if it's reachable and the model is loaded
   */
  async isAvailable(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/models`;
      const res = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });

      if (!res.ok) return false;
      const data = await res.json();
      const models = data?.data;
      if (Array.isArray(models)) {
        return models.some((m: { id?: string }) => m.id === this.modelName || m.id?.includes('qwen'));
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Execute chat completion locally via Ollama's OpenAI-compatible endpoint
   */
  async generate(messages: ModelMessage[], options?: GenerateOptions): Promise<ModelResponse> {
    const endpoint = `${this.baseUrl}/chat/completions`;
    const model = this.modelName;

    const formattedMessages = toOpenAIMessages(
      options?.systemPrompt
        ? [{ role: 'system', content: options.systemPrompt }, ...messages]
        : messages
    );

    const body: Record<string, unknown> = {
      model,
      messages: formattedMessages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 4096,
    };

    if (options?.tools && options.tools.length > 0) {
      body.tools = toOpenAITools(options.tools);
      body.tool_choice = 'auto';
    }

    logger.debug('LocalQwenProvider', 'Calling Local Qwen API', {
      endpoint,
      model,
      toolsCount: options?.tools?.length ?? 0,
      messagesCount: formattedMessages.length,
    });

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      throw new Error(
        `Local Qwen is unavailable at ${this.baseUrl} (${msg}). Please ensure Ollama is running on your Mac and model '${model}' is loaded.`
      );
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Local Qwen API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const message = choice?.message;

    if (message?.reasoning) {
      logger.debug('LocalQwenProvider', 'Qwen Reasoning Trace', {
        snippet: String(message.reasoning).slice(0, 150) + '...',
      });
    }

    const toolCalls = message?.tool_calls?.map(
      (tc: { id: string; function: { name: string; arguments: string | Record<string, unknown> } }) => {
        let parsedArgs: Record<string, unknown> = {};
        if (typeof tc.function.arguments === 'string') {
          try {
            parsedArgs = JSON.parse(tc.function.arguments);
          } catch {
            parsedArgs = {};
          }
        } else if (typeof tc.function.arguments === 'object' && tc.function.arguments !== null) {
          parsedArgs = tc.function.arguments as Record<string, unknown>;
        }

        return {
          id: tc.id,
          tool: tc.function.name,
          arguments: parsedArgs,
        };
      }
    );

    return {
      content: message?.content || '',
      toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
      model,
      finishReason: choice?.finish_reason === 'tool_calls' ? 'tool_calls' : 'stop',
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens ?? 0,
            completionTokens: data.usage.completion_tokens ?? 0,
            totalTokens: data.usage.total_tokens ?? 0,
          }
        : undefined,
    };
  }
}
