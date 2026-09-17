// lib/settings-store.ts — Multi-user persistent settings management
// Stores user preferences in user_settings table with per-user isolation

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

export interface UserSettings {
  selectedModel: string;
  temperature: number;
  streamEnabled: boolean;
  voiceLanguage: string;
  autoConnectors?: boolean;
  theme?: string;
  customPreferences?: Record<string, unknown>;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  selectedModel: 'omniroutes',
  temperature: 0.3,
  streamEnabled: true,
  voiceLanguage: 'en-US',
  autoConnectors: true,
};

class SettingsStore {
  private memorySettings: Map<string, UserSettings> = new Map();

  private get supabaseHeaders(): Record<string, string> | null {
    const key = env.supabase.serviceRoleKey;
    if (!key) return null;
    return {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    };
  }

  /**
   * Get settings for a user. Returns default settings if none saved.
   */
  async getUserSettings(userId: string): Promise<UserSettings> {
    if (!userId) return { ...DEFAULT_USER_SETTINGS };

    const headers = this.supabaseHeaders;
    if (headers && env.supabase.url) {
      try {
        const url = `${env.supabase.url.replace(
          /\/$/,
          ''
        )}/rest/v1/user_settings?user_id=eq.${encodeURIComponent(userId)}&limit=1`;
        const res = await fetch(url, { headers, cache: 'no-store' });
        if (res.ok) {
          const rows = await res.json();
          if (rows && rows.length > 0 && rows[0].settings) {
            return {
              ...DEFAULT_USER_SETTINGS,
              ...rows[0].settings,
            };
          }
        }
      } catch (err) {
        logger.warn('SettingsStore', 'Failed to read settings from Supabase, checking memory fallback', {
          error: String(err),
        });
      }
    }

    // Memory fallback
    return this.memorySettings.get(userId) || { ...DEFAULT_USER_SETTINGS };
  }

  /**
   * Save or update settings for a user.
   */
  async saveUserSettings(userId: string, settings: Partial<UserSettings>): Promise<UserSettings> {
    if (!userId) return { ...DEFAULT_USER_SETTINGS };

    const current = await this.getUserSettings(userId);
    const updated: UserSettings = {
      ...current,
      ...settings,
    };

    const headers = this.supabaseHeaders;
    if (headers && env.supabase.url) {
      try {
        const url = `${env.supabase.url.replace(/\/$/, '')}/rest/v1/user_settings`;
        await fetch(url, {
          method: 'POST',
          headers: {
            ...headers,
            Prefer: 'resolution=merge-duplicates,return=representation',
          },
          body: JSON.stringify({
            user_id: userId,
            settings: updated,
            updated_at: new Date().toISOString(),
          }),
        });
      } catch (err) {
        logger.warn('SettingsStore', 'Failed to save settings to Supabase', { error: String(err) });
      }
    }

    this.memorySettings.set(userId, updated);
    return updated;
  }
}

export const settingsStore = new SettingsStore();
