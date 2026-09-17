// app/api/users/route.ts — Returns all registered & logged-in users from the Supabase database

import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { tokenStore } from '@/lib/token-store';

export interface MurmurUser {
  id: string;
  email: string;
  name: string;
  picture: string | null;
  provider: 'google' | 'supabase' | 'email';
  isPrimary: boolean;
  createdAt: string;
  lastLoginAt: string;
  scopes?: string[];
  status: 'active' | 'recent' | 'offline';
}

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

    // Only allow if password is authorized AND user (if logged in) is the admin email
    const isEmailAuthorized =
      !user || user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

    if (!isPasswordAuthorized || !isEmailAuthorized) {
      return NextResponse.json(
        {
          error: `Admin authorization required. Access restricted to ${ADMIN_EMAIL} with admin password.`,
          total: 0,
          users: [],
          requiresPassword: true,
        },
        { status: 403 }
      );
    }

    const usersMap = new Map<string, MurmurUser>();

    // 1. Fetch Google OAuth Accounts from Supabase
    if (env.supabase.url && env.supabase.serviceRoleKey) {
      const headers = {
        apikey: env.supabase.serviceRoleKey,
        Authorization: `Bearer ${env.supabase.serviceRoleKey}`,
        'Content-Type': 'application/json',
      };

      try {
        const oauthRes = await fetch(
          `${env.supabase.url.replace(/\/$/, '')}/rest/v1/google_oauth_accounts?select=id,account_id,email,name,picture,is_primary,created_at,updated_at,scopes&order=updated_at.desc`,
          { method: 'GET', headers, cache: 'no-store' }
        );

        if (oauthRes.ok) {
          const oauthAccounts = await oauthRes.json();
          if (Array.isArray(oauthAccounts)) {
            for (const acc of oauthAccounts) {
              const email = acc.email?.toLowerCase().trim();
              if (!email) continue;

              usersMap.set(email, {
                id: acc.id || acc.account_id || email,
                email: acc.email,
                name: acc.name || email.split('@')[0],
                picture: acc.picture || null,
                provider: 'google',
                isPrimary: Boolean(acc.is_primary),
                createdAt: acc.created_at || new Date().toISOString(),
                lastLoginAt: acc.updated_at || acc.created_at || new Date().toISOString(),
                scopes: Array.isArray(acc.scopes) ? acc.scopes : [],
                status: 'active',
              });
            }
          }
        }
      } catch (err) {
        logger.error('UsersAPI', 'Failed to fetch google_oauth_accounts from Supabase', { error: String(err) });
      }

      // 2. Fetch Profiles from Supabase (email/password or GoTrue signups)
      try {
        const profilesRes = await fetch(
          `${env.supabase.url.replace(/\/$/, '')}/rest/v1/profiles?select=id,email,display_name,avatar_url,created_at,updated_at&order=updated_at.desc`,
          { method: 'GET', headers, cache: 'no-store' }
        );

        if (profilesRes.ok) {
          const profiles = await profilesRes.json();
          if (Array.isArray(profiles)) {
            for (const prof of profiles) {
              const email = prof.email?.toLowerCase().trim();
              if (!email) continue;

              const existing = usersMap.get(email);
              if (existing) {
                // Merge details, prefer non-null pictures and names
                if (!existing.picture && prof.avatar_url) {
                  existing.picture = prof.avatar_url;
                }
                if ((!existing.name || existing.name === email.split('@')[0]) && prof.display_name) {
                  existing.name = prof.display_name;
                }
                if (prof.created_at && new Date(prof.created_at) < new Date(existing.createdAt)) {
                  existing.createdAt = prof.created_at;
                }
              } else {
                usersMap.set(email, {
                  id: prof.id,
                  email: prof.email,
                  name: prof.display_name || prof.email.split('@')[0],
                  picture: prof.avatar_url || null,
                  provider: 'supabase',
                  isPrimary: false,
                  createdAt: prof.created_at || new Date().toISOString(),
                  lastLoginAt: prof.updated_at || prof.created_at || new Date().toISOString(),
                  status: 'recent',
                });
              }
            }
          }
        }
      } catch (err) {
        logger.error('UsersAPI', 'Failed to fetch profiles from Supabase', { error: String(err) });
      }
    }

    // 3. Fallback / Merge with TokenStore listAccounts
    try {
      const tokenAccounts = await tokenStore.listAccounts();
      for (const tAcc of tokenAccounts) {
        const email = tAcc.email?.toLowerCase().trim();
        if (!email) continue;
        if (!usersMap.has(email)) {
          usersMap.set(email, {
            id: tAcc.accountId || email,
            email: tAcc.email,
            name: tAcc.name || email.split('@')[0],
            picture: tAcc.picture || null,
            provider: 'google',
            isPrimary: tAcc.isPrimary,
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
            scopes: tAcc.scopes,
            status: 'active',
          });
        }
      }
    } catch {}

    const users = Array.from(usersMap.values()).sort((a, b) => {
      // Primary first, then by lastLoginAt descending
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return new Date(b.lastLoginAt).getTime() - new Date(a.lastLoginAt).getTime();
    });

    return NextResponse.json({
      success: true,
      users,
      total: users.length,
      primaryUser: users.find((u) => u.isPrimary) || users[0] || null,
    });
  } catch (err) {
    logger.error('UsersAPI', 'Unhandled error in /api/users', { error: String(err) });
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve users', users: [], total: 0 },
      { status: 500 }
    );
  }
}
