// app/api/auth/google/disconnect/route.ts — Disconnect Google account and revoke credentials

import { NextResponse } from 'next/server';
import { disconnectGoogle } from '@/lib/google-auth';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  try {
    let accountId: string | undefined;
    try {
      const body = await req.json();
      if (body?.accountId && typeof body.accountId === 'string') {
        accountId = body.accountId;
      }
    } catch {
      // Body is optional
    }

    await disconnectGoogle(accountId);
    logger.info('GoogleAuth', 'Google account disconnected', { accountId });
    return NextResponse.json({
      success: true,
      message: 'Google account disconnected and credentials cleared successfully.',
    });
  } catch (err) {
    logger.error('GoogleAuth', 'Failed to disconnect Google account', { error: String(err) });
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Disconnection failed' },
      { status: 500 }
    );
  }
}
