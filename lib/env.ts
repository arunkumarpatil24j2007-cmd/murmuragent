// lib/env.ts — Server-side environment configuration
// All secrets stay server-side. Never import this from client components.

import fs from 'fs';
import path from 'path';

// Safely load .env.local for standalone scripts, next-server, and background agents
function loadLocalEnv() {
  if (typeof window !== 'undefined') return;
  const envPath = path.join(process.cwd(), '.env.local');
  try {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          // Strip wrapping quotes if any
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key] || process.env[key] === '') {
            process.env[key] = val;
          }
        }
      }
    }
  } catch {}
}
loadLocalEnv();

export const env = {
  // Model Providers
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-3-flash-preview',
  },
  nvidia: {
    apiKey: process.env.NVIDIA_API_KEY || '',
    model: process.env.NVIDIA_MODEL || 'meta/llama-3.2-11b-vision-instruct',
  },
  kimi: {
    apiKey: process.env.KIMI_API_KEY || '',
    model: process.env.KIMI_MODEL || 'moonshotai/kimi-k2.6:free',
    baseUrl: process.env.KIMI_BASE_URL || 'https://openrouter.ai/api/v1',
  },
  local: {
    provider: process.env.LOCAL_MODEL_PROVIDER || 'ollama',
    baseUrl: process.env.LOCAL_MODEL_BASE_URL || 'http://127.0.0.1:11434/v1',
    model: process.env.LOCAL_MODEL_NAME || 'qwen3.5:latest',
  },

  // Browser
  airtop: {
    apiKey: process.env.AIRTOP_API_KEY || '',
  },

  // MCP
  palmier: {
    url: process.env.PALMIER_MCP_URL || 'http://127.0.0.1:19789/mcp',
    token: process.env.PALMIER_MCP_TOKEN || '',
  },

  // Notion
  notion: {
    token: process.env.NOTION_TOKEN || '',
  },

  // Vercel
  vercel: {
    token: process.env.VERCEL_TOKEN || '',
  },

  // Google Workspace OAuth
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback',
    tokenEncryptionKey: process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || 'murmur-agent-google-token-secret-32b',
  },

  // Supabase (Persistent Token Store)
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },

  // Agent limits
  agent: {
    maxSteps: parseInt(process.env.MAX_AGENT_STEPS || '20', 10),
    maxToolCalls: parseInt(process.env.MAX_TOOL_CALLS || '30', 10),
    maxExecutionTime: parseInt(process.env.MAX_EXECUTION_TIME || '300000', 10),
  },
} as const;

/** Check whether a provider is configured */
export function isProviderConfigured(provider: 'gemini' | 'nvidia' | 'kimi' | 'local' | 'airtop' | 'palmier' | 'notion' | 'vercel' | 'google' | 'supabase'): boolean {
  switch (provider) {
    case 'gemini':
      return !!env.gemini.apiKey;
    case 'nvidia':
      return !!env.nvidia.apiKey;
    case 'kimi':
      return !!env.kimi.apiKey;
    case 'local':
      return !!env.local.baseUrl && !!env.local.model;
    case 'airtop':
      return !!env.airtop.apiKey;
    case 'palmier':
      return !!env.palmier.url;
    case 'notion':
      return !!env.notion.token;
    case 'vercel':
      return !!env.vercel.token;
    case 'google':
      return !!(env.google.clientId && env.google.clientSecret);
    case 'supabase':
      return !!(env.supabase.url && env.supabase.serviceRoleKey);
  }
}
