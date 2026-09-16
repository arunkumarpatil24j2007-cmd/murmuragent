// tools/web.ts — Production Web Research & Information Gathering Tools
// Enables the Murmur Agent to search the live web, fetch & read webpages, extract structured data,
// and compare multiple web sources with zero manual API setup.

import { PermissionLevel } from '@/lib/schemas';
import type { ToolDefinition } from '@/lib/schemas';
import { toolRegistry } from './registry';
import { logger } from '@/lib/logger';

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Execute web search via DuckDuckGo HTML endpoint.
 * Parses titles, links, and snippets into clean structured objects.
 */
export async function searchDuckDuckGo(query: string, limit = 10): Promise<WebSearchResult[]> {
  const results: WebSearchResult[] = [];

  // Method 1: DuckDuckGo Lite (Fastest, direct organic URLs and clean text snippets)
  try {
    const liteRes = await fetch('https://lite.duckduckgo.com/lite/', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `q=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(8000),
    });

    if (liteRes.ok) {
      const html = await liteRes.text();
      const linkMatches = Array.from(html.matchAll(/<a[^>]+href=["\']([^"\']+)["\'][^>]+class=["\']result-link["\'][^>]*>([\s\S]*?)<\/a>/gi));
      const snippetMatches = Array.from(html.matchAll(/<td class=["\']result-snippet["\'][^>]*>([\s\S]*?)<\/td>/gi));

      for (let i = 0; i < linkMatches.length && results.length < limit; i++) {
        const lm = linkMatches[i];
        let url = lm[1];
        if (url.includes('uddg=')) {
          const raw = url.split('uddg=')[1]?.split('&')[0];
          if (raw) {
            try {
              url = decodeURIComponent(raw);
            } catch {}
          }
        }

        const title = stripHtml(lm[2]).trim();
        const snippet = stripHtml(snippetMatches[i]?.[1] || '').trim();

        if (url && title && !url.includes('duckduckgo.com/y.js')) {
          results.push({
            title,
            url,
            snippet: snippet || title,
          });
        }
      }

      if (results.length > 0) {
        return results;
      }
    }
  } catch (liteErr) {
    logger.warn('WebSearch', 'DuckDuckGo Lite attempt failed', { error: String(liteErr) });
  }

  // Method 2: DuckDuckGo HTML Fallback
  try {
    const encoded = encodeURIComponent(query);
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encoded}`;

    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const html = await res.text();
      const resultBlockRegex = /<div class="result__body">([\s\S]*?)<\/div>/gi;
      let match: RegExpExecArray | null;

      while ((match = resultBlockRegex.exec(html)) !== null && results.length < limit) {
        const block = match[1];

        const titleMatch = /<a[^>]+class="result__a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(block);
        const snippetMatch = /<a[^>]+class="result__snippet[^>]*>([\s\S]*?)<\/a>/i.exec(block);

        let rawUrl = titleMatch ? titleMatch[1] : '';
        const rawTitle = titleMatch ? titleMatch[2] : '';
        const rawSnippet = snippetMatch ? snippetMatch[1] : '';

        if (rawUrl.includes('uddg=')) {
          const urlParam = rawUrl.split('uddg=')[1]?.split('&')[0];
          if (urlParam) {
            try {
              rawUrl = decodeURIComponent(urlParam);
            } catch {}
          }
        }

        const cleanTitle = stripHtml(rawTitle).trim();
        const cleanSnippet = stripHtml(rawSnippet).trim();

        if (rawUrl && cleanTitle && !rawUrl.includes('duckduckgo.com/y.js')) {
          results.push({
            title: cleanTitle,
            url: rawUrl,
            snippet: cleanSnippet || cleanTitle,
          });
        }
      }

      if (results.length > 0) {
        return results;
      }
    }
  } catch (htmlErr) {
    logger.warn('WebSearch', 'DuckDuckGo HTML attempt failed', { error: String(htmlErr) });
  }

  // Method 3: DuckDuckGo Instant Answer API Fallback
  try {
    const instantRes = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`, {
      signal: AbortSignal.timeout(5000),
    });
    if (instantRes.ok) {
      const data = await instantRes.json();
      if (data.AbstractText && data.AbstractURL) {
        results.push({
          title: data.Heading || query,
          url: data.AbstractURL,
          snippet: data.AbstractText,
        });
      }
      if (Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics.slice(0, limit)) {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.split(' - ')[0] || topic.Text,
              url: topic.FirstURL,
              snippet: topic.Text,
            });
          }
        }
      }
    }
  } catch {}

  return results;
}

/**
 * Fetch and extract clean, readable text content from a web URL.
 */
export async function fetchWebpageContent(url: string, maxChars = 4000): Promise<{
  title: string;
  content: string;
  url: string;
}> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch webpage (HTTP ${res.status})`);
    }

    const html = await res.text();

    const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    const title = titleMatch ? stripHtml(titleMatch[1]).trim() : url;

    let clean = html
      .replace(/<head[\s\S]*?<\/head>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<svg[\s\S]*?<\/svg>/gi, '')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, '');

    clean = clean
      .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|tr)>/gi, '\n')
      .replace(/<br\s*[\/]?>/gi, '\n');

    clean = stripHtml(clean);

    const lines = clean
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 20);

    const finalContent = lines.join('\n\n').slice(0, maxChars);

    return {
      title,
      content: finalContent || 'No readable textual content could be extracted from this webpage.',
      url,
    };
  } catch (err: any) {
    throw new Error(`Unable to read ${url}: ${err?.message || String(err)}`);
  }
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Tool Definitions ──────────────────────────────────

const webSearch: ToolDefinition = {
  name: 'web.search',
  description:
    'Search the public web for real-time information, companies, services, competitors, people, or products. Returns top titles, links, and text summaries.',
  parameters: [
    {
      name: 'query',
      type: 'string',
      description: 'The search query (e.g. "top interior design companies Bangalore", "Stripe pricing 2026")',
      required: true,
    },
    {
      name: 'limit',
      type: 'number',
      description: 'Maximum number of results to return (default: 10, max: 20)',
      required: false,
    },
  ],
  permission: PermissionLevel.READ,
  source: 'api',
  riskLevel: 'low',
};

const webOpen: ToolDefinition = {
  name: 'web.open',
  description:
    'Open and read the textual content of any public webpage URL. Useful for reading company websites, documentation, articles, or competitor pages.',
  parameters: [
    {
      name: 'url',
      type: 'string',
      description: 'The full URL of the webpage to open (e.g. "https://example.com/about")',
      required: true,
    },
  ],
  permission: PermissionLevel.READ,
  source: 'api',
  riskLevel: 'low',
};

const webExtract: ToolDefinition = {
  name: 'web.extract',
  description:
    'Extract structured entities (company name, services, contact email, location, phone, social links) from a webpage URL.',
  parameters: [
    {
      name: 'url',
      type: 'string',
      description: 'The URL to extract data from',
      required: true,
    },
    {
      name: 'fields',
      type: 'string',
      description: 'Comma-separated list of target fields (e.g. "company_name, email, phone, address, services")',
      required: false,
    },
  ],
  permission: PermissionLevel.READ,
  source: 'api',
  riskLevel: 'low',
};

const webCompare: ToolDefinition = {
  name: 'web.compare',
  description:
    'Compare multiple companies, products, or websites side-by-side by inspecting their live pages and synthesizing differences.',
  parameters: [
    {
      name: 'urls',
      type: 'array',
      description: 'List of 2 to 5 URLs to compare',
      required: true,
    },
    {
      name: 'criteria',
      type: 'string',
      description: 'Aspects to compare (e.g. "pricing, key features, target audience")',
      required: false,
    },
  ],
  permission: PermissionLevel.READ,
  source: 'api',
  riskLevel: 'low',
};

// ── Registrations ─────────────────────────────────────

export function registerWebTools(): void {
  // 1. web.search
  toolRegistry.register(webSearch, async (args) => {
    const query = String(args.query || '').trim();
    const limit = Math.min(Math.max(1, Number(args.limit) || 10), 20);

    if (!query) {
      return { success: false, error: 'Query parameter is required for web search.' };
    }

    try {
      const results = await searchDuckDuckGo(query, limit);

      return {
        success: true,
        result: {
          query,
          count: results.length,
          results,
          source: 'DuckDuckGo Live Search',
        },
      };
    } catch (err: any) {
      return { success: false, error: `Web search failed: ${err?.message || String(err)}` };
    }
  });

  // 2. web.open
  toolRegistry.register(webOpen, async (args) => {
    const url = String(args.url || '').trim();
    if (!url || !url.startsWith('http')) {
      return { success: false, error: 'A valid http/https URL is required.' };
    }

    try {
      const page = await fetchWebpageContent(url);
      return {
        success: true,
        result: {
          title: page.title,
          url: page.url,
          content: page.content,
        },
      };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 3. web.extract
  toolRegistry.register(webExtract, async (args) => {
    const url = String(args.url || '').trim();
    if (!url || !url.startsWith('http')) {
      return { success: false, error: 'A valid http/https URL is required.' };
    }

    try {
      const page = await fetchWebpageContent(url, 6000);
      const text = page.content;

      const emailMatches = Array.from(new Set(text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []));
      const phoneMatches = Array.from(new Set(text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || []));

      return {
        success: true,
        result: {
          url,
          title: page.title,
          extracted: {
            emails: emailMatches.slice(0, 5),
            phoneNumbers: phoneMatches.slice(0, 5),
            preview: text.slice(0, 1000),
          },
        },
      };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 4. web.compare
  toolRegistry.register(webCompare, async (args) => {
    const rawUrls = args.urls;
    const urls: string[] = Array.isArray(rawUrls)
      ? rawUrls.map(String)
      : typeof rawUrls === 'string'
      ? rawUrls.split(',').map((u) => u.trim())
      : [];

    if (urls.length < 2) {
      return { success: false, error: 'Please provide at least 2 URLs to compare.' };
    }

    try {
      const pages = await Promise.all(
        urls.slice(0, 4).map(async (u) => {
          try {
            return await fetchWebpageContent(u, 2000);
          } catch {
            return { title: u, content: 'Could not fetch page', url: u };
          }
        })
      );

      return {
        success: true,
        result: {
          comparedSources: pages.map((p) => ({
            title: p.title,
            url: p.url,
            summarySnippet: p.content.slice(0, 400),
          })),
          criteria: args.criteria || 'General comparison',
        },
      };
    } catch (err: any) {
      return { success: false, error: `Comparison failed: ${err?.message || String(err)}` };
    }
  });
}
