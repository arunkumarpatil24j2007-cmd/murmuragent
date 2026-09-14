import React, { useState, useEffect } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [selectedModel, setSelectedModel] = useState<string>('auto');
  const [localConnected, setLocalConnected] = useState<boolean>(true);
  const [kimiDiagnostic, setKimiDiagnostic] = useState<{
    model: string;
    exactModelId: string;
    provider: string;
    connectionStatus: string;
    lastLatencyMs?: number;
    lastError?: string;
  } | null>(null);
  const [anthropicDiagnostic, setAnthropicDiagnostic] = useState<{
    selectedModel: string;
    provider: string;
    requestedModel: string;
    actualRequestModel: string;
    responseModel: string;
    requestId: string;
    status: string;
    latency: string;
    toolCalls: number;
    fallbackUsed: string;
    lastError?: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    try {
      const saved = localStorage.getItem('murmur_selected_model');
      if (saved) setSelectedModel(saved);
    } catch {}

    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        setLocalConnected(data?.providers?.local?.status === 'available');
      })
      .catch(() => setLocalConnected(false));

    fetch('/api/diagnostic')
      .then((res) => res.json())
      .then((data) => {
        if (data?.kimi) {
          setKimiDiagnostic(data.kimi);
        }
        if (data?.anthropic) {
          setAnthropicDiagnostic(data.anthropic);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

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
      zIndex: 9999,
      padding: '20px',
    }}>
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '480px',
        padding: '24px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        border: '1px solid var(--mac-card-border)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '18px',
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--mac-plum)' }}>
            Murmur Settings
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              color: 'var(--mac-text-secondary)',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--mac-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              User Profile
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px',
              marginTop: '6px',
              borderRadius: '10px',
              backgroundColor: 'var(--mac-main-bg)',
              border: '1px solid var(--mac-card-border)',
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'var(--mac-plum)',
                color: '#FFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '700',
              }}>
                A
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--mac-plum)' }}>Arunkumar</div>
                <div style={{ fontSize: '11px', color: 'var(--mac-text-secondary)' }}>Account Active • Local Session</div>
              </div>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--mac-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Active AI Model
            </label>
            <div style={{
              marginTop: '6px',
              padding: '10px 12px',
              borderRadius: '10px',
              backgroundColor: 'var(--mac-main-bg)',
              border: '1px solid var(--mac-card-border)',
              fontSize: '13px',
              fontWeight: '500',
              color: 'var(--mac-plum)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span>
                {selectedModel === 'anthropic'
                  ? 'Claude Opus 4.6 (Anthropic)'
                  : selectedModel === 'omniroutes'
                  ? 'Claude Opus 4.6 (OmniRoutes)'
                  : selectedModel === 'local'
                  ? 'Local — Qwen 3.5 (Ollama)'
                  : selectedModel === 'kimi'
                  ? 'Kimi K2.6 (Moonshot AI)'
                  : selectedModel === 'gemini'
                  ? 'Google Gemini (Flash)'
                  : selectedModel === 'nvidia'
                  ? 'NVIDIA AI (Llama 3.2 11B)'
                  : 'Auto Router (Intelligent Failover)'}
              </span>
              <span style={{
                fontSize: '11px',
                color: (selectedModel === 'anthropic' || selectedModel === 'omniroutes') ? '#D97706' : selectedModel === 'local' ? '#059669' : selectedModel === 'kimi' ? '#9333EA' : '#1b7440',
                fontWeight: '600',
              }}>
                {(selectedModel === 'anthropic' || selectedModel === 'omniroutes') ? '★ Claude Active' : selectedModel === 'local' ? '🔒 100% Local' : selectedModel === 'kimi' ? '★ Kimi Active' : 'Active'}
              </span>
            </div>
          </div>

          {/* Developer Diagnostic — Claude Opus 4.6 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--mac-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Developer Diagnostic — Claude Opus 4.6
              </label>
              <span style={{ fontSize: '10px', color: '#D97706', fontFamily: 'monospace', fontWeight: 600 }}>
                claude-opus-4-6
              </span>
            </div>
            <div style={{
              marginTop: '6px',
              padding: '10px 12px',
              borderRadius: '10px',
              backgroundColor: '#FFFBEB',
              border: '1px solid #FDE68A',
              fontSize: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              fontFamily: 'monospace',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#92400E' }}>Selected model:</span>
                <span style={{ fontWeight: '600', color: '#78350F' }}>{anthropicDiagnostic?.selectedModel || 'Claude Opus 4.6'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#92400E' }}>Provider:</span>
                <span style={{ fontWeight: '600', color: '#78350F' }}>{anthropicDiagnostic?.provider || 'anthropic'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#92400E' }}>Request model:</span>
                <span style={{ fontWeight: '600', color: '#78350F' }}>{anthropicDiagnostic?.actualRequestModel || 'claude-opus-4-6'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#92400E' }}>Response model:</span>
                <span style={{ fontWeight: '600', color: '#78350F' }}>{anthropicDiagnostic?.responseModel || 'claude-opus-4-6'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#92400E' }}>Status:</span>
                <span style={{ fontWeight: '600', color: anthropicDiagnostic?.status === 'SUCCESS' ? '#059669' : '#D97706' }}>
                  {anthropicDiagnostic?.status || 'IDLE'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#92400E' }}>Fallback used:</span>
                <span style={{ fontWeight: '600', color: '#059669' }}>{anthropicDiagnostic?.fallbackUsed || 'NO'}</span>
              </div>
            </div>
          </div>

          {/* Developer Diagnostic — Kimi K2.6 (Development & Inspection) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--mac-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Developer Diagnostic — Kimi K2.6
              </label>
              <span style={{ fontSize: '10px', color: '#6B7280', fontFamily: 'monospace' }}>
                moonshotai/kimi-k2.6:free
              </span>
            </div>
            <div style={{
              marginTop: '6px',
              padding: '10px 12px',
              borderRadius: '10px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              fontSize: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              fontFamily: 'monospace',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Model:</span>
                <span style={{ fontWeight: '600', color: '#0F172A' }}>Kimi K2.6</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Provider:</span>
                <span style={{ fontWeight: '600', color: '#0F172A' }}>{kimiDiagnostic?.provider || 'kimi'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Connection Status:</span>
                <span style={{
                  fontWeight: '600',
                  color: kimiDiagnostic?.connectionStatus === 'connected' ? '#059669' : '#D97706',
                }}>
                  {kimiDiagnostic?.connectionStatus === 'connected' ? '● Connected' : '○ Standby'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Last Latency:</span>
                <span style={{ fontWeight: '600', color: '#0F172A' }}>
                  {kimiDiagnostic?.lastLatencyMs ? `${(kimiDiagnostic.lastLatencyMs / 1000).toFixed(2)}s` : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--mac-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Local Model Runtime (Ollama)
            </label>
            <div style={{
              marginTop: '6px',
              padding: '10px 12px',
              borderRadius: '10px',
              backgroundColor: 'var(--mac-main-bg)',
              border: '1px solid var(--mac-card-border)',
              fontSize: '13px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ color: 'var(--mac-plum)', fontSize: '12px' }}>
                http://127.0.0.1:11434 • qwen3.5:latest
              </span>
              <span style={{
                fontSize: '11px',
                fontWeight: '600',
                color: localConnected ? '#059669' : '#DC2626',
              }}>
                {localConnected ? '● Connected' : '○ Disconnected'}
              </span>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--mac-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Keyboard Shortcut
            </label>
            <div style={{
              marginTop: '6px',
              padding: '10px 12px',
              borderRadius: '10px',
              backgroundColor: 'var(--mac-main-bg)',
              border: '1px solid var(--mac-card-border)',
              fontSize: '13px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span>Invoke Agent Anywhere</span>
              <kbd style={{
                backgroundColor: '#EDE6DE',
                padding: '2px 7px',
                borderRadius: '5px',
                fontSize: '11px',
                fontWeight: '600',
                border: '1px solid #DCD1C5',
              }}>
                ⌥ Space
              </kbd>
            </div>
          </div>

          <div style={{
            fontSize: '11px',
            color: 'var(--mac-text-tertiary)',
            lineHeight: 1.4,
            paddingTop: '8px',
          }}>
            All API credentials (Gemini, NVIDIA, Vercel, Notion, Airtop) remain strictly server-side. No client keys are exposed.
          </div>
        </div>

        <div style={{ marginTop: '22px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'var(--mac-plum)',
              color: '#FFFFFF',
              border: 'none',
              padding: '8px 18px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
