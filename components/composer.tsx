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
  mode?: 'chat' | 'agent';
  onModeChange?: (mode: 'chat' | 'agent') => void;
  placeholder?: string;
  isHero?: boolean;
}

export function Composer({
  onSend,
  onStop,
  isProcessing = false,
  disabled,
  activeModelLabel = 'Claude Opus 4.6',
  selectedModelPreference = 'omniroutes',
  onSelectModel,
  mode = 'chat',
  onModeChange,
  placeholder,
  isHero = false,
}: ComposerProps) {
  const [value, setValue] = useState('');
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [isModelOpen, setIsModelOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [localAvailable, setLocalAvailable] = useState<boolean>(true);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
    const interval = setInterval(checkHealth, 20000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (attachRef.current && !attachRef.current.contains(target)) {
        setIsAttachOpen(false);
      }
      if (modelRef.current && !modelRef.current.contains(target)) {
        setIsModelOpen(false);
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
      textarea.style.height = Math.min(textarea.scrollHeight, 180) + 'px';
    }
  };

  // Speech Recognition
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
      alert('Speech recognition is not supported in this browser window.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsRecording(true);
      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setValue((prev) => (prev ? `${prev} ${transcript}` : transcript));
          handleInput();
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsRecording(false);
    }
  };

  const defaultPlaceholder =
    mode === 'chat'
      ? `Ask ${activeModelLabel || 'Claude Opus 4.6'} anything...`
      : 'Ask Murmur to do something with your tools & connectors...';

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: isHero ? '680px' : '100%',
        margin: '0 auto',
      }}
    >
      {/* ─── Attachment Popover ─── */}
      {isAttachOpen && (
        <div
          ref={attachRef}
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: '12px',
            width: '210px',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid var(--murmur-border-solid)',
            boxShadow: 'var(--murmur-shadow-card)',
            padding: '4px',
            zIndex: 50,
          }}
        >
          {[
            {
              label: 'Add web link',
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              ),
              action: () => setValue((p) => (p ? `${p} https://` : 'https://')),
            },
            {
              label: 'Insert code block',
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
              ),
              action: () => setValue((p) => `${p}\n\`\`\`\n\n\`\`\``),
            },
          ].map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                item.action();
                setIsAttachOpen(false);
                textareaRef.current?.focus();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '7px 10px',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '12.5px',
                color: 'var(--murmur-text-primary)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--murmur-sidebar-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <span style={{ color: 'var(--murmur-text-secondary)' }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ─── Model Selection Popover ─── */}
      {isModelOpen && (
        <div
          ref={modelRef}
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: '80px',
            width: '270px',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid var(--murmur-border-solid)',
            boxShadow: 'var(--murmur-shadow-card)',
            padding: '6px',
            zIndex: 50,
          }}
        >
          <div
            style={{
              padding: '6px 8px',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--murmur-text-muted)',
              borderBottom: '1px solid var(--murmur-border)',
              marginBottom: '4px',
            }}
          >
            Model Selection
          </div>
          {[
            { id: 'omniroutes', name: 'Claude Opus 4.6', desc: 'Anthropic Opus via OmniRoute' },
            { id: 'kimi', name: 'Kimi K2.6', desc: 'Moonshot AI via OpenRouter' },
            { id: 'auto', name: 'Auto Router', desc: 'Intelligent multi-model selection' },
            { id: 'gemini', name: 'Google Gemini', desc: 'Gemini multimodal reasoning' },
            { id: 'nvidia', name: 'NVIDIA AI', desc: 'Llama 3.2 vision & reasoning' },
            { id: 'local', name: 'Local Qwen 3.5', desc: localAvailable ? 'Ollama running on Mac' : 'Ollama offline' },
          ].map((m) => {
            const isSelected = selectedModelPreference === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onSelectModel?.(m.id);
                  setIsModelOpen(false);
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '7px',
                  border: 'none',
                  backgroundColor: isSelected ? 'var(--murmur-sidebar-active)' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.1s',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--murmur-sidebar-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: isSelected ? 600 : 500, color: 'var(--murmur-text-primary)' }}>
                    {m.name}
                  </span>
                  {isSelected && (
                    <span style={{ fontSize: '12px', color: 'var(--murmur-plum)' }}>✓</span>
                  )}
                </div>
                <span style={{ fontSize: '11px', color: 'var(--murmur-text-muted)', marginTop: '1px' }}>
                  {m.desc}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ─── Main Clean Input Container ─── */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid var(--murmur-border-solid)',
          boxShadow: isHero ? 'var(--murmur-shadow-card)' : 'var(--murmur-shadow-subtle)',
          padding: '12px 14px 10px 14px',
          display: 'flex',
          flexDirection: 'column',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        }}
      >
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            handleInput();
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || defaultPlaceholder}
          disabled={disabled}
          rows={isHero ? 2 : 1}
          style={{
            width: '100%',
            resize: 'none',
            border: 'none',
            outline: 'none',
            fontSize: '14.5px',
            lineHeight: '1.5',
            fontFamily: 'inherit',
            color: 'var(--murmur-text-primary)',
            backgroundColor: 'transparent',
            minHeight: isHero ? '48px' : '28px',
            maxHeight: '180px',
            padding: '2px 0 6px 0',
          }}
        />

        {/* Action Controls Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '6px',
          }}
        >
          {/* Left Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* Mode Switcher Pill: [ Chat ] [ Agent ] */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: 'var(--murmur-sidebar)',
                borderRadius: '20px',
                padding: '2px',
                gap: '1px',
                border: '1px solid var(--murmur-border)',
              }}
            >
              <button
                type="button"
                onClick={() => onModeChange?.('chat')}
                title="Normal Chat: Direct conversation with Claude Opus 4.6 (no tools)"
                style={{
                  padding: '4px 10px',
                  borderRadius: '16px',
                  border: 'none',
                  backgroundColor: mode === 'chat' ? '#FFFFFF' : 'transparent',
                  color: mode === 'chat' ? 'var(--murmur-plum)' : 'var(--murmur-text-secondary)',
                  fontSize: '12px',
                  fontWeight: mode === 'chat' ? 600 : 500,
                  cursor: 'pointer',
                  boxShadow: mode === 'chat' ? '0 1px 2px rgba(40, 8, 19, 0.08)' : 'none',
                  transition: 'all 0.12s ease',
                }}
              >
                Chat
              </button>

              <button
                type="button"
                onClick={() => onModeChange?.('agent')}
                title="Agent Mode: Executes tasks using tools & connectors"
                style={{
                  padding: '4px 10px',
                  borderRadius: '16px',
                  border: 'none',
                  backgroundColor: mode === 'agent' ? '#FFFFFF' : 'transparent',
                  color: mode === 'agent' ? 'var(--murmur-plum)' : 'var(--murmur-text-secondary)',
                  fontSize: '12px',
                  fontWeight: mode === 'agent' ? 600 : 500,
                  cursor: 'pointer',
                  boxShadow: mode === 'agent' ? '0 1px 2px rgba(40, 8, 19, 0.08)' : 'none',
                  transition: 'all 0.12s ease',
                }}
              >
                Agent
              </button>
            </div>

            {/* Model Badge */}
            <button
              type="button"
              onClick={() => setIsModelOpen((p) => !p)}
              title="Click to view or switch model"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: '14px',
                border: '1px solid var(--murmur-border)',
                backgroundColor: 'transparent',
                color: 'var(--murmur-text-secondary)',
                fontSize: '11.5px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.12s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--murmur-sidebar)';
                e.currentTarget.style.color = 'var(--murmur-text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--murmur-text-secondary)';
              }}
            >
              <span>{activeModelLabel || 'Claude Opus 4.6'}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Attach button (+) */}
            <button
              type="button"
              onClick={() => setIsAttachOpen((p) => !p)}
              title="Add attachment or link"
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--murmur-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background-color 0.12s',
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>

          {/* Right Controls: Dictate & Send */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* Dictate / Microphone */}
            <button
              type="button"
              onClick={toggleRecording}
              title={isRecording ? 'Stop dictation' : 'Dictate with voice'}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: isRecording ? '#FEE2E2' : 'transparent',
                color: isRecording ? '#DC2626' : 'var(--murmur-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.12s',
              }}
              onMouseEnter={(e) => {
                if (!isRecording) {
                  e.currentTarget.style.backgroundColor = 'var(--murmur-sidebar)';
                  e.currentTarget.style.color = 'var(--murmur-plum)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isRecording) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--murmur-text-secondary)';
                }
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            </button>

            {/* Send / Stop button */}
            {isProcessing ? (
              <button
                type="button"
                onClick={onStop}
                title="Stop execution"
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: 'var(--murmur-sidebar-hover)',
                  color: 'var(--murmur-plum)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <div style={{ width: '9px', height: '9px', backgroundColor: 'var(--murmur-plum)', borderRadius: '2px' }} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!value.trim() || disabled}
                title="Send message (⏎)"
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: value.trim() ? 'var(--murmur-plum)' : 'var(--murmur-sidebar)',
                  color: value.trim() ? '#FFFFFF' : 'var(--murmur-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: value.trim() ? 'pointer' : 'default',
                  transition: 'all 0.15s ease',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
