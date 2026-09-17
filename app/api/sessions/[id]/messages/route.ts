// app/api/sessions/[id]/messages/route.ts — User-scoped session messages API

import { NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-session';
import { historyStore } from '@/lib/history-store';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id: sessionId } = await params;
    if (!sessionId) {
      return Response.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const messages = await historyStore.getSessionMessages(user.id, sessionId);
    return Response.json({
      success: true,
      sessionId,
      messages,
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
