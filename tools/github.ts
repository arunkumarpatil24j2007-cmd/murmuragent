// tools/github.ts — GitHub tool definitions with real API integration
// Connects with GitHub Personal Access Token to search repositories, inspect issues, and create PRs.

import { PermissionLevel } from '@/lib/schemas';
import type { ToolDefinition } from '@/lib/schemas';
import { toolRegistry } from './registry';
import { connectorsStore } from '@/lib/connectors-store';
import { logger } from '@/lib/logger';

const githubListRepos: ToolDefinition = {
  name: 'github.listRepos',
  description: 'List GitHub repositories accessible to the connected account.',
  parameters: [
    { name: 'visibility', type: 'string', description: 'Visibility filter: "all", "public", "private"', required: false },
    { name: 'limit', type: 'number', description: 'Max repositories to return (default: 20)', required: false },
  ],
  permission: PermissionLevel.READ,
  source: 'api',
};

const githubGetRepo: ToolDefinition = {
  name: 'github.getRepo',
  description: 'Get details about a specific GitHub repository (owner/repo).',
  parameters: [
    { name: 'owner', type: 'string', description: 'Repository owner (user or organization)', required: true },
    { name: 'repo', type: 'string', description: 'Repository name', required: true },
  ],
  permission: PermissionLevel.READ,
  source: 'api',
};

const githubListIssues: ToolDefinition = {
  name: 'github.listIssues',
  description: 'List issues for a repository with optional state filter.',
  parameters: [
    { name: 'owner', type: 'string', description: 'Repository owner', required: true },
    { name: 'repo', type: 'string', description: 'Repository name', required: true },
    { name: 'state', type: 'string', description: 'Issue state: "open", "closed", "all"', required: false },
    { name: 'limit', type: 'number', description: 'Max issues to return (default: 15)', required: false },
  ],
  permission: PermissionLevel.READ,
  source: 'api',
};

const githubCreateIssue: ToolDefinition = {
  name: 'github.createIssue',
  description: 'Open a new issue in a GitHub repository.',
  parameters: [
    { name: 'owner', type: 'string', description: 'Repository owner', required: true },
    { name: 'repo', type: 'string', description: 'Repository name', required: true },
    { name: 'title', type: 'string', description: 'Issue title', required: true },
    { name: 'body', type: 'string', description: 'Issue description body in markdown', required: false },
  ],
  permission: PermissionLevel.WRITE,
  source: 'api',
};

const githubCreatePullRequest: ToolDefinition = {
  name: 'github.createPullRequest',
  description: 'Create a new pull request between branches in a repository.',
  parameters: [
    { name: 'owner', type: 'string', description: 'Repository owner', required: true },
    { name: 'repo', type: 'string', description: 'Repository name', required: true },
    { name: 'title', type: 'string', description: 'Pull request title', required: true },
    { name: 'head', type: 'string', description: 'The branch that contains your changes', required: true },
    { name: 'base', type: 'string', description: 'The branch you want to merge into (e.g. main)', required: true },
    { name: 'body', type: 'string', description: 'Pull request description body in markdown', required: false },
  ],
  permission: PermissionLevel.WRITE,
  source: 'api',
};

import type { ToolContext } from './registry';

async function getGitHubToken(context?: ToolContext): Promise<{ token?: string; error?: string }> {
  if (!context?.userId) {
    return {
      error: 'You are not logged in. Please sign in to Murmur and connect your GitHub account in the Connections tab.',
    };
  }
  const token = await connectorsStore.getConnectorToken('github', context.userId);
  if (!token) {
    return {
      error: 'GitHub is not connected for your account. Please connect your GitHub account in the Connections tab.',
    };
  }
  return { token };
}

async function githubFetch(path: string, token: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Murmur-Agent',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

export function registerGitHubTools(): void {
  // List repos
  toolRegistry.register(githubListRepos, async (args, context) => {
    const { token, error } = await getGitHubToken(context);
    if (error || !token) {
      return { success: false, error: error || 'GitHub not connected' };
    }
    try {
      const visibility = (args.visibility as string) || 'all';
      const limit = (args.limit as number) || 20;
      const res = await githubFetch(`/user/repos?visibility=${visibility}&per_page=${limit}&sort=updated`, token);
      if (!res.ok) {
        const err = await res.text();
        return { success: false, error: `GitHub API error (${res.status}): ${err}` };
      }
      const data = await res.json();
      const repos = data.map((r: Record<string, unknown>) => ({
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        private: r.private,
        htmlUrl: r.html_url,
        description: r.description,
        defaultBranch: r.default_branch,
        stargazersCount: r.stargazers_count,
        updatedAt: r.updated_at,
      }));
      return { success: true, result: { count: repos.length, repositories: repos } };
    } catch (err) {
      logger.error('GitHubTool', 'List repos failed', { error: String(err) });
      return { success: false, error: err instanceof Error ? err.message : String(err)} ;
    }
  });

  // Get repo
  toolRegistry.register(githubGetRepo, async (args, context) => {
    const { token, error } = await getGitHubToken(context);
    if (error || !token) {
      return { success: false, error: error || 'GitHub not connected' };
    }
    try {
      const res = await githubFetch(`/repos/${args.owner}/${args.repo}`, token);
      if (!res.ok) {
        const err = await res.text();
        return { success: false, error: `Repository not found (${res.status}): ${err}` };
      }
      const r = await res.json();
      return {
        success: true,
        result: {
          id: r.id,
          name: r.name,
          fullName: r.full_name,
          private: r.private,
          htmlUrl: r.html_url,
          description: r.description,
          defaultBranch: r.default_branch,
          stars: r.stargazers_count,
          forks: r.forks_count,
          openIssues: r.open_issues_count,
        },
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // List issues
  toolRegistry.register(githubListIssues, async (args, context) => {
    const { token, error } = await getGitHubToken(context);
    if (error || !token) {
      return { success: false, error: error || 'GitHub not connected' };
    }
    try {
      const state = (args.state as string) || 'open';
      const limit = (args.limit as number) || 15;
      const res = await githubFetch(`/repos/${args.owner}/${args.repo}/issues?state=${state}&per_page=${limit}`, token);
      if (!res.ok) {
        const err = await res.text();
        return { success: false, error: `Failed to list issues (${res.status}): ${err}` };
      }
      const data = await res.json();
      const issues = data.map((i: Record<string, unknown>) => ({
        number: i.number,
        title: i.title,
        state: i.state,
        htmlUrl: i.html_url,
        author: (i.user as Record<string, unknown>)?.login,
        commentsCount: i.comments,
        createdAt: i.created_at,
      }));
      return { success: true, result: { count: issues.length, issues } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Create issue
  toolRegistry.register(githubCreateIssue, async (args, context) => {
    const { token, error } = await getGitHubToken(context);
    if (error || !token) {
      return { success: false, error: error || 'GitHub not connected' };
    }
    try {
      const res = await githubFetch(`/repos/${args.owner}/${args.repo}/issues`, token, {
        method: 'POST',
        body: JSON.stringify({
          title: args.title,
          body: args.body || '',
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        return { success: false, error: `Failed to create issue (${res.status}): ${err}` };
      }
      const data = await res.json();
      return {
        success: true,
        result: {
          number: data.number,
          title: data.title,
          htmlUrl: data.html_url,
          message: `Created issue #${data.number}: ${data.title}`,
        },
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Create PR
  toolRegistry.register(githubCreatePullRequest, async (args, context) => {
    const { token, error } = await getGitHubToken(context);
    if (error || !token) {
      return { success: false, error: error || 'GitHub not connected' };
    }
    try {
      const res = await githubFetch(`/repos/${args.owner}/${args.repo}/pulls`, token, {
        method: 'POST',
        body: JSON.stringify({
          title: args.title,
          head: args.head,
          base: args.base,
          body: args.body || '',
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        return { success: false, error: `Failed to create PR (${res.status}): ${err}` };
      }
      const data = await res.json();
      return {
        success: true,
        result: {
          number: data.number,
          title: data.title,
          htmlUrl: data.html_url,
          message: `Created Pull Request #${data.number}: ${data.title}`,
        },
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}
