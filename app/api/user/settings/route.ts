// app/api/user/settings/route.ts — User-scoped settings API

import { NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-session';
import { settingsStore, DEFAULT_USER_SETTINGS } from '@/lib/settings-store';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return Response.json({
        authenticated: false,
        settings: DEFAULT_USER_SETTINGS,
      });
    }

    const settings = await settingsStore.getUserSettings(user.id);
    return Response.json({
      authenticated: true,
      settings,
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const updated = await settingsStore.saveUserSettings(user.id, body);
    return Response.json({
      success: true,
      settings: updated,
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
