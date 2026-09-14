'use client';

import React from 'react';
import type { AgentEvent } from '@/lib/schemas';

import { ToolResultLinkBadge } from './work-artifact';

interface ToolStatusProps {
  events: AgentEvent[];
}

export function ToolStatus({ events }: ToolStatusProps) {
  if (events.length === 0) return null;

  // Filter to only tool-related and status events
  const relevantEvents = events.filter((e) =>
    ['tool_started', 'tool_result', 'tool_failed', 'permission_required', 'model_selected', 'agent_thinking'].includes(e.type)
  );

  if (relevantEvents.length === 0) return null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      padding: '12px 0',
    }}>
      {relevantEvents.map((event, i) => (
        <ToolStatusLine key={i} event={event} />
      ))}
    </div>
  );
}

function ToolStatusLine({ event }: { event: AgentEvent }) {
  switch (event.type) {
    case 'model_selected':
      return (
        <StatusLine
          icon="◆"
          text={`Using ${event.data.model}`}
          color="var(--murmur-text-tertiary)"
        />
      );

    case 'agent_thinking':
      return (
        <StatusLine
          icon="●"
          text={event.data.status || 'Thinking...'}
          color="var(--murmur-accent)"
          pulse
        />
      );

    case 'tool_started':
      return (
        <StatusLine
          icon="●"
          text={event.data.action || `Running ${event.data.tool}`}
          color="var(--murmur-accent)"
          pulse
        />
      );

    case 'tool_result': {
      const detectedUrl = event.data.url || (event.data.result?.match(/https?:\/\/[^\s"'<>\)]+/)?.[0]);
      return (
        <StatusLine
          icon="✓"
          text={event.data.title || event.data.result || `${event.data.tool} complete`}
          color="var(--murmur-success)"
          url={detectedUrl}
        />
      );
    }

    case 'tool_failed':
      return (
        <StatusLine
          icon="✗"
          text={event.data.error || `${event.data.tool} failed`}
          color="var(--murmur-error)"
        />
      );

    case 'permission_required':
      return (
        <StatusLine
          icon="⚠"
          text={`Permission required: ${event.data.action}`}
          color="var(--murmur-warning)"
        />
      );

    default:
      return null;
  }
}

function StatusLine({ icon, text, color, pulse, url }: {
  icon: string;
  text: string;
  color: string;
  pulse?: boolean;
  url?: string;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '8px',
      fontSize: '13px',
      color: 'var(--murmur-text-secondary)',
      fontWeight: 400,
      letterSpacing: '0.01em',
    }}>
      <span style={{
        color,
        fontSize: '10px',
        animation: pulse ? 'pulse 1.5s ease-in-out infinite' : 'none',
        display: 'inline-flex',
        alignItems: 'center',
        width: '14px',
        justifyContent: 'center',
      }}>
        {icon}
      </span>
      <span>{text}</span>
      {url && <ToolResultLinkBadge url={url} />}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
