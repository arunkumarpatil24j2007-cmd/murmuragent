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

const docsGenerateProposal: ToolDefinition = {
  name: 'docs.generateProposal',
  description:
    'Generate a comprehensive, client-ready business proposal or project document in Google Docs. Includes Executive Summary, Scope of Work, Deliverables, Timeline, and Commercials.',
  parameters: [
    { name: 'clientName', type: 'string', description: 'Name of the client or company (e.g. "ABC Interiors", "Acme Corp")', required: true },
    { name: 'title', type: 'string', description: 'Title of the proposal', required: false },
    { name: 'scope', type: 'string', description: 'Overview of work or project objectives', required: false },
    { name: 'deliverables', type: 'string', description: 'Key deliverables or phases', required: false },
    { name: 'budget', type: 'string', description: 'Pricing or investment summary', required: false },
  ],
  permission: PermissionLevel.WRITE,
  source: 'api',
  riskLevel: 'low',
};

// MARK: - Auth Helper

async function getDocsAuth(context?: import('../registry').ToolContext) {
  if (!context?.userId) {
    return {
      error: 'You are not logged in. Please sign in to Murmur and connect your Google account in the Connections tab to access Google Docs.',
    };
  }
  const auth = await getAuthenticatedGoogleClient(context.userId);
  if (!auth) {
    return {
      error: 'Google Docs is not connected for your account. Please connect your Google account in the Connections tab.',
    };
  }
  return { auth };
}

// MARK: - Registrations

export function registerDocsTools(): void {
  // 1. Create Document
  toolRegistry.register(docsCreate, async (args, context) => {
    try {
      const { auth, error } = await getDocsAuth(context);
      if (error || !auth) {
        return { success: false, error };
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
  toolRegistry.register(docsRead, async (args, context) => {
    try {
      const { auth, error } = await getDocsAuth(context);
      if (error || !auth) {
        return { success: false, error };
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
  toolRegistry.register(docsUpdate, async (args, context) => {
    try {
      const { auth, error } = await getDocsAuth(context);
      if (error || !auth) {
        return { success: false, error };
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

  // 4. Generate Proposal
  toolRegistry.register(docsGenerateProposal, async (args, context) => {
    try {
      const { auth, error } = await getDocsAuth(context);
      if (error || !auth) {
        return { success: false, error };
      }

      const clientName = (args.clientName as string) || 'Client';
      const docTitle = (args.title as string) || `Project Proposal — ${clientName}`;
      const scope = (args.scope as string) || 'Full-scope strategic consulting and implementation services tailored to client requirements.';
      const deliverables = (args.deliverables as string) || 'Phase 1: Discovery & Architecture\nPhase 2: Core Development & Integration\nPhase 3: QA, Staging & Production Handover';
      const budget = (args.budget as string) || 'Scope-based fixed milestones with milestone acceptance sign-offs.';

      const content = [
        `PROJECT PROPOSAL FOR ${clientName.toUpperCase()}`,
        `Prepared on: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
        '',
        '1. EXECUTIVE SUMMARY',
        `This proposal outlines the strategic roadmap, deliverables, and technical execution plan for ${clientName}. Our objective is to deliver high-impact, autonomous workflow integrations that streamline operations.`,
        '',
        '2. SCOPE OF WORK',
        scope,
        '',
        '3. KEY DELIVERABLES & TIMELINE',
        deliverables,
        '',
        '4. COMMERCIALS & INVESTMENT',
        budget,
        '',
        '5. NEXT STEPS',
        'Upon approval of this proposal, we will initiate Phase 1 Discovery and schedule the project kickoff meeting.',
      ].join('\n');

      const docs = google.docs({ version: 'v1', auth });

      const createRes = await docs.documents.create({
        requestBody: { title: docTitle },
      });

      const documentId = createRes.data.documentId;
      if (!documentId) {
        throw new Error('Google Docs API failed to return documentId');
      }

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

      const url = `https://docs.google.com/document/d/${documentId}/edit`;
      return {
        success: true,
        result: {
          documentId,
          title: docTitle,
          client: clientName,
          url,
          preview: content.slice(0, 400),
          markdownLink: `[${docTitle}](${url})`,
        },
      };
    } catch (err: any) {
      logger.error('DocsTool', 'Generate proposal failed', { error: String(err) });
      return { success: false, error: `Docs generateProposal error: ${err?.message || String(err)}` };
    }
  });
}
