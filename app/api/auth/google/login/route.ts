// app/api/auth/google/login/route.ts — Initiate Google Workspace OAuth 2.0 flow
// Encodes existing userId into CSRF state if user is already logged in and connecting Google.

import { NextRequest, NextResponse } from 'next/server';
import { generateGoogleAuthUrl, generateOAuthState } from '@/lib/google-auth';
import { env } from '@/lib/env';
import { getAuthenticatedUser } from '@/lib/auth-session';

export async function GET(req: NextRequest) {
  if (!env.google.clientId || !env.google.clientSecret) {
    return NextResponse.json(
      {
        error: 'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your environment.',
        configured: false,
      },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const customRedirect = searchParams.get('redirect_uri') || undefined;
  const format = searchParams.get('format');
  const returnTo = searchParams.get('return_to') || '/?tab=connectors';

  try {
    // Check if user is already authenticated
    const currentUser = await getAuthenticatedUser(req);
    const userId = currentUser?.id || searchParams.get('userId') || undefined;

    // Generate signed, expiring CSRF state containing optional userId
    const { stateParam, cookieValue } = generateOAuthState(userId);
    const authUrl = generateGoogleAuthUrl(stateParam, customRedirect);

    // If caller explicitly requested JSON format
    if (format === 'json' || req.headers.get('accept')?.includes('application/json')) {
      const response = NextResponse.json({ url: authUrl });
      response.cookies.set('murmur_google_oauth_state', cookieValue, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 600, // 10 minutes
      });
      response.cookies.set('murmur_auth_return_to', returnTo, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 600,
      });
      return response;
    }

    // Default: Redirect user directly to Google consent screen
    const response = NextResponse.redirect(authUrl);
    response.cookies.set('murmur_google_oauth_state', cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600, // 10 minutes
    });
    response.cookies.set('murmur_auth_return_to', returnTo, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    });
    return response;
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to generate auth URL: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
