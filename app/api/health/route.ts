// app/api/health/route.ts — Health check endpoint

import { NextRequest } from 'next/server';
import { isProviderConfigured } from '@/lib/env';
import { getProviderStatus } from '@/models/router';
import { getMCPStatus } from '@/mcp/registry';
import type { HealthStatus } from '@/lib/schemas';

export async function GET(_req: NextRequest) {
  const providers = await getProviderStatus();
  const mcpStatus = getMCPStatus();

  const nvidiaStatus = providers.find((p) => p.id === 'nvidia');
  const geminiStatus = providers.find((p) => p.id === 'gemini');
  const localStatus = providers.find((p) => p.id === 'local');

  const health: HealthStatus = {
    status: 'ok',
    providers: {
      nvidia: {
        configured: isProviderConfigured('nvidia'),
        status: nvidiaStatus?.available ? 'available' : 'not configured',
      },
      gemini: {
        configured: isProviderConfigured('gemini'),
        status: geminiStatus?.available ? 'available' : 'not configured',
      },
      local: {
        configured: isProviderConfigured('local'),
        status: localStatus?.available ? 'available' : 'not connected',
      },
      airtop: {
        configured: isProviderConfigured('airtop'),
        status: isProviderConfigured('airtop') ? 'configured' : 'not configured',
      },
      palmier: {
        configured: isProviderConfigured('palmier'),
        status: mcpStatus.connected ? `connected (${mcpStatus.toolCount} tools)` : 'not connected',
      },
      notion: {
        configured: isProviderConfigured('notion'),
        status: isProviderConfigured('notion') ? 'configured' : 'not configured',
      },
      vercel: {
        configured: isProviderConfigured('vercel'),
        status: isProviderConfigured('vercel') ? 'configured' : 'not configured',
      },
    },
    timestamp: new Date().toISOString(),
  };

  // Determine overall status
  if (!nvidiaStatus?.available && !geminiStatus?.available) {
    health.status = 'error';
  } else if (!isProviderConfigured('airtop') || !mcpStatus.connected) {
    health.status = 'degraded';
  }

  return Response.json(health);
}
