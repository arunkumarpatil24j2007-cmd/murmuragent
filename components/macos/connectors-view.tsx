'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { ConnectorInfo } from '@/lib/connectors-store';
import { ConnectorConnectModal, ConnectorIcon } from './connector-connect-modal';

interface ConnectorsViewProps {
  onConnectChange?: (count: number) => void;
}

export function ConnectorsView({ onConnectChange }: ConnectorsViewProps) {
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
        const count = data.connectors.filter((c: any) => c.isConnected).length;
        onConnectChange?.(count);
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
    const isGoogle = c.id.startsWith('google_') || c.id === 'gmail';
    if (isGoogle && !c.isConnected) {
      window.location.href = `/api/auth/google/login?return_to=${encodeURIComponent(
        window.location.pathname + '?tab=connectors'
      )}`;
      return;
    }
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
        (selectedCategory === 'browser' && (c.category === 'automation' || c.category === 'local'));

      return matchesSearch && matchesCat;
    });
  }, [connectors, searchQuery, selectedCategory]);

  const connectedCount = connectors.filter((c) => c.isConnected).length;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        height: '100%',
        backgroundColor: 'var(--murmur-canvas)',
        overflowY: 'auto',
        padding: '32px 36px',
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
              Connections
            </h2>
            <p
              style={{
                fontSize: '13.5px',
                color: 'var(--murmur-text-secondary)',
                lineHeight: 1.5,
              }}
            >
              Connect your services to allow Murmur Agent to read and execute actions on your behalf.
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '20px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--murmur-border-solid)',
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--murmur-text-secondary)',
              boxShadow: 'var(--murmur-shadow-subtle)',
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: '#10B981',
              }}
            />
            <span>{connectedCount} connected</span>
          </div>
        </div>

        {/* Filters & Search Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            marginBottom: '20px',
            flexWrap: 'wrap',
          }}
        >
          {/* Category Tabs */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: 'var(--murmur-sidebar)',
              padding: '3px',
              borderRadius: '10px',
              border: '1px solid var(--murmur-border)',
            }}
          >
            {[
              { id: 'all', label: 'All' },
              { id: 'workspace', label: 'Google Workspace' },
              { id: 'developer', label: 'Developer & Cloud' },
              { id: 'browser', label: 'Browser & MCP' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '7px',
                  border: 'none',
                  backgroundColor: selectedCategory === cat.id ? '#FFFFFF' : 'transparent',
                  color: selectedCategory === cat.id ? 'var(--murmur-plum)' : 'var(--murmur-text-secondary)',
                  fontSize: '12.5px',
                  fontWeight: selectedCategory === cat.id ? 600 : 500,
                  cursor: 'pointer',
                  boxShadow: selectedCategory === cat.id ? '0 1px 2px rgba(40, 8, 19, 0.05)' : 'none',
                  transition: 'all 0.12s ease',
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
              placeholder="Search services..."
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

        {/* Connectors List Container */}
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
              Loading connections...
            </div>
          ) : filteredConnectors.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--murmur-text-secondary)', fontSize: '13px' }}>
              No services match your search.
            </div>
          ) : (
            filteredConnectors.map((c, idx) => {
              const ping = pingStatuses[c.id];
              const isGoogle = c.id.startsWith('google_') || c.id === 'gmail';

              return (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderBottom: idx < filteredConnectors.length - 1 ? '1px solid var(--murmur-border-subtle)' : 'none',
                    transition: 'background-color 0.12s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--murmur-canvas)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
                >
                  {/* Left: Icon & Service Details */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid var(--murmur-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: '0 1px 2px rgba(40, 8, 19, 0.04)',
                      }}
                    >
                      <ConnectorIcon connectorId={c.id} size={20} />
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <span
                          style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: 'var(--murmur-text-primary)',
                          }}
                        >
                          {c.name}
                        </span>
                        {c.accountEmail && (
                          <span style={{ fontSize: '12px', color: 'var(--murmur-text-muted)' }}>
                            • {c.accountEmail}
                          </span>
                        )}
                      </div>
                      <p
                        style={{
                          fontSize: '12.5px',
                          color: 'var(--murmur-text-secondary)',
                          lineHeight: 1.4,
                          margin: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '450px',
                        }}
                      >
                        {c.shortDescription}
                      </p>
                    </div>
                  </div>

                  {/* Right: Status & Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                    {/* Status badge */}
                    {c.isConnected ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '12px',
                          fontWeight: 500,
                          color: '#047857',
                          backgroundColor: '#ECFDF5',
                          padding: '3px 8px',
                          borderRadius: '12px',
                        }}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                        Connected
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '12px',
                          color: 'var(--murmur-text-muted)',
                          padding: '3px 8px',
                        }}
                      >
                        Not linked
                      </span>
                    )}

                    {/* Ping status if tested */}
                    {ping && (
                      <span
                        style={{
                          fontSize: '11.5px',
                          color: ping.success ? '#047857' : '#B91C1C',
                        }}
                      >
                        {ping.loading ? 'Checking...' : ping.success ? `${ping.latency}ms` : 'Offline'}
                      </span>
                    )}

                    {/* Enable/Disable switch if connected */}
                    {c.isConnected && (
                      <button
                        type="button"
                        onClick={(e) => handleToggle(c, e)}
                        title={c.isEnabled ? 'Disable connector' : 'Enable connector'}
                        style={{
                          width: '36px',
                          height: '20px',
                          borderRadius: '10px',
                          backgroundColor: c.isEnabled ? 'var(--murmur-plum)' : 'var(--murmur-border-solid)',
                          border: 'none',
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'background-color 0.15s ease',
                        }}
                      >
                        <span
                          style={{
                            position: 'absolute',
                            top: '2px',
                            left: c.isEnabled ? '18px' : '2px',
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            backgroundColor: '#FFFFFF',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                            transition: 'left 0.15s ease',
                          }}
                        />
                      </button>
                    )}

                    {/* Action Button */}
                    {!c.isConnected ? (
                      <button
                        type="button"
                        onClick={() => handleOpenConnect(c)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: 'var(--murmur-plum)',
                          color: '#FFFFFF',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'background-color 0.12s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--murmur-plum-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--murmur-plum)')}
                      >
                        {isGoogle ? 'Connect Google' : 'Configure'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenConnect(c)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--murmur-border-solid)',
                          backgroundColor: 'transparent',
                          color: 'var(--murmur-text-secondary)',
                          fontSize: '12.5px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.12s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--murmur-sidebar)';
                          e.currentTarget.style.color = 'var(--murmur-plum)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = 'var(--murmur-text-secondary)';
                        }}
                      >
                        Manage
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Connection Modal */}
      {selectedConnector && (
        <ConnectorConnectModal
          isOpen={isModalOpen}
          connector={selectedConnector}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false);
            fetchConnectors();
          }}
        />
      )}
    </div>
  );
}
