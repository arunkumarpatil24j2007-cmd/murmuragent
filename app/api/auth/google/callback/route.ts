import { NextRequest, NextResponse } from 'next/server';
import { exchangeGoogleCode, validateOAuthState } from '@/lib/google-auth';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const stateParam = url.searchParams.get('state');

  const stateCookie = req.cookies.get('murmur_google_oauth_state')?.value;
  const returnTo = req.cookies.get('murmur_auth_return_to')?.value || '/?tab=connectors';

  // 1. If user cancelled or Google returned an error
  if (error) {
    logger.warn('GoogleAuth', 'OAuth callback returned error', { error });
    const redirectUrl = new URL(returnTo, req.url);
    redirectUrl.searchParams.set('google_auth', error === 'access_denied' ? 'cancelled' : 'error');
    redirectUrl.searchParams.set(
      'error_message',
      error === 'access_denied' ? 'Google connection cancelled' : error
    );
    const res = NextResponse.redirect(redirectUrl);
    res.cookies.delete('murmur_google_oauth_state');
    res.cookies.delete('murmur_auth_return_to');
    return res;
  }

  // 2. Validate CSRF State (CRITICAL for security)
  // Accept standard flow where state matches cookie, or legacy development murmur_app state
  const isDevMurmurState = stateParam === 'murmur_app' || stateParam === 'murmur_auth_flow';
  const isValidState = isDevMurmurState || validateOAuthState(stateParam, stateCookie);

  if (!isValidState) {
    logger.error('GoogleAuth', 'OAuth callback rejected: Invalid or expired state', {
      hasStateParam: !!stateParam,
      hasStateCookie: !!stateCookie,
    });
    const redirectUrl = new URL(returnTo, req.url);
    redirectUrl.searchParams.set('google_auth', 'error');
    redirectUrl.searchParams.set('error_message', 'Invalid or expired OAuth state');
    const res = NextResponse.redirect(redirectUrl);
    res.cookies.delete('murmur_google_oauth_state');
    res.cookies.delete('murmur_auth_return_to');
    return res;
  }

  // 3. Verify Code presence
  if (!code) {
    logger.error('GoogleAuth', 'OAuth callback missing authorization code');
    const redirectUrl = new URL(returnTo, req.url);
    redirectUrl.searchParams.set('google_auth', 'error');
    redirectUrl.searchParams.set('error_message', 'Missing authorization code');
    const res = NextResponse.redirect(redirectUrl);
    res.cookies.delete('murmur_google_oauth_state');
    res.cookies.delete('murmur_auth_return_to');
    return res;
  }

  // 4. Exchange code for access & refresh tokens
  try {
    const tokens = await exchangeGoogleCode(code);
    logger.info('GoogleAuth', 'Successfully connected Google Account', { email: tokens.user?.email });

    // If requested by the macOS desktop app, redirect directly back via deep link
    if (stateParam === 'murmur_app') {
      const appUrl = new URL('murmur://google-auth');
      appUrl.searchParams.set('status', 'success');
      if (tokens.user?.email) appUrl.searchParams.set('email', tokens.user.email);
      if (tokens.user?.name) appUrl.searchParams.set('name', tokens.user.name);
      return NextResponse.redirect(appUrl.toString());
    }

    const redirectUrl = new URL(returnTo, req.url);
    redirectUrl.searchParams.set('google_auth', 'success');
    redirectUrl.searchParams.set('tab', 'connectors');
    if (tokens.user?.email) {
      redirectUrl.searchParams.set('email', tokens.user.email);
    }

    const res = NextResponse.redirect(redirectUrl);
    res.cookies.delete('murmur_google_oauth_state');
    res.cookies.delete('murmur_auth_return_to');
    return res;
  } catch (err) {
    logger.error('GoogleAuth', 'Failed to exchange Google OAuth code', { error: String(err) });
    const redirectUrl = new URL(returnTo, req.url);
    redirectUrl.searchParams.set('google_auth', 'error');
    redirectUrl.searchParams.set('error_message', err instanceof Error ? err.message : 'Token exchange failed');
    const res = NextResponse.redirect(redirectUrl);
    res.cookies.delete('murmur_google_oauth_state');
    res.cookies.delete('murmur_auth_return_to');
    return res;
  }
}
