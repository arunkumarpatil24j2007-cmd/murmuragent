// app/api/chat/route.ts — Main chat endpoint
// Streams agent events to the client using Server-Sent Events

import { NextRequest } from 'next/server';
import { v4 as uuid } from 'uuid';
import { processMessage, processChatMessage } from '@/agent/agent';
import { ChatRequestSchema } from '@/lib/schemas';
import type { AgentEvent } from '@/lib/schemas';
import { getAuthenticatedUser } from '@/lib/auth-session';
import { historyStore } from '@/lib/history-store';

export const maxDuration = 300; // 5 minutes

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const userId = user?.id || null;

    const body = await req.json();
    const parsed = ChatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { message, conversationId: inputConvId, model, mode, history } = parsed.data;
    const conversationId = inputConvId || uuid();

    // Create a ReadableStream for SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (event: AgentEvent) => {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          try {
            controller.enqueue(encoder.encode(data));
          } catch {
            // Stream may have been closed
          }
        };

        try {
          // Persist user prompt if authenticated
          if (userId) {
            historyStore.addMessage(userId, conversationId, 'user', message).catch(() => {});
          }

          if (mode === 'chat') {
            const chatResult = await processChatMessage(message, conversationId, emit, model, history, req.signal);

            if (userId) {
              historyStore.addMessage(userId, conversationId, 'assistant', chatResult.content, { model: chatResult.model, mode: 'chat' }).catch(() => {});
            }

            const finalEvent = {
              type: 'final_response' as const,
              timestamp: new Date().toISOString(),
              data: {
                conversationId,
                content: chatResult.content,
                model: chatResult.model,
                mode: 'chat',
              },
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalEvent)}\n\n`));
          } else {
            const result = await processMessage(message, conversationId, emit, model, req.signal, userId);

            if (userId) {
              historyStore.addMessage(userId, conversationId, 'assistant', result.content, { model: result.model, mode: 'agent', taskId: result.taskState.id }).catch(() => {});
            }

            // Send final message
            const finalEvent = {
              type: 'final_response' as const,
              timestamp: new Date().toISOString(),
              data: {
                conversationId,
                content: result.content,
                model: result.model,
                taskId: result.taskState.id,
                mode: 'agent',
              },
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalEvent)}\n\n`));
          }
        } catch (err) {
          const errorEvent = {
            type: 'agent_error' as const,
            timestamp: new Date().toISOString(),
            data: {
              error: err instanceof Error ? err.message : 'Unknown error',
            },
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Conversation-Id': conversationId,
      },
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
