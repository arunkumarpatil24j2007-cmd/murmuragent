// scripts/test-all-tools.ts — Comprehensive Test Harness for All Tools & Model Auto-Failover

import { initializeAgent } from '../agent/agent';
import { toolRegistry } from '../tools/registry';
import { AirtopClient } from '../browser/airtop';
import { MCPClient } from '../mcp/client';
import {
  autoSelectProvider,
  executeWithFailover,
  markProviderExhausted,
  isProviderHealthy,
  getProviderStatus,
} from '../models/router';
import type { ModelProvider } from '../models/types';
import type { ModelMessage, ModelResponse } from '../lib/schemas';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  durationMs: number;
  details?: unknown;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(suite: string, name: string, fn: () => Promise<unknown>): Promise<void> {
  const start = Date.now();
  try {
    const details = await fn();
    const durationMs = Date.now() - start;
    results.push({ suite, name, passed: true, durationMs, details });
    console.log(`  ✓ [${suite}] ${name} (${durationMs}ms)`);
  } catch (err) {
    const durationMs = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : String(err);
    results.push({ suite, name, passed: false, durationMs, error: errorMsg });
    console.error(`  ✗ [${suite}] ${name} (${durationMs}ms) — ERROR: ${errorMsg}`);
  }
}

async function main() {
  console.log('====================================================');
  console.log('  MURMUR AGENT — COMPREHENSIVE TOOLS & ROUTER AUDIT ');
  console.log('====================================================\n');

  // Initialize all tools
  await initializeAgent();

  // ──────────────────────────────────────────────────────────
  // 1. GMAIL & EMAIL TOOLS
  // ──────────────────────────────────────────────────────────
  console.log('\n--- 1. Testing Gmail & Email Tools ---');
  let emailIdToRead = '';

  await runTest('Gmail', 'gmail.search with query', async () => {
    const res = await toolRegistry.execute('gmail.search', { query: 'Vercel' });
    if (!res.success) throw new Error(res.error || 'Search failed');
    const data = res.result as { count: number; emails: Array<{ id: string }> };
    if (data.count === 0) throw new Error('Expected at least 1 search result');
    emailIdToRead = data.emails[0].id;
    return { count: data.count, firstId: emailIdToRead };
  });

  await runTest('Gmail', 'gmail.read by ID', async () => {
    if (!emailIdToRead) emailIdToRead = 'msg_101';
    const res = await toolRegistry.execute('gmail.read', { emailId: emailIdToRead });
    if (!res.success) throw new Error(res.error || 'Read failed');
    const email = res.result as { id: string; subject: string };
    if (!email.subject) throw new Error('Email subject missing');
    return { id: email.id, subject: email.subject };
  });

  await runTest('Gmail', 'gmail.send new message', async () => {
    const res = await toolRegistry.execute('gmail.send', {
      to: 'client@example.com',
      subject: 'Automated Audit Status',
      body: 'All systems verified and operational.',
    });
    if (!res.success) throw new Error(res.error || 'Send failed');
    const sent = res.result as { id: string; status: string };
    if (sent.status !== 'sent') throw new Error(`Unexpected status: ${sent.status}`);
    return sent;
  });

  // ──────────────────────────────────────────────────────────
  // 2. GOOGLE DOCS TOOLS
  // ──────────────────────────────────────────────────────────
  console.log('\n--- 2. Testing Google Docs Tools ---');
  let createdDocId = '';

  await runTest('GoogleDocs', 'docs.create document', async () => {
    const res = await toolRegistry.execute('docs.create', {
      title: 'Automated Test Document',
      content: '# Murmur Flow Test\n\nVerified execution.',
    });
    if (!res.success) throw new Error(res.error || 'Create doc failed');
    const doc = res.result as { documentId: string; title: string };
    createdDocId = doc.documentId;
    return doc;
  });

  await runTest('GoogleDocs', 'docs.read document by ID', async () => {
    const res = await toolRegistry.execute('docs.read', { documentId: createdDocId });
    if (!res.success) throw new Error(res.error || 'Read doc failed');
    const doc = res.result as { title: string; content: string };
    if (!doc.content.includes('Murmur Flow')) throw new Error('Content mismatch');
    return { title: doc.title, length: doc.content.length };
  });

  await runTest('GoogleDocs', 'docs.update append content', async () => {
    const res = await toolRegistry.execute('docs.update', {
      documentId: createdDocId,
      content: 'Appended follow-up line from test harness.',
    });
    if (!res.success) throw new Error(res.error || 'Update doc failed');
    return res.result;
  });

  // ──────────────────────────────────────────────────────────
  // 3. GOOGLE SHEETS TOOLS
  // ──────────────────────────────────────────────────────────
  console.log('\n--- 3. Testing Google Sheets Tools ---');
  let createdSheetId = '';

  await runTest('GoogleSheets', 'sheets.create spreadsheet', async () => {
    const res = await toolRegistry.execute('sheets.create', {
      title: 'Q4 Financial Pipelines',
      headers: 'Metric, Target, Actual, Health',
      data: JSON.stringify([
        ['Revenue', '$50,000', '$52,400', 'Green'],
        ['Clients', '25', '28', 'Green'],
      ]),
    });
    if (!res.success) throw new Error(res.error || 'Create sheet failed');
    const sheet = res.result as { spreadsheetId: string; title: string; rowCount: number };
    createdSheetId = sheet.spreadsheetId;
    return sheet;
  });

  await runTest('GoogleSheets', 'sheets.read spreadsheet', async () => {
    const res = await toolRegistry.execute('sheets.read', { spreadsheetId: createdSheetId });
    if (!res.success) throw new Error(res.error || 'Read sheet failed');
    const sheet = res.result as { title: string; data: string[][] };
    if (sheet.data.length !== 2) throw new Error(`Expected 2 rows, got ${sheet.data.length}`);
    return { title: sheet.title, rows: sheet.data.length };
  });

  await runTest('GoogleSheets', 'sheets.update append rows', async () => {
    const res = await toolRegistry.execute('sheets.update', {
      spreadsheetId: createdSheetId,
      range: 'A3',
      data: JSON.stringify([['Retention', '95%', '97%', 'Green']]),
    });
    if (!res.success) throw new Error(res.error || 'Update sheet failed');
    return res.result;
  });

  // ──────────────────────────────────────────────────────────
  // 4. NOTION WORKSPACE TOOLS
  // ──────────────────────────────────────────────────────────
  console.log('\n--- 4. Testing Notion Workspace Tools ---');
  let notionPageId = '';

  await runTest('Notion', 'notion.search live workspace', async () => {
    const res = await toolRegistry.execute('notion.search', { query: '' });
    if (!res.success) throw new Error(res.error || 'Notion search failed');
    const data = res.result as { count: number; results: Array<{ id: string; title: string }> };
    if (data.count === 0) throw new Error('No Notion results returned');
    notionPageId = data.results[0].id;
    return { count: data.count, sampleTitle: data.results[0].title };
  });

  await runTest('Notion', 'notion.readPage by ID', async () => {
    if (!notionPageId) throw new Error('No page ID available from search');
    const res = await toolRegistry.execute('notion.readPage', { pageId: notionPageId });
    if (!res.success) throw new Error(res.error || 'Notion readPage failed');
    return { pageId: notionPageId, success: true };
  });

  // ──────────────────────────────────────────────────────────
  // 5. VERCEL DEPLOYMENT TOOLS
  // ──────────────────────────────────────────────────────────
  console.log('\n--- 5. Testing Vercel Deployment Tools ---');
  let vercelProjectId = '';

  await runTest('Vercel', 'vercel.listProjects live API', async () => {
    const res = await toolRegistry.execute('vercel.listProjects', { limit: 5 });
    if (!res.success) throw new Error(res.error || 'Vercel listProjects failed');
    const data = res.result as { count: number; projects: Array<{ id: string; name: string }> };
    if (data.count === 0) throw new Error('No Vercel projects found');
    vercelProjectId = data.projects[0].id;
    return { count: data.count, firstProject: data.projects[0].name };
  });

  await runTest('Vercel', 'vercel.getProject by ID', async () => {
    if (!vercelProjectId) throw new Error('No project ID from listProjects');
    const res = await toolRegistry.execute('vercel.getProject', { projectId: vercelProjectId });
    if (!res.success) throw new Error(res.error || 'Vercel getProject failed');
    return { projectId: vercelProjectId, success: true };
  });

  await runTest('Vercel', 'vercel.listDeployments live API', async () => {
    const res = await toolRegistry.execute('vercel.listDeployments', { limit: 3 });
    if (!res.success) throw new Error(res.error || 'Vercel listDeployments failed');
    const data = res.result as { count: number; deployments: Array<{ id: string; url: string }> };
    return { count: data.count, latestUrl: data.deployments[0]?.url };
  });

  // ──────────────────────────────────────────────────────────
  // 6. AIRTOP WEB BROWSER AUTOMATION
  // ──────────────────────────────────────────────────────────
  console.log('\n--- 6. Testing Airtop Web Browser Automation ---');

  await runTest('Airtop', 'Create and terminate live remote browser session', async () => {
    const client = new AirtopClient();
    const session = await client.createSession();
    if (!session.id) throw new Error('Failed to obtain session ID');
    await client.terminateSession();
    return { sessionId: session.id, status: 'verified_and_closed' };
  });

  await runTest('Airtop', 'browser.navigate tool execution', async () => {
    const res = await toolRegistry.execute('browser.navigate', { url: 'https://example.com' });
    if (!res.success) throw new Error(res.error || 'Browser navigate failed');
    return res.result;
  });

  // ──────────────────────────────────────────────────────────
  // 7. PALMIER MCP TOOLS RESILIENCE
  // ──────────────────────────────────────────────────────────
  console.log('\n--- 7. Testing Palmier MCP Client Resilience ---');

  await runTest('PalmierMCP', 'Graceful offline detection without hanging', async () => {
    const client = new MCPClient('http://127.0.0.1:19789/mcp', '');
    const isAvail = await client.isAvailable();
    const tools = await client.discoverTools();
    return { available: isAvail, toolsFound: tools.length, note: 'Gracefully handled offline daemon' };
  });

  // ──────────────────────────────────────────────────────────
  // 8. AUTO-ROUTER & CREDIT EXHAUSTION FAILOVER CIRCUIT
  // ──────────────────────────────────────────────────────────
  console.log('\n--- 8. Testing Auto-Router & Credit Failover Circuit ---');

  await runTest('AutoRouter', 'Task classification: tool-heavy prompt', async () => {
    const provider = await autoSelectProvider('Deploy my Vercel project and log details in Notion');
    return { selectedProvider: provider.metadata.id, model: provider.metadata.name };
  });

  await runTest('AutoRouter', 'Task classification: vision/browser prompt', async () => {
    const provider = await autoSelectProvider('Navigate to https://example.com and take a screenshot');
    return { selectedProvider: provider.metadata.id, model: provider.metadata.name };
  });

  await runTest('AutoRouter', 'Automatic failover on simulated credit exhaustion (HTTP 402/429)', async () => {
    let failoverTriggered = false;
    let from = '';
    let to = '';
    let why = '';

    // Create a mock provider that simulates HTTP 429 quota exhaustion
    const mockFailingProvider: ModelProvider = {
      metadata: {
        id: 'simulated-exhausted-model',
        name: 'Simulated Exhausted Model',
        provider: 'mock',
        supportsTool: true,
        supportsStreaming: false,
        maxTokens: 1024,
        costTier: 'high',
      },
      isAvailable: async () => true,
      generate: async () => {
        throw new Error('HTTP 429: Insufficient credits or quota exceeded for current billing cycle.');
      },
    };

    const messages: ModelMessage[] = [{ role: 'user', content: 'Say hello' }];

    const result = await executeWithFailover(
      messages,
      {},
      mockFailingProvider,
      'Say hello',
      (fromProvider, toProvider, reason) => {
        failoverTriggered = true;
        from = fromProvider;
        to = toProvider;
        why = reason;
      }
    );

    if (!failoverTriggered) {
      throw new Error('Failover was not triggered upon credit exhaustion error');
    }

    return {
      failoverTriggered,
      from,
      to,
      reason: why,
      finalResponse: result.response.content.trim().slice(0, 40),
      providerUsed: result.providerUsed.metadata.id,
    };
  });

  // ──────────────────────────────────────────────────────────
  // SUMMARY REPORT
  // ──────────────────────────────────────────────────────────
  console.log('\n====================================================');
  console.log('               AUDIT TEST SUMMARY                   ');
  console.log('====================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`Total Tests: ${total} | Passed: ${passed} | Failed: ${failed}\n`);

  if (failed > 0) {
    console.error('Failed Tests:');
    results.filter((r) => !r.passed).forEach((r) => {
      console.error(` - [${r.suite}] ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('ALL TESTS PASSED SUCCESSFULLY! ✓');
  }
}

main().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
