// app/api/auth/session/route.ts — Returns active session for Desktop App & Web
// Strictly returns authenticated: false for unauthenticated / Incognito visitors.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-session';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json({
        authenticated: false,
        session: null,
      });
    }

    return NextResponse.json({
      authenticated: true,
      id: user.id,
      email: user.email,
      name: user.name || user.email.split('@')[0],
      picture: user.picture || null,
      provider: user.provider || 'murmur',
      user: {
        id: user.id,
        email: user.email,
        name: user.name || user.email.split('@')[0],
        picture: user.picture || null,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { authenticated: false, error: err instanceof Error ? err.message : 'Session check failed' },
      { status: 500 }
    );
  }
}
