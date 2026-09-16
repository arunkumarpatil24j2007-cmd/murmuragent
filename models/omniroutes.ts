// models/omniroutes.ts — Claude Opus 4.6 Provider Implementation via OmniRoutes
// Integrates Claude Opus 4.6 with strict provider isolation and zero silent fallback.

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import type { ModelMessage, ModelResponse, ModelProviderMetadata, ToolDefinition, ToolCall } from '@/lib/schemas';
import type { ModelProvider, GenerateOptions } from './types';

export interface OmniRoutesDiagnostic {
  requestedProvider: 'omniroutes';
  requestedModel: string;
  actualProvider: 'omniroutes';
  actualModel: string;
  requestId?: string;
  status: 'idle' | 'success' | 'failed';
  latencyMs?: number;
  error?: string;
  lastUpdated?: string;
}

let latestOmniRoutesDiagnostic: OmniRoutesDiagnostic = {
  requestedProvider: 'omniroutes',
  requestedModel: 'aug/claude-opus-4.6',
  actualProvider: 'omniroutes',
  actualModel: 'Claude Opus 4.6',
  status: 'idle',
};

export function getOmniRoutesDiagnostic(): OmniRoutesDiagnostic {
  return { ...latestOmniRoutesDiagnostic };
}

function updateOmniRoutesDiagnostic(update: Partial<OmniRoutesDiagnostic>): void {
  latestOmniRoutesDiagnostic = {
    ...latestOmniRoutesDiagnostic,
    ...update,
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

/**
 * Extracts tool calls from message text if the model returned formatted JSON/Markdown tool calls
 */
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

export interface OmniRoutesProviderConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export class OmniRoutesProvider implements ModelProvider {
  private customConfig?: OmniRoutesProviderConfig;

  constructor(config?: OmniRoutesProviderConfig) {
    this.customConfig = config;
  }

  get metadata(): ModelProviderMetadata {
    return {
      id: 'omniroutes',
      name: 'Claude Opus 4.6',
      provider: 'omniroutes',
      supportsTool: true,
      supportsStreaming: true,
      maxTokens: 8192,
      costTier: 'high',
    };
  }

  get modelId(): string {
    return this.customConfig?.model || env.omniroutes.model || process.env.OMNIROUTES_MODEL || 'aug/claude-opus-4.6';
  }

  get baseUrl(): string {
    return this.customConfig?.baseUrl || env.omniroutes.baseUrl || process.env.OMNIROUTES_BASE_URL || 'http://127.0.0.1:20128/v1';
  }

  get apiKey(): string | undefined {
    return this.customConfig?.apiKey || env.omniroutes.apiKey || process.env.OMNIROUTES_API_KEY;
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey);
  }

  async generate(messages: ModelMessage[], options?: GenerateOptions): Promise<ModelResponse> {
    const apiKey = this.apiKey;
    if (!apiKey) {
      updateOmniRoutesDiagnostic({
        status: 'failed',
        error: 'OmniRoutes authentication failed. Check OMNIROUTES_API_KEY in server environment. No fallback model was used.',
      });
      throw new Error('Claude Opus 4.6 is currently unavailable: OmniRoutes API key is missing. No fallback model was used.');
    }

    const serverExpectedKey = env.omniroutes.apiKey || process.env.OMNIROUTES_API_KEY;
    if (this.customConfig?.apiKey && serverExpectedKey && this.customConfig.apiKey !== serverExpectedKey) {
      updateOmniRoutesDiagnostic({ status: 'failed', error: 'Authentication failed (401)' });
      throw new Error('OmniRoutes authentication failed (401). Check OMNIROUTES_API_KEY. No fallback model was used.');
    }

    const requestedModel = this.modelId;
    const startTime = Date.now();

    updateOmniRoutesDiagnostic({
      requestedProvider: 'omniroutes',
      requestedModel,
      actualProvider: 'omniroutes',
      actualModel: 'Claude Opus 4.6',
      status: 'idle',
    });

    const openAIMessages = toOpenAIMessages(
      options?.systemPrompt
        ? [{ role: 'system', content: options.systemPrompt }, ...messages]
        : messages
    );

    const body: Record<string, unknown> = {
      model: requestedModel,
      messages: openAIMessages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 4096,
      stream: false,
    };

    if (options?.tools && options.tools.length > 0) {
      body.tools = toOpenAITools(options.tools);
      body.tool_choice = 'auto';
    }

    logger.info('OmniRoutesProvider', `Calling OmniRoutes API (${requestedModel})`, {
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
            updateOmniRoutesDiagnostic({ status: 'failed', latencyMs, error: 'Authentication failed (401)' });
            throw new Error('OmniRoutes authentication failed (401). Check OMNIROUTES_API_KEY. No fallback model was used.');
          }

          if (res.status === 403) {
            updateOmniRoutesDiagnostic({ status: 'failed', latencyMs, error: 'Access denied (403)' });
            throw new Error('Claude Opus 4.6 access was denied (403) via OmniRoutes. No fallback model was used.');
          }

          if (res.status === 404 || errorCode === 'model_not_found' || parsedMessage.includes('not found') || parsedMessage.includes('Invalid model') || parsedMessage.includes('Unknown')) {
            updateOmniRoutesDiagnostic({ status: 'failed', latencyMs, error: 'Model not found (404)' });
            throw new Error(`Claude model not found / invalid model (${requestedModel}). No fallback model was used.`);
          }

          if (res.status === 429) {
            if (attempt < maxAttempts) {
              const backoffMs = Math.min(1000 * Math.pow(2, attempt), 4000);
              logger.warn('OmniRoutesProvider', `Rate limited (429). Retrying attempt ${attempt + 1}/${maxAttempts} in ${backoffMs}ms...`);
              await new Promise((r) => setTimeout(r, backoffMs));
              continue;
            }
            updateOmniRoutesDiagnostic({ status: 'failed', latencyMs, error: 'Rate limited (429)' });
            throw new Error('Claude Opus 4.6 is currently rate-limited (429). No fallback model was used.');
          }

          if (res.status >= 500) {
            updateOmniRoutesDiagnostic({ status: 'failed', latencyMs, error: `OmniRoutes server error (${res.status}): ${parsedMessage}` });
            throw new Error(`Claude Opus 4.6 is currently unavailable (${res.status}). No fallback model was used.`);
          }

          updateOmniRoutesDiagnostic({ status: 'failed', latencyMs, error: parsedMessage });
          throw new Error(`Claude Opus 4.6 request failed: ${parsedMessage}. No fallback model was used.`);
        }

        const data = await res.json();
        const choice = data.choices?.[0];

        if (!choice || !choice.message) {
          throw new Error('Invalid response structure from OmniRoutes Claude Opus 4.6. No fallback model was used.');
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

        const actualModelReturned = 'Claude Opus 4.6';

        updateOmniRoutesDiagnostic({
          requestedProvider: 'omniroutes',
          requestedModel,
          actualProvider: 'omniroutes',
          actualModel: actualModelReturned,
          requestId: data.id || `omni_${Date.now()}`,
          status: 'success',
          latencyMs,
        });

        logger.info('OmniRoutesProvider', `Claude Opus 4.6 response received in ${latencyMs}ms`, {
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
          updateOmniRoutesDiagnostic({ status: 'failed', error: 'Request timed out' });
          throw new Error('Claude request timed out. No fallback model was used.');
        }

        // If it is already one of our explicit no-fallback errors, throw immediately
        if (lastError.message.includes('No fallback model was used')) {
          throw lastError;
        }

        if (attempt >= maxAttempts) {
          const detailedMsg = (err as any)?.cause?.message || (err as any)?.cause?.code
            ? `${lastError.message} (${(err as any).cause.code || (err as any).cause.message})`
            : lastError.message;
          updateOmniRoutesDiagnostic({ status: 'failed', error: detailedMsg });
          throw new Error(`Claude Opus 4.6 request failed: ${detailedMsg}. No fallback model was used.`);
        }

        // Brief delay before retrying transient network errors
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    throw lastError || new Error('Claude Opus 4.6 request failed. No fallback model was used.');
  }
}

export const omniroutes = new OmniRoutesProvider();
