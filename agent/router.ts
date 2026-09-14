// agent/router.ts — Routes user requests to the appropriate model and configuration

import type { ModelPreference } from '@/models/router';

interface RouteDecision {
  modelPreference: ModelPreference;
  requiresTools: boolean;
}

/**
 * Analyze a user message and decide routing parameters.
 * This is a lightweight heuristic; the actual tool selection is done by the model.
 */
export function routeRequest(message: string): RouteDecision {
  const lower = message.toLowerCase();

  // Check if the message likely needs tools
  const toolIndicators = [
    'email', 'gmail', 'mail',
    'doc', 'document', 'google doc',
    'sheet', 'spreadsheet', 'google sheet',
    'notion', 'page',
    'vercel', 'deploy', 'deployment',
    'browse', 'website', 'open', 'navigate', 'search the web',
    'create', 'write', 'send', 'check', 'find', 'list',
    'read', 'get', 'update',
  ];

  const requiresTools = toolIndicators.some((indicator) => lower.includes(indicator));

  // For now, auto = use whatever is available
  // In the future, route based on task complexity
  const modelPreference: ModelPreference = 'auto';

  return { modelPreference, requiresTools };
}
