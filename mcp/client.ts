// mcp/client.ts — MCP client for connecting to external MCP servers (like Palmier Pro)
// Uses HTTP Streamable transport per the MCP spec

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import type { ToolDefinition, ToolParameter } from '@/lib/schemas';
import { PermissionLevel } from '@/lib/schemas';

interface MCPToolSchema {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, {
      type?: string;
      description?: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

interface MCPResponse {
  jsonrpc: string;
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export class MCPClient {
  private url: string;
  private token: string;
  private connected = false;
  private requestId = 0;

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.url) return false;
    try {
      const res = await this.rpcCall('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'murmur-agent', version: '1.0.0' },
      }, 2000);
      this.connected = !!res;
      return this.connected;
    } catch {
      this.connected = false;
      return false;
    }
  }

  async discoverTools(): Promise<ToolDefinition[]> {
    try {
      const result = await this.rpcCall('tools/list', {}, 5000);
      if (!result || typeof result !== 'object') return [];

      const listResult = result as { tools?: MCPToolSchema[] };
      return (listResult.tools || []).map((t: MCPToolSchema) => this.convertToolDefinition(t));
    } catch (err) {
      logger.warn('MCPClient', 'Failed to discover tools', { error: String(err) });
      return [];
    }
  }

  async executeTool(name: string, args: Record<string, unknown>): Promise<{
    success: boolean;
    result?: unknown;
    error?: string;
  }> {
    try {
      const result = await this.rpcCall('tools/call', {
        name,
        arguments: args,
      });

      if (!result || typeof result !== 'object') {
        return { success: false, error: 'Empty response from MCP tool' };
      }

      const callResult = result as { content?: Array<{ type?: string; text?: string }>; isError?: boolean };
      if (callResult.isError) {
        return {
          success: false,
          error: callResult.content?.map((c: { text?: string }) => c.text || '').join('\n') || 'MCP tool execution failed',
        };
      }

      const content = callResult.content
        ?.map((c: { text?: string }) => c.text || '')
        .join('\n') || JSON.stringify(result);

      return { success: true, result: content };
    } catch (err) {
      return { success: false, error: `MCP execution error: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  private async rpcCall(method: string, params: unknown, timeoutMs = 15000): Promise<unknown> {
    const id = ++this.requestId;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(this.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`MCP HTTP error (${res.status}): ${text}`);
    }

    const contentType = res.headers.get('content-type') || '';

    // Handle JSON response
    if (contentType.includes('application/json')) {
      const data: MCPResponse = await res.json();
      if (data.error) {
        throw new Error(`MCP error ${data.error.code}: ${data.error.message}`);
      }
      return data.result;
    }

    // Handle SSE / streaming response
    if (contentType.includes('text/event-stream')) {
      const text = await res.text();
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data: MCPResponse = JSON.parse(line.slice(6));
            if (data.id === id) {
              if (data.error) {
                throw new Error(`MCP error ${data.error.code}: ${data.error.message}`);
              }
              return data.result;
            }
          } catch {
            // Skip malformed lines
          }
        }
      }
    }

    // Fallback: try parsing as JSON
    const text = await res.text();
    try {
      const data: MCPResponse = JSON.parse(text);
      if (data.error) {
        throw new Error(`MCP error ${data.error.code}: ${data.error.message}`);
      }
      return data.result;
    } catch {
      throw new Error(`Unexpected MCP response: ${text.slice(0, 200)}`);
    }
  }

  private convertToolDefinition(mcp: MCPToolSchema): ToolDefinition {
    const parameters: ToolParameter[] = [];

    if (mcp.inputSchema?.properties) {
      const required = mcp.inputSchema.required || [];
      for (const [name, prop] of Object.entries(mcp.inputSchema.properties)) {
        parameters.push({
          name,
          type: prop.type || 'string',
          description: prop.description || name,
          required: required.includes(name),
          ...(prop.enum ? { enum: prop.enum } : {}),
        });
      }
    }

    // Infer permission level from tool name
    const permission = this.inferPermission(mcp.name);

    return {
      name: `mcp.${mcp.name}`,
      description: mcp.description || `MCP tool: ${mcp.name}`,
      parameters,
      permission,
      source: 'mcp',
    };
  }

  private inferPermission(name: string): PermissionLevel {
    const lower = name.toLowerCase();
    if (/delete|remove|destroy|drop|send|publish|deploy/.test(lower)) {
      return PermissionLevel.DANGEROUS;
    }
    if (/create|write|update|edit|modify|insert|set|put|post|add/.test(lower)) {
      return PermissionLevel.WRITE;
    }
    return PermissionLevel.READ;
  }
}

// Create client from env
export function createMCPClient(): MCPClient {
  return new MCPClient(env.palmier.url, env.palmier.token);
}
