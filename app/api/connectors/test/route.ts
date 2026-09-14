// app/api/connectors/test/route.ts — Live ping & verification test for Cloud Connectors

import { NextRequest, NextResponse } from 'next/server';
import { connectorsStore, type ConnectorId } from '@/lib/connectors-store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { connectorId } = body as { connectorId: ConnectorId };

    if (!connectorId) {
      return NextResponse.json({ error: 'Missing connectorId' }, { status: 400 });
    }

    const testResult = await connectorsStore.testConnector(connectorId);
    return NextResponse.json(testResult);
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        latencyMs: 0,
        message: err instanceof Error ? err.message : 'Ping test failed',
      },
      { status: 500 }
    );
  }
}
