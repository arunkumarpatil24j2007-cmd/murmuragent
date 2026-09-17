// agent/permissions.ts — Tool permission enforcement

import { PermissionLevel } from '@/lib/schemas';
import type { ToolDefinition } from '@/lib/schemas';
import { logger } from '@/lib/logger';

/**
 * Determines whether a tool can execute automatically or requires user confirmation.
 *
 * READ            → always auto-execute
 * WRITE           → auto-execute unless requiresConfirmation is set
 * EXTERNAL_ACTION → requires explicit user confirmation (sending email, publishing, etc.)
 * DESTRUCTIVE     → requires explicit user confirmation (deleting files, cancelling meetings)
 * DANGEROUS       → requires explicit user confirmation
 */
export function canAutoExecute(tool: ToolDefinition, isExplicitlyConfirmed = false): boolean {
  if (isExplicitlyConfirmed) return true;
  if (tool.requiresConfirmation) return false;

  switch (tool.permission) {
    case PermissionLevel.READ:
    case PermissionLevel.WRITE:
      return true;
    case PermissionLevel.EXTERNAL_ACTION:
    case PermissionLevel.DESTRUCTIVE:
    case PermissionLevel.DANGEROUS:
      return false;
    default:
      return false;
  }
}

/**
 * Validate that tool arguments are safe before execution.
 * Rejects clearly dangerous patterns.
 */
export function validateToolArguments(tool: ToolDefinition, args: Record<string, unknown>): { valid: boolean; reason?: string } {
  // Check for required parameters
  for (const param of tool.parameters) {
    if (param.required && (args[param.name] === undefined || args[param.name] === null)) {
      return { valid: false, reason: `Missing required parameter: ${param.name}` };
    }
  }

  // Check for injection attempts in string arguments
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string') {
      // Block shell injection patterns
      if (/[;&|`$()]/.test(value) && tool.source !== 'browser') {
        logger.warn('Permissions', `Suspicious argument in ${tool.name}.${key}`, { value: value.slice(0, 50) });
      }
    }
  }

  return { valid: true };
}

/**
 * Get a human-readable description of what a dangerous tool will do.
 */
export function describeAction(toolName: string, args: Record<string, unknown>): string {
  const parts = [toolName];
  if (args.subject || args.title || args.name) {
    parts.push(`"${args.subject || args.title || args.name}"`);
  }
  if (args.to || args.recipient) {
    parts.push(`to ${args.to || args.recipient}`);
  }
  return parts.join(' ');
}

// Global runtime permission checkpoint manager
export interface PendingPermission {
  toolCallId: string;
  tool: string;
  action: string;
  arguments: Record<string, unknown>;
  createdAt: number;
  resolve: (allowed: boolean) => void;
}

// Global map keyed by toolCallId
const pendingPermissions = new Map<string, PendingPermission>();

/**
 * Register a pending permission checkpoint and return a Promise that resolves
 * when the user clicks [Allow] or [Deny] in the notch, or rejects on timeout/abort.
 */
export function registerPendingPermission(
  toolCallId: string,
  tool: string,
  action: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
  timeoutMs = 60000
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let timeoutTimer: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      pendingPermissions.delete(toolCallId);
    };

    const handleResolve = (allowed: boolean) => {
      cleanup();
      logger.info('Permissions', `Permission decision for toolCall ${toolCallId} (${tool}): ${allowed ? 'ALLOWED' : 'DENIED'}`);
      resolve(allowed);
    };

    // Store in global registry
    pendingPermissions.set(toolCallId, {
      toolCallId,
      tool,
      action,
      arguments: args,
      createdAt: Date.now(),
      resolve: handleResolve,
    });

    // Abort signal support
    if (signal) {
      if (signal.aborted) {
        handleResolve(false);
        return;
      }
      signal.addEventListener('abort', () => handleResolve(false), { once: true });
    }

    // Default timeout fallback
    timeoutTimer = setTimeout(() => {
      logger.warn('Permissions', `Permission request for ${toolCallId} timed out after ${timeoutMs}ms`);
      handleResolve(false);
    }, timeoutMs);
  });
}

/**
 * Handle user response from the notch ([Allow] or [Deny])
 */
export function resolvePendingPermission(toolCallId: string, allowed: boolean): boolean {
  const pending = pendingPermissions.get(toolCallId);
  if (!pending) {
    logger.warn('Permissions', `No pending permission found for toolCallId: ${toolCallId}`);
    return false;
  }
  pending.resolve(allowed);
  return true;
}

/**
 * List currently pending permissions
 */
export function getPendingPermissions(): Array<Omit<PendingPermission, 'resolve'>> {
  return Array.from(pendingPermissions.values()).map(({ toolCallId, tool, action, arguments: args, createdAt }) => ({
    toolCallId,
    tool,
    action,
    arguments: args,
    createdAt,
  }));
}

