'use client';

import React, { useEffect, useState } from 'react';

interface ToolItem {
  name: string;
  description: string;
  source: string;
  permission: string;
}

export function ToolsView() {
  const [tools, setTools] = useState<ToolItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/tools')
      .then((res) => res.json())
      .then((data) => {
        if (data.tools) setTools(data.tools);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const categories: Record<string, ToolItem[]> = {
    'Vercel Deployment': tools.filter((t) => t.name.startsWith('vercel.')),
    'Notion Workspace': tools.filter((t) => t.name.startsWith('notion.')),
    'Google Workspace': tools.filter((t) => t.name.startsWith('gmail.') || t.name.startsWith('docs.') || t.name.startsWith('sheets.') || t.name.startsWith('drive.')),
    'Airtop Browser': tools.filter((t) => t.name.startsWith('browser.')),
  };

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
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--mac-plum)', marginBottom: '4px' }}>
          Registered Tools & Capabilities ({tools.length})
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--mac-text-secondary)' }}>
          Autonomous tools available to Murmur Agent with strict server-side authentication and permission guardrails.
        </p>
      </div>

      {loading ? (
        <div style={{ padding: '30px', textAlign: 'center', color: 'var(--mac-text-tertiary)', fontSize: '13px' }}>
          Loading registered tools...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {Object.entries(categories).map(([cat, list]) => (
            <div key={cat}>
              <div style={{
                fontSize: '11px',
                fontWeight: '700',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--mac-tag-pink)',
                marginBottom: '10px',
              }}>
                {cat} ({list.length})
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                {list.map((tool) => (
                  <div
                    key={tool.name}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: '1px solid var(--mac-card-border)',
                      backgroundColor: 'var(--mac-main-bg)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <code style={{ fontSize: '12px', fontWeight: '700', color: 'var(--mac-plum)' }}>
                          {tool.name}
                        </code>
                        <span style={{
                          fontSize: '9px',
                          fontWeight: '700',
                          padding: '2px 5px',
                          borderRadius: '4px',
                          backgroundColor:
                            tool.permission === 'DANGEROUS'
                              ? 'rgba(192, 57, 75, 0.15)'
                              : tool.permission === 'WRITE'
                              ? 'rgba(217, 101, 123, 0.15)'
                              : 'rgba(40, 8, 19, 0.07)',
                          color:
                            tool.permission === 'DANGEROUS'
                              ? '#c0394b'
                              : 'var(--mac-plum)',
                        }}>
                          {tool.permission}
                        </span>
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--mac-text-secondary)', lineHeight: 1.4 }}>
                        {tool.description}
                      </p>
                    </div>

                    <div style={{ fontSize: '10px', color: 'var(--mac-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>Source:</span>
                      <span style={{ fontWeight: '600' }}>{tool.source}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
