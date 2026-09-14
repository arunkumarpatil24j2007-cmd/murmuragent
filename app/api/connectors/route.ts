// app/api/connectors/route.ts — API endpoint for Cloud Connectors
// Lists all connectors, updates configuration/tokens, and toggles enabled status.

import { NextRequest, NextResponse } from 'next/server';
import { connectorsStore, type ConnectorId } from '@/lib/connectors-store';
import { initializeAgent } from '@/agent/agent';

export async function GET(_req: NextRequest) {
  try {
    await initializeAgent();
    const connectors = await connectorsStore.getAllConnectors();
    const connectedCount = connectors.filter((c) => c.isConnected).length;
    const enabledCount = connectors.filter((c) => c.isConnected && c.isEnabled).length;

    return NextResponse.json({
      connectors,
      total: connectors.length,
      connected: connectedCount,
      enabled: enabledCount,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load connectors' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, connectorId, enabled, token, metadata } = body as {
      action: 'update' | 'disconnect' | 'toggle';
      connectorId: ConnectorId;
      enabled?: boolean;
      token?: string;
      metadata?: {
        accountLabel?: string;
        accountEmail?: string;
        accountAvatar?: string;
      };
    };

    if (!connectorId) {
      return NextResponse.json({ error: 'Missing connectorId' }, { status: 400 });
    }

    if (action === 'disconnect') {
      await connectorsStore.disconnectConnector(connectorId);
      return NextResponse.json({ success: true, message: `Disconnected ${connectorId}` });
    }

    if (action === 'toggle') {
      await connectorsStore.updateConnector(connectorId, { enabled: !!enabled });
      return NextResponse.json({
        success: true,
        message: `${enabled ? 'Enabled' : 'Disabled'} ${connectorId}`,
      });
    }

    // Default update (token or metadata)
    await connectorsStore.updateConnector(connectorId, {
      enabled: enabled !== undefined ? enabled : true,
      token,
      metadata,
    });

    return NextResponse.json({ success: true, message: `Updated ${connectorId}` });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update connector' },
      { status: 500 }
    );
  }
}
