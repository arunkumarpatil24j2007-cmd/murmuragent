// tools/google/sheets.ts — Production Google Sheets Tools
// Direct integration with official Google Sheets API v4 using authenticated OAuth2Client.
// Generates genuine Google Sheets spreadsheets and returns actual docs.google.com/spreadsheets URLs.

import { google } from 'googleapis';
import { PermissionLevel } from '@/lib/schemas';
import type { ToolDefinition } from '@/lib/schemas';
import { toolRegistry } from '../registry';
import { getAuthenticatedGoogleClient } from '@/lib/google-auth';
import { logger } from '@/lib/logger';

// Helper: parse tabular data from string or array
function parseGridData(raw: unknown): any[][] {
  if (Array.isArray(raw)) {
    return raw.map((row) => (Array.isArray(row) ? row : [row]));
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((row) => (Array.isArray(row) ? row : [row]));
      }
    } catch {
      // Fallback: CSV-like line parsing
      return raw.split('\n').filter((l) => l.trim()).map((l) => l.split(',').map((c) => c.trim()));
    }
  }
  return [];
}

// MARK: - Tool Definitions

const sheetsCreate: ToolDefinition = {
  name: 'sheets.create',
  description: 'Create an authentic Google Spreadsheet in your Google Drive with a title, optional headers, and rows. Returns the genuine Google Sheets URL.',
  parameters: [
    { name: 'title', type: 'string', description: 'Spreadsheet title', required: true },
    { name: 'headers', type: 'string', description: 'Comma-separated column headers (e.g. "Name, Role, Status")', required: false },
    { name: 'data', type: 'string', description: 'JSON 2D array of rows, e.g. [["Alice","Engineer","Active"],["Bob","Designer","Active"]]', required: false },
  ],
  permission: PermissionLevel.WRITE,
  source: 'api',
};

const sheetsRead: ToolDefinition = {
  name: 'sheets.read',
  description: 'Read rows and cells from an authentic Google Sheet by Spreadsheet ID and range.',
  parameters: [
    { name: 'spreadsheetId', type: 'string', description: 'The Google Spreadsheet ID', required: true },
    { name: 'range', type: 'string', description: 'A1 range notation (e.g. "Sheet1!A1:Z50", optional, defaults to "Sheet1!A1:Z100")', required: false },
  ],
  permission: PermissionLevel.READ,
  source: 'api',
};

const sheetsUpdate: ToolDefinition = {
  name: 'sheets.update',
  description: 'Write or overwrite data in a specific range of an existing Google Sheet.',
  parameters: [
    { name: 'spreadsheetId', type: 'string', description: 'The Google Spreadsheet ID', required: true },
    { name: 'range', type: 'string', description: 'A1 range to write to (e.g. "Sheet1!A1")', required: true },
    { name: 'data', type: 'string', description: 'JSON 2D array of row values to write', required: true },
  ],
  permission: PermissionLevel.WRITE,
  source: 'api',
};

const sheetsAppend: ToolDefinition = {
  name: 'sheets.append',
  description: 'Append new rows of data to the bottom of an existing Google Sheet.',
  parameters: [
    { name: 'spreadsheetId', type: 'string', description: 'The Google Spreadsheet ID', required: true },
    { name: 'range', type: 'string', description: 'Sheet name or range (e.g. "Sheet1", defaults to "Sheet1")', required: false },
    { name: 'data', type: 'string', description: 'JSON 2D array of rows to append', required: true },
  ],
  permission: PermissionLevel.WRITE,
  source: 'api',
};

const sheetsAppendLeads: ToolDefinition = {
  name: 'sheets.appendLeads',
  description:
    'Append structured lead or prospect records (Name, Company, Email, Status, Notes) into a Google Sheet. Automatically creates a formatted "Leads & Prospects" spreadsheet if spreadsheetId is omitted.',
  parameters: [
    { name: 'spreadsheetId', type: 'string', description: 'Optional existing Google Spreadsheet ID. If omitted, creates a new one.', required: false },
    { name: 'title', type: 'string', description: 'Title if creating a new sheet (e.g. "Hyderabad Interior Designers", "Q3 Leads")', required: false },
    { name: 'leads', type: 'array', description: 'Array of lead objects, or JSON string of leads with name, company, email, status, and notes', required: true },
  ],
  permission: PermissionLevel.WRITE,
  source: 'api',
  riskLevel: 'low',
};

// MARK: - Auth Helper

async function getSheetsAuth(context?: import('../registry').ToolContext) {
  if (!context?.userId) {
    return {
      error: 'You are not logged in. Please sign in to Murmur and connect your Google account in the Connections tab to access Google Sheets.',
    };
  }
  const auth = await getAuthenticatedGoogleClient(context.userId);
  if (!auth) {
    return {
      error: 'Google Sheets is not connected for your account. Please connect your Google account in the Connections tab.',
    };
  }
  return { auth };
}

// MARK: - Registrations

export function registerSheetsTools(): void {
  // 1. Create Spreadsheet
  toolRegistry.register(sheetsCreate, async (args, context) => {
    try {
      const { auth, error } = await getSheetsAuth(context);
      if (error || !auth) {
        return { success: false, error };
      }

      const title = (args.title as string) || 'Untitled Spreadsheet';
      const sheets = google.sheets({ version: 'v4', auth });

      const createRes = await sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title,
          },
        },
      });

      const spreadsheetId = createRes.data.spreadsheetId;
      if (!spreadsheetId) {
        throw new Error('Google Sheets API did not return a spreadsheetId');
      }

      const rows: any[][] = [];
      if (args.headers) {
        const headerRow = typeof args.headers === 'string'
          ? args.headers.split(',').map((h) => h.trim())
          : (args.headers as string[]);
        rows.push(headerRow);
      }

      if (args.data) {
        const dataRows = parseGridData(args.data);
        rows.push(...dataRows);
      }

      // Populate initial values if provided
      if (rows.length > 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: 'Sheet1!A1',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: rows,
          },
        });
      }

      const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
      logger.info('SheetsTool', 'Successfully created authentic Google Sheet', { spreadsheetId, title });

      return {
        success: true,
        result: {
          spreadsheetId,
          title,
          url,
          rowsCount: rows.length,
          createdAt: new Date().toISOString(),
        },
      };
    } catch (err: any) {
      logger.error('SheetsTool', 'Create sheet failed', { error: String(err) });
      return { success: false, error: `Sheets create error: ${err?.message || String(err)}` };
    }
  });

  // 2. Read Spreadsheet
  toolRegistry.register(sheetsRead, async (args, context) => {
    try {
      const { auth, error } = await getSheetsAuth(context);
      if (error || !auth) {
        return { success: false, error };
      }

      const spreadsheetId = args.spreadsheetId as string;
      const range = (args.range as string) || 'Sheet1!A1:Z100';
      const sheets = google.sheets({ version: 'v4', auth });

      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      const values = res.data.values || [];
      const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

      return {
        success: true,
        result: {
          spreadsheetId,
          range: res.data.range || range,
          rowCount: values.length,
          values,
          url,
        },
      };
    } catch (err: any) {
      logger.error('SheetsTool', 'Read sheet failed', { error: String(err) });
      return { success: false, error: `Sheets read error: ${err?.message || String(err)}` };
    }
  });

  // 3. Update Spreadsheet
  toolRegistry.register(sheetsUpdate, async (args, context) => {
    try {
      const { auth, error } = await getSheetsAuth(context);
      if (error || !auth) {
        return { success: false, error };
      }

      const spreadsheetId = args.spreadsheetId as string;
      const range = args.range as string;
      const values = parseGridData(args.data);
      const sheets = google.sheets({ version: 'v4', auth });

      const res = await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values,
        },
      });

      const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
      return {
        success: true,
        result: {
          spreadsheetId,
          updatedRange: res.data.updatedRange,
          updatedRows: res.data.updatedRows,
          updatedColumns: res.data.updatedColumns,
          updatedCells: res.data.updatedCells,
          url,
        },
      };
    } catch (err: any) {
      logger.error('SheetsTool', 'Update sheet failed', { error: String(err) });
      return { success: false, error: `Sheets update error: ${err?.message || String(err)}` };
    }
  });

  // 4. Append Rows
  toolRegistry.register(sheetsAppend, async (args, context) => {
    try {
      const { auth, error } = await getSheetsAuth(context);
      if (error || !auth) {
        return { success: false, error };
      }

      const spreadsheetId = args.spreadsheetId as string;
      const range = (args.range as string) || 'Sheet1';
      const values = parseGridData(args.data);
      const sheets = google.sheets({ version: 'v4', auth });

      const res = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values,
        },
      });

      const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
      return {
        success: true,
        result: {
          spreadsheetId,
          updatedRange: res.data.updates?.updatedRange,
          updatedRows: res.data.updates?.updatedRows,
          updatedCells: res.data.updates?.updatedCells,
          url,
        },
      };
    } catch (err: any) {
      logger.error('SheetsTool', 'Append sheet failed', { error: String(err) });
      return { success: false, error: `Sheets append error: ${err?.message || String(err)}` };
    }
  });

  // 5. Append Leads
  toolRegistry.register(sheetsAppendLeads, async (args, context) => {
    try {
      const { auth, error } = await getSheetsAuth(context);
      if (error || !auth) {
        return { success: false, error };
      }

      const sheets = google.sheets({ version: 'v4', auth });
      let spreadsheetId = args.spreadsheetId as string | undefined;

      // Parse leads
      let rawLeads = args.leads;
      if (typeof rawLeads === 'string') {
        try {
          rawLeads = JSON.parse(rawLeads);
        } catch {
          rawLeads = [];
        }
      }
      const leadsList: any[] = Array.isArray(rawLeads) ? rawLeads : [];

      // If no spreadsheet ID provided, create a new one with standard lead headers
      if (!spreadsheetId) {
        const title = (args.title as string) || 'Murmur Leads & Prospects';
        const createRes = await sheets.spreadsheets.create({
          requestBody: {
            properties: { title },
            sheets: [
              {
                properties: {
                  title: 'Leads',
                  gridProperties: { frozenRowCount: 1 },
                },
                data: [
                  {
                    startRow: 0,
                    startColumn: 0,
                    rowData: [
                      {
                        values: [
                          { userEnteredValue: { stringValue: 'Name' } },
                          { userEnteredValue: { stringValue: 'Company' } },
                          { userEnteredValue: { stringValue: 'Email' } },
                          { userEnteredValue: { stringValue: 'Status' } },
                          { userEnteredValue: { stringValue: 'Date Added' } },
                          { userEnteredValue: { stringValue: 'Notes / Snippet' } },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        });
        spreadsheetId = createRes.data.spreadsheetId || undefined;
      }

      if (!spreadsheetId) {
        throw new Error('Failed to create or target Google Spreadsheet for leads');
      }

      const todayStr = new Date().toISOString().split('T')[0];

      // Convert lead items into 2D rows
      const rows = leadsList.map((lead: any) => [
        lead.name || lead.contact || '',
        lead.company || lead.business || '',
        lead.email || '',
        lead.status || 'New Lead',
        lead.date || todayStr,
        lead.notes || lead.snippet || lead.description || '',
      ]);

      if (rows.length > 0) {
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: 'Leads!A:F',
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: rows },
        });
      }

      const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
      return {
        success: true,
        result: {
          spreadsheetId,
          totalLeadsAdded: rows.length,
          url,
          sampleLeads: rows.slice(0, 3).map((r) => ({ name: r[0], company: r[1], email: r[2] })),
        },
      };
    } catch (err: any) {
      logger.error('SheetsTool', 'AppendLeads failed', { error: String(err) });
      return { success: false, error: `Sheets appendLeads error: ${err?.message || String(err)}` };
    }
  });
}
