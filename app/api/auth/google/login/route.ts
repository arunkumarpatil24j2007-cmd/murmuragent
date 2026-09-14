// app/api/auth/google/login/route.ts — Initiate Google Workspace OAuth 2.0 flow

import { NextRequest, NextResponse } from 'next/server';
import { generateGoogleAuthUrl, generateOAuthState } from '@/lib/google-auth';
import { env } from '@/lib/env';

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
    // Generate signed, expiring CSRF state
    const { stateParam, cookieValue } = generateOAuthState();
    const authUrl = generateGoogleAuthUrl(stateParam, customRedirect);

    // If caller explicitly requested JSON format (e.g. for popup window flow)
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
