// app/api/sessions/route.ts — User-scoped agent sessions API

import { NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-session';
import { historyStore } from '@/lib/history-store';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return Response.json({ authenticated: false, sessions: [] });
    }

    const sessions = await historyStore.getUserSessions(user.id);
    return Response.json({
      authenticated: true,
      sessions,
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('id');
    if (!sessionId) {
      return Response.json({ error: 'Session ID required' }, { status: 400 });
    }

    await historyStore.deleteSession(user.id, sessionId);
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
