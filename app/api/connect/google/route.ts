// app/api/connect/google/route.ts — Direct alias for /api/auth/google/login

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const target = new URL('/api/auth/google/login', req.url);
  url.searchParams.forEach((v, k) => target.searchParams.set(k, v));
  return NextResponse.redirect(target);
}
