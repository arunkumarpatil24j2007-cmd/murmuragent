// app/api/auth/google/login/route.ts — Initiate Google Workspace OAuth 2.0 flow

import { NextRequest, NextResponse } from 'next/server';
import { generateGoogleAuthUrl } from '@/lib/google-auth';
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
  const state = searchParams.get('state') || undefined;
  const customRedirect = searchParams.get('redirect_uri') || undefined;
  const format = searchParams.get('format');

  try {
    const authUrl = generateGoogleAuthUrl(state, customRedirect);

    // If caller explicitly requested JSON format
    if (format === 'json' || req.headers.get('accept')?.includes('application/json')) {
      return NextResponse.json({ url: authUrl });
    }

    // Default: Redirect user directly to Google consent screen
    return NextResponse.redirect(authUrl);
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to generate auth URL: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
