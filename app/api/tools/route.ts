import { NextRequest, NextResponse } from 'next/server';
import { initializeAgent } from '@/agent/agent';
import { toolRegistry } from '@/tools/registry';
import { getAuthenticatedUser } from '@/lib/auth-session';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from '@/app/api/admin/verify/route';

export async function GET(req: NextRequest) {
  try {
    // Check admin authorization
    const adminCookie = req.cookies.get('murmur_admin_session')?.value;
    const adminPasswordHeader = req.headers.get('x-admin-password');
    const isPasswordAuthorized =
      adminCookie === 'authenticated' || adminPasswordHeader === ADMIN_PASSWORD;

    const user = await getAuthenticatedUser(req);
    const isEmailAuthorized =
      !user || user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

    if (!isPasswordAuthorized || !isEmailAuthorized) {
      return NextResponse.json(
        {
          error: `Admin authorization required. Access restricted to ${ADMIN_EMAIL} with admin password.`,
          tools: [],
          count: 0,
          requiresPassword: true,
        },
        { status: 403 }
      );
    }

    await initializeAgent();
    const tools = toolRegistry.listTools();
    return NextResponse.json({ tools, count: tools.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to list tools' },
      { status: 500 }
    );
  }
}
