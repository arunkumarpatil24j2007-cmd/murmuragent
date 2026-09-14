// mcp/registry.ts — Discovers and registers MCP tools into the unified tool registry

import { logger } from '@/lib/logger';
import { toolRegistry } from '@/tools/registry';
import { createMCPClient, MCPClient } from './client';

let mcpClient: MCPClient | null = null;
let discoveredCount = 0;

/**
 * Initialize MCP connection, discover tools, and register them
 * in the unified tool registry.
 */
export async function initializeMCP(): Promise<{
  connected: boolean;
  toolCount: number;
  error?: string;
}> {
  mcpClient = createMCPClient();

  try {
    const available = await mcpClient.isAvailable();
    if (!available) {
      logger.warn('MCPRegistry', 'Palmier MCP server not reachable');
      return { connected: false, toolCount: 0, error: 'MCP server not reachable' };
    }

    logger.info('MCPRegistry', 'Connected to Palmier MCP server');

    // Discover tools
    const tools = await mcpClient.discoverTools();
    discoveredCount = tools.length;
    logger.info('MCPRegistry', `Discovered ${tools.length} MCP tools`);

    // Register each discovered tool into the unified registry
    for (const tool of tools) {
      const originalName = tool.name.replace('mcp.', '');
      toolRegistry.register(tool, async (args) => {
        if (!mcpClient) {
          return { success: false, error: 'MCP client not initialized' };
        }
        return mcpClient.executeTool(originalName, args);
      });
    }

    return { connected: true, toolCount: tools.length };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error('MCPRegistry', 'MCP initialization failed', { error });
    return { connected: false, toolCount: 0, error };
  }
}

/** Get MCP status */
export function getMCPStatus(): { connected: boolean; toolCount: number } {
  return { connected: mcpClient !== null && discoveredCount > 0, toolCount: discoveredCount };
}
