'use client';

import React, { useState, useEffect } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsSection = 'general' | 'models' | 'voice' | 'privacy';

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const [selectedModel, setSelectedModel] = useState<string>('omniroutes');
  const [localConnected, setLocalConnected] = useState<boolean>(true);
  const [temperature, setTemperature] = useState<number>(0.3);
  const [streamEnabled, setStreamEnabled] = useState<boolean>(true);
  const [sessionUser, setSessionUser] = useState<{ email?: string; name?: string; picture?: string } | null>(null);
  const [voiceLanguage, setVoiceLanguage] = useState<string>('en-US');

  useEffect(() => {
    if (!isOpen) return;
    try {
      const saved = localStorage.getItem('murmur_selected_model');
      if (saved) setSelectedModel(saved);
    } catch {}

    fetch('/api/user/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data?.settings) {
          if (data.settings.selectedModel) setSelectedModel(data.settings.selectedModel);
          if (typeof data.settings.temperature === 'number') setTemperature(data.settings.temperature);
          if (typeof data.settings.streamEnabled === 'boolean') setStreamEnabled(data.settings.streamEnabled);
          if (data.settings.voiceLanguage) setVoiceLanguage(data.settings.voiceLanguage);
        }
      })
      .catch(() => {});

    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        setLocalConnected(data?.providers?.local?.status === 'available');
      })
      .catch(() => setLocalConnected(false));

    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data?.authenticated && data?.email) {
          setSessionUser({ email: data.email, name: data.name, picture: data.picture });
        } else {
          setSessionUser(null);
        }
      })
      .catch(() => setSessionUser(null));
  }, [isOpen]);

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    try {
      localStorage.setItem('murmur_selected_model', modelId);
    } catch {}
    if (sessionUser) {
      fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedModel: modelId }),
      }).catch(() => {});
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(28, 11, 18, 0.35)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '620px',
          height: '460px',
          boxShadow: 'var(--murmur-shadow-modal)',
          border: '1px solid var(--murmur-border-solid)',
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        {/* Left Navigation */}
        <div
          style={{
            width: '180px',
            backgroundColor: 'var(--murmur-sidebar)',
            borderRight: '1px solid var(--murmur-border)',
            padding: '20px 10px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--murmur-text-muted)',
                padding: '0 8px 12px 8px',
              }}
            >
              Settings
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {[
                { id: 'general' as SettingsSection, label: 'General' },
                { id: 'models' as SettingsSection, label: 'AI & Models' },
                { id: 'voice' as SettingsSection, label: 'Voice' },
                { id: 'privacy' as SettingsSection, label: 'Privacy' },
              ].map((s) => {
                const isActive = activeSection === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveSection(s.id)}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: '7px',
                      border: 'none',
                      backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                      color: isActive ? 'var(--murmur-plum)' : 'var(--murmur-text-secondary)',
                      fontSize: '13px',
                      fontWeight: isActive ? 600 : 500,
                      textAlign: 'left',
                      cursor: 'pointer',
                      boxShadow: isActive ? '0 1px 2px rgba(40, 8, 19, 0.05)' : 'none',
                      transition: 'all 0.1s ease',
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid var(--murmur-border)',
              backgroundColor: 'transparent',
              color: 'var(--murmur-text-secondary)',
              fontSize: '12px',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            Done
          </button>
        </div>

        {/* Right Content Area */}
        <div
          style={{
            flex: 1,
            padding: '24px 28px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {activeSection === 'general' && (
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--murmur-plum)', marginBottom: '16px' }}>
                Account & Appearance
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {sessionUser?.picture ? (
                      <img
                        src={sessionUser.picture}
                        alt="User Avatar"
                        style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--murmur-plum)',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: 700,
                        }}
                      >
                        {(sessionUser?.name || sessionUser?.email || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--murmur-text-primary)' }}>
                        {sessionUser?.name || (sessionUser?.email ? sessionUser.email.split('@')[0] : 'Guest User')}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--murmur-text-muted)' }}>
                        {sessionUser?.email || 'Not signed in'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {sessionUser?.email ? (
                      <button
                        type="button"
                        onClick={async () => {
                          await fetch('/api/auth/logout', { method: 'POST' });
                          window.location.reload();
                        }}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--murmur-border)',
                          backgroundColor: 'transparent',
                          color: '#DC2626',
                          fontSize: '12px',
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        Log Out
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          window.location.href = '/api/auth/google/login?return_to=' + encodeURIComponent(window.location.pathname + window.location.search);
                        }}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          backgroundColor: 'var(--murmur-plum)',
                          color: '#FFFFFF',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Log In with Google
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ height: '1px', backgroundColor: 'var(--murmur-border-subtle)' }} />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--murmur-text-primary)' }}>
                      Application Version
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--murmur-text-muted)' }}>
                      Murmur 2.0 Web Client
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--murmur-text-secondary)' }}>
                    v2.1.0-release
                  </span>
                </div>

                <div style={{ height: '1px', backgroundColor: 'var(--murmur-border-subtle)' }} />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--murmur-text-primary)' }}>
                      Global Keyboard Shortcut
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--murmur-text-muted)' }}>
                      Focus input from anywhere
                    </div>
                  </div>
                  <kbd style={{ fontSize: '11.5px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--murmur-sidebar)', border: '1px solid var(--murmur-border)' }}>
                    ⌥ Space
                  </kbd>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'models' && (
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--murmur-plum)', marginBottom: '16px' }}>
                AI Model Preferences
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--murmur-text-primary)', marginBottom: '6px' }}>
                    Default Model for Normal Chat
                  </div>
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--murmur-border-solid)',
                      backgroundColor: 'var(--murmur-sidebar)',
                      fontSize: '13px',
                      color: 'var(--murmur-text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>Claude Opus 4.6 (OmniRoute)</span>
                    <span style={{ fontSize: '11px', color: '#10B981', fontWeight: 600 }}>Active</span>
                  </div>
                </div>

                <div style={{ height: '1px', backgroundColor: 'var(--murmur-border-subtle)' }} />

                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--murmur-text-primary)', marginBottom: '6px' }}>
                    Agent Execution Model
                  </div>
                  <select
                    value={selectedModel}
                    onChange={(e) => handleModelChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--murmur-border-solid)',
                      backgroundColor: '#FFFFFF',
                      fontSize: '13px',
                      color: 'var(--murmur-text-primary)',
                      outline: 'none',
                    }}
                  >
                    <option value="omniroutes">Claude Opus 4.6 (OmniRoute)</option>
                    <option value="auto">Auto Router (Dynamic)</option>
                    <option value="gemini">Google Gemini 3.0</option>
                    <option value="nvidia">NVIDIA AI (Llama 3.2)</option>
                    <option value="local">Local Qwen 3.5 (Ollama)</option>
                  </select>
                </div>

                <div style={{ height: '1px', backgroundColor: 'var(--murmur-border-subtle)' }} />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--murmur-text-primary)' }}>
                      Streaming Responses
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--murmur-text-muted)' }}>
                      Stream text tokens in real-time
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={streamEnabled}
                    onChange={(e) => setStreamEnabled(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'voice' && (
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--murmur-plum)', marginBottom: '16px' }}>
                Voice & Dictation
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--murmur-text-primary)', marginBottom: '6px' }}>
                    Speech Recognition Language
                  </div>
                  <select
                    value={voiceLanguage}
                    onChange={(e) => setVoiceLanguage(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--murmur-border-solid)',
                      backgroundColor: '#FFFFFF',
                      fontSize: '13px',
                      color: 'var(--murmur-text-primary)',
                      outline: 'none',
                    }}
                  >
                    <option value="en-US">English (US)</option>
                    <option value="en-GB">English (UK)</option>
                    <option value="en-IN">English (India)</option>
                  </select>
                </div>

                <div style={{ height: '1px', backgroundColor: 'var(--murmur-border-subtle)' }} />

                <p style={{ fontSize: '12.5px', color: 'var(--murmur-text-secondary)', lineHeight: 1.5 }}>
                  Click the microphone button in the input or press the dictate shortcut to speak your requests. Audio is transcribed on-device by your browser.
                </p>
              </div>
            </div>
          )}

          {activeSection === 'privacy' && (
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--murmur-plum)', marginBottom: '16px' }}>
                Privacy & Data Isolation
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--murmur-text-primary)' }}>
                      Local Privacy Isolation
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--murmur-text-muted)' }}>
                      {localConnected ? 'Ollama running on Mac' : 'Ollama not detected'}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 600,
                      color: localConnected ? '#047857' : '#B91C1C',
                      backgroundColor: localConnected ? '#ECFDF5' : '#FEF2F2',
                      padding: '2px 8px',
                      borderRadius: '10px',
                    }}
                  >
                    {localConnected ? 'Available' : 'Offline'}
                  </span>
                </div>

                <div style={{ height: '1px', backgroundColor: 'var(--murmur-border-subtle)' }} />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--murmur-text-primary)' }}>
                      Token Encryption
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--murmur-text-muted)' }}>
                      Connector credentials protected
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--murmur-plum)' }}>
                    AES-256-GCM
                  </span>
                </div>

                <div style={{ height: '1px', backgroundColor: 'var(--murmur-border-subtle)' }} />

                <p style={{ fontSize: '12px', color: 'var(--murmur-text-muted)', lineHeight: 1.5 }}>
                  Murmur keeps all secrets and tokens server-side. No API keys or OAuth secrets are ever transmitted to the client browser.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
