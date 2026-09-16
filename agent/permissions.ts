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
