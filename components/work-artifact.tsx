'use client';

import React from 'react';
import type { AgentEvent } from '@/lib/schemas';

export interface WorkArtifact {
  url: string;
  title: string;
  service: string;
  serviceIcon: string;
  actionLabel: string;
  accentColor: string;
  bgColor: string;
  borderColor: string;
}

/**
 * Identify the provider and visual theme for a given URL.
 */
export function identifyService(url: string, rawTitle?: string): WorkArtifact {
  const cleanUrl = url.trim();
  let service = 'Web Resource';
  let serviceIcon = '🌐';
  let actionLabel = 'Open Link ↗';
  let accentColor = '#4f46e5';
  let bgColor = '#f5f3ff';
  let borderColor = '#ddd6fe';
  let title = rawTitle?.trim() || '';

  if (cleanUrl.includes('docs.google.com/document')) {
    service = 'Google Doc';
    serviceIcon = '📄';
    actionLabel = 'Open Google Doc ↗';
    accentColor = '#1a73e8';
    bgColor = '#f0f6ff';
    borderColor = '#c2dcfe';
    if (!title) title = 'Google Document';
  } else if (cleanUrl.includes('docs.google.com/spreadsheets')) {
    service = 'Google Sheet';
    serviceIcon = '📊';
    actionLabel = 'Open Google Sheet ↗';
    accentColor = '#137333';
    bgColor = '#f0fdf4';
    borderColor = '#bbf7d0';
    if (!title) title = 'Google Spreadsheet';
  } else if (cleanUrl.includes('docs.google.com/presentation')) {
    service = 'Google Slides';
    serviceIcon = '📑';
    actionLabel = 'Open Presentation ↗';
    accentColor = '#b06000';
    bgColor = '#fffbeb';
    borderColor = '#fde68a';
    if (!title) title = 'Google Presentation';
  } else if (cleanUrl.includes('mail.google.com')) {
    service = 'Gmail';
    serviceIcon = '✉️';
    actionLabel = 'Open in Gmail ↗';
    accentColor = '#c5221f';
    bgColor = '#fef2f2';
    borderColor = '#fecaca';
    if (!title) title = 'Email Thread';
  } else if (cleanUrl.includes('notion.so') || cleanUrl.includes('notion.site')) {
    service = 'Notion';
    serviceIcon = '📓';
    actionLabel = 'Open in Notion ↗';
    accentColor = '#1f2937';
    bgColor = '#f9fafb';
    borderColor = '#e5e7eb';
    if (!title) title = 'Notion Page';
  } else if (cleanUrl.includes('vercel.app') || cleanUrl.includes('vercel.com')) {
    service = 'Vercel';
    serviceIcon = '▲';
    actionLabel = 'Visit Deployment ↗';
    accentColor = '#000000';
    bgColor = '#f9fafb';
    borderColor = '#e5e7eb';
    if (!title) title = 'Vercel Deployment';
  } else if (cleanUrl.includes('airtop.ai')) {
    service = 'Airtop Browser';
    serviceIcon = '🖥️';
    actionLabel = 'Open Browser Session ↗';
    accentColor = '#7c3aed';
    bgColor = '#faf5ff';
    borderColor = '#e9d5ff';
    if (!title) title = 'Remote Browser Session';
  }

  if (!title) {
    try {
      const parsed = new URL(cleanUrl);
      title = parsed.hostname + parsed.pathname;
    } catch {
      title = cleanUrl;
    }
  }

  return {
    url: cleanUrl,
    title,
    service,
    serviceIcon,
    actionLabel,
    accentColor,
    bgColor,
    borderColor,
  };
}

/**
 * Extract all unique work artifact URLs from message content and events.
 */
export function extractWorkArtifacts(content: string, events?: AgentEvent[]): WorkArtifact[] {
  const artifacts: WorkArtifact[] = [];
  const seenUrls = new Set<string>();

  // 1. From tool events (most reliable metadata)
  if (events) {
    for (const evt of events) {
      if (evt.type === 'tool_result' && evt.data) {
        let detectedUrl: string | undefined = evt.data.url;
        let detectedTitle: string | undefined = evt.data.title;

        // Fallback: check if evt.data.result contains a URL
        if (!detectedUrl && evt.data.result) {
          const match = evt.data.result.match(/https?:\/\/[^\s"'<>\)]+/);
          if (match) {
            detectedUrl = match[0];
          }
        }

        if (detectedUrl && !seenUrls.has(detectedUrl)) {
          seenUrls.add(detectedUrl);
          artifacts.push(identifyService(detectedUrl, detectedTitle));
        }
      }
    }
  }

  // 2. From markdown links: [Title](https://...)
  const mdLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let mdMatch;
  while ((mdMatch = mdLinkRegex.exec(content)) !== null) {
    const title = mdMatch[1];
    const url = mdMatch[2];
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      artifacts.push(identifyService(url, title));
    }
  }

  // 3. From bare URLs: https://...
  const rawUrlRegex = /(?<!\()https?:\/\/[^\s"'<>\)]+/g;
  let rawMatch;
  while ((rawMatch = rawUrlRegex.exec(content)) !== null) {
    const url = rawMatch[0];
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      artifacts.push(identifyService(url));
    }
  }

  return artifacts;
}

/**
 * Renders text content with markdown links, raw URLs, code, and bold parsed into clickable elements.
 */
export function FormattedMessage({ content }: { content: string }) {
  if (!content) return null;

  // Split content by markdown links [label](url) or bare URLs https://...
  const tokens: React.ReactNode[] = [];
  const combinedRegex = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(https?:\/\/[^\s"'<>\)]+)/g;
  
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = combinedRegex.exec(content)) !== null) {
    // Push preceding text
    if (match.index > lastIndex) {
      tokens.push(renderTextWithFormatting(content.slice(lastIndex, match.index), `txt-${lastIndex}`));
    }

    if (match[1]) {
      // Markdown link: [label](url)
      const label = match[2];
      const url = match[3];
      tokens.push(
        <a
          key={`link-${match.index}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#1a73e8',
            fontWeight: 600,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            backgroundColor: 'rgba(26, 115, 232, 0.08)',
            padding: '1px 7px',
            borderRadius: '6px',
            transition: 'all 0.15s ease',
            margin: '0 2px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(26, 115, 232, 0.16)';
            e.currentTarget.style.color = '#1557b0';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(26, 115, 232, 0.08)';
            e.currentTarget.style.color = '#1a73e8';
            e.currentTarget.style.transform = 'none';
          }}
          title={url}
        >
          <span>{label}</span>
          <span style={{ fontSize: '11px', opacity: 0.8 }}>↗</span>
        </a>
      );
    } else if (match[4]) {
      // Bare URL
      const url = match[4];
      tokens.push(
        <a
          key={`url-${match.index}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#1a73e8',
            fontWeight: 500,
            textDecoration: 'underline',
            textUnderlineOffset: '3px',
            wordBreak: 'break-all',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#1557b0')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#1a73e8')}
          title={url}
        >
          {url} ↗
        </a>
      );
    }

    lastIndex = combinedRegex.lastIndex;
  }

  if (lastIndex < content.length) {
    tokens.push(renderTextWithFormatting(content.slice(lastIndex), `txt-${lastIndex}`));
  }

  return <span style={{ whiteSpace: 'pre-wrap' }}>{tokens}</span>;
}

/**
 * Formats inline code `code` and bold **bold**
 */
function renderTextWithFormatting(text: string, keyPrefix: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(`[^`]+`)|(\*\*[^*]+\*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) {
      parts.push(text.slice(last, m.index));
    }

    if (m[1]) {
      // Code
      const code = m[1].slice(1, -1);
      parts.push(
        <code
          key={`${keyPrefix}-code-${m.index}`}
          style={{
            fontFamily: 'monospace',
            fontSize: '0.9em',
            padding: '2px 5px',
            borderRadius: '4px',
            backgroundColor: 'rgba(0, 0, 0, 0.05)',
            color: 'var(--murmur-text, #111)',
          }}
        >
          {code}
        </code>
      );
    } else if (m[2]) {
      // Bold
      const boldText = m[2].slice(2, -2);
      parts.push(
        <strong key={`${keyPrefix}-b-${m.index}`} style={{ fontWeight: 600 }}>
          {boldText}
        </strong>
      );
    }
    last = regex.lastIndex;
  }

  if (last < text.length) {
    parts.push(text.slice(last));
  }

  return <React.Fragment key={keyPrefix}>{parts}</React.Fragment>;
}

/**
 * Dedicated, prominent Work Artifact Cards rendered in the response section.
 * Gives the user a one-click button to open their created/worked-on thing.
 */
export function WorkArtifactCards({
  artifacts,
}: {
  artifacts: WorkArtifact[];
}) {
  if (!artifacts || artifacts.length === 0) return null;

  return (
    <div
      style={{
        marginTop: '12px',
        marginBottom: '6px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--mac-text-tertiary, #888)',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
        }}
      >
        <span>⚡ Work Output</span>
        <span style={{ opacity: 0.5 }}>•</span>
        <span style={{ fontWeight: 500, textTransform: 'none' }}>Click to open completed item</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {artifacts.map((artifact, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '12px 14px',
              borderRadius: '12px',
              backgroundColor: artifact.bgColor,
              border: `1px solid ${artifact.borderColor}`,
              boxShadow: '0 2px 5px rgba(0, 0, 0, 0.04)',
              transition: 'all 0.2s ease',
            }}
          >
            {/* Left: Icon & Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div
                style={{
                  fontSize: '20px',
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
                  flexShrink: 0,
                }}
              >
                {artifact.serviceIcon}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '13.5px',
                    fontWeight: 600,
                    color: '#1e293b',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={artifact.title}
                >
                  {artifact.title}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: artifact.accentColor,
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>{artifact.service}</span>
                  <span style={{ opacity: 0.4 }}>•</span>
                  <span
                    style={{
                      opacity: 0.75,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '260px',
                    }}
                    title={artifact.url}
                  >
                    {artifact.url.replace(/^https?:\/\//, '')}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Open Button */}
            <a
              href={artifact.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                backgroundColor: artifact.accentColor,
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                e.currentTarget.style.opacity = '0.95';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                e.currentTarget.style.opacity = '1';
              }}
            >
              <span>{artifact.actionLabel}</span>
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Compact interactive link pill rendered right inside the tool execution trace
 */
export function ToolResultLinkBadge({
  url,
  label,
}: {
  url: string;
  label?: string;
}) {
  const service = identifyService(url);
  const displayLabel = label || service.actionLabel.replace(' ↗', '');

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '6px',
        backgroundColor: service.bgColor,
        border: `1px solid ${service.borderColor}`,
        color: service.accentColor,
        fontSize: '11px',
        fontWeight: 600,
        textDecoration: 'none',
        marginLeft: '4px',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 2px 5px rgba(0,0,0,0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = 'none';
      }}
      title={url}
    >
      <span>{service.serviceIcon}</span>
      <span>{displayLabel}</span>
      <span style={{ fontSize: '10px' }}>↗</span>
    </a>
  );
}
