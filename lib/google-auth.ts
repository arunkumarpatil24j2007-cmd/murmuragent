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

import crypto from 'crypto';

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
] as const;

export interface GoogleCapabilities {
  gmail: boolean;
  calendar: boolean;
  drive: boolean;
  docs: boolean;
  sheets: boolean;
}

export interface GoogleAuthStatus {
  isConfigured: boolean;
  isConnected: boolean;
  storeType: 'supabase' | 'local';
  email?: string;
  name?: string;
  picture?: string;
  expiresAt?: string;
  scopes?: string[];
  capabilities?: GoogleCapabilities;
  accountsCount?: number;
}

// MARK: - CSRF OAuth State Protection

const STATE_SECRET = env.google.tokenEncryptionKey || 'murmur-agent-oauth-state-secret-2026';

export interface OAuthStatePayload {
  nonce: string;
  userId?: string;
  timestamp: number;
}

/** Generate cryptographically random, signed CSRF state with 10-minute expiration */
export function generateOAuthState(userId?: string): { stateParam: string; cookieValue: string } {
  const nonce = crypto.randomBytes(24).toString('hex');
  const timestamp = Date.now();
  const payload: OAuthStatePayload = { nonce, userId, timestamp };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', STATE_SECRET).update(payloadStr).digest('hex');
  const token = `${payloadStr}.${signature}`;
  return {
    stateParam: token,
    cookieValue: token,
  };
}

/** Validate CSRF OAuth state against cookie and timestamp */
export function validateOAuthState(stateParam: string | null, cookieValue?: string | null): boolean {
  if (!stateParam || !cookieValue || stateParam !== cookieValue) {
    return false;
  }

  try {
    const [payloadStr, signature] = stateParam.split('.');
    if (!payloadStr || !signature) return false;

    // Verify HMAC signature
    const expectedSig = crypto.createHmac('sha256', STATE_SECRET).update(payloadStr).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return false;
    }

    // Verify expiration (10 minutes)
    const payload: OAuthStatePayload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    const maxAgeMs = 10 * 60 * 1000;
    if (Date.now() - payload.timestamp > maxAgeMs) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
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
export async function exchangeGoogleCode(
  code: string,
  redirectUri?: string,
  userId?: string
): Promise<GoogleStoredTokens> {
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

  const lookupKey = userId || userInfo.email;
  const existing = lookupKey ? await tokenStore.getTokens(lookupKey) : null;
  const stored: GoogleStoredTokens = {
    access_token: tokens.access_token || existing?.access_token || null,
    refresh_token: tokens.refresh_token || existing?.refresh_token || null,
    scope: tokens.scope || existing?.scope,
    token_type: tokens.token_type || existing?.token_type || null,
    expiry_date: tokens.expiry_date || existing?.expiry_date || null,
    user: userInfo.email ? userInfo : existing?.user,
    updatedAt: new Date().toISOString(),
  };

  const customAccountId = userId ? `user:${userId}:google` : userInfo.email;
  await tokenStore.saveTokens(stored, false, customAccountId);
  return stored;
}

/**
 * Returns an authenticated OAuth2Client with valid tokens for the specific user,
 * automatically refreshing the access token if expired.
 * CRITICAL: Returns null if no user is specified.
 */
export async function getAuthenticatedGoogleClient(userId?: string): Promise<OAuth2Client | null> {
  if (!userId || !userId.trim()) {
    return null;
  }

  const stored = await tokenStore.getTokens(userId.trim());
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
      logger.info('GoogleAuth', 'Refreshing expired Google access token for user...', { userId });
      const { credentials } = await client.refreshAccessToken();
      const updated: GoogleStoredTokens = {
        ...stored,
        access_token: credentials.access_token || stored.access_token,
        expiry_date: credentials.expiry_date || stored.expiry_date,
        updatedAt: new Date().toISOString(),
      };
      const customAccountId = `user:${userId.trim()}:google`;
      await tokenStore.saveTokens(updated, false, customAccountId);
      client.setCredentials(credentials);
    } catch (err) {
      logger.error('GoogleAuth', 'Failed to refresh Google token for user', { error: String(err), userId });
      return null;
    }
  }

  return client;
}

/** Revoke access token with Google API and clear stored credentials for user */
export async function disconnectGoogle(userId?: string): Promise<boolean> {
  if (!userId || !userId.trim()) return false;
  const cleanId = userId.trim();
  const stored = await tokenStore.getTokens(cleanId);
  if (stored?.access_token) {
    try {
      const client = createOAuth2Client();
      client.setCredentials({ access_token: stored.access_token });
      await client.revokeToken(stored.access_token);
    } catch (err) {
      logger.warn('GoogleAuth', 'Error revoking token with Google, clearing local store anyway', { error: String(err) });
    }
  }
  await tokenStore.deleteTokens(cleanId);
  await tokenStore.deleteTokens(`user:${cleanId}:google`);
  return true;
}

/** Return current connection status for UI and diagnostic routes (Sanitized, no tokens exposed) */
export async function getGoogleAuthStatus(userId?: string): Promise<GoogleAuthStatus> {
  const isConfigured = !!(env.google.clientId && env.google.clientSecret);
  const storeType = tokenStore.getStoreType();

  if (!userId || !userId.trim()) {
    return {
      isConfigured,
      isConnected: false,
      storeType,
      capabilities: {
        gmail: false,
        calendar: false,
        drive: false,
        docs: false,
        sheets: false,
      },
    };
  }

  const stored = await tokenStore.getTokens(userId.trim());

  if (!stored || (!stored.access_token && !stored.refresh_token)) {
    return {
      isConfigured,
      isConnected: false,
      storeType,
      capabilities: {
        gmail: false,
        calendar: false,
        drive: false,
        docs: false,
        sheets: false,
      },
    };
  }

  const expiresAt = stored.expiry_date ? new Date(stored.expiry_date).toISOString() : undefined;
  const scopes = stored.scope ? stored.scope.split(' ') : undefined;
  const scopeStr = stored.scope || '';

  const capabilities: GoogleCapabilities = {
    gmail: scopeStr.includes('gmail') || !scopeStr,
    calendar: scopeStr.includes('calendar') || !scopeStr,
    drive: scopeStr.includes('drive') || !scopeStr,
    docs: scopeStr.includes('documents') || scopeStr.includes('drive') || !scopeStr,
    sheets: scopeStr.includes('spreadsheets') || scopeStr.includes('drive') || !scopeStr,
  };

  return {
    isConfigured,
    isConnected: true,
    storeType,
    email: stored.user?.email,
    name: stored.user?.name,
    picture: stored.user?.picture,
    expiresAt,
    scopes,
    capabilities,
  };
}
