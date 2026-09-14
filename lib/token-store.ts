// lib/token-store.ts — Persistent Token Store for Google Workspace OAuth
// Uses Supabase PostgreSQL PostgREST in production with AES-256-GCM encryption at rest.
// Falls back to encrypted local file (.google-tokens.json) during local development.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { env } from './env';
import { logger } from './logger';

export interface GoogleUserInfo {
  email?: string;
  name?: string;
  picture?: string;
}

export interface GoogleStoredTokens {
  access_token?: string | null;
  refresh_token?: string | null;
  scope?: string;
  token_type?: string | null;
  expiry_date?: number | null;
  user?: GoogleUserInfo;
  updatedAt: string;
}

export interface GoogleAccountSummary {
  accountId: string;
  email: string;
  name?: string;
  picture?: string;
  isPrimary: boolean;
  expiresAt?: string;
  scopes?: string[];
}

export interface PersistentTokenStore {
  getTokens(accountId?: string): Promise<GoogleStoredTokens | null>;
  saveTokens(tokens: GoogleStoredTokens, isPrimary?: boolean): Promise<void>;
  deleteTokens(accountId?: string): Promise<void>;
  listAccounts(): Promise<GoogleAccountSummary[]>;
  getStoreType(): 'supabase' | 'local';
}

const LOCAL_STORAGE_PATH = path.join(process.cwd(), '.google-tokens.json');

// MARK: - Encryption / Decryption Core (AES-256-GCM)

function getEncryptionKey(): Buffer {
  return crypto.createHash('sha256').update(env.google.tokenEncryptionKey).digest();
}

export function encryptPayload(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptPayload(cipherText: string): string | null {
  try {
    const [ivHex, authTagHex, encryptedHex] = cipherText.split(':');
    if (!ivHex || !authTagHex || !encryptedHex) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    logger.error('TokenStore', 'Decryption failed', { error: String(err) });
    return null;
  }
}

// MARK: - 1. Supabase PostgreSQL Store (Production)

class SupabaseTokenStore implements PersistentTokenStore {
  private url: string;
  private serviceRoleKey: string;

  constructor(url: string, serviceRoleKey: string) {
    this.url = url.replace(/\/$/, '');
    this.serviceRoleKey = serviceRoleKey;
  }

  getStoreType(): 'supabase' {
    return 'supabase';
  }

  private get headers(): Record<string, string> {
    return {
      apikey: this.serviceRoleKey,
      Authorization: `Bearer ${this.serviceRoleKey}`,
      'Content-Type': 'application/json',
    };
  }

  async getTokens(accountId?: string): Promise<GoogleStoredTokens | null> {
    try {
      let endpoint = `${this.url}/rest/v1/google_oauth_accounts?select=*`;
      if (accountId) {
        endpoint += `&account_id=eq.${encodeURIComponent(accountId)}&limit=1`;
      } else {
        endpoint += `&is_primary=eq.true&limit=1`;
      }

      const res = await fetch(endpoint, {
        method: 'GET',
        headers: this.headers,
        cache: 'no-store',
      });

      if (!res.ok) {
        logger.error('SupabaseTokenStore', 'Failed to fetch tokens from Supabase', { status: res.status });
        return null;
      }

      let rows = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) {
        if (!accountId) {
          // Fallback: fetch most recently updated account
          const fallbackRes = await fetch(`${this.url}/rest/v1/google_oauth_accounts?select=*&order=updated_at.desc&limit=1`, {
            method: 'GET',
            headers: this.headers,
            cache: 'no-store',
          });
          if (fallbackRes.ok) {
            rows = await fallbackRes.json();
          }
        }
      }

      if (!Array.isArray(rows) || rows.length === 0) {
        return null;
      }

      const row = rows[0];
      const decrypted = decryptPayload(row.encrypted_tokens);
      if (!decrypted) return null;

      const tokens: GoogleStoredTokens = JSON.parse(decrypted);
      tokens.user = {
        email: row.email,
        name: row.name || undefined,
        picture: row.picture || undefined,
      };
      return tokens;
    } catch (err) {
      logger.error('SupabaseTokenStore', 'Exception querying Supabase tokens', { error: String(err) });
      return null;
    }
  }

  async saveTokens(tokens: GoogleStoredTokens, isPrimary = true): Promise<void> {
    const accountId = tokens.user?.email || 'primary_account';
    const email = tokens.user?.email || accountId;
    const name = tokens.user?.name || null;
    const picture = tokens.user?.picture || null;
    const scopes = tokens.scope ? tokens.scope.split(' ') : [];
    const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null;

    // Encrypt token payload
    const tokenPayload = JSON.stringify({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      scope: tokens.scope,
      token_type: tokens.token_type,
      expiry_date: tokens.expiry_date,
      updatedAt: tokens.updatedAt,
    });
    const encryptedTokens = encryptPayload(tokenPayload);

    try {
      // If marking as primary, unmark others
      if (isPrimary) {
        await fetch(`${this.url}/rest/v1/google_oauth_accounts?is_primary=eq.true`, {
          method: 'PATCH',
          headers: this.headers,
          body: JSON.stringify({ is_primary: false }),
        });
      }

      // Upsert account record
      const body = [
        {
          account_id: accountId,
          email,
          name,
          picture,
          is_primary: isPrimary,
          encrypted_tokens: encryptedTokens,
          scopes,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        },
      ];

      const res = await fetch(`${this.url}/rest/v1/google_oauth_accounts?on_conflict=account_id`, {
        method: 'POST',
        headers: {
          ...this.headers,
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Supabase upsert failed (${res.status}): ${text}`);
      }

      logger.info('SupabaseTokenStore', 'Saved encrypted Google OAuth tokens to Supabase', { accountId, isPrimary });
    } catch (err) {
      logger.error('SupabaseTokenStore', 'Failed to save tokens to Supabase', { error: String(err) });
      throw err;
    }
  }

  async deleteTokens(accountId?: string): Promise<void> {
    try {
      let endpoint = `${this.url}/rest/v1/google_oauth_accounts`;
      if (accountId) {
        endpoint += `?account_id=eq.${encodeURIComponent(accountId)}`;
      } else {
        endpoint += `?is_primary=eq.true`;
      }

      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: this.headers,
      });

      if (!res.ok) {
        logger.error('SupabaseTokenStore', 'Delete tokens failed in Supabase', { status: res.status });
      } else {
        logger.info('SupabaseTokenStore', 'Deleted Google OAuth tokens from Supabase', { accountId });
      }
    } catch (err) {
      logger.error('SupabaseTokenStore', 'Failed to delete tokens from Supabase', { error: String(err) });
    }
  }

  async listAccounts(): Promise<GoogleAccountSummary[]> {
    try {
      const res = await fetch(
        `${this.url}/rest/v1/google_oauth_accounts?select=account_id,email,name,picture,is_primary,expires_at,scopes&order=created_at.asc`,
        {
          method: 'GET',
          headers: this.headers,
          cache: 'no-store',
        }
      );

      if (!res.ok) return [];
      const rows = await res.json();
      if (!Array.isArray(rows)) return [];

      return rows.map((r) => ({
        accountId: r.account_id,
        email: r.email,
        name: r.name || undefined,
        picture: r.picture || undefined,
        isPrimary: Boolean(r.is_primary),
        expiresAt: r.expires_at || undefined,
        scopes: Array.isArray(r.scopes) ? r.scopes : [],
      }));
    } catch (err) {
      logger.error('SupabaseTokenStore', 'Failed to list accounts from Supabase', { error: String(err) });
      return [];
    }
  }
}

// MARK: - 2. Local File Store (Fallback for Development)

interface LocalStoreSchema {
  primaryAccountId?: string;
  accounts: Record<
    string,
    {
      accountId: string;
      email: string;
      name?: string;
      picture?: string;
      isPrimary: boolean;
      encryptedData: string;
      scopes: string[];
      expiresAt?: string;
      updatedAt: string;
    }
  >;
}

class LocalFileTokenStore implements PersistentTokenStore {
  getStoreType(): 'local' {
    return 'local';
  }

  private readStore(): LocalStoreSchema {
    try {
      if (!fs.existsSync(LOCAL_STORAGE_PATH)) {
        return { accounts: {} };
      }
      const raw = fs.readFileSync(LOCAL_STORAGE_PATH, 'utf8');
      const parsed = JSON.parse(raw);

      // Backwards compatibility with legacy single-object format
      if (parsed.encrypted && parsed.data) {
        const decrypted = decryptPayload(parsed.data);
        if (decrypted) {
          const oldTokens: GoogleStoredTokens = JSON.parse(decrypted);
          const email = oldTokens.user?.email || 'local_user';
          return {
            primaryAccountId: email,
            accounts: {
              [email]: {
                accountId: email,
                email,
                name: oldTokens.user?.name,
                picture: oldTokens.user?.picture,
                isPrimary: true,
                encryptedData: parsed.data,
                scopes: oldTokens.scope ? oldTokens.scope.split(' ') : [],
                expiresAt: oldTokens.expiry_date ? new Date(oldTokens.expiry_date).toISOString() : undefined,
                updatedAt: oldTokens.updatedAt,
              },
            },
          };
        }
      }

      return parsed.accounts ? parsed : { accounts: {} };
    } catch (err) {
      logger.error('LocalFileTokenStore', 'Failed to read local token store', { error: String(err) });
      return { accounts: {} };
    }
  }

  private writeStore(store: LocalStoreSchema): void {
    try {
      fs.writeFileSync(LOCAL_STORAGE_PATH, JSON.stringify(store, null, 2), 'utf8');
    } catch (err) {
      logger.error('LocalFileTokenStore', 'Failed to write local token store', { error: String(err) });
    }
  }

  async getTokens(accountId?: string): Promise<GoogleStoredTokens | null> {
    const store = this.readStore();
    if (accountId) {
      const record = store.accounts[accountId];
      if (!record) return null;
      const decrypted = decryptPayload(record.encryptedData);
      return decrypted ? JSON.parse(decrypted) : null;
    }

    // Default: find primary account
    const primaryId = store.primaryAccountId;
    if (primaryId && store.accounts[primaryId]) {
      const record = store.accounts[primaryId];
      const decrypted = decryptPayload(record.encryptedData);
      return decrypted ? JSON.parse(decrypted) : null;
    }

    // Fallback if primary not set: first available account
    const first = Object.values(store.accounts)[0];
    if (!first) return null;
    const decrypted = decryptPayload(first.encryptedData);
    return decrypted ? JSON.parse(decrypted) : null;
  }

  async saveTokens(tokens: GoogleStoredTokens, isPrimary = true): Promise<void> {
    const store = this.readStore();
    const accountId = tokens.user?.email || 'local_user';
    const email = tokens.user?.email || accountId;
    const encryptedData = encryptPayload(JSON.stringify(tokens));

    if (isPrimary) {
      for (const key of Object.keys(store.accounts)) {
        store.accounts[key].isPrimary = false;
      }
      store.primaryAccountId = accountId;
    }

    store.accounts[accountId] = {
      accountId,
      email,
      name: tokens.user?.name,
      picture: tokens.user?.picture,
      isPrimary,
      encryptedData,
      scopes: tokens.scope ? tokens.scope.split(' ') : [],
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : undefined,
      updatedAt: tokens.updatedAt,
    };

    if (!store.primaryAccountId) {
      store.primaryAccountId = accountId;
    }

    this.writeStore(store);
    logger.info('LocalFileTokenStore', 'Saved tokens to local file store', { accountId, isPrimary });
  }

  async deleteTokens(accountId?: string): Promise<void> {
    const store = this.readStore();
    const targetId = accountId || store.primaryAccountId;
    if (!targetId) {
      // Clear everything
      if (fs.existsSync(LOCAL_STORAGE_PATH)) {
        fs.unlinkSync(LOCAL_STORAGE_PATH);
      }
      return;
    }

    delete store.accounts[targetId];
    if (store.primaryAccountId === targetId) {
      const remaining = Object.keys(store.accounts);
      store.primaryAccountId = remaining[0];
      if (store.primaryAccountId) {
        store.accounts[store.primaryAccountId].isPrimary = true;
      }
    }

    this.writeStore(store);
    logger.info('LocalFileTokenStore', 'Deleted account tokens from local file store', { targetId });
  }

  async listAccounts(): Promise<GoogleAccountSummary[]> {
    const store = this.readStore();
    return Object.values(store.accounts).map((a) => ({
      accountId: a.accountId,
      email: a.email,
      name: a.name,
      picture: a.picture,
      isPrimary: a.isPrimary,
      expiresAt: a.expiresAt,
      scopes: a.scopes,
    }));
  }
}

// MARK: - Factory Singleton

function createTokenStore(): PersistentTokenStore {
  if (env.supabase.url && env.supabase.serviceRoleKey) {
    logger.info('TokenStore', 'Using Supabase PostgreSQL Persistent Token Store');
    return new SupabaseTokenStore(env.supabase.url, env.supabase.serviceRoleKey);
  }

  logger.info('TokenStore', 'Supabase credentials not found. Using Local File Token Store (.google-tokens.json)');
  return new LocalFileTokenStore();
}

export const tokenStore = createTokenStore();
