'use client';

import React, { useState } from 'react';
import type { ConnectorInfo } from '@/lib/connectors-store';

interface ConnectorConnectModalProps {
  connector: ConnectorInfo | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ConnectorConnectModal({
  connector,
  isOpen,
  onClose,
  onSuccess,
}: ConnectorConnectModalProps) {
  const [tokenInput, setTokenInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latency?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !connector) return null;

  const isGoogle = connector.id.startsWith('google_') || connector.id === 'gmail';

  const handleGoogleOAuth = () => {
    // Initiate Google Workspace OAuth flow directly
    window.location.href = `/api/auth/google/login?return_to=${encodeURIComponent(window.location.pathname + '?tab=connectors')}`;
  };

  const handleVerifyAndSave = async () => {
    if (!tokenInput.trim() && !connector.isConnected) {
      setError('Please enter an API token or key');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setTestResult(null);

    try {
      // 1. Save token
      const res = await fetch('/api/connectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          connectorId: connector.id,
          token: tokenInput.trim(),
          enabled: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save configuration');
      }

      // 2. Perform live ping test
      setTesting(true);
      const testRes = await fetch('/api/connectors/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectorId: connector.id }),
      });
      const testData = await testRes.json();

      if (testData.success) {
        setTestResult({
          success: true,
          message: testData.message || 'Connected successfully!',
          latency: testData.latencyMs,
        });
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      } else {
        setTestResult({
          success: false,
          message: testData.message || 'Token verification failed. Please check your credentials.',
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm(`Are you sure you want to disconnect ${connector.name}?`)) return;
    setIsSubmitting(true);
    try {
      await fetch('/api/connectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'disconnect',
          connectorId: connector.id,
        }),
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(39, 7, 17, 0.45)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '20px',
    }}>
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '520px',
        boxShadow: '0 25px 65px -10px rgba(40, 8, 19, 0.25)',
        border: '1px solid var(--mac-card-border)',
        overflow: 'hidden',
        animation: 'fadeIn 0.2s ease-out',
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid #F1ECE6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              backgroundColor: '#F8F4F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
            }}>
              <ConnectorIcon type={connector.icon} size={24} color={connector.brandColor} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--mac-plum)', margin: 0 }}>
                  {connector.name}
                </h3>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: '10px',
                  backgroundColor: connector.isConnected ? '#ECFDF5' : '#F3F4F6',
                  color: connector.isConnected ? '#059669' : '#6B7280',
                }}>
                  {connector.isConnected ? '● Connected' : '○ Not Linked'}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--mac-text-secondary)', margin: '2px 0 0 0' }}>
                {connector.shortDescription}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '18px',
              color: 'var(--mac-text-tertiary)',
              cursor: 'pointer',
              padding: '4px',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <p style={{ fontSize: '13px', color: 'var(--mac-text-secondary)', lineHeight: 1.5, margin: 0 }}>
            {connector.longDescription}
          </p>

          {/* Google Workspace: 1-Click OAuth flow */}
          {isGoogle ? (
            <div style={{
              backgroundColor: '#FBF8F5',
              border: '1px solid #EFE8DF',
              borderRadius: '14px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>⚡</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--mac-plum)' }}>
                    1-Click Google Authentication
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--mac-text-secondary)' }}>
                    Authorizes Google Drive, Google Sheets, Google Docs, and Gmail with offline refresh capability.
                  </div>
                </div>
              </div>

              {connector.isConnected ? (
                <div style={{
                  padding: '10px 12px',
                  backgroundColor: '#ECFDF5',
                  borderRadius: '10px',
                  border: '1px solid #A7F3D0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <div style={{ fontSize: '12px', color: '#065F46', fontWeight: 600 }}>
                    Connected Account: {connector.accountEmail || 'Google Workspace'}
                  </div>
                  <button
                    onClick={handleGoogleOAuth}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#047857',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Re-authenticate
                  </button>
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleGoogleOAuth}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  backgroundColor: '#FFFFFF',
                  color: '#1F2937',
                  border: '1.5px solid #D1D5DB',
                  borderRadius: '12px',
                  padding: '12px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F9FAFB')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
              >
                <ConnectorIcon type="google" size={18} />
                <span>{connector.isConnected ? 'Connect Another Google Account' : 'Sign in with Google (1-Click)'}</span>
              </button>
            </div>
          ) : (
            /* Token / API Key connectors (Notion, Vercel, GitHub, Airtop) */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'var(--mac-text-secondary)',
                }}>
                  {connector.id === 'notion' ? 'Internal Integration Secret'
                    : connector.id === 'vercel' ? 'Vercel Personal Access Token'
                    : connector.id === 'github' ? 'GitHub Personal Access Token (PAT)'
                    : 'API Key'}
                </label>

                {connector.docsUrl && (
                  <a
                    href={connector.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '11px', color: 'var(--mac-tag-pink)', fontWeight: 600, textDecoration: 'none' }}
                  >
                    Get Token ↗
                  </a>
                )}
              </div>

              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder={
                  connector.isConnected
                    ? '•••••••••••••••••••••••• (Leave blank to keep existing)'
                    : connector.id === 'notion'
                    ? 'secret_...'
                    : connector.id === 'github'
                    ? 'ghp_...'
                    : 'Paste access token here...'
                }
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--mac-card-border)',
                  backgroundColor: 'var(--mac-main-bg)',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  color: 'var(--mac-text-primary)',
                  outline: 'none',
                }}
              />

              <div style={{ fontSize: '11px', color: 'var(--mac-text-tertiary)', lineHeight: 1.4 }}>
                {connector.id === 'notion' ? (
                  <span>Create an integration at <a href="https://www.notion.so/my-integrations" target="_blank" rel="noreferrer" style={{ color: 'var(--mac-plum)', fontWeight: 600 }}>notion.so/my-integrations</a> and share pages with your integration.</span>
                ) : connector.id === 'vercel' ? (
                  <span>Generate a personal token at <a href="https://vercel.com/account/tokens" target="_blank" rel="noreferrer" style={{ color: 'var(--mac-plum)', fontWeight: 600 }}>vercel.com/account/tokens</a> with read/write access.</span>
                ) : connector.id === 'github' ? (
                  <span>Generate a token at <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" style={{ color: 'var(--mac-plum)', fontWeight: 600 }}>github.com/settings/tokens</a> with <code>repo</code> permissions.</span>
                ) : null}
              </div>
            </div>
          )}

          {/* Test / Feedback Alert */}
          {testResult && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '10px',
              backgroundColor: testResult.success ? '#ECFDF5' : '#FEF2F2',
              border: `1px solid ${testResult.success ? '#A7F3D0' : '#FECACA'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: testResult.success ? '#065F46' : '#991B1B',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{testResult.success ? '✓' : '⚠'}</span>
                <span>{testResult.message}</span>
              </div>
              {testResult.latency && (
                <span style={{ fontSize: '10px', fontWeight: 700, opacity: 0.8 }}>
                  {testResult.latency}ms
                </span>
              )}
            </div>
          )}

          {error && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '10px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#991B1B',
              fontSize: '12px',
            }}>
              {error}
            </div>
          )}

          {/* Capabilities Preview */}
          <div>
            <div style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--mac-text-secondary)',
              marginBottom: '8px',
            }}>
              Included Tools ({connector.tools.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {connector.tools.map((t) => (
                <span
                  key={t.name}
                  style={{
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--mac-main-bg)',
                    border: '1px solid var(--mac-card-border)',
                    color: 'var(--mac-plum)',
                  }}
                >
                  {t.name}
                </span>
              ))}
            </div>
          </div>

          {/* Security Notice */}
          <div style={{
            fontSize: '11px',
            color: 'var(--mac-text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            paddingTop: '6px',
            borderTop: '1px solid #F1ECE6',
          }}>
            <span>🔒</span>
            <span>Tokens are encrypted with AES-256-GCM. Never shared with client browsers.</span>
          </div>
        </div>

        {/* Modal Actions */}
        <div style={{
          padding: '14px 24px 18px',
          backgroundColor: '#FAF7F4',
          borderTop: '1px solid #F1ECE6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          {connector.isConnected ? (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={isSubmitting}
              style={{
                backgroundColor: 'transparent',
                color: '#DC2626',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '6px 10px',
              }}
            >
              Disconnect
            </button>
          ) : (
            <div />
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: '1px solid var(--mac-card-border)',
                backgroundColor: '#FFFFFF',
                color: 'var(--mac-text-secondary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>

            {!isGoogle && (
              <button
                type="button"
                onClick={handleVerifyAndSave}
                disabled={isSubmitting || testing}
                style={{
                  padding: '8px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: 'var(--mac-plum)',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 6px rgba(40, 8, 19, 0.15)',
                  opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                {isSubmitting ? 'Verifying...' : connector.isConnected ? 'Update Token' : 'Verify & Connect'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ConnectorIcon({ type, size = 20, color }: { type: string; size?: number; color?: string }) {
  switch (type) {
    case 'drive':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M4.5 17.5L8.5 10.5H19.5L15.5 17.5H4.5Z" fill="#2684FC" />
          <path d="M8.5 10.5L12.5 3.5H19.5L15.5 10.5H8.5Z" fill="#FFBC00" />
          <path d="M4.5 17.5L8.5 10.5L12.5 17.5H4.5Z" fill="#0066DA" />
          <path d="M8.5 10.5L12.5 3.5L16.5 10.5H8.5Z" fill="#EA4335" />
          <path d="M12.5 17.5L8.5 10.5L12.5 3.5L16.5 10.5L12.5 17.5Z" fill="#00AC47" />
        </svg>
      );
    case 'sheets':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="3" fill="#0F9D58" />
          <path d="M7 8H17M7 12H17M7 16H17M11 8V16" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'docs':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <rect x="4" y="3" width="16" height="18" rx="2.5" fill="#4285F4" />
          <path d="M8 8H16M8 12H16M8 16H13" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'gmail':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M4 6C4 4.89543 4.89543 4 6 4H18C19.1046 4 20 4.89543 20 6V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V6Z" fill="#FFFFFF" stroke="#EA4335" strokeWidth="1.5" />
          <path d="M4 6L12 12.5L20 6" stroke="#EA4335" strokeWidth="2" strokeLinecap="round" />
          <path d="M4 18V7L12 13.5L20 7V18" fill="none" stroke="#EA4335" strokeWidth="1.5" />
        </svg>
      );
    case 'google':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24">
          <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
          <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
        </svg>
      );
    case 'notion':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="5" fill="#000000" />
          <path d="M6 7.5V17L12 19V9.5L6 7.5Z" fill="#FFFFFF" fillOpacity="0.4" />
          <path d="M12 9.5V19L18 17V7.5L12 9.5Z" fill="#FFFFFF" />
          <path d="M7 6L17 7.5L12 9L6 7.5L7 6Z" fill="#FFFFFF" />
        </svg>
      );
    case 'vercel':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M12 2L23 21H1L12 2Z" fill="#000000" />
        </svg>
      );
    case 'github':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="#24292F">
          <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
        </svg>
      );
    case 'airtop':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" fill="#FF5C35" />
          <path d="M12 6C8.68629 6 6 8.68629 6 12C6 15.3137 8.68629 18 12 18" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="12" cy="12" r="3" fill="#FFFFFF" />
        </svg>
      );
    case 'calendar':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      );
    case 'palmier':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#7C3AED" />
          <path d="M13 3L4 14H12L11 21L20 10H12L13 3Z" fill="#FFFFFF" />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2">
          <rect width="7" height="7" x="3" y="3" rx="1" />
          <rect width="7" height="7" x="14" y="3" rx="1" />
          <rect width="7" height="7" x="14" y="14" rx="1" />
          <rect width="7" height="7" x="3" y="14" rx="1" />
        </svg>
      );
  }
}
