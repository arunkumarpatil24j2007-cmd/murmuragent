// app/api/tools/route.ts — List available tools

import { NextRequest } from 'next/server';
import { initializeAgent } from '@/agent/agent';
import { toolRegistry } from '@/tools/registry';

export async function GET(_req: NextRequest) {
  try {
    await initializeAgent();
    const tools = toolRegistry.listTools();
    return Response.json({ tools, count: tools.length });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to list tools' },
      { status: 500 }
    );
  }
}
