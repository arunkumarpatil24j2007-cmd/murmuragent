// models/kimi.ts — Kimi K2.6 Provider Implementation (OpenRouter OpenAI-compatible API)
// Integrates moonshotai/kimi-k2.6:free with strict provider isolation and zero silent fallback.

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import type { ModelMessage, ModelResponse, ModelProviderMetadata, ToolDefinition, ToolCall } from '@/lib/schemas';
import type { ModelProvider, GenerateOptions } from './types';

export interface KimiDiagnostic {
  requestedProvider: 'kimi';
  requestedModel: string;
  actualProvider: 'kimi';
  actualModel: string;
  requestId?: string;
  status: 'idle' | 'success' | 'failed';
  latencyMs?: number;
  error?: string;
  lastUpdated?: string;
}

let latestKimiDiagnostic: KimiDiagnostic = {
  requestedProvider: 'kimi',
  requestedModel: 'moonshotai/kimi-k2.6:free',
  actualProvider: 'kimi',
  actualModel: 'moonshotai/kimi-k2.6:free',
  status: 'idle',
};

export function getKimiDiagnostic(): KimiDiagnostic {
  return { ...latestKimiDiagnostic };
}

function updateKimiDiagnostic(update: Partial<KimiDiagnostic>): void {
  latestKimiDiagnostic = {
    ...latestKimiDiagnostic,
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

export interface KimiProviderConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export class KimiProvider implements ModelProvider {
  private customConfig?: KimiProviderConfig;

  constructor(config?: KimiProviderConfig) {
    this.customConfig = config;
  }

  get metadata(): ModelProviderMetadata {
    return {
      id: 'kimi',
      name: this.modelId,
      provider: 'kimi',
      supportsTool: true,
      supportsStreaming: true,
      maxTokens: 8192,
      costTier: 'low',
    };
  }

  get modelId(): string {
    return this.customConfig?.model || env.kimi.model || process.env.KIMI_MODEL || 'moonshotai/kimi-k2.6';
  }

  get baseUrl(): string {
    return this.customConfig?.baseUrl || env.kimi.baseUrl || process.env.KIMI_BASE_URL || 'https://openrouter.ai/api/v1';
  }

  get apiKey(): string | undefined {
    return this.customConfig?.apiKey || env.kimi.apiKey || process.env.KIMI_API_KEY;
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async generate(messages: ModelMessage[], options?: GenerateOptions): Promise<ModelResponse> {
    const apiKey = this.apiKey;
    if (!apiKey) {
      updateKimiDiagnostic({
        status: 'failed',
        error: 'Kimi authentication failed. Check KIMI_API_KEY and the configured Kimi provider.',
      });
      throw new Error('Kimi authentication failed. Check KIMI_API_KEY and the configured Kimi provider.');
    }

    const requestedModel = this.modelId;
    const startTime = Date.now();

    updateKimiDiagnostic({
      requestedProvider: 'kimi',
      requestedModel,
      actualProvider: 'kimi',
      actualModel: requestedModel,
      status: 'idle',
    });

    const openAIMessages = toOpenAIMessages(
      options?.systemPrompt
        ? [{ role: 'system', content: options.systemPrompt }, ...messages]
        : messages
    );

    const body: Record<string, unknown> = {
      model: requestedModel,
      // Pass candidate models for OpenRouter free/paid slug routing
      models: requestedModel.endsWith(':free')
        ? [requestedModel, requestedModel.replace(':free', '')]
        : [requestedModel],
      messages: openAIMessages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 2048,
    };

    if (options?.tools && options.tools.length > 0) {
      body.tools = toOpenAITools(options.tools);
      body.tool_choice = 'auto';
    }

    logger.info('KimiProvider', `Calling Kimi API (${requestedModel})`, {
      messageCount: openAIMessages.length,
      hasTools: !!options?.tools?.length,
    });

    // Bounded retries for rate limits / temporary server errors (max 3 attempts)
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
            'HTTP-Referer': 'https://murmur.agent',
            'X-Title': 'Murmur Agent',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const latencyMs = Date.now() - startTime;

        if (!res.ok) {
          const rawErr = await res.text();
          let parsedMessage = rawErr;
          try {
            const errJson = JSON.parse(rawErr);
            parsedMessage = errJson.error?.message || rawErr;
          } catch {}

          // Specific status handling
          if (res.status === 401) {
            updateKimiDiagnostic({ status: 'failed', latencyMs, error: 'Authentication failed (401)' });
            throw new Error('Kimi authentication failed. Check KIMI_API_KEY and the configured Kimi provider.');
          }

          if (res.status === 403) {
            updateKimiDiagnostic({ status: 'failed', latencyMs, error: 'Access denied (403)' });
            throw new Error('Kimi access was denied. Verify that this API key has access to the selected Kimi model.');
          }

          if (res.status === 404) {
            // Check if model was rejected
            logger.error('KimiProvider', 'Endpoint/Model 404', {
              model: requestedModel,
              endpoint: `${this.baseUrl}/chat/completions`,
            });
            updateKimiDiagnostic({ status: 'failed', latencyMs, error: 'Model or endpoint not found (404)' });
            throw new Error(`Kimi model or endpoint was not found. Verify the exact model identifier (${requestedModel}) and API endpoint.`);
          }

          if (res.status === 429) {
            if (attempt < maxAttempts) {
              const backoffMs = Math.min(1000 * Math.pow(2, attempt), 6000);
              logger.warn('KimiProvider', `Rate limited (429). Retrying attempt ${attempt + 1}/${maxAttempts} in ${backoffMs}ms...`);
              await new Promise((r) => setTimeout(r, backoffMs));
              continue;
            }
            updateKimiDiagnostic({ status: 'failed', latencyMs, error: 'Rate limited (429)' });
            throw new Error('Kimi is currently rate-limited. Please retry after the provider\'s rate limit resets.');
          }

          if (res.status >= 500) {
            if (attempt < maxAttempts) {
              const backoffMs = 1500 * attempt;
              logger.warn('KimiProvider', `Temporary server error (${res.status}). Retrying attempt ${attempt + 1}/${maxAttempts}...`);
              await new Promise((r) => setTimeout(r, backoffMs));
              continue;
            }
            updateKimiDiagnostic({ status: 'failed', latencyMs, error: `Server error (${res.status})` });
            throw new Error('Kimi provider returned a temporary server error. No fallback model was used.');
          }

          // 400 Bad Request
          updateKimiDiagnostic({ status: 'failed', latencyMs, error: `Bad request (${res.status})` });
          throw new Error(`Kimi request error (${res.status}): ${parsedMessage}`);
        }

        const data = await res.json();
        const choice = data.choices?.[0];
        if (!choice) {
          throw new Error('Kimi returned an empty choices array.');
        }

        const message = choice.message;
        const toolCalls: ToolCall[] = [];

        if (message.tool_calls && Array.isArray(message.tool_calls)) {
          for (const tc of message.tool_calls) {
            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(tc.function.arguments);
            } catch {
              args = { raw: tc.function.arguments };
            }
            toolCalls.push({
              id: tc.id || `call_${Date.now()}`,
              tool: tc.function.name,
              arguments: args,
            });
          }
        }

        // Clean content (extract reasoning if present)
        let content = message.content || '';
        if (!content && message.reasoning && toolCalls.length === 0) {
          content = message.reasoning;
        }

        const actualModelReturned = data.model || requestedModel;

        updateKimiDiagnostic({
          requestedProvider: 'kimi',
          requestedModel,
          actualProvider: 'kimi',
          actualModel: actualModelReturned,
          requestId: data.id,
          status: 'success',
          latencyMs,
        });

        logger.info('KimiProvider', `Kimi response received in ${latencyMs}ms`, {
          model: actualModelReturned,
          hasContent: !!content,
          toolCallsCount: toolCalls.length,
        });

        return {
          content,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          usage: data.usage ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          } : undefined,
          model: actualModelReturned,
          finishReason: choice.finish_reason || 'stop',
        };
      } catch (err) {
        clearTimeout(timeoutId);
        lastError = err instanceof Error ? err : new Error(String(err));

        if (controller.signal.aborted) {
          updateKimiDiagnostic({ status: 'failed', error: 'Request timed out' });
          throw new Error('Kimi request timed out. No fallback model was used.');
        }

        // If it's already one of our formatted errors, throw immediately without further retries
        if (
          lastError.message.includes('Kimi authentication failed') ||
          lastError.message.includes('Kimi access was denied') ||
          lastError.message.includes('Kimi model or endpoint was not found') ||
          lastError.message.includes('Kimi request error')
        ) {
          throw lastError;
        }

        if (attempt >= maxAttempts) {
          updateKimiDiagnostic({ status: 'failed', error: lastError.message });
          throw lastError;
        }
      }
    }

    throw lastError || new Error('Kimi request failed. No fallback model was used.');
  }
}

export const kimi = new KimiProvider();
