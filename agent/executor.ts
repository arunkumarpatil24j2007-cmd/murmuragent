// agent/executor.ts — Executes tool calls with permission checking and error handling

import { toolRegistry } from '@/tools/registry';
import { canAutoExecute, validateToolArguments, registerPendingPermission } from './permissions';
import { logger } from '@/lib/logger';
import type { ToolCall, ToolResult, AgentEvent } from '@/lib/schemas';

export interface ExecutionContext {
  /** Callback to emit events to the UI */
  emit: (event: AgentEvent) => void;
  /** Optional cancellation signal to terminate actions */
  signal?: AbortSignal;
  /** Authenticated user id if logged in, null for guest */
  userId?: string | null;
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

  // Check permissions: if sensitive/external/destructive, pause execution and wait for user response from Notch
  if (!canAutoExecute(definition)) {
    const actionDesc = humanReadableAction(toolCall);
    ctx.emit({
      type: 'permission_required',
      timestamp: new Date().toISOString(),
      data: {
        tool: toolCall.tool,
        toolCallId: toolCall.id,
        action: actionDesc,
        permission: definition.permission,
        requiresConfirmation: true,
        text: `Permission required to ${actionDesc}`,
      },
    });

    const allowed = await registerPendingPermission(
      toolCall.id,
      toolCall.tool,
      actionDesc,
      toolCall.arguments,
      ctx.signal
    );

    if (!allowed) {
      ctx.emit({
        type: 'tool_failed',
        timestamp: new Date().toISOString(),
        data: {
          tool: toolCall.tool,
          toolCallId: toolCall.id,
          error: 'User denied permission',
          retryable: false,
        },
      });

      return {
        toolCallId: toolCall.id,
        tool: toolCall.tool,
        success: false,
        error: `User denied permission to execute ${toolCall.tool} (${actionDesc}). Explain to the user that the action was not executed.`,
      };
    }
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

  // Execute the tool with user context
  const result = await toolRegistry.execute(toolCall.tool, toolCall.arguments, {
    userId: ctx.userId,
    signal: ctx.signal,
  });
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
        retryable: true,
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
    'gmail.reply': 'Replying to email',
    'gmail.draft': 'Drafting email',
    'gmail.listUnanswered': 'Finding unanswered emails',
    'gmail.extractLeads': 'Extracting leads from Gmail',
    'calendar.listEvents': 'Checking calendar events',
    'calendar.createEvent': 'Scheduling calendar event',
    'calendar.updateEvent': 'Updating calendar event',
    'calendar.deleteEvent': 'Cancelling calendar event',
    'calendar.meetingPrep': 'Preparing meeting briefing',
    'drive.search': 'Searching Google Drive',
    'drive.list': 'Listing Drive files',
    'drive.get': 'Reading file details',
    'drive.createFolder': 'Creating Drive folder',
    'docs.create': 'Creating Google Doc',
    'docs.read': 'Reading Google Doc',
    'docs.update': 'Updating Google Doc',
    'docs.generateProposal': 'Generating proposal in Google Docs',
    'sheets.create': 'Creating Google Sheet',
    'sheets.read': 'Reading Google Sheet',
    'sheets.update': 'Updating Google Sheet',
    'sheets.append': 'Appending rows to Google Sheet',
    'sheets.appendLeads': 'Adding leads to Google Sheet',
    'web.search': 'Searching the web',
    'web.open': `Reading webpage (${call.arguments.url || 'URL'})`,
    'web.extract': 'Extracting web data',
    'web.compare': 'Comparing websites',
    'files.read': 'Reading document',
    'files.analyzeTable': 'Analyzing tabular data',
    'files.compare': 'Comparing documents',
    'files.summarize': 'Summarizing document',
    'linkedin.create_post': 'Drafting LinkedIn post',
    'linkedin.publish_post': 'Publishing post to LinkedIn',
    'social.content_calendar': 'Building content calendar',
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

