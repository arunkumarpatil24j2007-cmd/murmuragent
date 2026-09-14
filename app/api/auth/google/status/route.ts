// app/api/auth/google/status/route.ts — Get Google Workspace connection status

import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAuthStatus } from '@/lib/google-auth';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('account_id') || undefined;
    const status = await getGoogleAuthStatus(accountId);
    return NextResponse.json(status);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to retrieve auth status' },
      { status: 500 }
    );
  }
}
