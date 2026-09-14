// app/api/agent/route.ts — Direct non-streaming Agent execution and status endpoint

import { NextRequest } from 'next/server';
import { v4 as uuid } from 'uuid';
import { processMessage, initializeAgent } from '@/agent/agent';
import { ChatRequestSchema } from '@/lib/schemas';
import { getProviderStatus } from '@/models/router';
import { toolRegistry } from '@/tools/registry';

export const maxDuration = 300; // 5 minutes

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ChatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { message, conversationId: inputConvId, model } = parsed.data;
    const conversationId = inputConvId || uuid();

    const events: unknown[] = [];
    const emit = (event: unknown) => {
      events.push(event);
    };

    const result = await processMessage(message, conversationId, emit, model);

    return Response.json({
      success: true,
      conversationId,
      content: result.content,
      model: result.model,
      taskId: result.taskState.id,
      events,
      taskState: result.taskState,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(_req: NextRequest) {
  try {
    await initializeAgent();
    const providers = await getProviderStatus();
    const tools = toolRegistry.listTools();

    return Response.json({
      status: 'ready',
      models: providers,
      toolsCount: tools.length,
      tools: tools.map((t) => ({ name: t.name, description: t.description, source: t.source, permission: t.permission })),
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Agent status check failed' },
      { status: 500 }
    );
  }
}
