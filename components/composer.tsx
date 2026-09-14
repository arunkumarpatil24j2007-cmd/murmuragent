'use client';

import React, { useState, useRef, useEffect } from 'react';

interface ComposerProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  isProcessing?: boolean;
  disabled: boolean;
  activeModelLabel?: string;
  selectedModelPreference?: string;
  onSelectModel?: (modelId: string) => void;
  placeholder?: string;
}

export function Composer({
  onSend,
  onStop,
  isProcessing = false,
  disabled,
  activeModelLabel,
  selectedModelPreference = 'auto',
  onSelectModel,
  placeholder = 'Type a message...',
}: ComposerProps) {
  const [value, setValue] = useState('');
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [localAvailable, setLocalAvailable] = useState<boolean>(true);
  const [isRecording, setIsRecording] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const attachRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Poll local Ollama connection status
  useEffect(() => {
    let mounted = true;
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          if (mounted) {
            setLocalAvailable(data?.providers?.local?.status === 'available');
          }
        }
      } catch {
        if (mounted) setLocalAvailable(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (toolsRef.current && !toolsRef.current.contains(target)) {
        setIsToolsMenuOpen(false);
      }
      if (attachRef.current && !attachRef.current.contains(target)) {
        setIsAttachMenuOpen(false);
      }
      if (modelRef.current && !modelRef.current.contains(target)) {
        setIsModelMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
    }
  };

  // Speech Recognition (Dictation)
  const toggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech dictation is not supported in this browser window. You can type your request directly.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        if (transcript) {
          setValue((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
        setIsRecording(false);
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsRecording(false);
    }
  };

  const hasText = value.trim().length > 0;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* ─── Active Tools Popover (Crossed Tools) ─── */}
      {isToolsMenuOpen && (
        <div
          ref={toolsRef}
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 10px)',
            left: '42px',
            width: '290px',
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            boxShadow: '0 12px 36px -4px rgba(0, 0, 0, 0.16), 0 0 0 1px rgba(0, 0, 0, 0.08)',
            padding: '12px',
            zIndex: 100,
            animation: 'fadeInUp 0.15s ease-out',
          }}
        >
          <div style={{
            padding: '4px 8px 8px',
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: '#8E8E93',
            borderBottom: '1px solid #F0F0F2',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span>Available Integrations</span>
            <span style={{ color: '#10B981', fontWeight: 600, fontSize: '10px' }}>Autonomous Mode</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
            {[
              { name: 'Gmail & Email', icon: '📧', status: 'Ready' },
              { name: 'Google Docs', icon: '📝', status: 'Ready' },
              { name: 'Google Sheets', icon: '📊', status: 'Ready' },
              { name: 'Google Drive', icon: '📁', status: 'Ready' },
              { name: 'Notion Workspace', icon: '📓', status: 'Connected' },
              { name: 'Vercel Deployments', icon: '▲', status: 'Live' },
              { name: 'GitHub Code & PRs', icon: '🐙', status: 'Active' },
              { name: 'Airtop Web Browser', icon: '🌐', status: 'Active' },
              { name: 'Palmier MCP Client', icon: '⚡', status: 'Auto' },
            ].map((tool, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  backgroundColor: '#F9FAFB',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{tool.icon}</span>
                  <span style={{ fontWeight: 500, color: '#1F2937' }}>{tool.name}</span>
                </div>
                <span style={{ fontSize: '11px', color: '#10B981', fontWeight: 600 }}>
                  {tool.status}
                </span>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: '8px',
            paddingTop: '8px',
            borderTop: '1px solid #F0F0F2',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingLeft: '4px',
            paddingRight: '4px',
          }}>
            <span style={{ fontSize: '10.5px', color: '#64748B' }}>Cloud Plugins & OAuth</span>
            <button
              type="button"
              onClick={() => {
                setIsToolsMenuOpen(false);
                if (typeof window !== 'undefined' && (window as any).murmurSetTab) {
                  (window as any).murmurSetTab('connectors');
                }
              }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--mac-plum)',
                cursor: 'pointer',
                padding: '2px 4px',
              }}
            >
              Open Connectors ↗
            </button>
          </div>
        </div>
      )}

      {/* ─── Attachments / Actions Popover (+) ─── */}
      {isAttachMenuOpen && (
        <div
          ref={attachRef}
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 10px)',
            left: '10px',
            width: '230px',
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            boxShadow: '0 12px 36px -4px rgba(0, 0, 0, 0.16), 0 0 0 1px rgba(0, 0, 0, 0.08)',
            padding: '6px',
            zIndex: 100,
          }}
        >
          {[
            { label: 'Upload File or Image', icon: '📎', action: () => alert('File attachment ready') },
            { label: 'Add Web URL', icon: '🌐', action: () => setValue((p) => p ? `${p} https://` : 'https://') },
            { label: 'Insert Code Block', icon: '💻', action: () => setValue((p) => `${p}\n\`\`\`\n\n\`\`\``) },
          ].map((item, idx) => (
            <button
              key={idx}
              onClick={() => {
                item.action();
                setIsAttachMenuOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '13px',
                color: '#1F2937',
                transition: 'background-color 0.12s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F3F4F6')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ─── Model Selector Popover ─── */}
      {isModelMenuOpen && (
        <div
          ref={modelRef}
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 10px)',
            left: '80px',
            width: '320px',
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            boxShadow: '0 12px 36px -4px rgba(0, 0, 0, 0.16), 0 0 0 1px rgba(0, 0, 0, 0.08)',
            padding: '12px',
            zIndex: 100,
            animation: 'fadeInUp 0.15s ease-out',
          }}
        >
          <div style={{
            padding: '4px 8px 8px',
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: '#8E8E93',
            borderBottom: '1px solid #F0F0F2',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span>Model Provider</span>
            <span style={{ color: '#6B7280', fontWeight: 500, fontSize: '10px' }}>Persisted Locally</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
            {[
              {
                id: 'auto',
                label: 'Auto Router',
                badge: 'Auto Failover',
                description: 'Intelligently routes requests and fails over if quota is exhausted',
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                ),
                isLocal: false,
              },
              {
                id: 'gemini',
                label: 'Google Gemini',
                badge: 'Gemini 3 Flash',
                description: 'Multimodal vision, high reasoning & fast tool execution',
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                  </svg>
                ),
                isLocal: false,
              },
              {
                id: 'nvidia',
                label: 'NVIDIA AI',
                badge: 'Llama 3.2 11B Vision',
                description: 'Hosted open-weights vision models via NVIDIA NIM cloud',
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="4" />
                    <path d="m9 9 6 6m0-6-6 6" />
                  </svg>
                ),
                isLocal: false,
              },
              {
                id: 'kimi',
                label: 'Kimi K2.6',
                badge: 'moonshotai/kimi-k2.6:free',
                description: 'Moonshot AI high-performance reasoning model with native tool execution',
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M8 12h8" />
                    <path d="M12 8v8" />
                  </svg>
                ),
                isLocal: false,
              },
              {
                id: 'anthropic',
                label: 'Claude Opus 4.6',
                badge: 'Anthropic',
                description: 'Anthropic Claude Opus 4.6 frontier model (claude-opus-4-6)',
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2a1 1 0 0 1 1 1v7.05l4.98-4.98a1 1 0 1 1 1.41 1.41L14.41 11.46H21a1 1 0 1 1 0 2h-6.59l4.98 4.98a1 1 0 0 1-1.41 1.41L13 14.88V22a1 1 0 1 1-2 0v-7.12l-4.98 4.98a1 1 0 0 1-1.41-1.41l4.98-4.98H3a1 1 0 1 1 0-2h6.59L4.61 6.48a1 1 0 0 1 1.41-1.41L11 10.05V3a1 1 0 0 1 1-1z" />
                  </svg>
                ),
                isLocal: false,
              },
              {
                id: 'local',
                label: 'Local — Qwen 3.5',
                badge: '100% Private (Ollama)',
                description: 'Runs locally on Mac (127.0.0.1:11434). Zero data sent to cloud.',
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                ),
                isLocal: true,
              },
            ].map((opt) => {
              const isSelected = (selectedModelPreference || 'auto') === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onSelectModel?.(opt.id);
                    setIsModelMenuOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '10px',
                    border: isSelected ? '1px solid #0F172A' : '1px solid transparent',
                    backgroundColor: isSelected ? '#F8FAFC' : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = '#F3F4F6';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{
                      marginTop: '2px',
                      color: opt.isLocal ? '#059669' : isSelected ? '#0F172A' : '#64748B',
                      flexShrink: 0,
                    }}>
                      {opt.icon}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: isSelected ? 700 : 600, color: '#0F172A' }}>
                          {opt.label}
                        </span>
                        {opt.isLocal && (
                          <span style={{
                            fontSize: '9.5px',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: '4px',
                            backgroundColor: localAvailable ? '#ECFDF5' : '#FEF2F2',
                            color: localAvailable ? '#059669' : '#DC2626',
                          }}>
                            {localAvailable ? '● Connected' : '○ Offline'}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px', lineHeight: 1.3 }}>
                        {opt.description}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <div style={{ color: '#0F172A', marginTop: '2px', flexShrink: 0, paddingLeft: '4px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{
            marginTop: '8px',
            paddingTop: '8px',
            borderTop: '1px solid #F0F0F2',
            fontSize: '10.5px',
            color: '#64748B',
            lineHeight: 1.3,
            paddingLeft: '4px',
          }}>
            🔒 <strong>Strict Privacy:</strong> When Local Qwen is selected, all prompts, Google data, and tools stay on this Mac. Cloud failover is disabled.
          </div>
        </div>
      )}

      {/* ─── Main Rounded Pill Card ─── */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '26px',
          border: '1.5px solid #E5E7EB',
          boxShadow: '0 4px 18px -2px rgba(0, 0, 0, 0.04)',
          padding: '14px 18px 12px 18px',
          display: 'flex',
          flexDirection: 'column',
          transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
        }}
      >
        {/* Top Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            handleInput();
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          style={{
            width: '100%',
            resize: 'none',
            border: 'none',
            outline: 'none',
            fontSize: '15px',
            lineHeight: '1.45',
            fontFamily: 'inherit',
            color: '#111827',
            backgroundColor: 'transparent',
            minHeight: '26px',
            maxHeight: '150px',
            padding: '2px 0 6px 0',
          }}
        />

        {/* Bottom Controls Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '8px',
          }}
        >
          {/* Left Group: (+)  (🛠️)  [ ⚡ Auto ] */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* (+) Button */}
            <button
              type="button"
              onClick={() => setIsAttachMenuOpen((p) => !p)}
              aria-label="Add attachments or actions"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#ECEEF1',
                border: 'none',
                color: '#1F2937',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease, transform 0.1s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#E2E4E8')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ECEEF1')}
              onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.95)')}
              onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>

            {/* (🛠️) Crossed Tools Button */}
            <button
              type="button"
              onClick={() => setIsToolsMenuOpen((p) => !p)}
              aria-label="Active Tools and Integrations"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: isToolsMenuOpen ? '#ECEEF1' : 'transparent',
                border: 'none',
                color: '#4B5563',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease, color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#ECEEF1';
                e.currentTarget.style.color = '#111827';
              }}
              onMouseLeave={(e) => {
                if (!isToolsMenuOpen) e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#4B5563';
              }}
            >
              <CrossedToolsIcon size={18} />
            </button>

            {/* (🔌) Connectors Shortcut Button */}
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined' && (window as any).murmurSetTab) {
                  (window as any).murmurSetTab('connectors');
                }
              }}
              title="Cloud Connectors Hub (Google Drive, Sheets, Notion, Vercel, GitHub)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 9px',
                borderRadius: '16px',
                backgroundColor: '#F3F4F6',
                border: '1px solid #E5E7EB',
                color: 'var(--mac-plum)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#E5E7EB';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#F3F4F6';
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v6" />
                <path d="m19 13-4-4" />
                <path d="m5 13 4-4" />
                <path d="M8 12v5a4 4 0 0 0 8 0v-5Z" />
                <path d="M12 21v1" />
              </svg>
              <span>Connectors</span>
            </button>

            {/* [ ⚡ Model Selector Button / Pill ] */}
            {(() => {
              const isLocal = selectedModelPreference === 'local';
              const isKimi = selectedModelPreference === 'kimi';
              let displayLabel = activeModelLabel || 'Auto Router';
              if (selectedModelPreference === 'local') {
                displayLabel = 'Local — Qwen 3.5';
              } else if (selectedModelPreference === 'kimi') {
                displayLabel = 'Kimi K2.6';
              } else if (selectedModelPreference === 'gemini') {
                displayLabel = 'Google Gemini';
              } else if (selectedModelPreference === 'nvidia') {
                displayLabel = 'NVIDIA AI';
              }

              let bgColor = '#0F172A';
              let borderColor = 'transparent';
              let boxShadow = '0 2px 6px rgba(15, 23, 42, 0.15)';
              if (isLocal) {
                bgColor = '#064E3B';
                borderColor = '#059669';
                boxShadow = '0 2px 6px rgba(6, 78, 59, 0.35)';
              } else if (isKimi) {
                bgColor = '#3B0764'; // Plum/Purple accent for Moonshot Kimi
                borderColor = '#9333EA';
                boxShadow = '0 2px 6px rgba(59, 7, 100, 0.35)';
              }

              return (
                <button
                  type="button"
                  onClick={() => setIsModelMenuOpen((prev) => !prev)}
                  title="Click to switch model provider: Auto, Kimi K2.6, Gemini, NVIDIA, or Local Qwen (Selection is persisted)"
                  style={{
                    backgroundColor: bgColor,
                    color: '#F8FAFC',
                    borderRadius: '9999px',
                    padding: '6px 13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                    userSelect: 'none',
                    boxShadow: boxShadow,
                    border: `1px solid ${borderColor}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.92';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  {isLocal ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.5">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                  )}
                  <span>{displayLabel}</span>
                  {isLocal && (
                    <span
                      title={localAvailable ? 'Ollama Online' : 'Ollama Offline'}
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: localAvailable ? '#34D399' : '#EF4444',
                        display: 'inline-block',
                      }}
                    />
                  )}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7, marginLeft: '2px' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              );
            })()}
          </div>

          {/* Right Group: (🎙️) (↑) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* (🎙️) Microphone Button */}
            <button
              type="button"
              onClick={toggleRecording}
              aria-label={isRecording ? 'Stop dictation' : 'Start dictation'}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: isRecording ? '#FEE2E2' : 'transparent',
                border: 'none',
                color: isRecording ? '#EF4444' : '#4B5563',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isRecording) {
                  e.currentTarget.style.backgroundColor = '#ECEEF1';
                  e.currentTarget.style.color = '#111827';
                }
              }}
              onMouseLeave={(e) => {
                if (!isRecording) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#4B5563';
                }
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            </button>

            {/* (⏹) Orange Stop Button (when running) or (↑) Send Button */}
            {isProcessing ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Terminate action"
                title="Terminate action"
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: '#D95C2B',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 2px 6px rgba(217, 92, 43, 0.35)',
                  transition: 'background-color 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease',
                  animation: 'pulseGently 2s infinite',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#C34E20';
                  e.currentTarget.style.transform = 'scale(1.06)';
                  e.currentTarget.style.boxShadow = '0 3px 10px rgba(217, 92, 43, 0.45)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#D95C2B';
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '0 2px 6px rgba(217, 92, 43, 0.35)';
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'scale(0.92)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'scale(1.06)';
                }}
              >
                {/* Crisp rounded square stop symbol matching reference image */}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="5" y="5" width="14" height="14" rx="2.5" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={disabled || !hasText}
                aria-label="Send message"
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: hasText && !disabled ? '#0F172A' : '#E2E4EA',
                  color: hasText && !disabled ? '#FFFFFF' : '#6B7280',
                  cursor: hasText && !disabled ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'background-color 0.15s ease, color 0.15s ease, transform 0.1s ease',
                }}
                onMouseEnter={(e) => {
                  if (hasText && !disabled) {
                    e.currentTarget.style.backgroundColor = '#1E293B';
                  }
                }}
                onMouseLeave={(e) => {
                  if (hasText && !disabled) {
                    e.currentTarget.style.backgroundColor = '#0F172A';
                  }
                }}
                onMouseDown={(e) => {
                  if (hasText && !disabled) {
                    e.currentTarget.style.transform = 'scale(0.94)';
                  }
                }}
                onMouseUp={(e) => {
                  if (hasText && !disabled) {
                    e.currentTarget.style.transform = 'scale(1)';
                  }
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="6 11 12 5 18 11" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CrossedToolsIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      <path d="m18 15 3.5 3.5a1.5 1.5 0 0 1-2 2l-3.5-3.5" />
      <path d="m2 22 5-5" />
    </svg>
  );
}
