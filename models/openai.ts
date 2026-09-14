// models/openai.ts — OpenAI provider implementation (GPT-4o, GPT-5, etc.)

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

function toOpenAITools(tools: ToolDefinition[]): Array<Record<string, unknown>> {
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

export class OpenAIProvider implements ModelProvider {
  readonly metadata: ModelProviderMetadata = {
    id: 'openai',
    name: 'GPT 5.5',
    provider: 'openai',
    supportsTool: true,
    supportsStreaming: true,
    maxTokens: 8192,
    costTier: 'high',
  };

  async isAvailable(): Promise<boolean> {
    return !!process.env.OPENAI_API_KEY;
  }

  async generate(messages: ModelMessage[], options?: GenerateOptions): Promise<ModelResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const modelName = process.env.OPENAI_MODEL || 'gpt-4o';
    const body: Record<string, unknown> = {
      model: modelName,
      messages: toOpenAIMessages(
        options?.systemPrompt
          ? [{ role: 'system', content: options.systemPrompt }, ...messages]
          : messages
      ),
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 4096,
    };

    if (options?.tools && options.tools.length > 0) {
      body.tools = toOpenAITools(options.tools);
      body.tool_choice = 'auto';
    }

    logger.debug('OpenAIProvider', 'Calling OpenAI API', { model: modelName });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const message = choice?.message;

    return {
      content: message?.content || '',
      toolCalls: message?.tool_calls?.map((tc: { id: string; function: { name: string; arguments: string } }) => ({
        id: tc.id,
        tool: tc.function.name,
        arguments: JSON.parse(tc.function.arguments || '{}'),
      })),
      model: modelName,
      finishReason: choice?.finish_reason === 'tool_calls' ? 'tool_calls' : 'stop',
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
    };
  }
}
