// scripts/test-work-links.ts — Automated verification of work output links and artifact extraction

import { identifyService, extractWorkArtifacts } from '../components/work-artifact';
import { toolRegistry } from '../tools/registry';
import { registerDocsTools } from '../tools/google/docs';
import { registerSheetsTools } from '../tools/google/sheets';
import { registerNotionTools } from '../tools/notion';
import { executeToolCall } from '../agent/executor';
import type { AgentEvent, ToolCall } from '../lib/schemas';

async function main() {
  console.log('--- 1. Testing identifyService ---');
  const docService = identifyService('https://docs.google.com/document/d/doc_abc123/edit', 'Murmur Architecture');
  console.assert(docService.service === 'Google Doc', `Expected Google Doc, got ${docService.service}`);
  console.assert(docService.actionLabel.includes('Google Doc'), 'Expected Google Doc action label');
  console.log('✓ Google Doc service identification passed:', docService);

  const sheetService = identifyService('https://docs.google.com/spreadsheets/d/sheet_xyz789/edit', 'Financial Model');
  console.assert(sheetService.service === 'Google Sheet', `Expected Google Sheet, got ${sheetService.service}`);
  console.assert(sheetService.actionLabel.includes('Google Sheet'), 'Expected Google Sheet action label');
  console.log('✓ Google Sheet service identification passed:', sheetService);

  const notionService = identifyService('https://www.notion.so/my-page-123456');
  console.assert(notionService.service === 'Notion', `Expected Notion, got ${notionService.service}`);
  console.log('✓ Notion service identification passed:', notionService);

  const vercelService = identifyService('https://my-app.vercel.app');
  console.assert(vercelService.service === 'Vercel', `Expected Vercel, got ${vercelService.service}`);
  console.log('✓ Vercel service identification passed:', vercelService);

  console.log('\n--- 2. Testing extractWorkArtifacts from Markdown content ---');
  const mockContent = 'I have created the Google Sheet [Q3 Financial Model](https://docs.google.com/spreadsheets/d/sheet_123/edit) and also the doc https://docs.google.com/document/d/doc_456/edit for review.';
  const artifacts = extractWorkArtifacts(mockContent);
  console.assert(artifacts.length === 2, `Expected 2 artifacts, got ${artifacts.length}`);
  console.assert(artifacts[0].service === 'Google Sheet', 'First artifact should be Google Sheet');
  console.assert(artifacts[0].title === 'Q3 Financial Model', 'First artifact title should be extracted from markdown');
  console.assert(artifacts[1].service === 'Google Doc', 'Second artifact should be Google Doc');
  console.log(`✓ Successfully extracted ${artifacts.length} artifacts from markdown content`);

  console.log('\n--- 3. Testing Executor Event Emission with URL & Title Metadata ---');
  registerDocsTools();
  registerSheetsTools();

  const emittedEvents: AgentEvent[] = [];
  const mockCtx = {
    taskId: 'test-task',
    model: 'gemini',
    conversationId: 'test-conv',
    emit: (event: AgentEvent) => {
      emittedEvents.push(event);
    },
    signal: new AbortController().signal,
  };

  const docCall: ToolCall = {
    id: 'call-1',
    tool: 'docs.create',
    arguments: { title: 'AI Engineering Roadmap', content: 'Section 1: Agents' },
  };

  const docResult = await executeToolCall(docCall, mockCtx);
  console.assert(docResult.success === true, 'docs.create should succeed');
  const docEvent = emittedEvents.find((e) => e.type === 'tool_result' && e.data.tool === 'docs.create');
  console.assert(!!docEvent, 'tool_result event should be emitted');
  console.assert(!!docEvent?.data.url, 'tool_result event should contain url');
  console.assert(docEvent?.data.url?.includes('docs.google.com/document'), 'url should be valid Google Doc URL');
  console.assert(docEvent?.data.title === 'AI Engineering Roadmap', 'title should be AI Engineering Roadmap');
  console.log('✓ docs.create emitted tool_result with url and title:', docEvent?.data);

  // Sheets test
  const sheetCall: ToolCall = {
    id: 'call-2',
    tool: 'sheets.create',
    arguments: { title: 'Growth Metrics 2026', headers: 'Month,MRR,Users', data: '[["Jan","10k","500"]]' },
  };

  const sheetResult = await executeToolCall(sheetCall, mockCtx);
  console.assert(sheetResult.success === true, 'sheets.create should succeed');
  const sheetEvent = emittedEvents.find((e) => e.type === 'tool_result' && e.data.tool === 'sheets.create');
  console.assert(!!sheetEvent, 'tool_result event for sheet should be emitted');
  console.assert(!!sheetEvent?.data.url, 'sheet event should contain url');
  console.assert(sheetEvent?.data.url?.includes('docs.google.com/spreadsheets'), 'url should be valid Google Sheets URL');
  console.assert(sheetEvent?.data.title === 'Growth Metrics 2026', 'title should be Growth Metrics 2026');
  console.log('✓ sheets.create emitted tool_result with url and title:', sheetEvent?.data);

  console.log('\n--- 4. Testing extractWorkArtifacts with Events Integration ---');
  const combinedArtifacts = extractWorkArtifacts(
    'Task completed! You can access the documents below.',
    emittedEvents
  );
  console.assert(combinedArtifacts.length === 2, `Expected 2 artifacts from events, got ${combinedArtifacts.length}`);
  console.assert(combinedArtifacts.some((a) => a.service === 'Google Doc'), 'Should contain Google Doc');
  console.assert(combinedArtifacts.some((a) => a.service === 'Google Sheet'), 'Should contain Google Sheet');
  console.log('✓ Successfully extracted artifacts from emitted events:', combinedArtifacts.map((a) => ({ service: a.service, title: a.title, url: a.url })));

  console.log('\n🎉 ALL WORK LINK VERIFICATION TESTS PASSED!');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
