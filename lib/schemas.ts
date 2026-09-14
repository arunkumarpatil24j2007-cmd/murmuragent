// lib/schemas.ts — Shared types and schemas for the Murmur Agent

import { z } from 'zod';

// ── Permission Levels ─────────────────────────────────

export enum PermissionLevel {
  READ = 'READ',
  WRITE = 'WRITE',
  DANGEROUS = 'DANGEROUS',
}

// ── Tool Types ────────────────────────────────────────

export interface ToolParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  enum?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  permission: PermissionLevel;
  source: 'built-in' | 'mcp' | 'browser' | 'api';
}

export interface ToolCall {
  id: string;
  tool: string;
  arguments: Record<string, unknown>;
  thoughtSignature?: string;
}

export interface ToolResult {
  toolCallId: string;
  tool: string;
  success: boolean;
  result?: unknown;
  error?: string;
  duration?: number;
}

// ── Agent Events (streamed to UI) ─────────────────────

export type AgentEventType =
  | 'agent_started'
  | 'model_selected'
  | 'tool_started'
  | 'tool_result'
  | 'tool_failed'
  | 'agent_thinking'
  | 'agent_text'
  | 'agent_completed'
  | 'agent_error'
  | 'permission_required';

export interface AgentEvent {
  type: AgentEventType;
  timestamp: string;
  data: {
    taskId?: string;
    model?: string;
    tool?: string;
    action?: string;
    status?: string;
    result?: string;
    url?: string;
    title?: string;
    error?: string;
    text?: string;
    permission?: PermissionLevel;
    toolCallId?: string;
  };
}

// ── Message Types ─────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  events?: AgentEvent[];
  model?: string;
}

// ── Task State ────────────────────────────────────────

export interface TaskState {
  id: string;
  request: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'awaiting_permission';
  model: string;
  steps: TaskStep[];
  toolCalls: ToolResult[];
  errors: string[];
  result?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface TaskStep {
  index: number;
  type: 'model_call' | 'tool_execution' | 'verification';
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  tool?: string;
  result?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

// ── Model Types ───────────────────────────────────────

export interface ModelMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  toolName?: string;
}

export interface ModelResponse {
  content: string;
  toolCalls?: ToolCall[];
  model: string;
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ModelProviderMetadata {
  id: string;
  name: string;
  provider: string;
  supportsTool: boolean;
  supportsStreaming: boolean;
  maxTokens: number;
  costTier: 'low' | 'medium' | 'high';
}

// ── Memory Types ──────────────────────────────────────

export interface ShortTermMemory {
  messages: ModelMessage[];
  taskId: string;
}

export interface ToolState {
  results: Map<string, ToolResult>;
}

export interface LongTermMemory {
  preferences: Record<string, unknown>;
  history: { taskId: string; summary: string; timestamp: string }[];
}

// ── API Request/Response ──────────────────────────────

export const ChatRequestSchema = z.object({
  message: z.string().min(1),
  conversationId: z.string().optional(),
  model: z.string().optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export interface ChatResponse {
  conversationId: string;
  message: ChatMessage;
}

// ── Health ────────────────────────────────────────────

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  providers: {
    nvidia: { configured: boolean; status: string };
    gemini: { configured: boolean; status: string };
    kimi?: { configured: boolean; status: string; model?: string };
    local?: { configured: boolean; status: string; model?: string; provider?: string };
    airtop: { configured: boolean; status: string };
    palmier: { configured: boolean; status: string };
    notion: { configured: boolean; status: string };
    vercel: { configured: boolean; status: string };
  };
  timestamp: string;
}
