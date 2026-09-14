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

// MARK: - Registrations

export function registerSheetsTools(): void {
  // 1. Create Spreadsheet
  toolRegistry.register(sheetsCreate, async (args) => {
    try {
      const auth = await getAuthenticatedGoogleClient();
      if (!auth) {
        return { success: false, error: 'Google account is not connected. Please connect via /api/auth/google/login' };
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
  toolRegistry.register(sheetsRead, async (args) => {
    try {
      const auth = await getAuthenticatedGoogleClient();
      if (!auth) {
        return { success: false, error: 'Google account is not connected. Please connect via /api/auth/google/login' };
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
  toolRegistry.register(sheetsUpdate, async (args) => {
    try {
      const auth = await getAuthenticatedGoogleClient();
      if (!auth) {
        return { success: false, error: 'Google account is not connected. Please connect via /api/auth/google/login' };
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
  toolRegistry.register(sheetsAppend, async (args) => {
    try {
      const auth = await getAuthenticatedGoogleClient();
      if (!auth) {
        return { success: false, error: 'Google account is not connected. Please connect via /api/auth/google/login' };
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
}
