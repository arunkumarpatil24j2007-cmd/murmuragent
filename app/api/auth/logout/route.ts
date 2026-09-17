// app/api/auth/logout/route.ts — Log out active user and clear session cookies

import { NextRequest, NextResponse } from 'next/server';
import { clearAuthSessionCookies } from '@/lib/auth-session';

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ success: true, message: 'Logged out successfully' });
  clearAuthSessionCookies(res);
  return res;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const returnTo = url.searchParams.get('return_to') || '/';

  const res = NextResponse.redirect(new URL(returnTo, req.url));
  clearAuthSessionCookies(res);
  return res;
}
