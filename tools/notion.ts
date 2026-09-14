// tools/notion.ts — Notion tool definitions with real API integration

import { PermissionLevel } from '@/lib/schemas';
import type { ToolDefinition } from '@/lib/schemas';
import { toolRegistry } from './registry';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

const notionSearch: ToolDefinition = {
  name: 'notion.search',
  description: 'Search Notion workspace for pages, databases, and content matching a query.',
  parameters: [
    { name: 'query', type: 'string', description: 'Search query text', required: true },
    { name: 'filter', type: 'string', description: 'Filter type: "page" or "database"', required: false },
  ],
  permission: PermissionLevel.READ,
  source: 'api',
};

const notionReadPage: ToolDefinition = {
  name: 'notion.readPage',
  description: 'Read the content of a Notion page by ID. Returns page properties and content blocks.',
  parameters: [
    { name: 'pageId', type: 'string', description: 'Notion page ID', required: true },
  ],
  permission: PermissionLevel.READ,
  source: 'api',
};

const notionCreatePage: ToolDefinition = {
  name: 'notion.createPage',
  description: 'Create a new Notion page.',
  parameters: [
    { name: 'title', type: 'string', description: 'Page title', required: true },
    { name: 'content', type: 'string', description: 'Page content in plain text', required: false },
    { name: 'parentId', type: 'string', description: 'Parent page ID (optional, uses root if omitted)', required: false },
  ],
  permission: PermissionLevel.WRITE,
  source: 'api',
};

const notionUpdatePage: ToolDefinition = {
  name: 'notion.updatePage',
  description: 'Update an existing Notion page content.',
  parameters: [
    { name: 'pageId', type: 'string', description: 'Notion page ID to update', required: true },
    { name: 'content', type: 'string', description: 'New content to append', required: true },
  ],
  permission: PermissionLevel.WRITE,
  source: 'api',
};

import { connectorsStore } from '@/lib/connectors-store';

async function getNotionToken(): Promise<string | null> {
  return connectorsStore.getConnectorToken('notion');
}

async function notionFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getNotionToken();
  if (!token) {
    throw new Error('Notion API token not configured. Connect your Notion workspace in Connectors.');
  }
  return fetch(`https://api.notion.com/v1${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

export function registerNotionTools(): void {
  // Search
  toolRegistry.register(notionSearch, async (args) => {
    const token = await getNotionToken();
    if (!token) {
      return { success: false, error: 'Notion API token not configured. Connect your Notion workspace in Connectors.' };
    }
    try {
      const body: Record<string, unknown> = { query: args.query as string };
      if (args.filter) {
        body.filter = { value: args.filter, property: 'object' };
      }
      const res = await notionFetch('/search', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.text();
        return { success: false, error: `Notion search failed (${res.status}): ${err}` };
      }
      const data = await res.json();
      const results = data.results?.map((r: Record<string, unknown>) => ({
        id: r.id,
        type: r.object,
        title: extractNotionTitle(r),
        url: r.url,
        lastEdited: r.last_edited_time,
      })) || [];
      return { success: true, result: { count: results.length, results } };
    } catch (err) {
      logger.error('NotionTool', 'Search failed', { error: String(err) });
      return { success: false, error: `Notion search error: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // Read page
  toolRegistry.register(notionReadPage, async (args) => {
    if (!await getNotionToken()) {
      return { success: false, error: 'Notion API token not configured.' };
    }
    try {
      const pageId = args.pageId as string;
      // Get page metadata
      const pageRes = await notionFetch(`/pages/${pageId}`);
      if (!pageRes.ok) {
        const err = await pageRes.text();
        return { success: false, error: `Failed to read page (${pageRes.status}): ${err}` };
      }
      const page = await pageRes.json();

      // Get page content blocks
      const blocksRes = await notionFetch(`/blocks/${pageId}/children?page_size=100`);
      let blocks: unknown[] = [];
      if (blocksRes.ok) {
        const blocksData = await blocksRes.json();
        blocks = blocksData.results?.map((b: Record<string, unknown>) => extractBlockContent(b)) || [];
      }

      return {
        success: true,
        result: {
          id: page.id,
          title: extractNotionTitle(page),
          url: page.url,
          lastEdited: page.last_edited_time,
          content: blocks,
        },
      };
    } catch (err) {
      return { success: false, error: `Notion read error: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // Create page
  toolRegistry.register(notionCreatePage, async (args) => {
    if (!await getNotionToken()) {
      return { success: false, error: 'Notion API token not configured.' };
    }
    try {
      const title = args.title as string;
      const content = args.content as string | undefined;

      // Build page body
      const body: Record<string, unknown> = {
        properties: {
          title: {
            title: [{ text: { content: title } }],
          },
        },
      };

      // If parentId is given, set it; otherwise use workspace root
      if (args.parentId) {
        body.parent = { page_id: args.parentId };
      } else {
        // Create as a workspace-level page
        body.parent = { type: 'page_id', page_id: '' };
      }

      // Add content blocks
      if (content) {
        body.children = content.split('\n').filter(Boolean).map((line) => ({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ text: { content: line } }],
          },
        }));
      }

      // Try creating without parent first (workspace level page)
      if (!args.parentId) {
        // Search for any page to use as parent context, or just try
        body.parent = { type: 'workspace', workspace: true };
      }

      const res = await notionFetch('/pages', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        return { success: false, error: `Failed to create page (${res.status}): ${err}` };
      }

      const page = await res.json();
      return {
        success: true,
        result: {
          id: page.id,
          title,
          url: page.url,
          message: `Created Notion page "${title}"`,
        },
      };
    } catch (err) {
      return { success: false, error: `Notion create error: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // Update page
  toolRegistry.register(notionUpdatePage, async (args) => {
    if (!await getNotionToken()) {
      return { success: false, error: 'Notion API token not configured.' };
    }
    try {
      const pageId = args.pageId as string;
      const content = args.content as string;

      const children = content.split('\n').filter(Boolean).map((line) => ({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ text: { content: line } }],
        },
      }));

      const res = await notionFetch(`/blocks/${pageId}/children`, {
        method: 'PATCH',
        body: JSON.stringify({ children }),
      });

      if (!res.ok) {
        const err = await res.text();
        return { success: false, error: `Failed to update page (${res.status}): ${err}` };
      }

      return { success: true, result: { message: `Updated Notion page ${pageId}` } };
    } catch (err) {
      return { success: false, error: `Notion update error: ${err instanceof Error ? err.message : String(err)}` };
    }
  });
}

function extractNotionTitle(obj: Record<string, unknown>): string {
  const props = obj.properties as Record<string, unknown> | undefined;
  if (!props) return 'Untitled';

  // Try title property
  const titleProp = props.title || props.Title || props.Name;
  if (titleProp && typeof titleProp === 'object') {
    const tp = titleProp as Record<string, unknown>;
    if (tp.title && Array.isArray(tp.title)) {
      return tp.title.map((t: Record<string, unknown>) => (t.plain_text || '')).join('');
    }
  }

  return 'Untitled';
}

function extractBlockContent(block: Record<string, unknown>): Record<string, unknown> {
  const type = block.type as string;
  const content = block[type] as Record<string, unknown> | undefined;
  let text = '';

  if (content?.rich_text && Array.isArray(content.rich_text)) {
    text = content.rich_text.map((t: Record<string, unknown>) => t.plain_text || '').join('');
  }

  return { type, text, id: block.id };
}
