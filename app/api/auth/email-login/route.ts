// app/api/auth/email-login/route.ts — Connects web login to the Murmur Supabase auth system

import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name, mode = 'login' } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (!env.supabase.url || !env.supabase.serviceRoleKey) {
      return NextResponse.json(
        { success: false, error: 'Supabase authentication is not configured' },
        { status: 500 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();
    const supabaseBase = env.supabase.url.replace(/\/$/, '');

    // 1. Mode: Sign Up
    if (mode === 'signup') {
      const signupRes = await fetch(`${supabaseBase}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          apikey: env.supabase.serviceRoleKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
          data: {
            full_name: name?.trim() || trimmedEmail.split('@')[0],
          },
        }),
      });

      const signupData = await signupRes.json();

      if (!signupRes.ok) {
        return NextResponse.json(
          { success: false, error: signupData.msg || signupData.error_description || 'Signup failed' },
          { status: signupRes.status }
        );
      }

      const user = signupData.user || signupData;
      const userName = name?.trim() || user.user_metadata?.full_name || trimmedEmail.split('@')[0];

      // Upsert profile
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
              id: user.id,
              email: trimmedEmail,
              display_name: userName,
              updated_at: new Date().toISOString(),
            },
          ]),
        });
      } catch {}

      const res = NextResponse.json({
        success: true,
        message: 'Account created successfully',
        user: {
          id: user.id,
          email: trimmedEmail,
          name: userName,
        },
      });

      // Set session cookies
      const sessionData = {
        id: user.id,
        email: trimmedEmail,
        name: userName,
        picture: null,
        loginAt: new Date().toISOString(),
      };

      res.cookies.set('murmur_user_session', JSON.stringify(sessionData), {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      });

      res.cookies.set('murmur_active_user', trimmedEmail, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      });

      return res;
    }

    // 2. Mode: Password Sign In
    const tokenRes = await fetch(`${supabaseBase}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: env.supabase.serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: trimmedEmail,
        password,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      let errorMsg = tokenData.error_description || tokenData.msg || 'Invalid email or password';
      if (tokenData.error_code === 'invalid_credentials') {
        errorMsg = 'Incorrect email or password. Please try again.';
      }
      return NextResponse.json(
        { success: false, error: errorMsg },
        { status: tokenRes.status }
      );
    }

    const user = tokenData.user;
    const userName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      trimmedEmail.split('@')[0];
    const userPicture = user.user_metadata?.avatar_url || null;

    logger.info('EmailLogin', 'User authenticated via Supabase GoTrue', { email: trimmedEmail });

    // Ensure profiles record is updated
    try {
      await fetch(`${supabaseBase}/rest/v1/profiles?email=eq.${encodeURIComponent(trimmedEmail)}`, {
        method: 'PATCH',
        headers: {
          apikey: env.supabase.serviceRoleKey,
          Authorization: `Bearer ${env.supabase.serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          display_name: userName,
          avatar_url: userPicture,
          updated_at: new Date().toISOString(),
        }),
      });
    } catch {}

    const res = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: trimmedEmail,
        name: userName,
        picture: userPicture,
      },
    });

    const sessionData = {
      id: user.id,
      email: trimmedEmail,
      name: userName,
      picture: userPicture,
      loginAt: new Date().toISOString(),
    };

    res.cookies.set('murmur_user_session', JSON.stringify(sessionData), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });

    res.cookies.set('murmur_active_user', trimmedEmail, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });

    return res;
  } catch (err) {
    logger.error('EmailLogin', 'Unexpected login error', { error: String(err) });
    return NextResponse.json(
      { success: false, error: 'Login service encountered an unexpected error' },
      { status: 500 }
    );
  }
}
