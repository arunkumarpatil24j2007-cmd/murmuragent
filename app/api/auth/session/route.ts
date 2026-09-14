// app/api/auth/session/route.ts — Returns active Google / Murmur session for Desktop App & Web

import { NextRequest, NextResponse } from 'next/server';
import { tokenStore } from '@/lib/token-store';

export async function GET(_req: NextRequest) {
  try {
    const tokens = await tokenStore.getTokens();
    if (!tokens || !tokens.user?.email) {
      return NextResponse.json({
        authenticated: false,
        session: null,
      });
    }

    return NextResponse.json({
      authenticated: true,
      email: tokens.user.email,
      name: tokens.user.name || 'Arunkumar Patil',
      picture: tokens.user.picture || null,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      scopes: tokens.scope ? tokens.scope.split(' ') : [],
    });
  } catch (err) {
    return NextResponse.json(
      { authenticated: false, error: err instanceof Error ? err.message : 'Session check failed' },
      { status: 500 }
    );
  }
}
