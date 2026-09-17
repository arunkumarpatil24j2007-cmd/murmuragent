// tools/registry.ts — Unified tool registry
// All tools (built-in, MCP, browser, API) register here.

import { logger } from '@/lib/logger';
import type { ToolDefinition, ToolResult } from '@/lib/schemas';

export interface ToolContext {
  userId?: string | null;
  signal?: AbortSignal;
  [key: string]: unknown;
}

export type ToolExecutor = (
  args: Record<string, unknown>,
  context?: ToolContext
) => Promise<{
  success: boolean;
  result?: unknown;
  error?: string;
}>;

interface RegisteredTool {
  definition: ToolDefinition;
  execute: ToolExecutor;
}

class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();

  register(definition: ToolDefinition, executor: ToolExecutor): void {
    if (this.tools.has(definition.name)) {
      logger.warn('ToolRegistry', `Overwriting tool: ${definition.name}`);
    }
    this.tools.set(definition.name, { definition, execute: executor });
    logger.info('ToolRegistry', `Registered tool: ${definition.name} [${definition.source}] [${definition.permission}]`);
  }

  unregister(name: string): void {
    this.tools.delete(name);
    logger.info('ToolRegistry', `Unregistered tool: ${name}`);
  }

  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  getDefinition(name: string): ToolDefinition | undefined {
    return this.tools.get(name)?.definition;
  }

  getAllDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  async execute(name: string, args: Record<string, unknown>, context?: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        toolCallId: '',
        tool: name,
        success: false,
        error: `Tool not found: ${name}`,
      };
    }

    const start = Date.now();
    try {
      // Normalize arguments based on parameter schema
      const normalizedArgs: Record<string, unknown> = { ...args };
      for (const param of tool.definition.parameters) {
        const val = normalizedArgs[param.name];
        if (val !== undefined && val !== null) {
          if (param.type === 'number' && typeof val === 'string' && !isNaN(Number(val))) {
            normalizedArgs[param.name] = Number(val);
          } else if (param.type === 'boolean' && typeof val === 'string') {
            normalizedArgs[param.name] = val.toLowerCase() === 'true';
          }
        }
      }

      logger.info('ToolRegistry', `Executing tool: ${name}`, {
        args: Object.keys(normalizedArgs),
        userId: context?.userId || 'guest',
      });
      const result = await tool.execute(normalizedArgs, context);
      const duration = Date.now() - start;
      logger.info('ToolRegistry', `Tool ${name} completed in ${duration}ms`, { success: result.success });
      return {
        toolCallId: '',
        tool: name,
        success: result.success,
        result: result.result,
        error: result.error,
        duration,
      };
    } catch (err) {
      const duration = Date.now() - start;
      const error = err instanceof Error ? err.message : String(err);
      logger.error('ToolRegistry', `Tool ${name} threw`, { error });
      return {
        toolCallId: '',
        tool: name,
        success: false,
        error,
        duration,
      };
    }
  }

  listTools(): Array<{ name: string; description: string; source: string; permission: string }> {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.definition.name,
      description: t.definition.description,
      source: t.definition.source,
      permission: t.definition.permission,
    }));
  }

  get size(): number {
    return this.tools.size;
  }
}

// Singleton registry
export const toolRegistry = new ToolRegistry();
