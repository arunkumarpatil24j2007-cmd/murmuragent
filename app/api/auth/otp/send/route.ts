// app/api/auth/otp/send/route.ts — Send 8-digit Email OTP via Supabase GoTrue
// Matches on-device Murmur App's SupabaseClient.swift:sendEmailOTP

import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body as { email?: string };

    if (!email || !email.trim()) {
      return NextResponse.json(
        { success: false, error: 'Email address is required' },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (!env.supabase.url || !env.supabase.serviceRoleKey) {
      return NextResponse.json(
        { success: false, error: 'Supabase authentication service is not configured' },
        { status: 500 }
      );
    }

    const supabaseUrl = env.supabase.url.replace(/\/$/, '');
    const res = await fetch(`${supabaseUrl}/auth/v1/otp`, {
      method: 'POST',
      headers: {
        apikey: env.supabase.serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: trimmedEmail,
        create_user: true,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMsg = data.msg || data.error_description || data.message || 'Failed to send verification code';
      logger.warn('AuthOTP', 'Supabase OTP send failed', { email: trimmedEmail, status: res.status, error: errorMsg });

      if (errorMsg.includes('rate limit') || errorMsg.includes('over_email_send_rate_limit')) {
        return NextResponse.json(
          { success: false, error: 'Too many requests. Please wait a moment before requesting another code.' },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { success: false, error: errorMsg },
        { status: res.status }
      );
    }

    logger.info('AuthOTP', 'Verification code sent successfully', { email: trimmedEmail });
    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your email',
    });
  } catch (err) {
    logger.error('AuthOTP', 'Unexpected error in OTP send', { error: String(err) });
    return NextResponse.json(
      { success: false, error: 'Internal server error while sending verification code' },
      { status: 500 }
    );
  }
}
