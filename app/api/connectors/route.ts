// app/api/connectors/route.ts — User-Scoped API endpoint for Cloud Connectors
// Lists user-scoped connectors, updates configuration/tokens, and toggles enabled status.
// Unauthenticated requests see all personal connectors as disconnected.

import { NextRequest, NextResponse } from 'next/server';
import { connectorsStore, type ConnectorId } from '@/lib/connectors-store';
import { initializeAgent } from '@/agent/agent';
import { getAuthenticatedUser } from '@/lib/auth-session';

export async function GET(req: NextRequest) {
  try {
    await initializeAgent();
    const user = await getAuthenticatedUser(req);
    const connectors = await connectorsStore.getAllConnectors(user?.id);
    const connectedCount = connectors.filter((c) => c.isConnected).length;
    const enabledCount = connectors.filter((c) => c.isConnected && c.isEnabled).length;

    return NextResponse.json({
      connectors,
      total: connectors.length,
      connected: connectedCount,
      enabled: enabledCount,
      isAuthenticated: !!user,
      userId: user?.id || null,
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
    const user = await getAuthenticatedUser(req);
    if (!user || !user.id) {
      return NextResponse.json(
        { error: 'Please log in to Murmur to manage and configure your connectors.' },
        { status: 401 }
      );
    }

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
      await connectorsStore.disconnectConnector(connectorId, user.id);
      return NextResponse.json({ success: true, message: `Disconnected ${connectorId}` });
    }

    if (action === 'toggle') {
      await connectorsStore.updateConnector(connectorId, user.id, { enabled: !!enabled });
      return NextResponse.json({
        success: true,
        message: `${enabled ? 'Enabled' : 'Disabled'} ${connectorId}`,
      });
    }

    // Default update (token or metadata)
    await connectorsStore.updateConnector(connectorId, user.id, {
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
