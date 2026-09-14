'use client';

import React from 'react';

interface AgentStatusProps {
  status: 'idle' | 'thinking' | 'executing' | 'error';
  model?: string;
}

export function AgentStatus({ status, model }: AgentStatusProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '12px 20px',
      borderBottom: '1px solid var(--murmur-border)',
      backgroundColor: 'var(--murmur-surface)',
    }}>
      {/* Murmur mark */}
      <div style={{
        width: '28px',
        height: '28px',
        borderRadius: '8px',
        backgroundColor: 'var(--murmur-accent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
        fontSize: '14px',
        fontWeight: 700,
        letterSpacing: '-0.02em',
        flexShrink: 0,
      }}>
        M
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
        <span style={{
          fontSize: '15px',
          fontWeight: 600,
          color: 'var(--murmur-text)',
          letterSpacing: '-0.02em',
        }}>
          Murmur
        </span>
        <span style={{
          fontSize: '11px',
          fontWeight: 500,
          color: 'var(--murmur-text-tertiary)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
        }}>
          {model && <span>{model}</span>}
          {model && <span>·</span>}
          <span>Agent</span>
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Status indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        color: statusColor(status),
        fontWeight: 500,
      }}>
        <div style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          backgroundColor: statusColor(status),
          animation: status === 'thinking' || status === 'executing'
            ? 'statusPulse 1.2s ease-in-out infinite'
            : 'none',
        }} />
        <span>{statusLabel(status)}</span>
        <style>{`
          @keyframes statusPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        `}</style>
      </div>
    </div>
  );
}

function statusColor(status: string): string {
  switch (status) {
    case 'thinking': return 'var(--murmur-accent)';
    case 'executing': return 'var(--murmur-warning)';
    case 'error': return 'var(--murmur-error)';
    default: return 'var(--murmur-success)';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'thinking': return 'Thinking';
    case 'executing': return 'Executing';
    case 'error': return 'Error';
    default: return 'Ready';
  }
}
