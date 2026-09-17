'use client';

import React, { useEffect, useState, useMemo } from 'react';

interface ToolItem {
  name: string;
  description: string;
  source: string;
  permission: string;
}

interface ToolsViewProps {
  isAdminUnlocked?: boolean;
  onUnlockRequest?: () => void;
}

export function ToolsView({ isAdminUnlocked = false, onUnlockRequest }: ToolsViewProps) {
  const [tools, setTools] = useState<ToolItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isLockedByApi, setIsLockedByApi] = useState(false);

  useEffect(() => {
    if (!isAdminUnlocked) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch('/api/tools')
      .then((res) => res.json())
      .then((data) => {
        if (data.requiresPassword) {
          setIsLockedByApi(true);
        } else if (Array.isArray(data.tools)) {
          setTools(data.tools);
          setIsLockedByApi(false);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isAdminUnlocked]);

  const isActuallyLocked = !isAdminUnlocked || isLockedByApi;

  if (isActuallyLocked) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          height: '100%',
          backgroundColor: 'var(--murmur-canvas)',
          padding: '40px 24px',
        }}
      >
        <div
          style={{
            maxWidth: '440px',
            width: '100%',
            backgroundColor: '#FFFFFF',
            borderRadius: '20px',
            border: '1px solid var(--murmur-border-solid)',
            boxShadow: '0 10px 30px -5px rgba(45, 13, 25, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04)',
            padding: '36px 32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              backgroundColor: 'rgba(45, 13, 25, 0.06)',
              border: '1px solid rgba(45, 13, 25, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--murmur-plum)',
              marginBottom: '18px',
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>

          <h2
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--murmur-text-primary)',
              letterSpacing: '-0.02em',
              marginBottom: '8px',
            }}
          >
            Tools Directory is Locked
          </h2>

          <p
            style={{
              fontSize: '13px',
              color: 'var(--murmur-text-secondary)',
              lineHeight: 1.5,
              marginBottom: '22px',
            }}
          >
            Access to agent tools and executable capabilities is protected. Only the administrator account (<strong style={{ color: 'var(--murmur-plum)' }}>arunkumarpatil24j2007@gmail.com</strong>) with the administrator password can view and execute these tools.
          </p>

          <button
            type="button"
            onClick={onUnlockRequest}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '11px 26px',
              borderRadius: '9999px',
              backgroundColor: '#250E18',
              color: '#FFFFFF',
              fontSize: '13.5px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(37, 14, 24, 0.22)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.backgroundColor = '#381525';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.backgroundColor = '#250E18';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>Enter Admin Password</span>
          </button>
        </div>
      </div>
    );
  }

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
