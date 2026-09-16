'use client';

import React, { useEffect, useState, useMemo } from 'react';

interface ToolItem {
  name: string;
  description: string;
  source: string;
  permission: string;
}

export function ToolsView() {
  const [tools, setTools] = useState<ToolItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/tools')
      .then((res) => res.json())
      .then((data) => {
        if (data.tools) setTools(data.tools);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filteredTools = useMemo(() => {
    return tools.filter(
      (t) =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase())
    );
  }, [tools, search]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        height: '100%',
        backgroundColor: 'var(--murmur-canvas)',
        padding: '32px 36px',
        overflowY: 'auto',
      }}
    >
      <div style={{ maxWidth: '840px', width: '100%', margin: '0 auto' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: '28px',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <h2
              style={{
                fontSize: '24px',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: 'var(--murmur-plum)',
                marginBottom: '4px',
              }}
            >
              Tools Directory
            </h2>
            <p style={{ fontSize: '13.5px', color: 'var(--murmur-text-secondary)', lineHeight: 1.5 }}>
              Capabilities and actions available to Murmur Agent across your connected services.
            </p>
          </div>

          {/* Search input */}
          <div style={{ position: 'relative', width: '240px' }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tools..."
              style={{
                width: '100%',
                padding: '7px 12px 7px 30px',
                borderRadius: '8px',
                border: '1px solid var(--murmur-border-solid)',
                backgroundColor: '#FFFFFF',
                color: 'var(--murmur-text-primary)',
                fontSize: '12.5px',
                outline: 'none',
              }}
            />
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--murmur-text-muted)',
              }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
        </div>

        {/* Tools container */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid var(--murmur-border-solid)',
            boxShadow: 'var(--murmur-shadow-subtle)',
            overflow: 'hidden',
          }}
        >
          {loading ? (
            <div style={{ padding: '36px', textAlign: 'center', color: 'var(--murmur-text-muted)', fontSize: '13px' }}>
              Loading tools...
            </div>
          ) : filteredTools.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', color: 'var(--murmur-text-secondary)', fontSize: '13px' }}>
              No tools match your query.
            </div>
          ) : (
            filteredTools.map((t, idx) => (
              <div
                key={t.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderBottom: idx < filteredTools.length - 1 ? '1px solid var(--murmur-border-subtle)' : 'none',
                  transition: 'background-color 0.1s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--murmur-canvas)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
              >
                <div style={{ minWidth: 0, paddingRight: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <code
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--murmur-plum)',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      }}
                    >
                      {t.name}
                    </code>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor:
                          t.permission === 'DANGEROUS'
                            ? '#FEF2F2'
                            : t.permission === 'WRITE'
                            ? '#FFFBEB'
                            : 'var(--murmur-sidebar)',
                        color:
                          t.permission === 'DANGEROUS'
                            ? '#B91C1C'
                            : t.permission === 'WRITE'
                            ? '#B45309'
                            : 'var(--murmur-text-secondary)',
                      }}
                    >
                      {t.permission}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: '12.5px',
                      color: 'var(--murmur-text-secondary)',
                      lineHeight: 1.4,
                      margin: 0,
                    }}
                  >
                    {t.description}
                  </p>
                </div>

                <span
                  style={{
                    fontSize: '11.5px',
                    color: 'var(--murmur-text-muted)',
                    textTransform: 'capitalize',
                    flexShrink: 0,
                  }}
                >
                  {t.source}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
