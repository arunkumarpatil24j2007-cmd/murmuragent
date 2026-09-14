// app/api/auth/google/callback/route.ts — Google OAuth 2.0 Callback Handler

import { NextRequest, NextResponse } from 'next/server';
import { exchangeGoogleCode } from '@/lib/google-auth';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  // If user cancelled or Google returned an error
  if (error) {
    logger.warn('GoogleAuth', 'OAuth callback returned error', { error });
    const redirectUrl = new URL('/', req.url);
    redirectUrl.searchParams.set('google_auth', 'error');
    redirectUrl.searchParams.set('error_message', error);
    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    logger.error('GoogleAuth', 'OAuth callback missing authorization code');
    const redirectUrl = new URL('/', req.url);
    redirectUrl.searchParams.set('google_auth', 'error');
    redirectUrl.searchParams.set('error_message', 'Missing authorization code');
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const tokens = await exchangeGoogleCode(code);
    logger.info('GoogleAuth', 'Successfully connected Google Account', { email: tokens.user?.email });

    const state = url.searchParams.get('state');

    // If requested by the macOS desktop app, redirect directly back via deep link
    if (state === 'murmur_app' || state?.includes('murmur')) {
      const appUrl = new URL('murmur://google-auth');
      appUrl.searchParams.set('status', 'success');
      if (tokens.user?.email) appUrl.searchParams.set('email', tokens.user.email);
      if (tokens.user?.name) appUrl.searchParams.set('name', tokens.user.name);
      return NextResponse.redirect(appUrl.toString());
    }

    const redirectUrl = new URL('/', req.url);
    redirectUrl.searchParams.set('google_auth', 'success');
    if (tokens.user?.email) {
      redirectUrl.searchParams.set('email', tokens.user.email);
    }
    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    logger.error('GoogleAuth', 'Failed to exchange Google OAuth code', { error: String(err) });
    const state = url.searchParams.get('state');
    if (state === 'murmur_app' || state?.includes('murmur')) {
      return NextResponse.redirect('murmur://google-auth?status=error&error_message=Token+exchange+failed');
    }
    const redirectUrl = new URL('/', req.url);
    redirectUrl.searchParams.set('google_auth', 'error');
    redirectUrl.searchParams.set('error_message', err instanceof Error ? err.message : 'Token exchange failed');
    return NextResponse.redirect(redirectUrl);
  }
}
