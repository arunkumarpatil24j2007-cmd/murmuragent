// models/gemini.ts — Google Gemini provider implementation

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import type { ModelMessage, ModelResponse, ModelProviderMetadata, ToolDefinition, ToolCall } from '@/lib/schemas';
import type { ModelProvider, GenerateOptions } from './types';

function toGeminiContents(messages: ModelMessage[]): Array<Record<string, unknown>> {
  const contents: Array<Record<string, unknown>> = [];

  for (const m of messages) {
    if (m.role === 'system') continue; // handled separately

    if (m.role === 'tool') {
      contents.push({
        role: 'user',
        parts: [{
          functionResponse: {
            name: (m.toolName || m.toolCallId || 'unknown').replace(/\./g, '__'),
            response: { result: m.content },
          },
        }],
      });
      continue;
    }

    if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
      contents.push({
        role: 'model',
        parts: [
          ...(m.content ? [{ text: m.content }] : []),
          ...m.toolCalls.map((tc) => ({
            functionCall: {
              name: tc.tool.replace(/\./g, '__'),
              args: tc.arguments,
            },
            ...(tc.thoughtSignature ? { thoughtSignature: tc.thoughtSignature } : {}),
          })),
        ],
      });
      continue;
    }

    contents.push({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    });
  }

  return contents;
}

function toGeminiTools(tools: ToolDefinition[]): Array<Record<string, unknown>> {
  return [{
    functionDeclarations: tools.map((t) => {
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const p of t.parameters) {
        const pType = p.type.toUpperCase();
        properties[p.name] = {
          type: pType === 'ARRAY' ? 'ARRAY' : pType,
          description: p.description,
          ...(pType === 'ARRAY' ? { items: { type: 'STRING' } } : {}),
          ...(p.enum ? { enum: p.enum } : {}),
        };
        if (p.required) required.push(p.name);
      }
      return {
        name: t.name.replace(/\./g, '__'),
        description: t.description,
        parameters: {
          type: 'OBJECT',
          properties,
          required,
        },
      };
    }),
  }];
}

export class GeminiProvider implements ModelProvider {
  readonly metadata: ModelProviderMetadata = {
    id: 'gemini',
    name: env.gemini.model,
    provider: 'gemini',
    supportsTool: true,
    supportsStreaming: true,
    maxTokens: 8192,
    costTier: 'low',
  };

  async isAvailable(): Promise<boolean> {
    return !!env.gemini.apiKey;
  }

  async generate(messages: ModelMessage[], options?: GenerateOptions): Promise<ModelResponse> {
    if (!env.gemini.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const systemInstruction = options?.systemPrompt ||
      messages.find((m) => m.role === 'system')?.content;

    const contents = toGeminiContents(messages.filter((m) => m.role !== 'system'));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options?.temperature ?? 0.3,
        maxOutputTokens: options?.maxTokens ?? 8192,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    if (options?.tools && options.tools.length > 0) {
      body.tools = toGeminiTools(options.tools);
    }

    const candidateModels = [
      env.gemini.model,
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3-flash-preview',
    ].filter((m, i, arr) => Boolean(m) && arr.indexOf(m) === i);

    let lastError: Error | null = null;
    let successfulModel = env.gemini.model;
    let data: any = null;

    for (const modelTag of candidateModels) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelTag}:generateContent?key=${env.gemini.apiKey}`;
      logger.debug('GeminiProvider', 'Calling Gemini API', { model: modelTag });

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        data = await response.json();
        successfulModel = modelTag;
        break;
      }

      const errText = await response.text();
      lastError = new Error(`Gemini API error (${response.status}) on ${modelTag}: ${errText}`);
      if (response.status === 401 || response.status === 403) {
        // Fatal authentication error
        throw lastError;
      }
      logger.warn('GeminiProvider', `Model ${modelTag} returned ${response.status}, trying fallback tag...`);
    }

    if (!data) {
      throw lastError || new Error('No response from Gemini API');
    }

    const candidate = data.candidates?.[0];
    if (!candidate) {
      throw new Error('No response from Gemini API');
    }

    let content = '';
    const toolCalls: ToolCall[] = [];

    for (const part of candidate.content?.parts || []) {
      if (part.text) {
        content += part.text;
      }
      if (part.functionCall) {
        toolCalls.push({
          id: part.functionCall.id || `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          tool: (part.functionCall.name || '').replace(/__/g, '.'),
          arguments: part.functionCall.args || {},
          thoughtSignature: part.thoughtSignature,
        });
      }
    }

    const hasToolCalls = toolCalls.length > 0;

    return {
      content,
      toolCalls: hasToolCalls ? toolCalls : undefined,
      model: successfulModel,
      finishReason: hasToolCalls ? 'tool_calls' : 'stop',
      usage: data.usageMetadata ? {
        promptTokens: data.usageMetadata.promptTokenCount || 0,
        completionTokens: data.usageMetadata.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata.totalTokenCount || 0,
      } : undefined,
    };
  }
}
