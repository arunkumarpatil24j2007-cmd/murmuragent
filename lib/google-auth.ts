// lib/google-auth.ts — Server-side Google Workspace OAuth 2.0 Client & Token Manager
// Supports Gmail, Google Drive, Google Docs, and Google Sheets.
// Persists tokens securely in Supabase PostgreSQL (production) or encrypted local file (development).

import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { env } from './env';
import { logger } from './logger';
import { tokenStore } from './token-store';
import type {
  GoogleStoredTokens,
  GoogleUserInfo,
  GoogleAccountSummary,
} from './token-store';

export type { GoogleStoredTokens, GoogleUserInfo, GoogleAccountSummary };

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
] as const;

export interface GoogleAuthStatus {
  isConfigured: boolean;
  isConnected: boolean;
  storeType: 'supabase' | 'local';
  email?: string;
  name?: string;
  picture?: string;
  expiresAt?: string;
  scopes?: string[];
  accountsCount?: number;
}

// MARK: - OAuth2 Client Setup

export function createOAuth2Client(customRedirectUri?: string): OAuth2Client {
  return new google.auth.OAuth2(
    env.google.clientId,
    env.google.clientSecret,
    customRedirectUri || env.google.redirectUri
  );
}

/** Generate Google OAuth Consent URL with offline access */
export function generateGoogleAuthUrl(state?: string, redirectUri?: string): string {
  const client = createOAuth2Client(redirectUri);
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [...GOOGLE_SCOPES],
    state: state || 'murmur_auth_flow',
  });
}

/** Exchange authorization code for access & refresh tokens and persist them */
export async function exchangeGoogleCode(code: string, redirectUri?: string): Promise<GoogleStoredTokens> {
  const client = createOAuth2Client(redirectUri);
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  // Fetch connected profile information
  let userInfo: GoogleUserInfo = {};
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data } = await oauth2.userinfo.get();
    userInfo = {
      email: data.email || undefined,
      name: data.name || undefined,
      picture: data.picture || undefined,
    };
  } catch (err) {
    logger.warn('GoogleAuth', 'Failed to fetch userinfo during token exchange', { error: String(err) });
  }

  // Preserve existing refresh token if Google does not return a new one on re-auth
  const existing = await tokenStore.getTokens(userInfo.email);
  const stored: GoogleStoredTokens = {
    access_token: tokens.access_token || existing?.access_token || null,
    refresh_token: tokens.refresh_token || existing?.refresh_token || null,
    scope: tokens.scope || existing?.scope,
    token_type: tokens.token_type || existing?.token_type || null,
    expiry_date: tokens.expiry_date || existing?.expiry_date || null,
    user: userInfo.email ? userInfo : existing?.user,
    updatedAt: new Date().toISOString(),
  };

  await tokenStore.saveTokens(stored, true);
  return stored;
}

/**
 * Returns an authenticated OAuth2Client with valid tokens,
 * automatically refreshing the access token if expired.
 */
export async function getAuthenticatedGoogleClient(accountId?: string): Promise<OAuth2Client | null> {
  const stored = await tokenStore.getTokens(accountId);
  if (!stored || (!stored.access_token && !stored.refresh_token)) {
    return null;
  }

  const client = createOAuth2Client();
  client.setCredentials({
    access_token: stored.access_token || undefined,
    refresh_token: stored.refresh_token || undefined,
    expiry_date: stored.expiry_date || undefined,
  });

  // Check if token is expired or expiring within 3 minutes
  const now = Date.now();
  const isExpiring = stored.expiry_date ? stored.expiry_date - now < 3 * 60 * 1000 : true;

  if (isExpiring && stored.refresh_token) {
    try {
      logger.info('GoogleAuth', 'Refreshing expired Google access token...');
      const { credentials } = await client.refreshAccessToken();
      const updated: GoogleStoredTokens = {
        ...stored,
        access_token: credentials.access_token || stored.access_token,
        expiry_date: credentials.expiry_date || stored.expiry_date,
        updatedAt: new Date().toISOString(),
      };
      await tokenStore.saveTokens(updated, true);
      client.setCredentials(credentials);
    } catch (err) {
      logger.error('GoogleAuth', 'Failed to refresh Google token', { error: String(err) });
      return null;
    }
  }

  return client;
}

/** Revoke access token with Google API and clear stored credentials */
export async function disconnectGoogle(accountId?: string): Promise<boolean> {
  const stored = await tokenStore.getTokens(accountId);
  if (stored?.access_token) {
    try {
      const client = createOAuth2Client();
      client.setCredentials({ access_token: stored.access_token });
      await client.revokeToken(stored.access_token);
    } catch (err) {
      logger.warn('GoogleAuth', 'Error revoking token with Google, clearing local store anyway', { error: String(err) });
    }
  }
  await tokenStore.deleteTokens(accountId);
  return true;
}

/** Return current connection status for UI and diagnostic routes (Sanitized, no tokens exposed) */
export async function getGoogleAuthStatus(accountId?: string): Promise<GoogleAuthStatus> {
  const isConfigured = !!(env.google.clientId && env.google.clientSecret);
  const storeType = tokenStore.getStoreType();
  const stored = await tokenStore.getTokens(accountId);
  const accounts = await tokenStore.listAccounts();

  if (!stored || (!stored.access_token && !stored.refresh_token)) {
    return {
      isConfigured,
      isConnected: false,
      storeType,
      accountsCount: accounts.length,
    };
  }

  const expiresAt = stored.expiry_date ? new Date(stored.expiry_date).toISOString() : undefined;
  const scopes = stored.scope ? stored.scope.split(' ') : undefined;

  return {
    isConfigured,
    isConnected: true,
    storeType,
    email: stored.user?.email,
    name: stored.user?.name,
    picture: stored.user?.picture,
    expiresAt,
    scopes,
    accountsCount: accounts.length,
  };
}
