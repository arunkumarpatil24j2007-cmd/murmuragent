// browser/airtop.ts — Airtop browser automation client

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

const AIRTOP_BASE = 'https://api.airtop.ai/api/v1';

interface AirtopSession {
  id: string;
  cdpUrl?: string;
  status: string;
}

interface AirtopWindow {
  windowId: string;
  sessionId: string;
}

async function airtopFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${AIRTOP_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${env.airtop.apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

export class AirtopClient {
  private sessionId: string | null = null;
  private windowId: string | null = null;

  async isAvailable(): Promise<boolean> {
    return !!env.airtop.apiKey;
  }

  async createSession(): Promise<AirtopSession> {
    if (!env.airtop.apiKey) {
      throw new Error('Airtop API key not configured. Set AIRTOP_API_KEY in environment.');
    }

    const res = await airtopFetch('/sessions', {
      method: 'POST',
      body: JSON.stringify({
        configuration: {
          timeoutMinutes: 10,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Airtop session creation failed (${res.status}): ${err}`);
    }

    const data = await res.json();
    this.sessionId = data.data?.id || data.id;
    logger.info('Airtop', 'Session created', { sessionId: this.sessionId });

    // Wait for session to be ready
    const currentStatus = data.data?.status || data.status;
    if (currentStatus !== 'active' && currentStatus !== 'running' && currentStatus !== 'ready') {
      await this.waitForSession();
    }

    return { id: this.sessionId!, status: 'active' };
  }

  private async waitForSession(maxWaitMs = 30000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const res = await airtopFetch(`/sessions/${this.sessionId}`);
      if (res.ok) {
        const data = await res.json();
        const status = data.data?.status || data.status;
        if (status === 'active' || status === 'running' || status === 'ready') return;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    throw new Error('Airtop session failed to become ready');
  }

  async createWindow(url: string): Promise<AirtopWindow> {
    if (!this.sessionId) {
      await this.createSession();
    }

    const res = await airtopFetch(`/sessions/${this.sessionId}/windows`, {
      method: 'POST',
      body: JSON.stringify({ url }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Airtop window creation failed (${res.status}): ${err}`);
    }

    const data = await res.json();
    this.windowId = data.data?.windowId || data.windowId;
    logger.info('Airtop', 'Window created', { windowId: this.windowId, url });

    // Wait a moment for page load
    await new Promise((r) => setTimeout(r, 3000));

    return { windowId: this.windowId!, sessionId: this.sessionId! };
  }

  async navigate(url: string): Promise<{ success: boolean; url: string; error?: string }> {
    try {
      if (!this.windowId) {
        await this.createWindow(url);
      } else {
        // Navigate existing window
        const res = await airtopFetch(
          `/sessions/${this.sessionId}/windows/${this.windowId}/navigate`,
          {
            method: 'POST',
            body: JSON.stringify({ url }),
          }
        );
        if (!res.ok) {
          // If navigate endpoint doesn't exist, try creating new window
          await this.createWindow(url);
        }
      }
      return { success: true, url };
    } catch (err) {
      return { success: false, url, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async extract(prompt: string): Promise<{ success: boolean; content?: string; error?: string }> {
    if (!this.sessionId || !this.windowId) {
      return { success: false, error: 'No active browser session. Navigate to a URL first.' };
    }

    try {
      const res = await airtopFetch(
        `/sessions/${this.sessionId}/windows/${this.windowId}/page-query`,
        {
          method: 'POST',
          body: JSON.stringify({
            prompt,
            configuration: { outputSchema: null },
          }),
        }
      );

      if (!res.ok) {
        const err = await res.text();
        return { success: false, error: `Extraction failed (${res.status}): ${err}` };
      }

      const data = await res.json();
      const content = data.data?.modelResponse || data.modelResponse || JSON.stringify(data);
      return { success: true, content };
    } catch (err) {
      return { success: false, error: `Extraction error: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  async screenshot(): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
    if (!this.sessionId || !this.windowId) {
      return { success: false, error: 'No active browser session.' };
    }

    try {
      const res = await airtopFetch(
        `/sessions/${this.sessionId}/windows/${this.windowId}/screenshot`,
        { method: 'POST' }
      );

      if (!res.ok) {
        return { success: false, error: `Screenshot failed (${res.status})` };
      }

      const data = await res.json();
      return { success: true, imageUrl: data.data?.imageUrl || data.imageUrl };
    } catch (err) {
      return { success: false, error: `Screenshot error: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  async close(): Promise<void> {
    if (this.sessionId) {
      try {
        await airtopFetch(`/sessions/${this.sessionId}`, { method: 'DELETE' });
        logger.info('Airtop', 'Session closed', { sessionId: this.sessionId });
      } catch {
        // Best-effort cleanup
      }
      this.sessionId = null;
      this.windowId = null;
    }
  }

  async endSession(): Promise<void> {
    return this.close();
  }

  async terminateSession(): Promise<void> {
    return this.close();
  }
}

// Singleton
export const airtopClient = new AirtopClient();
