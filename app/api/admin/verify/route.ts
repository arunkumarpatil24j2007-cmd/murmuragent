// app/api/admin/verify/route.ts — Admin authorization verification for Tools & Users Directory
// Restricts admin access strictly to arunkumarpatil24j2007@gmail.com with password "ka32n3498"

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-session';

export const ADMIN_EMAIL = 'arunkumarpatil24j2007@gmail.com';
export const ADMIN_PASSWORD = 'ka32n3498';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password } = body as { password?: string };

    if (!password || password.trim() !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { success: false, error: 'Incorrect admin password.' },
        { status: 401 }
      );
    }

    // Check currently authenticated user
    const user = await getAuthenticatedUser(req);
    
    // If a user is logged in, their email MUST match the admin email
    if (user && user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return NextResponse.json(
        {
          success: false,
          error: `Access denied. Only the admin account (${ADMIN_EMAIL}) has permission to view this section.`,
        },
        { status: 403 }
      );
    }

    // Password is valid and user is either the admin or verifying for unlock
    const response = NextResponse.json({
      success: true,
      message: 'Admin authorization granted',
      adminEmail: ADMIN_EMAIL,
    });

    // Set secure admin session cookie (valid for 4 hours)
    response.cookies.set('murmur_admin_session', 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 4 * 3600,
    });

    return response;
  } catch (err) {
    return NextResponse.json(
      { success: false, error: 'Failed to verify admin password' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  const adminCookie = req.cookies.get('murmur_admin_session')?.value;
  const isAuthorized =
    adminCookie === 'authenticated' &&
    (!user || user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());

  return NextResponse.json({
    authorized: isAuthorized,
    adminEmail: ADMIN_EMAIL,
  });
}
