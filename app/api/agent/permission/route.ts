// app/api/agent/permission/route.ts
// Handles [Allow] and [Deny] user decisions from the Murmur Notch

import { NextRequest, NextResponse } from 'next/server';
import { resolvePendingPermission, getPendingPermissions } from '@/agent/permissions';
import { z } from 'zod';

const PermissionResponseSchema = z.object({
  toolCallId: z.string().min(1),
  allowed: z.boolean(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = PermissionResponseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { toolCallId, allowed } = parsed.data;
    const resolved = resolvePendingPermission(toolCallId, allowed);

    if (!resolved) {
      return NextResponse.json(
        { success: false, error: `No active permission request found for id: ${toolCallId}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      toolCallId,
      allowed,
      message: allowed ? 'Permission granted. Tool executing...' : 'Permission denied. Tool execution cancelled.',
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const pending = getPendingPermissions();
  return NextResponse.json({
    pendingCount: pending.length,
    requests: pending,
  });
}
