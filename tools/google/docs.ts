// tools/google/docs.ts — Production Google Docs Tools
// Direct integration with official Google Docs API v1 using authenticated OAuth2Client.
// Generates genuine Google Docs documents and returns actual, clickable docs.google.com URLs.

import { google } from 'googleapis';
import { PermissionLevel } from '@/lib/schemas';
import type { ToolDefinition } from '@/lib/schemas';
import { toolRegistry } from '../registry';
import { getAuthenticatedGoogleClient } from '@/lib/google-auth';
import { logger } from '@/lib/logger';

// Helper: extract readable text from Google Docs structural body elements
function extractDocumentText(content: any[] | undefined): string {
  if (!content || !Array.isArray(content)) return '';
  let fullText = '';

  for (const element of content) {
    if (element.paragraph?.elements) {
      for (const pElem of element.paragraph.elements) {
        if (pElem.textRun?.content) {
          fullText += pElem.textRun.content;
        }
      }
    } else if (element.table?.tableRows) {
      for (const row of element.table.tableRows) {
        const cells: string[] = [];
        for (const cell of row.tableCells || []) {
          cells.push(extractDocumentText(cell.content).trim());
        }
        fullText += `| ${cells.join(' | ')} |\n`;
      }
    }
  }

  return fullText.trim();
}

// MARK: - Tool Definitions

const docsCreate: ToolDefinition = {
  name: 'docs.create',
  description: 'Create an authentic Google Doc in your Google Drive with a title and optional text. Returns the genuine Google Docs web URL.',
  parameters: [
    { name: 'title', type: 'string', description: 'Document title', required: true },
    { name: 'content', type: 'string', description: 'Initial document content or outline', required: false },
  ],
  permission: PermissionLevel.WRITE,
  source: 'api',
};

const docsRead: ToolDefinition = {
  name: 'docs.read',
  description: 'Read the full text content and metadata of a real Google Doc by Document ID.',
  parameters: [
    { name: 'documentId', type: 'string', description: 'The Google Doc ID', required: true },
  ],
  permission: PermissionLevel.READ,
  source: 'api',
};

const docsUpdate: ToolDefinition = {
  name: 'docs.update',
  description: 'Insert or append text content to an existing Google Doc.',
  parameters: [
    { name: 'documentId', type: 'string', description: 'The Google Doc ID', required: true },
    { name: 'content', type: 'string', description: 'Text content to append', required: true },
  ],
  permission: PermissionLevel.WRITE,
  source: 'api',
};

// MARK: - Registrations

export function registerDocsTools(): void {
  // 1. Create Document
  toolRegistry.register(docsCreate, async (args) => {
    try {
      const auth = await getAuthenticatedGoogleClient();
      if (!auth) {
        return { success: false, error: 'Google account is not connected. Please connect via /api/auth/google/login' };
      }

      const title = (args.title as string) || 'Untitled Document';
      const content = (args.content as string) || '';
      const docs = google.docs({ version: 'v1', auth });

      // Step 1: Create the document via Google Docs API
      const createRes = await docs.documents.create({
        requestBody: {
          title,
        },
      });

      const documentId = createRes.data.documentId;
      if (!documentId) {
        throw new Error('Google Docs API did not return a documentId');
      }

      // Step 2: If initial content provided, insert it at index 1
      if (content.trim()) {
        await docs.documents.batchUpdate({
          documentId,
          requestBody: {
            requests: [
              {
                insertText: {
                  location: { index: 1 },
                  text: `${content}\n`,
                },
              },
            ],
          },
        });
      }

      const url = `https://docs.google.com/document/d/${documentId}/edit`;
      logger.info('DocsTool', 'Successfully created authentic Google Doc', { documentId, title });

      return {
        success: true,
        result: {
          documentId,
          title: createRes.data.title || title,
          url,
          createdAt: new Date().toISOString(),
        },
      };
    } catch (err: any) {
      logger.error('DocsTool', 'Create doc failed', { error: String(err) });
      return { success: false, error: `Docs create error: ${err?.message || String(err)}` };
    }
  });

  // 2. Read Document
  toolRegistry.register(docsRead, async (args) => {
    try {
      const auth = await getAuthenticatedGoogleClient();
      if (!auth) {
        return { success: false, error: 'Google account is not connected. Please connect via /api/auth/google/login' };
      }

      const documentId = args.documentId as string;
      const docs = google.docs({ version: 'v1', auth });

      const doc = await docs.documents.get({
        documentId,
      });

      const fullText = extractDocumentText(doc.data.body?.content);
      const url = `https://docs.google.com/document/d/${documentId}/edit`;

      return {
        success: true,
        result: {
          documentId,
          title: doc.data.title,
          content: fullText,
          characterCount: fullText.length,
          revisionId: doc.data.revisionId,
          url,
        },
      };
    } catch (err: any) {
      logger.error('DocsTool', 'Read doc failed', { error: String(err) });
      return { success: false, error: `Docs read error: ${err?.message || String(err)}` };
    }
  });

  // 3. Update / Append Document
  toolRegistry.register(docsUpdate, async (args) => {
    try {
      const auth = await getAuthenticatedGoogleClient();
      if (!auth) {
        return { success: false, error: 'Google account is not connected. Please connect via /api/auth/google/login' };
      }

      const documentId = args.documentId as string;
      const content = args.content as string;
      const docs = google.docs({ version: 'v1', auth });

      // Fetch document to discover the end index of the body
      const doc = await docs.documents.get({ documentId });
      const bodyElements = doc.data.body?.content || [];
      const lastElem = bodyElements[bodyElements.length - 1];
      const endIndex = (lastElem?.endIndex ? lastElem.endIndex - 1 : 1);

      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: { index: Math.max(1, endIndex) },
                text: `\n${content}\n`,
              },
            },
          ],
        },
      });

      const url = `https://docs.google.com/document/d/${documentId}/edit`;
      return {
        success: true,
        result: {
          documentId,
          title: doc.data.title,
          appendedLength: content.length,
          url,
          updatedAt: new Date().toISOString(),
        },
      };
    } catch (err: any) {
      logger.error('DocsTool', 'Update doc failed', { error: String(err) });
      return { success: false, error: `Docs update error: ${err?.message || String(err)}` };
    }
  });
}
