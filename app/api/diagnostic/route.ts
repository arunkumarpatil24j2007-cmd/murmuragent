// app/api/diagnostic/route.ts — Developer-only Diagnostic Endpoint
// Surfaces model identity verification, latency, and connection status without exposing secrets.

import { NextRequest, NextResponse } from 'next/server';
import { getKimiDiagnostic } from '@/models/kimi';
import { getProviderStatus } from '@/models/router';

export async function GET(_req: NextRequest) {
  const kimiDiagnostic = getKimiDiagnostic();
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
    providers,
    timestamp: new Date().toISOString(),
  });
}
