// tools/google/drive.ts — Production Google Drive Tools
// Direct integration with official Google Drive API v3 using authenticated OAuth2Client.

import { google } from 'googleapis';
import { PermissionLevel } from '@/lib/schemas';
import type { ToolDefinition } from '@/lib/schemas';
import { toolRegistry } from '../registry';
import { getAuthenticatedGoogleClient } from '@/lib/google-auth';
import { logger } from '@/lib/logger';

// MARK: - Tool Definitions

const driveSearch: ToolDefinition = {
  name: 'drive.search',
  description: 'Search files and folders in Google Drive by name, type, or query. Returns matched file metadata and links.',
  parameters: [
    { name: 'query', type: 'string', description: 'Search term or Drive query expression (e.g. "name contains \'budget\'", "mimeType = \'application/vnd.google-apps.document\'")', required: true },
    { name: 'pageSize', type: 'number', description: 'Number of results to return (default: 15, max: 30)', required: false },
  ],
  permission: PermissionLevel.READ,
  source: 'api',
};

const driveList: ToolDefinition = {
  name: 'drive.list',
  description: 'List recent files in Google Drive or inside a specific folder.',
  parameters: [
    { name: 'folderId', type: 'string', description: 'Folder ID to list contents from (optional, defaults to root)', required: false },
    { name: 'pageSize', type: 'number', description: 'Number of files to return (default: 20)', required: false },
  ],
  permission: PermissionLevel.READ,
  source: 'api',
};

const driveGet: ToolDefinition = {
  name: 'drive.get',
  description: 'Get file details, metadata, and web links for a Google Drive file by ID.',
  parameters: [
    { name: 'fileId', type: 'string', description: 'The Google Drive file ID', required: true },
  ],
  permission: PermissionLevel.READ,
  source: 'api',
};

const driveCreateFolder: ToolDefinition = {
  name: 'drive.createFolder',
  description: 'Create a new folder in Google Drive.',
  parameters: [
    { name: 'name', type: 'string', description: 'Name of the folder', required: true },
    { name: 'parentFolderId', type: 'string', description: 'Parent folder ID (optional)', required: false },
  ],
  permission: PermissionLevel.WRITE,
  source: 'api',
};

const driveOpen: ToolDefinition = {
  name: 'drive.open',
  description: 'Obtain the official Google Drive web URL and metadata to open an existing file in the browser.',
  parameters: [
    { name: 'fileId', type: 'string', description: 'The Google Drive file ID', required: true },
  ],
  permission: PermissionLevel.READ,
  source: 'api',
};

// MARK: - Registrations

export function registerDriveTools(): void {
  // 1. Search Files
  toolRegistry.register(driveSearch, async (args) => {
    try {
      const auth = await getAuthenticatedGoogleClient();
      if (!auth) {
        return { success: false, error: 'Google account is not connected. Please connect via /api/auth/google/login' };
      }

      const drive = google.drive({ version: 'v3', auth });
      const rawQuery = (args.query as string) || '';
      const pageSize = Math.min(Math.max(1, Number(args.pageSize) || 15), 30);

      // Construct safe search query
      let q = "trashed = false";
      if (rawQuery.includes('contains') || rawQuery.includes('=') || rawQuery.includes('and')) {
        q += ` and (${rawQuery})`;
      } else if (rawQuery.trim()) {
        const sanitized = rawQuery.replace(/'/g, "\\'");
        q += ` and (name contains '${sanitized}')`;
      }

      const res = await drive.files.list({
        q,
        pageSize,
        fields: 'files(id, name, mimeType, webViewLink, iconLink, modifiedTime, size, owners)',
        orderBy: 'modifiedTime desc',
      });

      const files = (res.data.files || []).map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        url: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
        modifiedTime: f.modifiedTime,
        size: f.size,
      }));

      return {
        success: true,
        result: {
          count: files.length,
          query: rawQuery,
          files,
        },
      };
    } catch (err: any) {
      logger.error('DriveTool', 'Search failed', { error: String(err) });
      return { success: false, error: `Drive search error: ${err?.message || String(err)}` };
    }
  });

  // 2. List Files
  toolRegistry.register(driveList, async (args) => {
    try {
      const auth = await getAuthenticatedGoogleClient();
      if (!auth) {
        return { success: false, error: 'Google account is not connected. Please connect via /api/auth/google/login' };
      }

      const drive = google.drive({ version: 'v3', auth });
      const folderId = (args.folderId as string) || undefined;
      const pageSize = Math.min(Math.max(1, Number(args.pageSize) || 20), 50);

      let q = 'trashed = false';
      if (folderId) {
        q += ` and '${folderId}' in parents`;
      }

      const res = await drive.files.list({
        q,
        pageSize,
        fields: 'files(id, name, mimeType, webViewLink, modifiedTime, size)',
        orderBy: 'modifiedTime desc',
      });

      const files = (res.data.files || []).map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        url: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
        modifiedTime: f.modifiedTime,
      }));

      return {
        success: true,
        result: {
          count: files.length,
          folderId: folderId || 'root',
          files,
        },
      };
    } catch (err: any) {
      logger.error('DriveTool', 'List failed', { error: String(err) });
      return { success: false, error: `Drive list error: ${err?.message || String(err)}` };
    }
  });

  // 3. Get File Details
  toolRegistry.register(driveGet, async (args) => {
    try {
      const auth = await getAuthenticatedGoogleClient();
      if (!auth) {
        return { success: false, error: 'Google account is not connected. Please connect via /api/auth/google/login' };
      }

      const fileId = args.fileId as string;
      const drive = google.drive({ version: 'v3', auth });

      const res = await drive.files.get({
        fileId,
        fields: 'id, name, mimeType, description, webViewLink, webContentLink, createdTime, modifiedTime, size, owners',
      });

      const f = res.data;
      return {
        success: true,
        result: {
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          description: f.description,
          url: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
          createdTime: f.createdTime,
          modifiedTime: f.modifiedTime,
          size: f.size,
        },
      };
    } catch (err: any) {
      logger.error('DriveTool', 'Get failed', { error: String(err) });
      return { success: false, error: `Drive get error: ${err?.message || String(err)}` };
    }
  });

  // 4. Create Folder
  toolRegistry.register(driveCreateFolder, async (args) => {
    try {
      const auth = await getAuthenticatedGoogleClient();
      if (!auth) {
        return { success: false, error: 'Google account is not connected. Please connect via /api/auth/google/login' };
      }

      const name = args.name as string;
      const parentFolderId = args.parentFolderId as string | undefined;
      const drive = google.drive({ version: 'v3', auth });

      const res = await drive.files.create({
        requestBody: {
          name,
          mimeType: 'application/vnd.google-apps.folder',
          parents: parentFolderId ? [parentFolderId] : undefined,
        },
        fields: 'id, name, webViewLink',
      });

      return {
        success: true,
        result: {
          folderId: res.data.id,
          name: res.data.name,
          url: res.data.webViewLink || `https://drive.google.com/drive/folders/${res.data.id}`,
        },
      };
    } catch (err: any) {
      logger.error('DriveTool', 'Create folder failed', { error: String(err) });
      return { success: false, error: `Drive create folder error: ${err?.message || String(err)}` };
    }
  });

  // 5. Open File Link
  toolRegistry.register(driveOpen, async (args) => {
    try {
      const auth = await getAuthenticatedGoogleClient();
      if (!auth) {
        return { success: false, error: 'Google account is not connected. Please connect via /api/auth/google/login' };
      }

      const fileId = args.fileId as string;
      const drive = google.drive({ version: 'v3', auth });

      const res = await drive.files.get({
        fileId,
        fields: 'id, name, mimeType, webViewLink',
      });

      const url = res.data.webViewLink || `https://drive.google.com/file/d/${res.data.id}/view`;
      return {
        success: true,
        result: {
          fileId: res.data.id,
          name: res.data.name,
          mimeType: res.data.mimeType,
          url,
        },
      };
    } catch (err: any) {
      logger.error('DriveTool', 'Open failed', { error: String(err) });
      return { success: false, error: `Drive open error: ${err?.message || String(err)}` };
    }
  });
}
