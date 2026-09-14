// agent/executor.ts — Executes tool calls with permission checking and error handling

import { toolRegistry } from '@/tools/registry';
import { canAutoExecute, validateToolArguments } from './permissions';
import { logger } from '@/lib/logger';
import type { ToolCall, ToolResult, AgentEvent } from '@/lib/schemas';

export interface ExecutionContext {
  /** Callback to emit events to the UI */
  emit: (event: AgentEvent) => void;
  /** Pending permission requests (for DANGEROUS tools) */
  pendingPermission?: {
    toolCall: ToolCall;
    resolve: (allowed: boolean) => void;
  };
  /** Optional cancellation signal to terminate actions */
  signal?: AbortSignal;
}

/**
 * Execute a single tool call.
 * Checks permissions, validates arguments, runs the tool, and returns the result.
 */
export async function executeToolCall(
  toolCall: ToolCall,
  ctx: ExecutionContext
): Promise<ToolResult> {
  if (ctx.signal?.aborted) {
    return {
      toolCallId: toolCall.id,
      tool: toolCall.tool,
      success: false,
      error: 'Action terminated by user.',
    };
  }

  const definition = toolRegistry.getDefinition(toolCall.tool);

  if (!definition) {
    ctx.emit({
      type: 'tool_failed',
      timestamp: new Date().toISOString(),
      data: {
        tool: toolCall.tool,
        toolCallId: toolCall.id,
        error: `Unknown tool: ${toolCall.tool}`,
      },
    });
    return {
      toolCallId: toolCall.id,
      tool: toolCall.tool,
      success: false,
      error: `Unknown tool: ${toolCall.tool}. Available tools: ${toolRegistry.getAllDefinitions().map(t => t.name).join(', ')}`,
    };
  }

  // Validate arguments
  const validation = validateToolArguments(definition, toolCall.arguments);
  if (!validation.valid) {
    ctx.emit({
      type: 'tool_failed',
      timestamp: new Date().toISOString(),
      data: {
        tool: toolCall.tool,
        toolCallId: toolCall.id,
        error: validation.reason!,
      },
    });
    return {
      toolCallId: toolCall.id,
      tool: toolCall.tool,
      success: false,
      error: `Invalid arguments: ${validation.reason}`,
    };
  }

  // Check permissions
  if (!canAutoExecute(definition)) {
    ctx.emit({
      type: 'permission_required',
      timestamp: new Date().toISOString(),
      data: {
        tool: toolCall.tool,
        toolCallId: toolCall.id,
        action: `${toolCall.tool}: ${JSON.stringify(toolCall.arguments)}`,
        permission: definition.permission,
      },
    });

    // In V1, we auto-deny dangerous tools without explicit approval mechanism.
    // The UI will show the permission request but the agent will receive a denial.
    return {
      toolCallId: toolCall.id,
      tool: toolCall.tool,
      success: false,
      error: `Tool ${toolCall.tool} requires user confirmation (${definition.permission} permission level). The user must explicitly approve this action.`,
    };
  }

  // Emit tool started event
  ctx.emit({
    type: 'tool_started',
    timestamp: new Date().toISOString(),
    data: {
      tool: toolCall.tool,
      toolCallId: toolCall.id,
      action: humanReadableAction(toolCall),
    },
  });

  // Execute the tool
  const result = await toolRegistry.execute(toolCall.tool, toolCall.arguments);
  result.toolCallId = toolCall.id;

  // Emit result event
  if (result.success) {
    const extracted = extractResourceMeta(result.result, toolCall.arguments);

    ctx.emit({
      type: 'tool_result',
      timestamp: new Date().toISOString(),
      data: {
        tool: toolCall.tool,
        toolCallId: toolCall.id,
        status: 'success',
        result: summarizeResult(result.result, toolCall),
        url: extracted.url,
        title: extracted.title,
      },
    });
  } else {
    ctx.emit({
      type: 'tool_failed',
      timestamp: new Date().toISOString(),
      data: {
        tool: toolCall.tool,
        toolCallId: toolCall.id,
        error: result.error || 'Unknown error',
      },
    });
  }

  return result;
}

function humanReadableAction(call: ToolCall): string {
  const parts = call.tool.split('.');
  const service = parts[0];
  const action = parts.slice(1).join('.');

  const actionMap: Record<string, string> = {
    'gmail.search': 'Searching Gmail',
    'gmail.read': 'Reading email',
    'gmail.send': 'Sending email',
    'docs.create': 'Creating Google Doc',
    'docs.read': 'Reading Google Doc',
    'docs.update': 'Updating Google Doc',
    'sheets.create': 'Creating Google Sheet',
    'sheets.read': 'Reading Google Sheet',
    'sheets.update': 'Updating Google Sheet',
    'notion.search': 'Searching Notion',
    'notion.readPage': 'Reading Notion page',
    'notion.createPage': 'Creating Notion page',
    'notion.updatePage': 'Updating Notion page',
    'vercel.listProjects': 'Listing Vercel projects',
    'vercel.getProject': 'Getting Vercel project details',
    'vercel.listDeployments': 'Checking Vercel deployments',
    'vercel.getDeployment': 'Inspecting deployment',
    'browser.navigate': `Navigating to ${call.arguments.url || 'page'}`,
    'browser.extract': 'Extracting page content',
    'browser.screenshot': 'Taking screenshot',
  };

  return actionMap[call.tool] || `Running ${service}.${action}`;
}

function extractResourceMeta(
  result: unknown,
  args?: Record<string, unknown>
): { url?: string; title?: string } {
  let url: string | undefined;
  let title: string | undefined;

  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>;
    if (typeof r.url === 'string' && r.url.startsWith('http')) url = r.url;
    else if (typeof r.link === 'string' && r.link.startsWith('http')) url = r.link;
    else if (typeof r.html_url === 'string' && r.html_url.startsWith('http')) url = r.html_url;

    if (typeof r.title === 'string') title = r.title;
    else if (typeof r.name === 'string') title = r.name;
  }

  if (!title && args) {
    if (typeof args.title === 'string') title = args.title;
    else if (typeof args.name === 'string') title = args.name;
  }

  if (!url && typeof result === 'string') {
    const match = result.match(/https?:\/\/[^\s"'<>\)]+/);
    if (match) url = match[0];
  }

  if (!url && args && typeof args.url === 'string' && args.url.startsWith('http')) {
    url = args.url;
  }

  return { url, title };
}

function summarizeResult(result: unknown, call?: ToolCall): string {
  if (!result) return 'Done';
  if (typeof result === 'string') return result.slice(0, 200);
  if (typeof result === 'object') {
    const r = result as Record<string, unknown>;
    if (r.message) return String(r.message);
    if (r.title && r.url) return `${r.title} (${r.url})`;
    if (r.url) return `URL: ${r.url}`;
    if (r.count !== undefined) return `Found ${r.count} results`;
    return JSON.stringify(result).slice(0, 200);
  }
  return String(result).slice(0, 200);
}

