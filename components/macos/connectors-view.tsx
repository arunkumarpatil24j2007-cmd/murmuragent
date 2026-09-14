'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { ConnectorInfo, ConnectorCategory } from '@/lib/connectors-store';
import { ConnectorConnectModal, ConnectorIcon } from './connector-connect-modal';

export function ConnectorsView() {
  const [connectors, setConnectors] = useState<ConnectorInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedConnector, setSelectedConnector] = useState<ConnectorInfo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pingStatuses, setPingStatuses] = useState<Record<string, { loading: boolean; latency?: number; success?: boolean; message?: string }>>({});

  const fetchConnectors = async () => {
    try {
      const res = await fetch('/api/connectors');
      const data = await res.json();
      if (data.connectors) {
        setConnectors(data.connectors);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnectors();
  }, []);

  const handleToggle = async (c: ConnectorInfo, e: React.MouseEvent) => {
    e.stopPropagation();
    const newEnabled = !c.isEnabled;

    // Optimistic UI update
    setConnectors((prev) =>
      prev.map((item) => (item.id === c.id ? { ...item, isEnabled: newEnabled } : item))
    );

    try {
      await fetch('/api/connectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle',
          connectorId: c.id,
          enabled: newEnabled,
        }),
      });
    } catch {
      // Revert on error
      setConnectors((prev) =>
        prev.map((item) => (item.id === c.id ? { ...item, isEnabled: !newEnabled } : item))
      );
    }
  };

  const handleTestPing = async (c: ConnectorInfo, e: React.MouseEvent) => {
    e.stopPropagation();
    setPingStatuses((prev) => ({
      ...prev,
      [c.id]: { loading: true },
    }));

    try {
      const res = await fetch('/api/connectors/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectorId: c.id }),
      });
      const data = await res.json();
      setPingStatuses((prev) => ({
        ...prev,
        [c.id]: {
          loading: false,
          success: data.success,
          latency: data.latencyMs,
          message: data.message,
        },
      }));
    } catch (err) {
      setPingStatuses((prev) => ({
        ...prev,
        [c.id]: {
          loading: false,
          success: false,
          message: err instanceof Error ? err.message : 'Ping failed',
        },
      }));
    }
  };

  const handleOpenConnect = (c: ConnectorInfo) => {
    setSelectedConnector(c);
    setIsModalOpen(true);
  };

  // Filter connectors
  const filteredConnectors = useMemo(() => {
    return connectors.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.shortDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.tools.some((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCat =
        selectedCategory === 'all' ||
        (selectedCategory === 'workspace' && (c.category === 'workspace' || c.id.startsWith('google_'))) ||
        (selectedCategory === 'developer' && c.category === 'developer') ||
        (selectedCategory === 'automation' && (c.category === 'automation' || c.category === 'local'));

      return matchesSearch && matchesCat;
    });
  }, [connectors, searchQuery, selectedCategory]);

  const connectedCount = connectors.filter((c) => c.isConnected).length;
  const totalActionsCount = connectors
    .filter((c) => c.isConnected && c.isEnabled)
    .reduce((acc, c) => acc + c.tools.length, 0);

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
      {/* Top Banner & Header */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--mac-plum)', margin: 0 }}>
              Cloud Connectors Hub
            </h3>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: 'rgba(217, 101, 123, 0.15)',
              color: 'var(--mac-plum)',
              padding: '2px 8px',
              borderRadius: '20px',
            }}>
              Plugins & Integrations
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--mac-text-secondary)', margin: 0 }}>
            Connect your accounts in one click. Enable or disable capabilities for Murmur Agent like ChatGPT plugins.
          </p>
        </div>

        {/* Quick Stats Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          backgroundColor: 'var(--mac-main-bg)',
          padding: '8px 16px',
          borderRadius: '30px',
          border: '1px solid var(--mac-card-border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: connectedCount > 0 ? '#10B981' : '#9CA3AF',
            }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--mac-plum)' }}>
              {connectedCount} Connected
            </span>
          </div>
          <span style={{ color: '#D1D5DB' }}>•</span>
          <span style={{ fontSize: '12px', color: 'var(--mac-text-secondary)' }}>
            <strong style={{ color: 'var(--mac-plum)' }}>{totalActionsCount}</strong> Live Agent Actions
          </span>
          <span style={{ color: '#D1D5DB' }}>•</span>
          <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>
            🔒 AES-256
          </span>
        </div>
      </div>

      {/* Filter Row: Search & Category Pills */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '20px',
        flexWrap: 'wrap',
      }}>
        {/* Category Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {[
            { id: 'all', label: 'All Connectors' },
            { id: 'workspace', label: 'Google & Workspace' },
            { id: 'developer', label: 'Developer & Cloud' },
            { id: 'automation', label: 'Browser & MCP' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: selectedCategory === cat.id ? '1px solid var(--mac-plum)' : '1px solid var(--mac-card-border)',
                backgroundColor: selectedCategory === cat.id ? 'var(--mac-plum)' : 'var(--mac-main-bg)',
                color: selectedCategory === cat.id ? '#FFFFFF' : 'var(--mac-text-secondary)',
                fontSize: '12px',
                fontWeight: selectedCategory === cat.id ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div style={{ position: 'relative', width: '220px' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search connectors..."
            style={{
              width: '100%',
              backgroundColor: 'var(--mac-main-bg)',
              border: '1px solid var(--mac-card-border)',
              borderRadius: '20px',
              padding: '6px 14px 6px 30px',
              fontSize: '12px',
              color: 'var(--mac-text-primary)',
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
              left: '11px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--mac-text-tertiary)',
            }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
      </div>

      {/* Connectors Grid */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--mac-text-tertiary)', fontSize: '13px' }}>
          Loading cloud connectors...
        </div>
      ) : filteredConnectors.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--mac-text-tertiary)', fontSize: '13px' }}>
          No connectors match your query.
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '14px',
        }}>
          {filteredConnectors.map((c) => {
            const ping = pingStatuses[c.id];
            return (
              <div
                key={c.id}
                onClick={() => handleOpenConnect(c)}
                style={{
                  padding: '16px',
                  borderRadius: '16px',
                  border: `1.5px solid ${c.isConnected && c.isEnabled ? 'rgba(217, 101, 123, 0.4)' : 'var(--mac-card-border)'}`,
                  backgroundColor: 'var(--mac-main-bg)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  boxShadow: c.isConnected ? '0 4px 12px rgba(40, 8, 19, 0.04)' : 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(40, 8, 19, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = c.isConnected ? '0 4px 12px rgba(40, 8, 19, 0.04)' : 'none';
                }}
              >
                {/* Card Top: Brand Icon + Title + Status + Toggle */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        backgroundColor: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                        border: '1px solid rgba(0,0,0,0.04)',
                        flexShrink: 0,
                      }}>
                        <ConnectorIcon type={c.icon} size={22} color={c.brandColor} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--mac-plum)', margin: 0 }}>
                            {c.name}
                          </h4>
                          {c.isConnected && (
                            <span style={{
                              width: '7px',
                              height: '7px',
                              borderRadius: '50%',
                              backgroundColor: c.isEnabled ? '#10B981' : '#9CA3AF',
                              display: 'inline-block',
                            }} />
                          )}
                        </div>
                        <span style={{ fontSize: '10px', color: 'var(--mac-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {c.categoryLabel}
                        </span>
                      </div>
                    </div>

                    {/* Toggle Switch (ChatGPT plugin style) */}
                    {c.isConnected ? (
                      <div
                        onClick={(e) => handleToggle(c, e)}
                        title={c.isEnabled ? 'Click to disable for agent' : 'Click to enable for agent'}
                        style={{
                          width: '36px',
                          height: '20px',
                          borderRadius: '10px',
                          backgroundColor: c.isEnabled ? 'var(--mac-plum)' : '#D1D5DB',
                          padding: '2px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          transition: 'background-color 0.2s ease',
                        }}
                      >
                        <div style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          backgroundColor: '#FFFFFF',
                          transform: c.isEnabled ? 'translateX(16px)' : 'translateX(0)',
                          transition: 'transform 0.2s ease',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }} />
                      </div>
                    ) : (
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(0,0,0,0.05)',
                        color: 'var(--mac-text-secondary)',
                      }}>
                        Available
                      </span>
                    )}
                  </div>

                  <p style={{ fontSize: '12px', color: 'var(--mac-text-secondary)', lineHeight: 1.45, margin: '0 0 10px 0' }}>
                    {c.shortDescription}
                  </p>

                  {/* Connected Account Label */}
                  {c.isConnected && c.accountEmail && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 8px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(16, 185, 129, 0.08)',
                      marginBottom: '10px',
                    }}>
                      <span style={{ fontSize: '11px', color: '#065F46', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        👤 {c.accountEmail}
                      </span>
                    </div>
                  )}

                  {/* Included Tools Pills Preview */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {c.tools.slice(0, 3).map((tool) => (
                      <span
                        key={tool.name}
                        style={{
                          fontSize: '10px',
                          fontFamily: 'monospace',
                          padding: '2px 6px',
                          borderRadius: '5px',
                          backgroundColor: '#FFFFFF',
                          border: '1px solid var(--mac-card-border)',
                          color: 'var(--mac-plum)',
                        }}
                      >
                        {tool.name}
                      </span>
                    ))}
                    {c.tools.length > 3 && (
                      <span style={{ fontSize: '10px', color: 'var(--mac-text-muted)', alignSelf: 'center', paddingLeft: '2px' }}>
                        +{c.tools.length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Bottom Actions */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '10px',
                  borderTop: '1px solid rgba(0,0,0,0.05)',
                  marginTop: '4px',
                }}>
                  {/* Test Ping Status */}
                  <div>
                    {ping?.loading ? (
                      <span style={{ fontSize: '11px', color: 'var(--mac-text-tertiary)' }}>Pinging...</span>
                    ) : ping?.success ? (
                      <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>
                        ● {ping.latency}ms Live
                      </span>
                    ) : ping?.message ? (
                      <span style={{ fontSize: '11px', color: '#DC2626', fontWeight: 600 }}>
                        Offline
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', color: 'var(--mac-text-muted)' }}>
                        {c.tools.length} actions
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {c.isConnected && (
                      <button
                        type="button"
                        onClick={(e) => handleTestPing(c, e)}
                        title="Test live upstream connection"
                        style={{
                          padding: '5px 10px',
                          borderRadius: '8px',
                          border: '1px solid var(--mac-card-border)',
                          backgroundColor: '#FFFFFF',
                          color: 'var(--mac-text-secondary)',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Test Ping
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenConnect(c)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: c.isConnected ? 'rgba(40, 8, 19, 0.08)' : 'var(--mac-plum)',
                        color: c.isConnected ? 'var(--mac-plum)' : '#FFFFFF',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      {c.isConnected ? 'Configure' : '1-Click Connect'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Connect Modal */}
      <ConnectorConnectModal
        connector={selectedConnector}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          fetchConnectors();
        }}
      />
    </div>
  );
}
