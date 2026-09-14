// models/nvidia.ts — NVIDIA NIM / API provider implementation

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import type { ModelMessage, ModelResponse, ModelProviderMetadata, ToolDefinition, ToolCall } from '@/lib/schemas';
import type { ModelProvider, GenerateOptions } from './types';

function toNvidiaMessages(messages: ModelMessage[]): Array<Record<string, unknown>> {
  return messages.map((m) => {
    if (m.role === 'tool') {
      return {
        role: 'tool',
        content: m.content,
        tool_call_id: m.toolCallId || '',
      };
    }
    const msg: Record<string, unknown> = {
      role: m.role === 'system' ? 'system' : m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    };
    if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
      msg.tool_calls = m.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.tool,
          arguments: JSON.stringify(tc.arguments),
        },
      }));
    }
    return msg;
  });
}

function toNvidiaTools(tools: ToolDefinition[]): Array<Record<string, unknown>> {
  return tools.map((t) => {
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
    return {
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: {
          type: 'object',
          properties,
          required,
        },
      },
    };
  });
}

export class NvidiaProvider implements ModelProvider {
  readonly metadata: ModelProviderMetadata = {
    id: 'nvidia',
    name: env.nvidia.model,
    provider: 'nvidia',
    supportsTool: true,
    supportsStreaming: true,
    maxTokens: 4096,
    costTier: 'medium',
  };

  async isAvailable(): Promise<boolean> {
    return !!env.nvidia.apiKey;
  }

  async generate(messages: ModelMessage[], options?: GenerateOptions): Promise<ModelResponse> {
    if (!env.nvidia.apiKey) {
      throw new Error('NVIDIA API key not configured');
    }

    const body: Record<string, unknown> = {
      model: env.nvidia.model,
      messages: toNvidiaMessages(
        options?.systemPrompt
          ? [{ role: 'system', content: options.systemPrompt }, ...messages]
          : messages
      ),
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 4096,
    };

    if (options?.tools && options.tools.length > 0) {
      body.tools = toNvidiaTools(options.tools);
      body.tool_choice = 'auto';
    }

    logger.debug('NvidiaProvider', 'Calling NVIDIA API', { model: env.nvidia.model });

    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.nvidia.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error('NvidiaProvider', 'NVIDIA API error', { status: response.status, body: errText });
      throw new Error(`NVIDIA API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    if (!choice) {
      throw new Error('No response from NVIDIA API');
    }

    const toolCalls: ToolCall[] = [];
    if (choice.message?.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        toolCalls.push({
          id: tc.id,
          tool: tc.function.name,
          arguments: typeof tc.function.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : tc.function.arguments,
        });
      }
    }

    return {
      content: choice.message?.content || '',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      model: env.nvidia.model,
      finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : 'stop',
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
    };
  }
}
