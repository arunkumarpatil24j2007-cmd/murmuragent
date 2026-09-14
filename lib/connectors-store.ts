// lib/connectors-store.ts — Cloud Connectors Store & Registry
// Manages authentication, connection statuses, enabled/disabled toggles,
// and dynamic credential resolution for Google Workspace, Notion, Vercel, GitHub, etc.

import fs from 'fs';
import path from 'path';
import { env } from './env';
import { logger } from './logger';
import { encryptPayload, decryptPayload, tokenStore } from './token-store';

export type ConnectorId =
  | 'google_drive'
  | 'google_sheets'
  | 'google_docs'
  | 'google_calendar'
  | 'gmail'
  | 'notion'
  | 'vercel'
  | 'github'
  | 'airtop'
  | 'palmier';

export type ConnectorCategory = 'workspace' | 'developer' | 'automation' | 'local';

export interface ConnectorToolSummary {
  name: string;
  description: string;
  permission: 'READ' | 'WRITE' | 'DANGEROUS';
}

export interface ConnectorInfo {
  id: ConnectorId;
  name: string;
  shortDescription: string;
  longDescription: string;
  category: ConnectorCategory;
  categoryLabel: string;
  icon: string;
  brandColor: string;
  authType: 'oauth' | 'token' | 'api_key' | 'mcp';
  docsUrl: string;
  isConnected: boolean;
  isEnabled: boolean;
  accountLabel?: string;
  accountEmail?: string;
  accountAvatar?: string;
  lastConnectedAt?: string;
  tools: ConnectorToolSummary[];
}

interface StoredConnectorConfig {
  enabled: boolean;
  encryptedToken?: string;
  metadata?: {
    accountLabel?: string;
    accountEmail?: string;
    accountAvatar?: string;
    connectedAt?: string;
  };
}

type ConnectorsConfigMap = Record<string, StoredConnectorConfig>;

const CONNECTORS_FILE_PATH = path.join(process.cwd(), '.connectors.json');

// Base catalog of supported Cloud Connectors
export const CONNECTOR_DEFINITIONS: Record<ConnectorId, Omit<ConnectorInfo, 'isConnected' | 'isEnabled' | 'accountLabel' | 'accountEmail' | 'accountAvatar' | 'lastConnectedAt'>> = {
  google_drive: {
    id: 'google_drive',
    name: 'Google Drive',
    shortDescription: 'Search, read, create, and organize files in Google Drive.',
    longDescription: 'Direct access to your cloud drive. Read doc contents, locate project files, search file metadata, and upload newly generated assets autonomously.',
    category: 'workspace',
    categoryLabel: 'Google Workspace',
    icon: 'drive',
    brandColor: '#4285F4',
    authType: 'oauth',
    docsUrl: 'https://developers.google.com/drive',
    tools: [
      { name: 'drive.listFiles', description: 'List files in Drive matching queries', permission: 'READ' },
      { name: 'drive.searchFiles', description: 'Search files by keyword and MIME type', permission: 'READ' },
      { name: 'drive.getFile', description: 'Get file metadata and download link', permission: 'READ' },
      { name: 'drive.createFolder', description: 'Create folders for organizing outputs', permission: 'WRITE' },
      { name: 'drive.createFile', description: 'Upload and create new documents', permission: 'WRITE' },
    ],
  },
  google_sheets: {
    id: 'google_sheets',
    name: 'Google Sheets',
    shortDescription: 'Create, read, append rows, and manage spreadsheets.',
    longDescription: 'Full spreadsheet intelligence. Query cell ranges, populate financial projections, append lead lists, and create formatted spreadsheets in real-time.',
    category: 'workspace',
    categoryLabel: 'Google Workspace',
    icon: 'sheets',
    brandColor: '#0F9D58',
    authType: 'oauth',
    docsUrl: 'https://developers.google.com/sheets',
    tools: [
      { name: 'sheets.read', description: 'Read rows and cells from a sheet range', permission: 'READ' },
      { name: 'sheets.create', description: 'Create brand new spreadsheets', permission: 'WRITE' },
      { name: 'sheets.append_row', description: 'Append structured rows to spreadsheets', permission: 'WRITE' },
      { name: 'sheets.update_cells', description: 'Batch update specific cells and formulas', permission: 'WRITE' },
    ],
  },
  google_docs: {
    id: 'google_docs',
    name: 'Google Docs',
    shortDescription: 'Read, draft, and append rich Google Docs.',
    longDescription: 'Collaborative document authoring. Generate research briefs, append meeting summaries, and produce clean styled Google Docs with direct sharing links.',
    category: 'workspace',
    categoryLabel: 'Google Workspace',
    icon: 'docs',
    brandColor: '#4285F4',
    authType: 'oauth',
    docsUrl: 'https://developers.google.com/docs',
    tools: [
      { name: 'docs.read', description: 'Read document content and structural text', permission: 'READ' },
      { name: 'docs.create', description: 'Create new formatted Google Docs', permission: 'WRITE' },
      { name: 'docs.append_text', description: 'Append text, outlines, or bullet points', permission: 'WRITE' },
    ],
  },
  google_calendar: {
    id: 'google_calendar',
    name: 'Google Calendar',
    shortDescription: 'Schedule meetings, view calendar events, and manage schedule.',
    longDescription: 'Autonomous calendar intelligence. Schedule meetings with attendees, verify conflicts, search upcoming schedule, and generate direct clickable Google Calendar links.',
    category: 'workspace',
    categoryLabel: 'Google Workspace',
    icon: 'calendar',
    brandColor: '#4285F4',
    authType: 'oauth',
    docsUrl: 'https://developers.google.com/calendar',
    tools: [
      { name: 'calendar.listEvents', description: 'List scheduled events and meetings', permission: 'READ' },
      { name: 'calendar.createEvent', description: 'Schedule new meeting with direct link', permission: 'WRITE' },
      { name: 'calendar.deleteEvent', description: 'Cancel calendar event by ID', permission: 'DANGEROUS' },
    ],
  },
  gmail: {
    id: 'gmail',
    name: 'Gmail',
    shortDescription: 'Search, read, draft, and send emails securely.',
    longDescription: 'Autonomous communication agent. Inspect urgent threads, draft executive responses, search conversations, and send verified email updates.',
    category: 'workspace',
    categoryLabel: 'Google Workspace',
    icon: 'gmail',
    brandColor: '#EA4335',
    authType: 'oauth',
    docsUrl: 'https://developers.google.com/gmail',
    tools: [
      { name: 'gmail.listMessages', description: 'Search emails with query filters', permission: 'READ' },
      { name: 'gmail.getMessage', description: 'Read full email thread and body', permission: 'READ' },
      { name: 'gmail.createDraft', description: 'Create editable email drafts', permission: 'WRITE' },
      { name: 'gmail.sendEmail', description: 'Send verified emails to recipients', permission: 'DANGEROUS' },
    ],
  },
  notion: {
    id: 'notion',
    name: 'Notion',
    shortDescription: 'Connect pages, databases, and project roadmaps.',
    longDescription: 'Full workspace memory. Query internal databases, read team wikis, draft documentation pages, and create task tickets directly in Notion.',
    category: 'workspace',
    categoryLabel: 'Knowledge & Docs',
    icon: 'notion',
    brandColor: '#000000',
    authType: 'token',
    docsUrl: 'https://developers.notion.com',
    tools: [
      { name: 'notion.search', description: 'Search workspace for pages and databases', permission: 'READ' },
      { name: 'notion.readPage', description: 'Read page blocks and rich properties', permission: 'READ' },
      { name: 'notion.createPage', description: 'Create new wiki pages or database items', permission: 'WRITE' },
      { name: 'notion.updatePage', description: 'Append notes and task updates to pages', permission: 'WRITE' },
      { name: 'notion.queryDatabase', description: 'Filter and sort Notion database entries', permission: 'READ' },
    ],
  },
  vercel: {
    id: 'vercel',
    name: 'Vercel',
    shortDescription: 'Inspect deployments, build logs, and deploy projects.',
    longDescription: 'DevOps cloud connector. Check production preview URLs, inspect build errors, query project status, and trigger staging/prod deployments.',
    category: 'developer',
    categoryLabel: 'Cloud & Hosting',
    icon: 'vercel',
    brandColor: '#000000',
    authType: 'token',
    docsUrl: 'https://vercel.com/docs/rest-api',
    tools: [
      { name: 'vercel.listProjects', description: 'List connected Vercel projects and repos', permission: 'READ' },
      { name: 'vercel.getProject', description: 'Get project settings and env targets', permission: 'READ' },
      { name: 'vercel.listDeployments', description: 'List recent deployments and domains', permission: 'READ' },
      { name: 'vercel.getDeployment', description: 'Inspect deployment status and build logs', permission: 'READ' },
      { name: 'vercel.deploy', description: 'Trigger a new production deployment', permission: 'DANGEROUS' },
    ],
  },
  github: {
    id: 'github',
    name: 'GitHub',
    shortDescription: 'Browse repositories, track issues, and manage pull requests.',
    longDescription: 'Autonomous software engineering integration. Query open pull requests, inspect commits, file bug reports, and review code diffs across your repositories.',
    category: 'developer',
    categoryLabel: 'Developer Tools',
    icon: 'github',
    brandColor: '#24292F',
    authType: 'token',
    docsUrl: 'https://docs.github.com/en/rest',
    tools: [
      { name: 'github.listRepos', description: 'List repositories accessible to the token', permission: 'READ' },
      { name: 'github.getRepo', description: 'Get repository details, stars, and branch info', permission: 'READ' },
      { name: 'github.listIssues', description: 'List and filter issues for a repository', permission: 'READ' },
      { name: 'github.createIssue', description: 'Open a new issue with title and body', permission: 'WRITE' },
      { name: 'github.createPullRequest', description: 'Open a pull request between branches', permission: 'WRITE' },
    ],
  },
  airtop: {
    id: 'airtop',
    name: 'Airtop Web Browser',
    shortDescription: 'Autonomous cloud browser for dynamic web tasks.',
    longDescription: 'Interact with any web application. Scrape dynamic JavaScript websites, fill forms, take screenshots, and run autonomous browser workflows.',
    category: 'automation',
    categoryLabel: 'Web & Automation',
    icon: 'airtop',
    brandColor: '#FF5C35',
    authType: 'api_key',
    docsUrl: 'https://docs.airtop.ai',
    tools: [
      { name: 'browser.navigate', description: 'Navigate to target URLs and render pages', permission: 'READ' },
      { name: 'browser.scrape', description: 'Extract text, tables, and structured data', permission: 'READ' },
      { name: 'browser.click', description: 'Click buttons, tabs, and interactive elements', permission: 'WRITE' },
      { name: 'browser.type', description: 'Fill form inputs and submit requests', permission: 'WRITE' },
    ],
  },
  palmier: {
    id: 'palmier',
    name: 'Palmier MCP Client',
    shortDescription: 'Model Context Protocol connector for local desktop context.',
    longDescription: 'Bridge between web agent and local macOS context. Discover and execute local MCP tools securely.',
    category: 'local',
    categoryLabel: 'Desktop & MCP',
    icon: 'palmier',
    brandColor: '#7C3AED',
    authType: 'mcp',
    docsUrl: 'https://modelcontextprotocol.io',
    tools: [
      { name: 'mcp.discover', description: 'List dynamically discovered MCP tools', permission: 'READ' },
      { name: 'mcp.execute', description: 'Execute external MCP tool invocation', permission: 'WRITE' },
    ],
  },
};

class ConnectorsStore {
  private configCache: ConnectorsConfigMap | null = null;

  private loadConfig(): ConnectorsConfigMap {
    if (this.configCache) return this.configCache;
    try {
      if (fs.existsSync(CONNECTORS_FILE_PATH)) {
        const raw = fs.readFileSync(CONNECTORS_FILE_PATH, 'utf-8');
        this.configCache = JSON.parse(raw);
        return this.configCache || {};
      }
    } catch (err) {
      logger.error('ConnectorsStore', 'Failed to read .connectors.json', { error: String(err) });
    }
    this.configCache = {};
    return this.configCache;
  }

  private saveConfig(config: ConnectorsConfigMap): void {
    this.configCache = config;
    try {
      fs.writeFileSync(CONNECTORS_FILE_PATH, JSON.stringify(config, null, 2), {
        mode: 0o600,
      });
    } catch (err) {
      logger.error('ConnectorsStore', 'Failed to save .connectors.json', { error: String(err) });
    }
  }

  /**
   * Returns whether a connector is enabled (active for the agent).
   * Defaults to true if connected.
   */
  async isConnectorEnabled(id: ConnectorId): Promise<boolean> {
    const config = this.loadConfig();
    if (config[id] && config[id].enabled !== undefined) {
      return config[id].enabled;
    }
    return true;
  }

  /**
   * Retrieves active token for a connector (custom user token first, then server environment fallback).
   */
  async getConnectorToken(id: ConnectorId): Promise<string | null> {
    const config = this.loadConfig();
    const item = config[id];

    if (item?.encryptedToken) {
      const decrypted = decryptPayload(item.encryptedToken);
      if (decrypted) return decrypted;
    }

    // Fallback to environment variables
    switch (id) {
      case 'notion':
        return env.notion.token || process.env.NOTION_TOKEN || null;
      case 'vercel':
        return env.vercel.token || process.env.VERCEL_TOKEN || null;
      case 'github':
        return process.env.GITHUB_TOKEN || null;
      case 'airtop':
        return env.airtop.apiKey || process.env.AIRTOP_API_KEY || null;
      default:
        return null;
    }
  }

  /**
   * List all connectors with real-time connection status & account details.
   */
  async getAllConnectors(): Promise<ConnectorInfo[]> {
    const config = this.loadConfig();

    // Check Google Auth status from tokenStore
    let googleConnected = false;
    let googleAccount: { email?: string; name?: string; picture?: string } = {};

    try {
      const googleTokens = await tokenStore.getTokens();
      if (googleTokens && (googleTokens.access_token || googleTokens.refresh_token)) {
        googleConnected = true;
        googleAccount = googleTokens.user || {};
      }
    } catch (err) {
      logger.warn('ConnectorsStore', 'Could not check Google token store', { error: String(err) });
    }

    const results: ConnectorInfo[] = [];

    for (const id of Object.keys(CONNECTOR_DEFINITIONS) as ConnectorId[]) {
      const def = CONNECTOR_DEFINITIONS[id];
      const saved = config[id];
      const isEnabled = saved?.enabled !== undefined ? saved.enabled : true;

      let isConnected = false;
      let accountLabel: string | undefined = saved?.metadata?.accountLabel;
      let accountEmail: string | undefined = saved?.metadata?.accountEmail;
      let accountAvatar: string | undefined = saved?.metadata?.accountAvatar;
      let lastConnectedAt: string | undefined = saved?.metadata?.connectedAt;

      if (id === 'google_drive' || id === 'google_sheets' || id === 'google_docs' || id === 'google_calendar' || id === 'gmail') {
        isConnected = googleConnected;
        if (googleConnected) {
          accountEmail = googleAccount.email || 'Connected Google Account';
          accountLabel = googleAccount.name || googleAccount.email || 'Google Workspace';
          accountAvatar = googleAccount.picture;
        }
      } else if (id === 'palmier') {
        isConnected = !!env.palmier.url;
        accountLabel = env.palmier.url ? 'Local Palmier Bridge' : undefined;
      } else {
        const token = await this.getConnectorToken(id);
        isConnected = !!token;
        if (!accountLabel && isConnected) {
          accountLabel = id === 'notion' ? 'Notion Integration'
            : id === 'vercel' ? 'Vercel Account'
            : id === 'github' ? 'GitHub PAT'
            : id === 'airtop' ? 'Airtop API Active' : 'Connected';
        }
      }

      results.push({
        ...def,
        isConnected,
        isEnabled,
        accountLabel,
        accountEmail,
        accountAvatar,
        lastConnectedAt,
      });
    }

    return results;
  }

  /**
   * Set credentials / status for a connector.
   */
  async updateConnector(
    id: ConnectorId,
    params: {
      enabled?: boolean;
      token?: string;
      metadata?: {
        accountLabel?: string;
        accountEmail?: string;
        accountAvatar?: string;
      };
    }
  ): Promise<void> {
    const config = this.loadConfig();
    const existing = config[id] || { enabled: true };

    if (params.enabled !== undefined) {
      existing.enabled = params.enabled;
    }

    if (params.token !== undefined) {
      if (params.token.trim()) {
        existing.encryptedToken = encryptPayload(params.token.trim());
      } else {
        delete existing.encryptedToken;
      }
    }

    if (params.metadata) {
      existing.metadata = {
        ...existing.metadata,
        ...params.metadata,
        connectedAt: new Date().toISOString(),
      };
    }

    config[id] = existing;
    this.saveConfig(config);
    logger.info('ConnectorsStore', `Updated connector ${id}`, { enabled: existing.enabled });
  }

  /**
   * Disconnect a connector by revoking credentials.
   */
  async disconnectConnector(id: ConnectorId): Promise<void> {
    if (id === 'google_drive' || id === 'google_sheets' || id === 'google_docs' || id === 'google_calendar' || id === 'gmail') {
      await tokenStore.deleteTokens();
    }

    const config = this.loadConfig();
    if (config[id]) {
      delete config[id].encryptedToken;
      delete config[id].metadata;
      config[id].enabled = false;
      this.saveConfig(config);
    }
    logger.info('ConnectorsStore', `Disconnected connector ${id}`);
  }

  /**
   * Live test a connector by pinging its real upstream API.
   */
  async testConnector(id: ConnectorId): Promise<{
    success: boolean;
    latencyMs: number;
    message: string;
    details?: Record<string, unknown>;
  }> {
    const start = Date.now();

    try {
      switch (id) {
        case 'google_drive':
        case 'google_sheets':
        case 'google_docs':
        case 'gmail': {
          const tokens = await tokenStore.getTokens();
          if (!tokens?.access_token && !tokens?.refresh_token) {
            return {
              success: false,
              latencyMs: Date.now() - start,
              message: 'Not connected. Connect your Google account first.',
            };
          }
          return {
            success: true,
            latencyMs: Date.now() - start,
            message: `Connected as ${tokens.user?.email || 'Google Workspace'}`,
            details: { email: tokens.user?.email, name: tokens.user?.name },
          };
        }

        case 'vercel': {
          const token = await this.getConnectorToken('vercel');
          if (!token) {
            return { success: false, latencyMs: Date.now() - start, message: 'No Vercel API token configured' };
          }
          const res = await fetch('https://api.vercel.com/v2/user', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const latencyMs = Date.now() - start;
          if (!res.ok) {
            return { success: false, latencyMs, message: `Vercel API error (${res.status}): Invalid token or unauthorized` };
          }
          const data = await res.json();
          return {
            success: true,
            latencyMs,
            message: `Connected to Vercel (${data.user?.username || data.user?.email || 'User'})`,
            details: { username: data.user?.username, email: data.user?.email },
          };
        }

        case 'notion': {
          const token = await this.getConnectorToken('notion');
          if (!token) {
            return { success: false, latencyMs: Date.now() - start, message: 'No Notion API token configured' };
          }
          const res = await fetch('https://api.notion.com/v1/users/me', {
            headers: {
              Authorization: `Bearer ${token}`,
              'Notion-Version': '2022-06-28',
            },
          });
          const latencyMs = Date.now() - start;
          if (!res.ok) {
            return { success: false, latencyMs, message: `Notion API error (${res.status}): Invalid API key` };
          }
          const data = await res.json();
          return {
            success: true,
            latencyMs,
            message: `Connected to Notion (${data.name || data.bot?.owner?.workspace_name || 'Workspace'})`,
            details: { name: data.name, bot: data.bot },
          };
        }

        case 'github': {
          const token = await this.getConnectorToken('github');
          if (!token) {
            return { success: false, latencyMs: Date.now() - start, message: 'No GitHub Personal Access Token configured' };
          }
          const res = await fetch('https://api.github.com/user', {
            headers: {
              Authorization: `Bearer ${token}`,
              'User-Agent': 'Murmur-Agent-Connectors',
              Accept: 'application/vnd.github.v3+json',
            },
          });
          const latencyMs = Date.now() - start;
          if (!res.ok) {
            return { success: false, latencyMs, message: `GitHub API error (${res.status}): Invalid token` };
          }
          const data = await res.json();
          return {
            success: true,
            latencyMs,
            message: `Connected as GitHub @${data.login}`,
            details: { login: data.login, name: data.name, publicRepos: data.public_repos },
          };
        }

        case 'airtop': {
          const apiKey = await this.getConnectorToken('airtop');
          const latencyMs = Date.now() - start;
          if (!apiKey) {
            return { success: false, latencyMs, message: 'No Airtop API key configured' };
          }
          return {
            success: true,
            latencyMs,
            message: 'Airtop API key verified',
          };
        }

        case 'palmier': {
          const latencyMs = Date.now() - start;
          return {
            success: !!env.palmier.url,
            latencyMs,
            message: env.palmier.url ? `Configured at ${env.palmier.url}` : 'MCP not configured',
          };
        }

        default:
          return { success: false, latencyMs: Date.now() - start, message: 'Unknown connector' };
      }
    } catch (err) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

export const connectorsStore = new ConnectorsStore();
