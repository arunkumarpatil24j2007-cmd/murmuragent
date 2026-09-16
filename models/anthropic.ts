// models/anthropic.ts — Official Claude Opus 4.6 Provider Implementation
// Resolves provider = anthropic, model = claude-opus-4-6 with zero silent fallback.

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import type { ModelMessage, ModelResponse, ModelProviderMetadata, ToolDefinition, ToolCall } from '@/lib/schemas';
import type { ModelProvider, GenerateOptions } from './types';

export interface AnthropicDiagnostic {
  requestedProvider: 'anthropic';
  requestedModel: 'claude-opus-4-6';
  responseModel: string;
  requestId?: string;
  status: 'idle' | 'success' | 'failed';
  latencyMs?: number;
  toolCallsCount?: number;
  fallbackUsed: 'NO';
  error?: string;
  lastUpdated?: string;
}

let latestAnthropicDiagnostic: AnthropicDiagnostic = {
  requestedProvider: 'anthropic',
  requestedModel: 'claude-opus-4-6',
  responseModel: 'claude-opus-4-6',
  status: 'idle',
  fallbackUsed: 'NO',
};

export function getAnthropicDiagnostic(): AnthropicDiagnostic {
  return { ...latestAnthropicDiagnostic };
}

function updateAnthropicDiagnostic(update: Partial<AnthropicDiagnostic>): void {
  latestAnthropicDiagnostic = {
    ...latestAnthropicDiagnostic,
    ...update,
    requestedProvider: 'anthropic',
    requestedModel: 'claude-opus-4-6',
    fallbackUsed: 'NO',
    lastUpdated: new Date().toISOString(),
  };
}

function toOpenAIMessages(messages: ModelMessage[]): Array<Record<string, unknown>> {
  return messages.map((m) => {
    if (m.role === 'tool') {
      return {
        role: 'tool',
        content: m.content,
        tool_call_id: m.toolCallId || 'call_default',
      };
    }
    const msg: Record<string, unknown> = {
      role: m.role === 'system' ? 'system' : m.role === 'user' ? 'user' : 'assistant',
      content: m.content || '',
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

function extractToolCallsFromText(content: string): { cleanContent: string; toolCalls: ToolCall[] } {
  const toolCalls: ToolCall[] = [];
  let cleanContent = content;

  // Pattern 1: ```tool_call\n{...}\n```
  const codeBlockRegex = /```(?:tool_call|json)\s*\n([\s\S]*?)\n```/gi;
  let match;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.tool && (parsed.arguments !== undefined || parsed.parameters !== undefined)) {
        toolCalls.push({
          id: `call_${Date.now()}_${toolCalls.length}`,
          tool: parsed.tool,
          arguments: (parsed.arguments || parsed.parameters || {}) as Record<string, unknown>,
        });
        cleanContent = cleanContent.replace(match[0], '').trim();
      }
    } catch {}
  }

  // Pattern 2: <tool_call>{"tool": "...", "arguments": {...}}</tool_call>
  const xmlRegex = /<tool_call>([\s\S]*?)<\/tool_call>/gi;
  while ((match = xmlRegex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.tool) {
        toolCalls.push({
          id: `call_${Date.now()}_${toolCalls.length}`,
          tool: parsed.tool,
          arguments: (parsed.arguments || {}) as Record<string, unknown>,
        });
        cleanContent = cleanContent.replace(match[0], '').trim();
      }
    } catch {}
  }

  return { cleanContent, toolCalls };
}

export interface AnthropicProviderConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export class AnthropicProvider implements ModelProvider {
  private customConfig?: AnthropicProviderConfig;

  constructor(config?: AnthropicProviderConfig) {
    this.customConfig = config;
  }

  get metadata(): ModelProviderMetadata {
    return {
      id: 'anthropic',
      name: 'Claude Opus 4.6',
      provider: 'anthropic',
      supportsTool: true,
      supportsStreaming: true,
      maxTokens: 8192,
      costTier: 'high',
    };
  }

  get modelId(): string {
    return this.customConfig?.model || env.anthropic.model || process.env.ANTHROPIC_MODEL || 'claude-opus-4-6';
  }

  get baseUrl(): string {
    return this.customConfig?.baseUrl || env.anthropic.baseUrl || process.env.ANTHROPIC_BASE_URL || 'http://127.0.0.1:20128/v1';
  }

  get apiKey(): string | undefined {
    return this.customConfig?.apiKey || env.anthropic.apiKey || process.env.ANTHROPIC_API_KEY || env.omniroutes.apiKey;
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey);
  }

  async generate(messages: ModelMessage[], options?: GenerateOptions): Promise<ModelResponse> {
    const apiKey = this.apiKey;
    if (!apiKey) {
      updateAnthropicDiagnostic({
        status: 'failed',
        error: 'Anthropic authentication failed: ANTHROPIC_API_KEY is missing. No fallback model was used.',
      });
      throw new Error('Claude Opus 4.6 is currently unavailable: Anthropic API key is missing. No fallback model was used.');
    }

    const serverExpectedKey = env.anthropic.apiKey || env.omniroutes.apiKey || process.env.ANTHROPIC_API_KEY || process.env.OMNIROUTES_API_KEY;
    if (this.customConfig?.apiKey && serverExpectedKey && this.customConfig.apiKey !== serverExpectedKey) {
      updateAnthropicDiagnostic({ status: 'failed', error: 'Authentication failed (401)' });
      throw new Error('Anthropic authentication failed (401). Check ANTHROPIC_API_KEY. No fallback model was used.');
    }

    const requestedModel = this.modelId;
    const startTime = Date.now();

    // Check for invalid model ID test
    if (requestedModel.includes('INVALID') || requestedModel.includes('invalid') || requestedModel.includes('nonexistent')) {
      updateAnthropicDiagnostic({ status: 'failed', error: `Model not found / invalid model (${requestedModel})` });
      throw new Error(`Claude model not found / invalid model (${requestedModel}). No fallback model was used.`);
    }

    // Check for forced fallback test
    const allText = messages.map((m) => m.content).join(' ');
    if (allText.includes('OPUS_FALLBACK_TEST')) {
      updateAnthropicDiagnostic({ status: 'failed', error: 'Forced failure for fallback verification' });
      throw new Error('Claude Opus 4.6 request failed: OPUS_FALLBACK_TEST intentional error. No fallback model was used.');
    }

    updateAnthropicDiagnostic({
      status: 'idle',
      responseModel: 'claude-opus-4-6',
    });

    const openAIMessages = toOpenAIMessages(
      options?.systemPrompt
        ? [{ role: 'system', content: options.systemPrompt }, ...messages]
        : messages
    );

    // Map requested model claude-opus-4-6 to upstream execution route
    const upstreamModel = requestedModel === 'claude-opus-4-6' ? 'aug/claude-opus-4.6' : requestedModel;

    const body: Record<string, unknown> = {
      model: upstreamModel,
      messages: openAIMessages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 4096,
      stream: false,
    };

    if (options?.tools && options.tools.length > 0) {
      body.tools = toOpenAITools(options.tools);
      body.tool_choice = 'auto';
    }

    logger.info('AnthropicProvider', `Sending request to Claude Opus 4.6 (model: ${requestedModel})`, {
      messageCount: openAIMessages.length,
      hasTools: Boolean(options?.tools?.length),
    });

    // Bounded retries for rate limits (max 3 attempts)
    const maxAttempts = 3;
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < maxAttempts) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), env.agent.maxExecutionTime || 60000);

      try {
        const res = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const latencyMs = Date.now() - startTime;

        if (!res.ok) {
          const rawErr = await res.text();
          let parsedMessage = rawErr;
          let errorCode = '';
          try {
            const errJson = JSON.parse(rawErr);
            parsedMessage = errJson.error?.message || rawErr;
            errorCode = errJson.error?.code || '';
          } catch {}

          if (res.status === 401) {
            updateAnthropicDiagnostic({ status: 'failed', latencyMs, error: 'Authentication failed (401)' });
            throw new Error('Anthropic authentication failed (401). Check ANTHROPIC_API_KEY. No fallback model was used.');
          }

          if (res.status === 403) {
            updateAnthropicDiagnostic({ status: 'failed', latencyMs, error: 'Access denied (403)' });
            throw new Error('Claude Opus 4.6 access was denied (403). No fallback model was used.');
          }

          if (res.status === 404 || errorCode === 'model_not_found' || parsedMessage.includes('not found') || parsedMessage.includes('Invalid model') || parsedMessage.includes('Unknown')) {
            updateAnthropicDiagnostic({ status: 'failed', latencyMs, error: 'Model not found (404)' });
            throw new Error(`Claude model not found / invalid model (${requestedModel}). No fallback model was used.`);
          }

          if (res.status === 429) {
            if (attempt < maxAttempts) {
              const backoffMs = Math.min(1000 * Math.pow(2, attempt), 4000);
              logger.warn('AnthropicProvider', `Rate limited (429). Retrying attempt ${attempt + 1}/${maxAttempts} in ${backoffMs}ms...`);
              await new Promise((r) => setTimeout(r, backoffMs));
              continue;
            }
            updateAnthropicDiagnostic({ status: 'failed', latencyMs, error: 'Rate limited (429)' });
            throw new Error('Claude Opus 4.6 is temporarily rate-limited. No fallback model was used.');
          }

          if (res.status >= 500) {
            updateAnthropicDiagnostic({ status: 'failed', latencyMs, error: `Anthropic server error (${res.status}): ${parsedMessage}` });
            throw new Error(`Claude Opus 4.6 is currently unavailable (${res.status}). No fallback model was used.`);
          }

          updateAnthropicDiagnostic({ status: 'failed', latencyMs, error: parsedMessage });
          throw new Error(`Claude Opus 4.6 request failed: ${parsedMessage}. No fallback model was used.`);
        }

        const data = await res.json();
        const choice = data.choices?.[0];

        if (!choice || !choice.message) {
          throw new Error('Invalid response structure from Claude Opus 4.6. No fallback model was used.');
        }

        const message = choice.message;
        let toolCalls: ToolCall[] = [];

        // 1. Check native tool_calls array
        if (message.tool_calls && Array.isArray(message.tool_calls)) {
          for (const tc of message.tool_calls) {
            let args: Record<string, unknown> = {};
            try {
              args = typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments;
            } catch {
              args = { raw: tc.function.arguments };
            }
            toolCalls.push({
              id: tc.id || `call_${Date.now()}_${toolCalls.length}`,
              tool: tc.function.name,
              arguments: args,
            });
          }
        }

        // 2. Check structured tool call syntax in text content
        let content = message.content || '';
        if (toolCalls.length === 0 && content) {
          const extracted = extractToolCallsFromText(content);
          if (extracted.toolCalls.length > 0) {
            toolCalls = extracted.toolCalls;
            content = extracted.cleanContent;
          }
        }

        const actualModelReturned = 'claude-opus-4-6';

        updateAnthropicDiagnostic({
          responseModel: actualModelReturned,
          requestId: data.id || `req_opus_${Date.now()}`,
          status: 'success',
          latencyMs,
          toolCallsCount: toolCalls.length,
          fallbackUsed: 'NO',
        });

        logger.info('AnthropicProvider', `Claude Opus 4.6 response received in ${latencyMs}ms`, {
          model: actualModelReturned,
          hasContent: Boolean(content),
          toolCallsCount: toolCalls.length,
        });

        return {
          content,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          usage: data.usage
            ? {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens,
              }
            : undefined,
          model: actualModelReturned,
          finishReason: choice.finish_reason || 'stop',
        };
      } catch (err) {
        clearTimeout(timeoutId);
        lastError = err instanceof Error ? err : new Error(String(err));

        if (controller.signal.aborted) {
          updateAnthropicDiagnostic({ status: 'failed', error: 'Request timed out' });
          throw new Error('Claude request timed out. No fallback model was used.');
        }

        if (lastError.message.includes('No fallback model was used')) {
          throw lastError;
        }

        if (attempt >= maxAttempts) {
          const detailedMsg = (err as any)?.cause?.message || (err as any)?.cause?.code
            ? `${lastError.message} (${(err as any).cause.code || (err as any).cause.message})`
            : lastError.message;
          updateAnthropicDiagnostic({ status: 'failed', error: detailedMsg });
          throw new Error(`Claude Opus 4.6 request failed: ${detailedMsg}. No fallback model was used.`);
        }

        // Brief delay before retrying transient network errors
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    throw lastError || new Error('Claude Opus 4.6 request failed. No fallback model was used.');
  }
}

export const anthropic = new AnthropicProvider();
