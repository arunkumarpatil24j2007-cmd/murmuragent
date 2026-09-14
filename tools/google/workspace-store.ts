// tools/google/workspace-store.ts — Local Workspace Provider for Google Docs, Sheets, and Gmail
// Provides stateful execution, document creation, spreadsheet tracking, and email drafting.

import { v4 as uuid } from 'uuid';

export interface LocalEmail {
  id: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  body: string;
  date: string;
  read: boolean;
}

export interface LocalDoc {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface LocalSheet {
  id: string;
  title: string;
  headers: string[];
  data: string[][];
  createdAt: string;
  updatedAt: string;
}

class WorkspaceStore {
  private emails: LocalEmail[] = [
    {
      id: 'msg_101',
      from: 'alex.design@company.com',
      to: 'arunkumarpatil24j2007@gmail.com',
      subject: 'New client design specifications for Murmur Flow',
      snippet: 'Hi Arunkumar, I have uploaded the updated Figma tokens and macOS card mockups...',
      body: 'Hi Arunkumar,\n\nI have uploaded the updated Figma tokens and macOS card mockups for the Murmur Flow project. Please take a look at the card radius and dark pill button components.\n\nBest,\nAlex',
      date: '2026-09-10T14:30:00Z',
      read: false,
    },
    {
      id: 'msg_102',
      from: 'notifications@vercel.com',
      to: 'arunkumarpatil24j2007@gmail.com',
      subject: 'Production Deployment Successful: project-qggul',
      snippet: 'Your project-qggul deployment is now live on Vercel at project-qggul.vercel.app',
      body: 'Your project-qggul deployment was promoted to production successfully.\nCommit: Delete about.html\nState: READY\nDomain: project-qggul.vercel.app',
      date: '2026-09-10T09:15:00Z',
      read: true,
    },
    {
      id: 'msg_103',
      from: 'team@notion.so',
      to: 'arunkumarpatil24j2007@gmail.com',
      subject: 'Weekly Notion Workspace Activity Summary',
      snippet: '5 updates made to Jamadar Constructions and Icraft Designs lead records',
      body: 'Here is your weekly summary of activity across the Tweak Media workspace. New leads followed up: 3.\nDeals in progress: 4.',
      date: '2026-09-09T18:00:00Z',
      read: true,
    },
  ];

  private docs: Map<string, LocalDoc> = new Map([
    [
      'doc_201',
      {
        id: 'doc_201',
        title: 'Murmur Agent Architecture & System Design',
        content: '# Murmur Agent Architecture\n\n- Multimodal Agent Loop with dynamic model router\n- Real-time Server-Sent Events (SSE) streaming\n- Tool execution engine for Notion, Vercel, Airtop, Palmier MCP\n- Privacy window retention policy',
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-10T12:00:00Z',
      },
    ],
  ]);

  private sheets: Map<string, LocalSheet> = new Map([
    [
      'sheet_301',
      {
        id: 'sheet_301',
        title: 'Q3 Client Pipelines & Budget Tracking',
        headers: ['Client', 'Service', 'Total Value', 'Advance Paid', 'Status'],
        data: [
          ['Jamadar Constructions', 'Website & SEO', '₹15,000', '₹5,000', 'Follow-up'],
          ['Icraft Designs', 'Web Development', '₹20,000', '₹10,000', 'In Progress'],
          ['Hercules Fitness', 'Website Maintenance', '₹5,000', '₹2,000', 'Active'],
        ],
        createdAt: '2026-08-20T08:00:00Z',
        updatedAt: '2026-09-08T15:00:00Z',
      },
    ],
  ]);

  // Gmail methods
  searchEmails(query: string, maxResults = 20): LocalEmail[] {
    const q = query.toLowerCase();
    return this.emails
      .filter((e) =>
        e.subject.toLowerCase().includes(q) ||
        e.from.toLowerCase().includes(q) ||
        e.body.toLowerCase().includes(q) ||
        e.snippet.toLowerCase().includes(q) ||
        q === 'is:unread' && !e.read ||
        q === ''
      )
      .slice(0, maxResults);
  }

  getEmail(id: string): LocalEmail | undefined {
    return this.emails.find((e) => e.id === id);
  }

  sendEmail(to: string, subject: string, body: string): { id: string; status: string } {
    const newEmail: LocalEmail = {
      id: `msg_${uuid().slice(0, 8)}`,
      from: 'arunkumarpatil24j2007@gmail.com',
      to,
      subject,
      snippet: body.slice(0, 80),
      body,
      date: new Date().toISOString(),
      read: true,
    };
    this.emails.unshift(newEmail);
    return { id: newEmail.id, status: 'sent' };
  }

  // Google Docs methods
  createDoc(title: string, content = ''): LocalDoc {
    const id = `doc_${uuid().slice(0, 8)}`;
    const doc: LocalDoc = {
      id,
      title,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.docs.set(id, doc);
    return doc;
  }

  getDoc(id: string): LocalDoc | undefined {
    return this.docs.get(id);
  }

  updateDoc(id: string, newContent: string): LocalDoc | undefined {
    const doc = this.docs.get(id);
    if (!doc) return undefined;
    doc.content += `\n${newContent}`;
    doc.updatedAt = new Date().toISOString();
    return doc;
  }

  listDocs(): LocalDoc[] {
    return Array.from(this.docs.values());
  }

  // Google Sheets methods
  createSheet(title: string, headers?: string[], data?: string[][]): LocalSheet {
    const id = `sheet_${uuid().slice(0, 8)}`;
    const sheet: LocalSheet = {
      id,
      title,
      headers: headers || ['Col A', 'Col B', 'Col C'],
      data: data || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.sheets.set(id, sheet);
    return sheet;
  }

  getSheet(id: string): LocalSheet | undefined {
    return this.sheets.get(id);
  }

  updateSheet(id: string, range: string, rowData: string[][]): LocalSheet | undefined {
    const sheet = this.sheets.get(id);
    if (!sheet) return undefined;
    sheet.data.push(...rowData);
    sheet.updatedAt = new Date().toISOString();
    return sheet;
  }

  listSheets(): LocalSheet[] {
    return Array.from(this.sheets.values());
  }
}

export const workspaceStore = new WorkspaceStore();
