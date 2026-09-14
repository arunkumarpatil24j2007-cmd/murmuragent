// agent/memory.ts — Memory abstraction for the agent

import type { ModelMessage, ToolResult } from '@/lib/schemas';

/**
 * Short-term memory: current conversation context
 */
export class ShortTermMemory {
  private messages: ModelMessage[] = [];
  private maxMessages = 50;

  add(message: ModelMessage): void {
    this.messages.push(message);
    // Keep within limits (keep system messages + recent)
    if (this.messages.length > this.maxMessages) {
      const systemMsgs = this.messages.filter((m) => m.role === 'system');
      const recentMsgs = this.messages.filter((m) => m.role !== 'system').slice(-this.maxMessages + systemMsgs.length);
      this.messages = [...systemMsgs, ...recentMsgs];
    }
  }

  getAll(): ModelMessage[] {
    return [...this.messages];
  }

  clear(): void {
    this.messages = [];
  }

  get length(): number {
    return this.messages.length;
  }
}

/**
 * Tool state: results produced during the current task
 */
export class ToolStateMemory {
  private results: Map<string, ToolResult> = new Map();

  set(toolCallId: string, result: ToolResult): void {
    this.results.set(toolCallId, result);
  }

  get(toolCallId: string): ToolResult | undefined {
    return this.results.get(toolCallId);
  }

  getAll(): ToolResult[] {
    return Array.from(this.results.values());
  }

  clear(): void {
    this.results.clear();
  }

  get size(): number {
    return this.results.size;
  }
}

/**
 * Long-term memory: future capability for persistent user preferences.
 * Interface defined now for forward-compatibility.
 */
export class LongTermMemory {
  private preferences: Record<string, unknown> = {};
  private history: Array<{ taskId: string; summary: string; timestamp: string }> = [];

  setPreference(key: string, value: unknown): void {
    this.preferences[key] = value;
  }

  getPreference(key: string): unknown {
    return this.preferences[key];
  }

  addToHistory(taskId: string, summary: string): void {
    this.history.push({
      taskId,
      summary,
      timestamp: new Date().toISOString(),
    });
    // Keep last 100 entries
    if (this.history.length > 100) {
      this.history = this.history.slice(-100);
    }
  }

  getRecentHistory(n = 10): Array<{ taskId: string; summary: string; timestamp: string }> {
    return this.history.slice(-n);
  }
}
