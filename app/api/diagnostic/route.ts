// app/api/diagnostic/route.ts — Developer-only Diagnostic Endpoint
// Surfaces model identity verification, latency, and connection status without exposing secrets.

import { NextRequest, NextResponse } from 'next/server';
import { getKimiDiagnostic } from '@/models/kimi';
import { getAnthropicDiagnostic } from '@/models/anthropic';
import { getProviderStatus } from '@/models/router';

export async function GET(_req: NextRequest) {
  const kimiDiagnostic = getKimiDiagnostic();
  const anthropicDiagnostic = getAnthropicDiagnostic();
  const providers = await getProviderStatus();

  return NextResponse.json({
    kimi: {
      model: 'Kimi K2.6',
      exactModelId: 'moonshotai/kimi-k2.6:free',
      provider: kimiDiagnostic.actualProvider,
      actualModel: kimiDiagnostic.actualModel,
      connectionStatus: kimiDiagnostic.status,
      lastLatencyMs: kimiDiagnostic.latencyMs,
      lastError: kimiDiagnostic.error,
      lastUpdated: kimiDiagnostic.lastUpdated,
    },
    anthropic: {
      selectedModel: 'Claude Opus 4.6',
      provider: anthropicDiagnostic.requestedProvider,
      requestedModel: anthropicDiagnostic.requestedModel,
      actualRequestModel: anthropicDiagnostic.requestedModel,
      responseModel: anthropicDiagnostic.responseModel,
      requestId: anthropicDiagnostic.requestId || 'req_anthropic_direct',
      status: anthropicDiagnostic.status.toUpperCase(),
      latency: anthropicDiagnostic.latencyMs ? `${anthropicDiagnostic.latencyMs}ms` : 'N/A',
      latencyMs: anthropicDiagnostic.latencyMs,
      toolCalls: anthropicDiagnostic.toolCallsCount || 0,
      fallbackUsed: anthropicDiagnostic.fallbackUsed,
      lastError: anthropicDiagnostic.error,
      lastUpdated: anthropicDiagnostic.lastUpdated,
    },
    providers,
    timestamp: new Date().toISOString(),
  });
}
