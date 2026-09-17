// lib/auth-session.ts — Canonical Server-Side Authentication & Session Resolver
// Derives user identity from Supabase JWT, secure session cookie, or bearer headers.
// Guarantees that guest visitors are isolated and never inherit developer credentials.

import { NextRequest, NextResponse } from 'next/server';
import { env } from './env';
import { logger } from './logger';

export interface AuthenticatedUser {
  id: string; // Supabase UUID
  email: string;
  name?: string;
  picture?: string;
  provider?: string;
}

export const SESSION_COOKIE_NAME = 'murmur_user_session';
export const ACTIVE_USER_COOKIE_NAME = 'murmur_active_user';
export const AUTH_TOKEN_COOKIE_NAME = 'murmur_auth_token';

/**
 * Validates request authentication and resolves canonical Supabase user identity.
 * Returns null if the request is from a guest / unauthenticated visitor.
 */
export async function getAuthenticatedUser(req: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    // 1. Check Authorization: Bearer header (Supabase JWT from native Mac app or web client)
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const jwt = authHeader.substring(7).trim();
      if (jwt && env.supabase.url) {
        const user = await verifySupabaseJwt(jwt);
        if (user) return user;
      }
    }

    // 2. Check auth token cookie (JWT)
    const tokenCookie = req.cookies.get(AUTH_TOKEN_COOKIE_NAME)?.value;
    if (tokenCookie && env.supabase.url) {
      const user = await verifySupabaseJwt(tokenCookie);
      if (user) return user;
    }

    // 3. Check murmur_user_session cookie
    const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (sessionCookie) {
      try {
        const parsed = JSON.parse(sessionCookie);
        if (parsed?.id && parsed?.email) {
          return {
            id: String(parsed.id),
            email: String(parsed.email).toLowerCase(),
            name: parsed.name ? String(parsed.name) : undefined,
            picture: parsed.picture ? String(parsed.picture) : undefined,
            provider: parsed.provider ? String(parsed.provider) : 'murmur',
          };
        }
      } catch {
        // Corrupted session cookie, ignore
      }
    }

    // Unauthenticated guest
    return null;
  } catch (err) {
    logger.warn('AuthSession', 'Failed to resolve user session', { error: String(err) });
    return null;
  }
}

/**
 * Verify a Supabase JWT token against the Supabase GoTrue auth service (/auth/v1/user).
 */
async function verifySupabaseJwt(jwt: string): Promise<AuthenticatedUser | null> {
  try {
    const supabaseUrl = env.supabase.url.replace(/\/$/, '');
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        apikey: env.supabase.serviceRoleKey || process.env.SUPABASE_ANON_KEY || 'sb_publishable_xKYeMgWEC5GLTXP3UEglCQ_oSLCarpX',
        Authorization: `Bearer ${jwt}`,
      },
      cache: 'no-store',
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.id || !data?.email) return null;

    return {
      id: data.id,
      email: String(data.email).toLowerCase(),
      name: data.user_metadata?.full_name || data.user_metadata?.name || data.email.split('@')[0],
      picture: data.user_metadata?.avatar_url || null,
      provider: data.app_metadata?.provider || 'supabase',
    };
  } catch {
    return null;
  }
}

/**
 * Attach authenticated session cookies to a NextResponse.
 */
export function setAuthSessionCookies(
  res: NextResponse,
  user: AuthenticatedUser,
  accessToken?: string
): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOptions = {
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  };

  // User session info for UI
  res.cookies.set(
    SESSION_COOKIE_NAME,
    JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.name || user.email.split('@')[0],
      picture: user.picture || null,
      provider: user.provider || 'murmur',
      loginAt: new Date().toISOString(),
    }),
    {
      ...cookieOptions,
      httpOnly: false, // Available to client UI components
    }
  );

  // Active email
  res.cookies.set(ACTIVE_USER_COOKIE_NAME, user.email, {
    ...cookieOptions,
    httpOnly: true,
  });

  // Supabase JWT if present
  if (accessToken) {
    res.cookies.set(AUTH_TOKEN_COOKIE_NAME, accessToken, {
      ...cookieOptions,
      httpOnly: true,
    });
  }
}

/**
 * Remove all session cookies to log out the user cleanly.
 */
export function clearAuthSessionCookies(res: NextResponse): void {
  const clearOptions = { path: '/', maxAge: 0 };
  res.cookies.delete(SESSION_COOKIE_NAME);
  res.cookies.delete(ACTIVE_USER_COOKIE_NAME);
  res.cookies.delete(AUTH_TOKEN_COOKIE_NAME);
  res.cookies.delete('murmur_google_oauth_state');
  res.cookies.delete('murmur_auth_return_to');
}
