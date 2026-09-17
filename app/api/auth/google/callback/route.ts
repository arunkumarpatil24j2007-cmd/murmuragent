// app/api/auth/google/callback/route.ts — Google OAuth 2.0 Callback Handler
// Exchanges code, binds tokens to the canonical Supabase userId, and issues secure session cookies.

import { NextRequest, NextResponse } from 'next/server';
import { exchangeGoogleCode, validateOAuthState } from '@/lib/google-auth';
import { logger } from '@/lib/logger';
import { setAuthSessionCookies } from '@/lib/auth-session';
import { env } from '@/lib/env';
import { v4 as uuid } from 'uuid';

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
    res.cookies.delete('murmur_google_redirect_uri');
    return res;
  }

  // 2. Validate CSRF State
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
    res.cookies.delete('murmur_google_redirect_uri');
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
    res.cookies.delete('murmur_google_redirect_uri');
    return res;
  }

  // Extract optional userId from stateParam if encoded
  let stateUserId: string | undefined;
  if (stateParam && stateParam.includes('.')) {
    try {
      const payloadStr = stateParam.split('.')[0];
      const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
      if (payload?.userId) stateUserId = String(payload.userId);
    } catch {}
  }

  // Determine effective callback URI matching the login initialization
  const redirectUriCookie = req.cookies.get('murmur_google_redirect_uri')?.value;
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.host;
  const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  const detectedOrigin = `${proto}://${host}`;
  const effectiveCallbackUri =
    redirectUriCookie || (!host.includes('localhost') ? `${detectedOrigin}/api/auth/google/callback` : undefined);

  // 4. Exchange code for access & refresh tokens
  try {
    const tokens = await exchangeGoogleCode(code, effectiveCallbackUri, stateUserId);
    logger.info('GoogleAuth', 'Successfully connected Google Account', { email: tokens.user?.email });

    const userEmail = tokens.user?.email ? tokens.user.email.toLowerCase() : null;
    let canonicalUserId = stateUserId;

    // Resolve Supabase user ID from public.profiles if not in state
    if (!canonicalUserId && userEmail && env.supabase.url && env.supabase.serviceRoleKey) {
      const supabaseBase = env.supabase.url.replace(/\/$/, '');
      try {
        const profileRes = await fetch(
          `${supabaseBase}/rest/v1/profiles?email=eq.${encodeURIComponent(userEmail)}&select=id,display_name,avatar_url&limit=1`,
          {
            headers: {
              apikey: env.supabase.serviceRoleKey,
              Authorization: `Bearer ${env.supabase.serviceRoleKey}`,
            },
            cache: 'no-store',
          }
        );

        if (profileRes.ok) {
          const profiles = await profileRes.json();
          if (Array.isArray(profiles) && profiles.length > 0) {
            canonicalUserId = profiles[0].id;
          }
        }
      } catch (e) {
        logger.warn('GoogleAuth', 'Could not query profiles for email', { error: String(e) });
      }
    }

    // If still no canonicalUserId, check or create in Supabase profiles
    if (!canonicalUserId) {
      canonicalUserId = uuid();
    }

    // Upsert profile in Supabase
    if (userEmail && env.supabase.url && env.supabase.serviceRoleKey) {
      const supabaseBase = env.supabase.url.replace(/\/$/, '');
      try {
        await fetch(`${supabaseBase}/rest/v1/profiles`, {
          method: 'POST',
          headers: {
            apikey: env.supabase.serviceRoleKey,
            Authorization: `Bearer ${env.supabase.serviceRoleKey}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates',
          },
          body: JSON.stringify([
            {
              id: canonicalUserId,
              email: userEmail,
              display_name: tokens.user?.name || userEmail.split('@')[0],
              avatar_url: tokens.user?.picture || null,
              updated_at: new Date().toISOString(),
            },
          ]),
        });
      } catch (e) {
        logger.warn('GoogleAuth', 'Could not upsert profile', { error: String(e) });
      }
    }

    // Save tokens under canonicalUserId
    const { tokenStore } = await import('@/lib/token-store');
    await tokenStore.saveTokens(tokens, false, `user:${canonicalUserId}:google`);
    await tokenStore.saveTokens(tokens, false, canonicalUserId);

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
    if (tokens.user?.email) {
      redirectUrl.searchParams.set('email', tokens.user.email);
    }

    const res = NextResponse.redirect(redirectUrl);
    res.cookies.delete('murmur_google_oauth_state');
    res.cookies.delete('murmur_auth_return_to');
    res.cookies.delete('murmur_google_redirect_uri');

    // Issue secure session cookies with canonical user identity
    if (userEmail) {
      setAuthSessionCookies(res, {
        id: canonicalUserId,
        email: userEmail,
        name: tokens.user?.name || userEmail.split('@')[0],
        picture: tokens.user?.picture || undefined,
        provider: 'google',
      });
    }

    return res;
  } catch (err) {
    logger.error('GoogleAuth', 'Failed to exchange Google OAuth code', { error: String(err) });
    const redirectUrl = new URL(returnTo, req.url);
    redirectUrl.searchParams.set('google_auth', 'error');
    redirectUrl.searchParams.set('error_message', err instanceof Error ? err.message : 'Token exchange failed');
    const res = NextResponse.redirect(redirectUrl);
    res.cookies.delete('murmur_google_oauth_state');
    res.cookies.delete('murmur_auth_return_to');
    res.cookies.delete('murmur_google_redirect_uri');
    return res;
  }
}
