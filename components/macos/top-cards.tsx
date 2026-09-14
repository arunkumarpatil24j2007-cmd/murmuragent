'use client';

import React from 'react';

interface TopCardsProps {
  toolsCount?: number;
  modelName?: string;
  activeTasksCount?: number;
}

export function TopCards({
  toolsCount = 21,
  modelName = 'Gemini 3.5 Flash',
  activeTasksCount = 0,
}: TopCardsProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1.4fr 0.9fr',
      gap: '16px',
      marginBottom: '28px',
    }}>
      {/* Featured Banner Card — dark plum background matching reference screenshot */}
      <div style={{
        backgroundColor: 'var(--mac-plum)',
        color: '#FFFFFF',
        borderRadius: '16px',
        padding: '24px 26px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        boxShadow: '0 4px 14px rgba(40, 8, 19, 0.08)',
      }}>
        {/* Eyebrow tag */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '11px',
          fontWeight: '700',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--mac-tag-pink)',
          marginBottom: '8px',
        }}>
          <span>Intelligent Agent</span>
          <span>•</span>
        </div>

        {/* Heading */}
        <h2 style={{
          fontSize: '20px',
          fontWeight: '700',
          color: '#FFFFFF',
          marginBottom: '8px',
          letterSpacing: '-0.02em',
          lineHeight: 1.3,
        }}>
          Fast, private workflow execution.
        </h2>

        {/* Description */}
        <p style={{
          fontSize: '13px',
          lineHeight: '1.5',
          color: 'rgba(255, 255, 255, 0.78)',
          maxWidth: '480px',
          fontWeight: '400',
        }}>
          Executes multi-step tasks across your connected workspace: Vercel deployments, Notion pages, Google Docs, and Airtop browser automation.
        </p>
      </div>

      {/* Metrics / Stats Card — clean white card matching reference screenshot */}
      <div style={{
        backgroundColor: 'var(--mac-card-bg)',
        border: '1px solid var(--mac-card-border)',
        borderRadius: '16px',
        padding: '22px 24px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}>
          {/* Metric 1 */}
          <div>
            <div style={{
              fontSize: '34px',
              fontWeight: '700',
              color: 'var(--mac-plum)',
              lineHeight: 1,
              marginBottom: '6px',
              letterSpacing: '-0.03em',
            }}>
              {toolsCount}
            </div>
            <div style={{
              fontSize: '12px',
              fontWeight: '500',
              color: 'var(--mac-text-secondary)',
            }}>
              connected tools
            </div>
          </div>

          {/* Metric 2 */}
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: '34px',
              fontWeight: '700',
              color: 'var(--mac-plum)',
              lineHeight: 1,
              marginBottom: '6px',
              letterSpacing: '-0.03em',
            }}>
              {activeTasksCount > 0 ? activeTasksCount : '—'}
            </div>
            <div style={{
              fontSize: '12px',
              fontWeight: '500',
              color: 'var(--mac-text-secondary)',
            }}>
              active runs
            </div>
          </div>
        </div>

        {/* Bottom privacy note with icon */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          paddingTop: '16px',
          borderTop: '1px solid var(--mac-card-border)',
          fontSize: '12px',
          fontWeight: '500',
          color: 'var(--mac-text-secondary)',
        }}>
          {/* Clock / shield icon */}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>4-Hour Privacy Window • Keys Secured</span>
        </div>
      </div>
    </div>
  );
}
