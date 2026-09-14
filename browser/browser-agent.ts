// browser/browser-agent.ts — Browser tools that register into the unified tool registry

import { PermissionLevel } from '@/lib/schemas';
import type { ToolDefinition } from '@/lib/schemas';
import { toolRegistry } from '@/tools/registry';
import { airtopClient } from './airtop';

const browserNavigate: ToolDefinition = {
  name: 'browser.navigate',
  description: 'Navigate the browser to a URL. Opens a web page for inspection, extraction, or interaction.',
  parameters: [
    { name: 'url', type: 'string', description: 'The URL to navigate to', required: true },
  ],
  permission: PermissionLevel.READ,
  source: 'browser',
};

const browserExtract: ToolDefinition = {
  name: 'browser.extract',
  description: 'Extract information from the currently loaded web page using a natural language prompt. Navigate to a URL first.',
  parameters: [
    { name: 'prompt', type: 'string', description: 'What information to extract from the page (e.g., "Find the pricing plans", "Get all product names")', required: true },
  ],
  permission: PermissionLevel.READ,
  source: 'browser',
};

const browserScreenshot: ToolDefinition = {
  name: 'browser.screenshot',
  description: 'Take a screenshot of the currently loaded web page.',
  parameters: [],
  permission: PermissionLevel.READ,
  source: 'browser',
};

export function registerBrowserTools(): void {
  toolRegistry.register(browserNavigate, async (args) => {
    if (!(await airtopClient.isAvailable())) {
      return { success: false, error: 'Airtop API key not configured. Set AIRTOP_API_KEY in environment to enable browser automation.' };
    }
    const result = await airtopClient.navigate(args.url as string);
    return result;
  });

  toolRegistry.register(browserExtract, async (args) => {
    if (!(await airtopClient.isAvailable())) {
      return { success: false, error: 'Airtop API key not configured. Set AIRTOP_API_KEY in environment to enable browser automation.' };
    }
    const result = await airtopClient.extract(args.prompt as string);
    return result;
  });

  toolRegistry.register(browserScreenshot, async () => {
    if (!(await airtopClient.isAvailable())) {
      return { success: false, error: 'Airtop API key not configured.' };
    }
    const result = await airtopClient.screenshot();
    return result;
  });
}
