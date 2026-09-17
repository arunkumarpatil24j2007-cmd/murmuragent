// lib/history-store.ts — Multi-user persistent agent sessions and message history
// Manages agent_sessions and agent_messages in Supabase with user isolation

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { v4 as uuid } from 'uuid';

export interface AgentSessionRecord {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  group?: 'today' | 'yesterday' | 'previous';
}

export interface AgentMessageRecord {
  id: string;
  sessionId: string;
  userId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

class HistoryStore {
  // In-memory fallback partitioned strictly by userId -> sessionId -> messages
  private memorySessions: Map<string, Map<string, AgentSessionRecord>> = new Map();
  private memoryMessages: Map<string, AgentMessageRecord[]> = new Map();

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
   * List all sessions for a specific user.
   */
  async getUserSessions(userId: string): Promise<AgentSessionRecord[]> {
    if (!userId) return [];

    const headers = this.supabaseHeaders;
    if (headers && env.supabase.url) {
      try {
        const url = `${env.supabase.url.replace(/\/$/, '')}/rest/v1/agent_sessions?user_id=eq.${encodeURIComponent(
          userId
        )}&order=updated_at.desc&limit=50`;
        const res = await fetch(url, { headers, cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const now = new Date();
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          const yesterdayStart = todayStart - 86400000;

          return data.map((item: any) => {
            const updatedAt = new Date(item.updated_at || item.created_at).getTime();
            let group: 'today' | 'yesterday' | 'previous' = 'previous';
            if (updatedAt >= todayStart) group = 'today';
            else if (updatedAt >= yesterdayStart) group = 'yesterday';

            return {
              id: item.id,
              userId: item.user_id,
              title: item.title || 'New Conversation',
              createdAt: item.created_at,
              updatedAt: item.updated_at,
              group,
            };
          });
        }
      } catch (err) {
        logger.warn('HistoryStore', 'Failed to fetch sessions from Supabase, checking memory fallback', {
          error: String(err),
        });
      }
    }

    // Memory fallback
    const userMap = this.memorySessions.get(userId);
    if (!userMap) return [];
    return Array.from(userMap.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  /**
   * Create or ensure an agent session exists for the user.
   */
  async ensureSession(userId: string, sessionId: string, title?: string): Promise<AgentSessionRecord> {
    const titleToUse = title?.trim() || 'New Conversation';
    const now = new Date().toISOString();

    const headers = this.supabaseHeaders;
    if (headers && env.supabase.url) {
      try {
        const url = `${env.supabase.url.replace(/\/$/, '')}/rest/v1/agent_sessions`;
        const payload = {
          id: sessionId,
          user_id: userId,
          title: titleToUse,
          updated_at: now,
        };
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            ...headers,
            Prefer: 'resolution=merge-duplicates,return=representation',
          },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const rows = await res.json();
          if (rows && rows[0]) {
            return {
              id: rows[0].id,
              userId: rows[0].user_id,
              title: rows[0].title,
              createdAt: rows[0].created_at,
              updatedAt: rows[0].updated_at,
            };
          }
        }
      } catch (err) {
        logger.warn('HistoryStore', 'Failed to save session to Supabase', { error: String(err) });
      }
    }

    // Memory fallback
    if (!this.memorySessions.has(userId)) {
      this.memorySessions.set(userId, new Map());
    }
    const userMap = this.memorySessions.get(userId)!;
    const existing = userMap.get(sessionId);
    const session: AgentSessionRecord = {
      id: sessionId,
      userId,
      title: titleToUse,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
      group: 'today',
    };
    userMap.set(sessionId, session);
    return session;
  }

  /**
   * Save a message into agent_messages and update session's updated_at.
   */
  async addMessage(
    userId: string,
    sessionId: string,
    role: 'user' | 'assistant' | 'system' | 'tool',
    content: string,
    metadata: Record<string, unknown> = {}
  ): Promise<AgentMessageRecord> {
    const messageId = uuid();
    const now = new Date().toISOString();

    // Ensure session exists
    await this.ensureSession(userId, sessionId, role === 'user' ? content.slice(0, 40) : undefined);

    const headers = this.supabaseHeaders;
    if (headers && env.supabase.url) {
      try {
        const url = `${env.supabase.url.replace(/\/$/, '')}/rest/v1/agent_messages`;
        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            id: messageId,
            session_id: sessionId,
            user_id: userId,
            role,
            content,
            metadata,
            created_at: now,
          }),
        });

        if (res.ok) {
          // Touch session updated_at
          fetch(
            `${env.supabase.url.replace(/\/$/, '')}/rest/v1/agent_sessions?id=eq.${encodeURIComponent(sessionId)}`,
            {
              method: 'PATCH',
              headers,
              body: JSON.stringify({ updated_at: now }),
            }
          ).catch(() => {});
        }
      } catch (err) {
        logger.warn('HistoryStore', 'Failed to append message to Supabase', { error: String(err) });
      }
    }

    // Memory fallback
    const key = `${userId}:${sessionId}`;
    if (!this.memoryMessages.has(key)) {
      this.memoryMessages.set(key, []);
    }
    const record: AgentMessageRecord = {
      id: messageId,
      sessionId,
      userId,
      role,
      content,
      metadata,
      createdAt: now,
    };
    this.memoryMessages.get(key)!.push(record);
    return record;
  }

  /**
   * Get all messages for a specific session, verifying user ownership.
   */
  async getSessionMessages(userId: string, sessionId: string): Promise<AgentMessageRecord[]> {
    if (!userId || !sessionId) return [];

    const headers = this.supabaseHeaders;
    if (headers && env.supabase.url) {
      try {
        const url = `${env.supabase.url.replace(
          /\/$/,
          ''
        )}/rest/v1/agent_messages?user_id=eq.${encodeURIComponent(
          userId
        )}&session_id=eq.${encodeURIComponent(sessionId)}&order=created_at.asc`;
        const res = await fetch(url, { headers, cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          return data.map((item: any) => ({
            id: item.id,
            sessionId: item.session_id,
            userId: item.user_id,
            role: item.role,
            content: item.content,
            metadata: item.metadata || {},
            createdAt: item.created_at,
          }));
        }
      } catch (err) {
        logger.warn('HistoryStore', 'Failed to fetch messages from Supabase', { error: String(err) });
      }
    }

    const key = `${userId}:${sessionId}`;
    return this.memoryMessages.get(key) || [];
  }

  /**
   * Delete a session and all its messages.
   */
  async deleteSession(userId: string, sessionId: string): Promise<boolean> {
    if (!userId || !sessionId) return false;

    const headers = this.supabaseHeaders;
    if (headers && env.supabase.url) {
      try {
        const url = `${env.supabase.url.replace(
          /\/$/,
          ''
        )}/rest/v1/agent_sessions?user_id=eq.${encodeURIComponent(userId)}&id=eq.${encodeURIComponent(sessionId)}`;
        await fetch(url, { method: 'DELETE', headers });
      } catch (err) {
        logger.warn('HistoryStore', 'Failed to delete session in Supabase', { error: String(err) });
      }
    }

    const userMap = this.memorySessions.get(userId);
    if (userMap) userMap.delete(sessionId);
    this.memoryMessages.delete(`${userId}:${sessionId}`);
    return true;
  }
}

export const historyStore = new HistoryStore();
