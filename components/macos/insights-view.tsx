'use client';

import React, { useEffect, useState } from 'react';

interface HealthData {
  status: string;
  providers: Record<string, { configured: boolean; status: string }>;
  timestamp: string;
}

export function InsightsView() {
  const [health, setHealth] = useState<HealthData | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then(setHealth)
      .catch(() => {});
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      backgroundColor: 'var(--mac-card-bg)',
      border: '1px solid var(--mac-card-border)',
      borderRadius: '16px',
      padding: '24px',
      overflowY: 'auto',
    }}>
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--mac-plum)', marginBottom: '4px' }}>
          Agent Insights & System Health
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--mac-text-secondary)' }}>
          Real-time telemetry, model provider latencies, and service connection statuses.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px',
        marginBottom: '24px',
      }}>
        <div style={{
          padding: '16px',
          borderRadius: '12px',
          backgroundColor: 'var(--mac-main-bg)',
          border: '1px solid var(--mac-card-border)',
        }}>
          <div style={{ fontSize: '11px', color: 'var(--mac-text-secondary)', marginBottom: '6px' }}>
            System Status
          </div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: health?.status === 'ok' ? '#1b7440' : 'var(--mac-plum)', textTransform: 'capitalize' }}>
            {health?.status || 'Online'}
          </div>
        </div>

        <div style={{
          padding: '16px',
          borderRadius: '12px',
          backgroundColor: 'var(--mac-main-bg)',
          border: '1px solid var(--mac-card-border)',
        }}>
          <div style={{ fontSize: '11px', color: 'var(--mac-text-secondary)', marginBottom: '6px' }}>
            Active AI Engines
          </div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--mac-plum)' }}>
            Gemini 3.5 & Llama 3.2
          </div>
        </div>

        <div style={{
          padding: '16px',
          borderRadius: '12px',
          backgroundColor: 'var(--mac-main-bg)',
          border: '1px solid var(--mac-card-border)',
        }}>
          <div style={{ fontSize: '11px', color: 'var(--mac-text-secondary)', marginBottom: '6px' }}>
            Privacy Window
          </div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--mac-plum)' }}>
            4 Hours
          </div>
        </div>
      </div>

      {health?.providers && (
        <div>
          <div style={{
            fontSize: '11px',
            fontWeight: '700',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--mac-tag-pink)',
            marginBottom: '12px',
          }}>
            Provider Connections
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}>
            {Object.entries(health.providers).map(([name, info]) => (
              <div
                key={name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--mac-main-bg)',
                  border: '1px solid var(--mac-card-border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: info.configured ? '#27C93F' : '#FFBD2E',
                  }} />
                  <span style={{ fontSize: '13px', fontWeight: '600', textTransform: 'capitalize', color: 'var(--mac-plum)' }}>
                    {name}
                  </span>
                </div>

                <span style={{
                  fontSize: '11px',
                  fontWeight: '500',
                  color: 'var(--mac-text-secondary)',
                }}>
                  {info.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
