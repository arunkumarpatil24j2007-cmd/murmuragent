// tools/files.ts — Production File Intelligence & Document Analysis Tools
// Enables Murmur Agent to read, analyze, compare, summarize, and convert tabular data and documents.

import { PermissionLevel } from '@/lib/schemas';
import type { ToolDefinition } from '@/lib/schemas';
import { toolRegistry } from './registry';
import { logger } from '@/lib/logger';

// Helper: parse CSV string into headers and rows
function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // Parse comma or tab delimited
  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const parseLine = (line: string) =>
    line.split(delimiter).map((c) => c.replace(/^["']|["']$/g, '').trim());

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);

  return { headers, rows };
}

// ── Tool Definitions ──────────────────────────────────

const filesRead: ToolDefinition = {
  name: 'files.read',
  description: 'Read and extract content from a text file, markdown document, CSV, or structured JSON payload.',
  parameters: [
    {
      name: 'content',
      type: 'string',
      description: 'The raw document text, CSV content, or path/identifier of the file to inspect',
      required: true,
    },
    {
      name: 'filename',
      type: 'string',
      description: 'Optional filename (e.g. "leads.csv", "proposal.docx", "report.txt")',
      required: false,
    },
  ],
  permission: PermissionLevel.READ,
  source: 'api',
  riskLevel: 'low',
};

const filesAnalyzeTable: ToolDefinition = {
  name: 'files.analyzeTable',
  description:
    'Analyze a CSV or tabular dataset. Computes row counts, column types, identifies leads/records needing follow-up, and returns structured summaries.',
  parameters: [
    {
      name: 'csvData',
      type: 'string',
      description: 'The CSV content or tabular text representation',
      required: true,
    },
    {
      name: 'query',
      type: 'string',
      description: 'Analysis objective (e.g. "find leads that haven\'t replied", "summarize by status")',
      required: false,
    },
  ],
  permission: PermissionLevel.READ,
  source: 'api',
  riskLevel: 'low',
};

const filesCompare: ToolDefinition = {
  name: 'files.compare',
  description: 'Compare two documents or proposals side-by-side to identify differences, revisions, pricing updates, and altered terms.',
  parameters: [
    {
      name: 'docA',
      type: 'string',
      description: 'Content of the original / first document',
      required: true,
    },
    {
      name: 'docB',
      type: 'string',
      description: 'Content of the modified / second document',
      required: true,
    },
    {
      name: 'focus',
      type: 'string',
      description: 'Specific focus of comparison (e.g. "scope, pricing, milestones, deliverables")',
      required: false,
    },
  ],
  permission: PermissionLevel.READ,
  source: 'api',
  riskLevel: 'low',
};

const filesSummarize: ToolDefinition = {
  name: 'files.summarize',
  description: 'Generate an executive summary of a document, contract, or PDF text, highlighting action items and key details.',
  parameters: [
    {
      name: 'content',
      type: 'string',
      description: 'The document or text content to summarize',
      required: true,
    },
    {
      name: 'maxLength',
      type: 'number',
      description: 'Target summary length in words (default: 250)',
      required: false,
    },
  ],
  permission: PermissionLevel.READ,
  source: 'api',
  riskLevel: 'low',
};

// ── Registrations ─────────────────────────────────────

export function registerFilesTools(): void {
  // 1. files.read
  toolRegistry.register(filesRead, async (args) => {
    const raw = String(args.content || '').trim();
    const filename = String(args.filename || 'document.txt');

    if (!raw) {
      return { success: false, error: 'Content parameter cannot be empty.' };
    }

    const lines = raw.split(/\r?\n/).length;
    const wordCount = raw.split(/\s+/).filter(Boolean).length;

    return {
      success: true,
      result: {
        filename,
        lineCount: lines,
        wordCount,
        characterCount: raw.length,
        preview: raw.slice(0, 1500),
        fullContent: raw.length <= 4000 ? raw : undefined,
      },
    };
  });

  // 2. files.analyzeTable
  toolRegistry.register(filesAnalyzeTable, async (args) => {
    const raw = String(args.csvData || '').trim();
    const objective = String(args.query || 'General analysis');

    if (!raw) {
      return { success: false, error: 'csvData parameter cannot be empty.' };
    }

    try {
      const { headers, rows } = parseCSV(raw);

      if (headers.length === 0) {
        return { success: false, error: 'Could not detect tabular columns in provided data.' };
      }

      // Check for common status columns
      const statusColIdx = headers.findIndex((h) =>
        /status|stage|replied|response|follow/i.test(h)
      );

      const statusDistribution: Record<string, number> = {};
      const followUpRecords: any[] = [];

      rows.forEach((r, idx) => {
        if (statusColIdx !== -1 && r[statusColIdx]) {
          const val = r[statusColIdx].toLowerCase();
          statusDistribution[val] = (statusDistribution[val] || 0) + 1;

          if (val.includes('no') || val.includes('pending') || val.includes('follow') || val.includes('unanswered') || val.includes('wait')) {
            followUpRecords.push({
              rowNumber: idx + 1,
              data: Object.fromEntries(headers.map((h, i) => [h, r[i] || ''])),
            });
          }
        }
      });

      return {
        success: true,
        result: {
          totalRows: rows.length,
          columns: headers,
          objective,
          statusDistribution: Object.keys(statusDistribution).length > 0 ? statusDistribution : undefined,
          recordsNeedingFollowUp: followUpRecords.length > 0 ? followUpRecords.slice(0, 20) : undefined,
          sampleRows: rows.slice(0, 5).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] || '']))),
        },
      };
    } catch (err: any) {
      return { success: false, error: `Table analysis failed: ${err?.message || String(err)}` };
    }
  });

  // 3. files.compare
  toolRegistry.register(filesCompare, async (args) => {
    const docA = String(args.docA || '').trim();
    const docB = String(args.docB || '').trim();
    const focus = String(args.focus || 'general');

    if (!docA || !docB) {
      return { success: false, error: 'Both docA and docB parameters are required for comparison.' };
    }

    const linesA = docA.split(/\r?\n/).filter(Boolean);
    const linesB = docB.split(/\r?\n/).filter(Boolean);

    const setA = new Set(linesA);
    const setB = new Set(linesB);

    const onlyInA = linesA.filter((l) => !setB.has(l));
    const onlyInB = linesB.filter((l) => !setA.has(l));

    return {
      success: true,
      result: {
        focus,
        docAStats: { length: docA.length, lines: linesA.length },
        docBStats: { length: docB.length, lines: linesB.length },
        addedOrModifiedInB: onlyInB.slice(0, 15),
        removedFromA: onlyInA.slice(0, 15),
        summary: `Document B contains ${onlyInB.length} altered/new lines and removed ${onlyInA.length} lines compared to Document A.`,
      },
    };
  });

  // 4. files.summarize
  toolRegistry.register(filesSummarize, async (args) => {
    const content = String(args.content || '').trim();
    if (!content) {
      return { success: false, error: 'Content parameter cannot be empty.' };
    }

    const sentences = content
      .split(/(?<=[.?!])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 15);

    // Extract sentences with key indicators
    const keySentences = sentences.filter((s) =>
      /important|note|objective|deliverable|action|key|require|deadline|summary|result|propose/i.test(s)
    );

    const selected = keySentences.length > 0 ? keySentences.slice(0, 6) : sentences.slice(0, 4);

    return {
      success: true,
      result: {
        totalWords: content.split(/\s+/).length,
        executiveTakeaways: selected,
        fullContentSample: content.slice(0, 1200),
      },
    };
  });
}
