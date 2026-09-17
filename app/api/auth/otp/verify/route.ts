// app/api/auth/otp/verify/route.ts — Verify Email OTP via Supabase GoTrue
// Matches on-device Murmur App's SupabaseClient.swift:verifyOTP

import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { setAuthSessionCookies } from '@/lib/auth-session';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, token, type = 'email' } = body as {
      email?: string;
      token?: string;
      type?: string;
    };

    if (!email || !token) {
      return NextResponse.json(
        { success: false, error: 'Email and verification code are required' },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();
    const cleanToken = token.trim();

    if (!env.supabase.url || !env.supabase.serviceRoleKey) {
      return NextResponse.json(
        { success: false, error: 'Supabase authentication service is not configured' },
        { status: 500 }
      );
    }

    const supabaseUrl = env.supabase.url.replace(/\/$/, '');
    const res = await fetch(`${supabaseUrl}/auth/v1/verify`, {
      method: 'POST',
      headers: {
        apikey: env.supabase.serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type,
        email: trimmedEmail,
        token: cleanToken,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMsg = data.msg || data.error_description || data.message || 'Invalid verification code';
      logger.warn('AuthOTP', 'Supabase OTP verify failed', { email: trimmedEmail, status: res.status, error: errorMsg });

      if (errorMsg.includes('expired') || errorMsg.includes('otp_expired')) {
        return NextResponse.json(
          { success: false, error: 'This verification code has expired. Please request a new one.' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { success: false, error: 'Incorrect verification code. Please check your email and try again.' },
        { status: 400 }
      );
    }

    const user = data.user || data;
    if (!user || !user.id) {
      return NextResponse.json(
        { success: false, error: 'Authentication succeeded but user identity could not be resolved' },
        { status: 500 }
      );
    }

    const displayName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      trimmedEmail.split('@')[0];
    const avatarUrl = user.user_metadata?.avatar_url || null;

    logger.info('AuthOTP', 'OTP verified successfully, session established', {
      userId: user.id,
      email: trimmedEmail,
    });

    // Upsert user profile into public.profiles
    try {
      await fetch(`${supabaseUrl}/rest/v1/profiles`, {
        method: 'POST',
        headers: {
          apikey: env.supabase.serviceRoleKey,
          Authorization: `Bearer ${env.supabase.serviceRoleKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify([
          {
            id: user.id,
            email: trimmedEmail,
            display_name: displayName,
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString(),
          },
        ]),
      });
    } catch (e) {
      logger.warn('AuthOTP', 'Could not sync profiles table during OTP verification', { error: String(e) });
    }

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: trimmedEmail,
        name: displayName,
        picture: avatarUrl,
      },
    });

    // Set secure HTTP-only cookies
    setAuthSessionCookies(
      response,
      {
        id: user.id,
        email: trimmedEmail,
        name: displayName,
        picture: avatarUrl,
        provider: 'email_otp',
      },
      data.access_token
    );

    return response;
  } catch (err) {
    logger.error('AuthOTP', 'Unexpected error in OTP verify', { error: String(err) });
    return NextResponse.json(
      { success: false, error: 'Internal server error while verifying code' },
      { status: 500 }
    );
  }
}
