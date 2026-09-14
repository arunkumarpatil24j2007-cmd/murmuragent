'use client';

import React from 'react';

const EXAMPLE_COMMANDS = [
  'Check my emails',
  'Create a Google Doc about my project',
  'Create a Google Sheet with 20 content ideas',
  'Search the web for the latest NVIDIA models',
  'Find my Murmur documentation in Notion',
  'Check my Vercel deployment status',
];

interface EmptyStateProps {
  onSelectCommand: (command: string) => void;
}

export function EmptyState({ onSelectCommand }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: '40px 20px',
      gap: '40px',
    }}>
      {/* Logo area */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '14px',
          backgroundColor: 'var(--murmur-accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontSize: '22px',
          fontWeight: 700,
          letterSpacing: '-0.02em',
        }}>
          M
        </div>
        <div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 600,
            color: 'var(--murmur-text)',
            letterSpacing: '-0.03em',
            textAlign: 'center',
          }}>
            Murmur
          </h1>
          <p style={{
            fontSize: '15px',
            color: 'var(--murmur-text-tertiary)',
            fontWeight: 400,
            marginTop: '4px',
            textAlign: 'center',
          }}>
            How can I help?
          </p>
        </div>
      </div>

      {/* Example commands */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        justifyContent: 'center',
        maxWidth: '560px',
      }}>
        {EXAMPLE_COMMANDS.map((cmd) => (
          <button
            key={cmd}
            onClick={() => onSelectCommand(cmd)}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: '1px solid var(--murmur-border)',
              backgroundColor: 'transparent',
              color: 'var(--murmur-text-secondary)',
              fontSize: '13px',
              fontWeight: 450,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s ease',
              letterSpacing: '0.01em',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--murmur-accent-light)';
              e.currentTarget.style.borderColor = 'var(--murmur-accent)';
              e.currentTarget.style.color = 'var(--murmur-accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = 'var(--murmur-border)';
              e.currentTarget.style.color = 'var(--murmur-text-secondary)';
            }}
          >
            {cmd}
          </button>
        ))}
      </div>
    </div>
  );
}
