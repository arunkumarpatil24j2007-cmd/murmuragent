// tools/google/gmail.ts — Production Google Gmail Tools
// Direct integration with official Google Gmail API v1 using authenticated OAuth2Client.

import { google } from 'googleapis';
import { PermissionLevel } from '@/lib/schemas';
import type { ToolDefinition } from '@/lib/schemas';
import { toolRegistry } from '../registry';
import { getAuthenticatedGoogleClient } from '@/lib/google-auth';
import { logger } from '@/lib/logger';

// Helper: parse header value from Gmail message payload
function getHeader(headers: Array<{ name?: string | null; value?: string | null }> | undefined, name: string): string {
  if (!headers) return '';
  const found = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return found?.value || '';
}

// Helper: extract text content from MIME payload parts
function extractBody(payload: any): { text: string; html?: string } {
  let text = '';
  let html = '';

  if (payload.body?.data) {
    const decoded = Buffer.from(payload.body.data, 'base64url').toString('utf8');
    if (payload.mimeType?.includes('html')) {
      html = decoded;
    } else {
      text = decoded;
    }
  }

  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        text += Buffer.from(part.body.data, 'base64url').toString('utf8');
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        html += Buffer.from(part.body.data, 'base64url').toString('utf8');
      } else if (part.parts) {
        const nested = extractBody(part);
        if (nested.text) text += nested.text;
        if (nested.html) html += nested.html;
      }
    }
  }

  return { text: text.trim() || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), html: html || undefined };
}

// Helper: build RFC 2822 raw base64url email string
function buildRawEmail(params: {
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
  threadId?: string;
}): string {
  const lines = [
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
  ];

  if (params.inReplyTo) {
    lines.push(`In-Reply-To: ${params.inReplyTo}`);
  }
  if (params.references) {
    lines.push(`References: ${params.references}`);
  }

  lines.push('', params.body);
  return Buffer.from(lines.join('\r\n')).toString('base64url');
}

// MARK: - Tool Definitions

const gmailSearch: ToolDefinition = {
  name: 'gmail.search',
  description: 'Search Gmail messages using standard query syntax (e.g. "is:unread", "from:support", "subject:meeting"). Returns message summaries.',
  parameters: [
    { name: 'query', type: 'string', description: 'Search query (e.g. "is:unread", "label:inbox", "from:someone@domain.com")', required: true },
    { name: 'maxResults', type: 'number', description: 'Max number of messages to return (default: 10, max: 25)', required: false },
  ],
  permission: PermissionLevel.READ,
  source: 'api',
};

const gmailRead: ToolDefinition = {
  name: 'gmail.read',
  description: 'Read the full contents of a specific email message by ID. Returns sender, recipient, subject, date, body, and attachments metadata.',
  parameters: [
    { name: 'emailId', type: 'string', description: 'The unique Gmail message ID', required: true },
  ],
  permission: PermissionLevel.READ,
  source: 'api',
};

const gmailGetThread: ToolDefinition = {
  name: 'gmail.getThread',
  description: 'Retrieve all messages in a conversation thread by Thread ID.',
  parameters: [
    { name: 'threadId', type: 'string', description: 'The Gmail thread ID', required: true },
  ],
  permission: PermissionLevel.READ,
  source: 'api',
};

const gmailDraft: ToolDefinition = {
  name: 'gmail.draft',
  description: 'Create a draft email in your Gmail account without sending it.',
  parameters: [
    { name: 'to', type: 'string', description: 'Recipient email address', required: true },
    { name: 'subject', type: 'string', description: 'Email subject', required: true },
    { name: 'body', type: 'string', description: 'Email body text', required: true },
  ],
  permission: PermissionLevel.WRITE,
  source: 'api',
};

const gmailSend: ToolDefinition = {
  name: 'gmail.send',
  description: 'Send an email through your connected Gmail account. Requires user confirmation.',
  parameters: [
    { name: 'to', type: 'string', description: 'Recipient email address', required: true },
    { name: 'subject', type: 'string', description: 'Email subject', required: true },
    { name: 'body', type: 'string', description: 'Email body text', required: true },
  ],
  permission: PermissionLevel.DANGEROUS,
  source: 'api',
};

const gmailReply: ToolDefinition = {
  name: 'gmail.reply',
  description: 'Reply to an existing email message within its thread. Requires user confirmation.',
  parameters: [
    { name: 'emailId', type: 'string', description: 'ID of the message to reply to', required: true },
    { name: 'body', type: 'string', description: 'Reply content', required: true },
  ],
  permission: PermissionLevel.DANGEROUS,
  source: 'api',
};

// MARK: - Registrations

export function registerGmailTools(): void {
  // 1. Search
  toolRegistry.register(gmailSearch, async (args) => {
    try {
      const auth = await getAuthenticatedGoogleClient();
      if (!auth) {
        return { success: false, error: 'Google account is not connected. Please connect via /api/auth/google/login' };
      }

      const query = (args.query as string) || '';
      const maxResults = Math.min(Math.max(1, Number(args.maxResults) || 10), 25);
      const gmail = google.gmail({ version: 'v1', auth });

      const listRes = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults,
      });

      const messageItems = listRes.data.messages || [];
      if (messageItems.length === 0) {
        return {
          success: true,
          result: { count: 0, query, messages: [] },
        };
      }

      // Fetch headers in parallel for top messages
      const details = await Promise.all(
        messageItems.map(async (item) => {
          try {
            const meta = await gmail.users.messages.get({
              userId: 'me',
              id: item.id!,
              format: 'metadata',
              metadataHeaders: ['Subject', 'From', 'To', 'Date'],
            });
            const headers = meta.data.payload?.headers;
            return {
              id: item.id,
              threadId: item.threadId,
              subject: getHeader(headers, 'Subject') || '(No Subject)',
              from: getHeader(headers, 'From'),
              to: getHeader(headers, 'To'),
              date: getHeader(headers, 'Date'),
              snippet: meta.data.snippet || '',
            };
          } catch {
            return { id: item.id, threadId: item.threadId, subject: '', from: '', to: '', date: '', snippet: '' };
          }
        })
      );

      return {
        success: true,
        result: {
          count: details.length,
          query,
          messages: details,
        },
      };
    } catch (err: any) {
      logger.error('GmailTool', 'Search failed', { error: String(err) });
      return { success: false, error: `Gmail search error: ${err?.message || String(err)}` };
    }
  });

  // 2. Read Message
  toolRegistry.register(gmailRead, async (args) => {
    try {
      const auth = await getAuthenticatedGoogleClient();
      if (!auth) {
        return { success: false, error: 'Google account is not connected. Please connect via /api/auth/google/login' };
      }

      const emailId = args.emailId as string;
      const gmail = google.gmail({ version: 'v1', auth });

      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: emailId,
        format: 'full',
      });

      const headers = msg.data.payload?.headers;
      const { text, html } = extractBody(msg.data.payload || {});

      const attachments: Array<{ filename: string; mimeType: string; size: number; attachmentId?: string }> = [];
      if (msg.data.payload?.parts) {
        for (const p of msg.data.payload.parts) {
          if (p.filename && p.body) {
            attachments.push({
              filename: p.filename,
              mimeType: p.mimeType || 'application/octet-stream',
              size: p.body.size || 0,
              attachmentId: p.body.attachmentId || undefined,
            });
          }
        }
      }

      return {
        success: true,
        result: {
          id: msg.data.id,
          threadId: msg.data.threadId,
          subject: getHeader(headers, 'Subject') || '(No Subject)',
          from: getHeader(headers, 'From'),
          to: getHeader(headers, 'To'),
          date: getHeader(headers, 'Date'),
          snippet: msg.data.snippet,
          body: text,
          html,
          attachments,
          labels: msg.data.labelIds || [],
          url: `https://mail.google.com/mail/u/0/#inbox/${msg.data.id}`,
        },
      };
    } catch (err: any) {
      logger.error('GmailTool', 'Read failed', { error: String(err) });
      return { success: false, error: `Gmail read error: ${err?.message || String(err)}` };
    }
  });

  // 3. Get Thread
  toolRegistry.register(gmailGetThread, async (args) => {
    try {
      const auth = await getAuthenticatedGoogleClient();
      if (!auth) {
        return { success: false, error: 'Google account is not connected. Please connect via /api/auth/google/login' };
      }

      const threadId = args.threadId as string;
      const gmail = google.gmail({ version: 'v1', auth });

      const thread = await gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'full',
      });

      const messages = (thread.data.messages || []).map((m) => {
        const headers = m.payload?.headers;
        const { text } = extractBody(m.payload || {});
        return {
          id: m.id,
          from: getHeader(headers, 'From'),
          to: getHeader(headers, 'To'),
          date: getHeader(headers, 'Date'),
          snippet: m.snippet,
          body: text,
        };
      });

      return {
        success: true,
        result: {
          threadId,
          messageCount: messages.length,
          messages,
          url: `https://mail.google.com/mail/u/0/#inbox/${threadId}`,
        },
      };
    } catch (err: any) {
      logger.error('GmailTool', 'GetThread failed', { error: String(err) });
      return { success: false, error: `Gmail thread error: ${err?.message || String(err)}` };
    }
  });

  // 4. Draft
  toolRegistry.register(gmailDraft, async (args) => {
    try {
      const auth = await getAuthenticatedGoogleClient();
      if (!auth) {
        return { success: false, error: 'Google account is not connected. Please connect via /api/auth/google/login' };
      }

      const { to, subject, body } = args as { to: string; subject: string; body: string };
      const raw = buildRawEmail({ to, subject, body });
      const gmail = google.gmail({ version: 'v1', auth });

      const draft = await gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: { raw },
        },
      });

      return {
        success: true,
        result: {
          draftId: draft.data.id,
          messageId: draft.data.message?.id,
          recipient: to,
          subject,
          url: `https://mail.google.com/mail/u/0/#drafts`,
        },
      };
    } catch (err: any) {
      logger.error('GmailTool', 'Draft failed', { error: String(err) });
      return { success: false, error: `Gmail draft error: ${err?.message || String(err)}` };
    }
  });

  // 5. Send
  toolRegistry.register(gmailSend, async (args) => {
    try {
      const auth = await getAuthenticatedGoogleClient();
      if (!auth) {
        return { success: false, error: 'Google account is not connected. Please connect via /api/auth/google/login' };
      }

      const { to, subject, body } = args as { to: string; subject: string; body: string };
      const raw = buildRawEmail({ to, subject, body });
      const gmail = google.gmail({ version: 'v1', auth });

      const sent = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw },
      });

      return {
        success: true,
        result: {
          status: 'sent',
          messageId: sent.data.id,
          threadId: sent.data.threadId,
          recipient: to,
          subject,
          url: `https://mail.google.com/mail/u/0/#sent/${sent.data.id}`,
        },
      };
    } catch (err: any) {
      logger.error('GmailTool', 'Send failed', { error: String(err) });
      return { success: false, error: `Gmail send error: ${err?.message || String(err)}` };
    }
  });

  // 6. Reply
  toolRegistry.register(gmailReply, async (args) => {
    try {
      const auth = await getAuthenticatedGoogleClient();
      if (!auth) {
        return { success: false, error: 'Google account is not connected. Please connect via /api/auth/google/login' };
      }

      const { emailId, body } = args as { emailId: string; body: string };
      const gmail = google.gmail({ version: 'v1', auth });

      // Fetch parent message to obtain subject, sender, threadId, Message-ID
      const parent = await gmail.users.messages.get({
        userId: 'me',
        id: emailId,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Message-ID', 'References'],
      });

      const headers = parent.data.payload?.headers;
      const originalSubject = getHeader(headers, 'Subject') || '';
      const replySubject = originalSubject.toLowerCase().startsWith('re:') ? originalSubject : `Re: ${originalSubject}`;
      const to = getHeader(headers, 'From');
      const messageIdHeader = getHeader(headers, 'Message-ID');
      const existingRefs = getHeader(headers, 'References');
      const references = existingRefs ? `${existingRefs} ${messageIdHeader}` : messageIdHeader;

      const raw = buildRawEmail({
        to,
        subject: replySubject,
        body,
        inReplyTo: messageIdHeader,
        references,
      });

      const replyMsg = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw,
          threadId: parent.data.threadId || undefined,
        },
      });

      return {
        success: true,
        result: {
          status: 'replied',
          messageId: replyMsg.data.id,
          threadId: replyMsg.data.threadId,
          recipient: to,
          subject: replySubject,
          url: `https://mail.google.com/mail/u/0/#inbox/${replyMsg.data.threadId}`,
        },
      };
    } catch (err: any) {
      logger.error('GmailTool', 'Reply failed', { error: String(err) });
      return { success: false, error: `Gmail reply error: ${err?.message || String(err)}` };
    }
  });
}
