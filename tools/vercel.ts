// tools/vercel.ts — Vercel tool definitions with real API integration

import { PermissionLevel } from '@/lib/schemas';
import type { ToolDefinition } from '@/lib/schemas';
import { toolRegistry } from './registry';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

const vercelListProjects: ToolDefinition = {
  name: 'vercel.listProjects',
  description: 'List all Vercel projects in the connected account.',
  parameters: [
    { name: 'limit', type: 'number', description: 'Max number of projects to return (default: 20)', required: false },
  ],
  permission: PermissionLevel.READ,
  source: 'api',
};

const vercelGetProject: ToolDefinition = {
  name: 'vercel.getProject',
  description: 'Get details about a specific Vercel project by name or ID.',
  parameters: [
    { name: 'projectId', type: 'string', description: 'Project name or ID', required: true },
  ],
  permission: PermissionLevel.READ,
  source: 'api',
};

const vercelListDeployments: ToolDefinition = {
  name: 'vercel.listDeployments',
  description: 'List recent deployments for a Vercel project.',
  parameters: [
    { name: 'projectId', type: 'string', description: 'Project name or ID', required: false },
    { name: 'limit', type: 'number', description: 'Max results (default: 10)', required: false },
  ],
  permission: PermissionLevel.READ,
  source: 'api',
};

const vercelGetDeployment: ToolDefinition = {
  name: 'vercel.getDeployment',
  description: 'Get details about a specific deployment including status, errors, and logs.',
  parameters: [
    { name: 'deploymentId', type: 'string', description: 'Deployment ID or URL', required: true },
  ],
  permission: PermissionLevel.READ,
  source: 'api',
};

const vercelDeploy: ToolDefinition = {
  name: 'vercel.deploy',
  description: 'Trigger a new deployment. This is a DANGEROUS operation requiring confirmation.',
  parameters: [
    { name: 'projectId', type: 'string', description: 'Project name or ID', required: true },
    { name: 'target', type: 'string', description: 'Deployment target: "production" or "preview"', required: false },
  ],
  permission: PermissionLevel.DANGEROUS,
  source: 'api',
};

import { connectorsStore } from '@/lib/connectors-store';

async function getVercelToken(): Promise<string | null> {
  return connectorsStore.getConnectorToken('vercel');
}

async function vercelFetch(path: string): Promise<Response> {
  const token = await getVercelToken();
  if (!token) {
    throw new Error('Vercel API token not configured. Connect your Vercel account in Connectors.');
  }
  return fetch(`https://api.vercel.com${path}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

export function registerVercelTools(): void {
  // List projects
  toolRegistry.register(vercelListProjects, async (args) => {
    const token = await getVercelToken();
    if (!token) {
      return { success: false, error: 'Vercel API token not configured. Connect your Vercel account in Connectors.' };
    }
    try {
      const limit = (args.limit as number) || 20;
      const res = await vercelFetch(`/v9/projects?limit=${limit}`);
      if (!res.ok) {
        const err = await res.text();
        return { success: false, error: `Vercel API error (${res.status}): ${err}` };
      }
      const data = await res.json();
      const projects = data.projects?.map((p: Record<string, unknown>) => {
        const latestDeployments = p.latestDeployments as Record<string, unknown>[] | undefined;
        return {
          id: p.id,
          name: p.name,
          framework: p.framework,
          updatedAt: p.updatedAt,
          latestDeployment: latestDeployments && latestDeployments[0] ? {
            url: latestDeployments[0].url,
            state: latestDeployments[0].readyState,
            created: latestDeployments[0].createdAt,
          } : null,
        };
      }) || [];
      return { success: true, result: { count: projects.length, projects } };
    } catch (err) {
      logger.error('VercelTool', 'List projects failed', { error: String(err) });
      return { success: false, error: `Vercel error: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // Get project
  toolRegistry.register(vercelGetProject, async (args) => {
    if (!await getVercelToken()) {
      return { success: false, error: 'Vercel API token not configured.' };
    }
    try {
      const res = await vercelFetch(`/v9/projects/${args.projectId}`);
      if (!res.ok) {
        const err = await res.text();
        return { success: false, error: `Project not found (${res.status}): ${err}` };
      }
      const project = await res.json();
      return {
        success: true,
        result: {
          id: project.id,
          name: project.name,
          framework: project.framework,
          nodeVersion: project.nodeVersion,
          buildCommand: project.buildCommand,
          outputDirectory: project.outputDirectory,
          rootDirectory: project.rootDirectory,
          updatedAt: project.updatedAt,
          link: project.link,
        },
      };
    } catch (err) {
      return { success: false, error: `Vercel error: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // List deployments
  toolRegistry.register(vercelListDeployments, async (args) => {
    if (!await getVercelToken()) {
      return { success: false, error: 'Vercel API token not configured.' };
    }
    try {
      const limit = (args.limit as number) || 10;
      let path = `/v6/deployments?limit=${limit}`;
      if (args.projectId) {
        path += `&projectId=${args.projectId}`;
      }
      const res = await vercelFetch(path);
      if (!res.ok) {
        const err = await res.text();
        return { success: false, error: `Vercel API error (${res.status}): ${err}` };
      }
      const data = await res.json();
      const deployments = data.deployments?.map((d: Record<string, unknown>) => ({
        uid: d.uid,
        name: d.name,
        url: d.url,
        state: d.readyState || d.state,
        target: d.target,
        created: d.createdAt || d.created,
        ready: d.ready,
        error: d.errorMessage,
      })) || [];
      return { success: true, result: { count: deployments.length, deployments } };
    } catch (err) {
      return { success: false, error: `Vercel error: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // Get deployment
  toolRegistry.register(vercelGetDeployment, async (args) => {
    if (!await getVercelToken()) {
      return { success: false, error: 'Vercel API token not configured.' };
    }
    try {
      const res = await vercelFetch(`/v13/deployments/${args.deploymentId}`);
      if (!res.ok) {
        const err = await res.text();
        return { success: false, error: `Deployment not found (${res.status}): ${err}` };
      }
      const d = await res.json();
      return {
        success: true,
        result: {
          uid: d.uid,
          name: d.name,
          url: d.url,
          state: d.readyState,
          target: d.target,
          created: d.createdAt,
          buildError: d.errorMessage,
          meta: d.meta,
        },
      };
    } catch (err) {
      return { success: false, error: `Vercel error: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // Deploy (DANGEROUS)
  toolRegistry.register(vercelDeploy, async (args) => {
    if (!await getVercelToken()) {
      return { success: false, error: 'Vercel API token not configured.' };
    }
    // This would trigger a deployment via Vercel API
    // For now, return a structured message explaining capability
    return {
      success: false,
      error: 'Deployment via API requires additional configuration (Git integration or file upload). Use the Vercel dashboard or CLI for now.',
    };
  });
}
