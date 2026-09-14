// models/router.ts — Intelligent Auto-Router with Credit Exhaustion / Quota Failover Circuit

import { logger } from '@/lib/logger';
import type { ModelProvider, GenerateOptions } from './types';
import type { ModelMessage, ModelResponse } from '@/lib/schemas';
import { NvidiaProvider } from './nvidia';
import { GeminiProvider } from './gemini';
import { OpenAIProvider } from './openai';
import { LocalQwenProvider } from './local-qwen';

const gemini = new GeminiProvider();
const nvidia = new NvidiaProvider();
const openai = new OpenAIProvider();
const local = new LocalQwenProvider();

/** All registered providers */
export const allProviders: ModelProvider[] = [gemini, nvidia, openai, local];

export type ModelPreference = 'auto' | 'gemini' | 'nvidia' | 'openai' | 'local' | 'qwen' | string;

export interface ProviderHealth {
  id: string;
  isExhausted: boolean;
  reason?: string;
  exhaustedUntil?: number;
  consecutiveErrors: number;
}

const providerHealthMap = new Map<string, ProviderHealth>([
  ['gemini', { id: 'gemini', isExhausted: false, consecutiveErrors: 0 }],
  ['nvidia', { id: 'nvidia', isExhausted: false, consecutiveErrors: 0 }],
  ['openai', { id: 'openai', isExhausted: false, consecutiveErrors: 0 }],
  ['local', { id: 'local', isExhausted: false, consecutiveErrors: 0 }],
]);

/**
 * Mark a provider as credit exhausted, rate-limited, or degraded.
 */
export function markProviderExhausted(providerId: string, reason: string, cooldownMs = 60000): void {
  const health = providerHealthMap.get(providerId) || { id: providerId, isExhausted: false, consecutiveErrors: 0 };
  health.isExhausted = true;
  health.reason = reason;
  health.exhaustedUntil = Date.now() + cooldownMs;
  health.consecutiveErrors++;
  providerHealthMap.set(providerId, health);
  logger.warn('ModelRouter', `Provider [${providerId}] marked EXHAUSTED/DEGRADED: ${reason}. Cooldown for ${cooldownMs / 1000}s`);
}

/**
 * Check if a provider is currently healthy and not in credit exhaustion cooldown.
 */
export function isProviderHealthy(providerId: string): boolean {
  const health = providerHealthMap.get(providerId);
  if (!health) return true;
  if (health.isExhausted && health.exhaustedUntil) {
    if (Date.now() > health.exhaustedUntil) {
      health.isExhausted = false;
      health.reason = undefined;
      health.consecutiveErrors = 0;
      return true;
    }
    return false;
  }
  return true;
}

/**
 * Automatically determine the optimal model provider based on task context and prompt.
 */
export async function autoSelectProvider(taskPrompt: string): Promise<ModelProvider> {
  const text = taskPrompt.toLowerCase();

  // 1. Check which providers are configured with API keys or local endpoint
  const available: ModelProvider[] = [];
  for (const p of [gemini, nvidia, openai, local]) {
    if (await p.isAvailable()) {
      available.push(p);
    }
  }

  if (available.length === 0) {
    throw new Error('No model providers are available. Please configure GEMINI_API_KEY, NVIDIA_API_KEY, or ensure Ollama is running locally.');
  }

  // Filter for healthy providers not currently exhausted
  const healthy = available.filter((p) => isProviderHealthy(p.metadata.id));
  const candidatePool = healthy.length > 0 ? healthy : available; // Fallback to all available if all are marked exhausted

  // 2. Task classification
  const isToolHeavy = /deploy|vercel|notion|sheet|spreadsheet|table|excel|email|gmail|inbox|database/i.test(text);
  const isVisionOrBrowser = /browse|website|url|web|screenshot|extract|page|navigate/i.test(text);

  if (isVisionOrBrowser || isToolHeavy) {
    // Gemini has top multimodal & tool reliability; Nvidia/Local as secondary
    const preferred = candidatePool.find((p) => p.metadata.id === 'gemini') ||
                      candidatePool.find((p) => p.metadata.id === 'nvidia') ||
                      candidatePool.find((p) => p.metadata.id === 'local') ||
                      candidatePool[0];
    logger.info('ModelRouter', `Auto-selected provider [${preferred.metadata.id}] for task-type: ${isVisionOrBrowser ? 'vision/browser' : 'tool-heavy'}`);
    return preferred;
  }

  // Fast general reasoning
  const primary = candidatePool.find((p) => p.metadata.id === 'gemini') ||
                  candidatePool.find((p) => p.metadata.id === 'nvidia') ||
                  candidatePool.find((p) => p.metadata.id === 'local') ||
                  candidatePool[0];
  logger.info('ModelRouter', `Auto-selected provider [${primary.metadata.id}] for general task`);
  return primary;
}

/**
 * Select the best available model provider (with manual override support or auto-routing).
 */
export async function selectProvider(preference: ModelPreference = 'auto', taskPrompt = ''): Promise<ModelProvider> {
  const normPref = (preference || 'auto').toLowerCase();

  if (normPref === 'auto') {
    return autoSelectProvider(taskPrompt);
  }

  // Explicit Local preference — STRICT PRIVACY: NEVER fall back to cloud providers
  if (normPref === 'local' || normPref === 'qwen' || normPref.includes('ollama') || normPref.includes('qwen')) {
    const isAvail = await local.isAvailable();
    if (!isAvail) {
      throw new Error(
        `Local Qwen model (${local.modelName}) is unavailable at ${local.baseUrl}. Please ensure Ollama is running on your Mac. (Cloud fallback is disabled to preserve 100% local privacy).`
      );
    }
    return local;
  }

  // Explicit cloud preferences
  let targetProvider: ModelProvider | undefined;
  if (normPref.includes('gpt') || normPref.includes('openai')) {
    targetProvider = openai;
  } else if (normPref.includes('gemini') || normPref.includes('google')) {
    targetProvider = gemini;
  } else if (normPref.includes('nvidia') || normPref.includes('nemotron') || normPref.includes('llama')) {
    targetProvider = nvidia;
  } else {
    targetProvider = allProviders.find((p) => p.metadata.id.toLowerCase() === normPref);
  }

  if (targetProvider && (await targetProvider.isAvailable()) && isProviderHealthy(targetProvider.metadata.id)) {
    return targetProvider;
  }

  logger.warn('ModelRouter', `Requested provider "${preference}" unavailable or exhausted, auto-routing`);
  return autoSelectProvider(taskPrompt);
}

/**
 * Check whether an error is caused by credit exhaustion, quota limit, rate limiting, or auth.
 */
export function isCreditOrQuotaError(error: unknown): { isQuota: boolean; reason: string } {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();

  if (msg.includes('402') || msg.includes('payment') || msg.includes('credit') || msg.includes('insufficient_quota') || msg.includes('billing')) {
    return { isQuota: true, reason: 'Credit exhausted / Payment required (HTTP 402)' };
  }
  if (msg.includes('429') || msg.includes('too many requests') || msg.includes('quota') || msg.includes('rate limit') || msg.includes('resource_exhausted')) {
    return { isQuota: true, reason: 'Rate limit / Quota exceeded (HTTP 429)' };
  }
  if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('invalid api key')) {
    return { isQuota: true, reason: 'Authentication failed / Invalid key (HTTP 401)' };
  }
  if (msg.includes('404') && (msg.includes('not found') || msg.includes('not available'))) {
    return { isQuota: true, reason: 'Model endpoint unavailable (HTTP 404)' };
  }

  return { isQuota: false, reason: 'General error' };
}

/**
 * Execute a model completion with automatic multi-provider failover.
 * If the primary provider fails due to credit exhaustion, rate limit, or error,
 * it instantly and transparently switches to the next available provider.
 */
export async function executeWithFailover(
  messages: ModelMessage[],
  options?: GenerateOptions,
  initialProvider?: ModelProvider,
  taskPrompt = '',
  onFailover?: (fromProvider: string, toProvider: string, reason: string) => void
): Promise<{ response: ModelResponse; providerUsed: ModelProvider }> {
  let currentProvider = initialProvider || (await autoSelectProvider(taskPrompt));

  // STRICT PRIVACY ISOLATION:
  // When executing with Local Qwen, never route or fail over to cloud providers (Gemini or NVIDIA).
  if (currentProvider.metadata.id === 'local') {
    try {
      logger.info('ModelRouter', `Executing generation locally with [${currentProvider.metadata.id}] (Isolated local run)`);
      const response = await currentProvider.generate(messages, options);
      return { response, providerUsed: currentProvider };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('ModelRouter', `Local provider execution failed: ${msg}`);
      throw new Error(`Local model execution failed: ${msg}. (Requests explicitly routed to Local Qwen are never failed over to cloud providers for privacy).`);
    }
  }

  // Determine fallback order excluding the first provider
  const allAvailable: ModelProvider[] = [];
  for (const p of [gemini, nvidia, openai, local]) {
    if (await p.isAvailable()) {
      allAvailable.push(p);
    }
  }

  const providersToTry = [
    currentProvider,
    ...allAvailable.filter((p) => p.metadata.id !== currentProvider.metadata.id),
  ];

  let lastError: Error | null = null;

  for (let i = 0; i < providersToTry.length; i++) {
    const provider = providersToTry[i];
    try {
      logger.info('ModelRouter', `Executing generation with provider [${provider.metadata.id}] (attempt ${i + 1}/${providersToTry.length})`);
      const response = await provider.generate(messages, options);
      return { response, providerUsed: provider };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const { isQuota, reason } = isCreditOrQuotaError(err);

      if (isQuota) {
        markProviderExhausted(provider.metadata.id, reason);
      }

      logger.warn('ModelRouter', `Provider [${provider.metadata.id}] failed: ${lastError.message}`);

      // If there is another provider to try, initiate failover
      const nextProvider = providersToTry[i + 1];
      if (nextProvider) {
        logger.warn('ModelRouter', `>>> FAILING OVER from [${provider.metadata.id}] to [${nextProvider.metadata.id}] <<<`);
        onFailover?.(provider.metadata.id, nextProvider.metadata.id, reason);
      }
    }
  }

  throw new Error(`All available model providers failed. Last error: ${lastError?.message || 'Unknown error'}`);
}

/** Get all providers and their availability & health status */
export async function getProviderStatus(): Promise<Array<{ id: string; name: string; available: boolean; healthy: boolean; reason?: string }>> {
  const status = [];
  for (const provider of allProviders) {
    const available = await provider.isAvailable();
    const healthy = isProviderHealthy(provider.metadata.id);
    const health = providerHealthMap.get(provider.metadata.id);
    status.push({
      id: provider.metadata.id,
      name: provider.metadata.name,
      available,
      healthy,
      reason: health?.reason,
    });
  }
  return status;
}

export { gemini, nvidia, openai, local };
