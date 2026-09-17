'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

export type AgentNotchState =
  | 'IDLE'
  | 'MIC_LISTENING'
  | 'MIC_TRANSCRIBING'
  | 'AGENT_LISTENING'
  | 'AGENT_WORKING'
  | 'AGENT_PERMISSION'
  | 'SUCCESS'
  | 'ERROR';

export interface ActionCardData {
  type?: 'email' | 'calendar' | 'web' | 'doc' | 'general';
  serviceIcon?: 'gmail' | 'notion' | 'docs' | 'sheets' | 'calendar' | 'browser';
  title?: string;
  to?: string;
  subject?: string;
  preview?: string;
  actionButtonText?: string;
  url?: string;
  onConfirm?: () => void;
}

export interface AgentNotchProps {
  state?: AgentNotchState;
  message?: string;
  transcript?: string;
  tool?: string;
  actionDetails?: ActionCardData;
  onStateChange?: (state: AgentNotchState) => void;
  onActionConfirm?: () => void;
  onCancel?: () => void;
  onClick?: () => void;
}

/**
 * Inserts transcribed text into currently focused element or copies to clipboard
 */
function insertTextAtActiveElement(text: string): boolean {
  if (typeof document === 'undefined') return false;
  const el = document.activeElement as HTMLElement | null;

  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
    const input = el as HTMLInputElement | HTMLTextAreaElement;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const before = input.value.substring(0, start);
    const after = input.value.substring(end);
    input.value = before + text + after;
    input.selectionStart = input.selectionEnd = start + text.length;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  } else if (el && el.isContentEditable) {
    document.execCommand('insertText', false, text);
    return true;
  } else {
    // Fallback copy to clipboard
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    return false;
  }
}

export function AgentNotch({
  state: controlledState,
  message: externalMessage,
  transcript: externalTranscript,
  tool: externalTool,
  actionDetails: externalActionDetails,
  onStateChange,
  onActionConfirm,
  onCancel,
  onClick,
}: AgentNotchProps) {
  const [internalState, setInternalState] = useState<AgentNotchState>('IDLE');
  const [isHovered, setIsHovered] = useState(false);
  const [isMicHovered, setIsMicHovered] = useState(false);
  const [isAgentHovered, setIsAgentHovered] = useState(false);

  // Audio / Speech Recognition
  const [speechText, setSpeechText] = useState('');
  const [audioLevel, setAudioLevel] = useState(0.3);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [agentInputPrompt, setAgentInputPrompt] = useState('');
  const [showPromptInput, setShowPromptInput] = useState(false);

  // Live Agent Orchestration State
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const [stepDetail, setStepDetail] = useState<string>('Analyzing task...');
  const [pendingPermission, setPendingPermission] = useState<{
    toolCallId: string;
    tool: string;
    action: string;
  } | null>(null);
  const [completedURL, setCompletedURL] = useState<string | null>(null);
  const [completedTitle, setCompletedTitle] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const currentState = controlledState || internalState;
  const recognitionRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const updateState = useCallback(
    (newState: AgentNotchState) => {
      if (onStateChange) {
        onStateChange(newState);
      } else {
        setInternalState(newState);
      }
    },
    [onStateChange]
  );

  // Timer for duration counter in listening states
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (currentState === 'MIC_LISTENING' || currentState === 'AGENT_LISTENING') {
      setRecordingSeconds(0);
      interval = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
        setAudioLevel(0.2 + Math.random() * 0.7);
      }, 100);
    } else {
      setRecordingSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentState]);

  // Auto-dismiss timers for SUCCESS and ERROR states
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (currentState === 'SUCCESS') {
      timer = setTimeout(() => {
        updateState('IDLE');
      }, completedURL ? 6000 : 2500);
    } else if (currentState === 'ERROR') {
      timer = setTimeout(() => {
        updateState('IDLE');
      }, 4000);
    }
    return () => clearTimeout(timer);
  }, [currentState, completedURL, updateState]);

  // Clean up recognition / abort controllers on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // -------------------------------------------------------------
  // 1. MIC MODE: Speech-to-Text Implementation
  // -------------------------------------------------------------
  const startMicMode = () => {
    updateState('MIC_LISTENING');
    setSpeechText('');
    setStatusMessage('');

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        const rec = new SpeechRec();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'en-US';

        rec.onresult = (event: any) => {
          let current = '';
          for (let i = 0; i < event.results.length; i++) {
            current += event.results[i][0].transcript;
          }
          setSpeechText(current);
        };

        rec.onerror = (e: any) => {
          console.warn('Speech recognition warning:', e);
        };

        rec.start();
        recognitionRef.current = rec;
      } catch (err) {
        console.warn('Could not start webkitSpeechRecognition:', err);
      }
    }
  };

  const stopMicModeAndInsert = () => {
    updateState('MIC_TRANSCRIBING');
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    setTimeout(() => {
      const textToUse = speechText.trim() || externalTranscript || 'Dictated text inserted successfully.';
      const wasInserted = insertTextAtActiveElement(textToUse);
      setStatusMessage(wasInserted ? `Inserted: "${textToUse.slice(0, 30)}..."` : 'Transcribed & copied to clipboard');
      updateState('SUCCESS');
    }, 600);
  };

  // -------------------------------------------------------------
  // 2. AGENT MODE: Autonomous Orchestration & SSE Execution
  // -------------------------------------------------------------
  const startAgentMode = () => {
    setShowPromptInput(true);
    updateState('AGENT_LISTENING');
    setSpeechText('');
  };

  const submitAgentPrompt = async (promptToRun: string) => {
    if (!promptToRun.trim()) return;
    setShowPromptInput(false);
    updateState('AGENT_WORKING');
    setCurrentTool(null);
    setStepDetail('Analyzing task...');
    setCompletedURL(null);
    setCompletedTitle(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          message: promptToRun,
          conversationId: `notch-${Date.now()}`,
          model: 'auto',
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const event = JSON.parse(jsonStr);
            const { type, data } = event;

            if (type === 'agent_thinking') {
              setStepDetail(data?.status || data?.text || 'Thinking...');
            } else if (type === 'tool_started') {
              setCurrentTool(data?.tool || 'action');
              setStepDetail(data?.action || data?.title || `Running ${data?.tool}`);
            } else if (type === 'tool_result') {
              setStepDetail(data?.title || data?.result || `${data?.tool} completed`);
              if (data?.url) {
                setCompletedURL(data.url);
                setCompletedTitle(data?.title || 'Open Result');
              }
            } else if (type === 'permission_required') {
              setPendingPermission({
                toolCallId: data.toolCallId || '',
                tool: data.tool || 'tool',
                action: data.action || data.text || 'Confirm execution',
              });
              updateState('AGENT_PERMISSION');
            } else if (type === 'final_response' || type === 'agent_completed') {
              setStatusMessage(data?.content?.slice(0, 48) || 'Task completed successfully');
              updateState('SUCCESS');
            } else if (type === 'agent_error') {
              setStatusMessage(data?.error || 'Execution encountered an error');
              updateState('ERROR');
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setStatusMessage(err.message || 'Failed to connect to agent');
        updateState('ERROR');
      }
    }
  };

  const handleRespondPermission = async (allowed: boolean) => {
    if (!pendingPermission?.toolCallId) {
      updateState('AGENT_WORKING');
      return;
    }

    const { toolCallId } = pendingPermission;
    setPendingPermission(null);
    updateState('AGENT_WORKING');
    setStepDetail(allowed ? 'Permission granted. Proceeding...' : 'Action cancelled by user.');

    try {
      await fetch('/api/agent/permission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolCallId, allowed }),
      });
    } catch (err) {
      console.error('Error responding to permission:', err);
    }
  };

  const cancelExecution = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    updateState('IDLE');
    onCancel?.();
  };

  // -------------------------------------------------------------
  // Dynamic Widths (Single continuous horizontal extension)
  // -------------------------------------------------------------
  const getWidth = () => {
    switch (currentState) {
      case 'IDLE':
        return isHovered ? 290 : 270;
      case 'MIC_LISTENING':
        return 380;
      case 'MIC_TRANSCRIBING':
        return 320;
      case 'AGENT_LISTENING':
        return showPromptInput ? 440 : 380;
      case 'AGENT_WORKING':
        return 460;
      case 'AGENT_PERMISSION':
        return 490;
      case 'SUCCESS':
        return completedURL ? 420 : 330;
      case 'ERROR':
        return 360;
      default:
        return 270;
    }
  };

  const currentWidth = getWidth();

  return (
    <aside
      aria-label="MacBook Notch System Agent"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: 0,
        display: 'flex',
        justifyContent: 'center',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'relative',
          top: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pointerEvents: 'auto',
        }}
      >
        {/* Left Notch Ear Fillet Curve */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{ position: 'absolute', top: 0, left: '-12px', pointerEvents: 'none' }}
        >
          <path d="M 12 0 C 4 0 0 6 0 12 L 12 12 Z" fill="#000000" />
        </svg>

        {/* Right Notch Ear Fillet Curve */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{ position: 'absolute', top: 0, right: '-12px', pointerEvents: 'none' }}
        >
          <path d="M 0 0 C 8 0 12 6 12 12 L 0 12 Z" fill="#000000" />
        </svg>

        {/* The Murmur Notch Bar (Continuous Solid Surface) */}
        <div
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            width: `${currentWidth}px`,
            height: '32px',
            backgroundColor: '#000000',
            borderBottomLeftRadius: '11px',
            borderBottomRightRadius: '11px',
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            display: 'flex',
            alignItems: 'center',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.45)',
            userSelect: 'none',
            overflow: 'hidden',
            transition: 'width 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            padding: '0 12px',
          }}
        >
          {/* ==================================================================== */}
          {/* 1. IDLE STATE: Dual Wing Controls + Camera Clearance                */}
          {/* ==================================================================== */}
          {currentState === 'IDLE' && (
            <div
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: '100%',
              }}
            >
              {/* Left Wing: Speech-To-Text Dictation Mic Button */}
              <button
                type="button"
                onClick={startMicMode}
                onMouseEnter={() => setIsMicHovered(true)}
                onMouseLeave={() => setIsMicHovered(false)}
                title="Mic Mode: Dictate text to insert into active input"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px 6px',
                  borderRadius: '4px',
                  transition: 'transform 0.15s ease, opacity 0.15s ease',
                  transform: isMicHovered ? 'scale(1.1)' : 'scale(1.0)',
                  opacity: isMicHovered ? 0.95 : 0.55,
                }}
              >
                <svg width="12" height="13" viewBox="0 0 16 16" fill="#FFFFFF">
                  <path d="M8 10c1.66 0 3-1.34 3-3V3c0-1.66-1.34-3-3-3S5 1.34 5 3v4c0 1.66 1.34 3 3 3z" />
                  <path d="M12.5 7c0 2.48-2.02 4.5-4.5 4.5S3.5 9.48 3.5 7H2c0 3.03 2.25 5.54 5.17 5.92V15h1.66v-2.08C11.75 12.54 14 10.03 14 7h-1.5z" />
                </svg>
              </button>

              {/* Center: MacBook Camera & Sensor Hardware Clearance Zone */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {/* Hardware Camera lens reflection */}
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#0A0C10',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                  }}
                />
                {/* Subtle indicator light */}
                <div
                  style={{
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    backgroundColor: isHovered ? 'rgba(56, 189, 248, 0.6)' : 'transparent',
                    transition: 'background-color 0.2s ease',
                  }}
                />
              </div>

              {/* Right Wing: Circular Agent Trigger Button */}
              <button
                type="button"
                onClick={startAgentMode}
                onMouseEnter={() => setIsAgentHovered(true)}
                onMouseLeave={() => setIsAgentHovered(false)}
                title="Agent Mode: Orchestrate autonomous tools"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px 6px',
                  borderRadius: '4px',
                  transition: 'transform 0.15s ease',
                  transform: isAgentHovered ? 'scale(1.12)' : 'scale(1.0)',
                }}
              >
                <div
                  style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    border: `1px solid ${isAgentHovered ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.22)'}`,
                    backgroundColor: isAgentHovered ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      backgroundColor: isAgentHovered ? '#FFFFFF' : 'rgba(255, 255, 255, 0.75)',
                    }}
                  />
                </div>
              </button>
            </div>
          )}

          {/* ==================================================================== */}
          {/* 2. MIC LISTENING STATE: Audio Waveform + Active Speech               */}
          {/* ==================================================================== */}
          {currentState === 'MIC_LISTENING' && (
            <div
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: '100%',
                gap: '10px',
              }}
            >
              {/* Equalizer bars + mic icon */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="11" height="11" viewBox="0 0 16 16" fill="#EF4444">
                  <path d="M8 10c1.66 0 3-1.34 3-3V3c0-1.66-1.34-3-3-3S5 1.34 5 3v4c0 1.66 1.34 3 3 3z" />
                  <path d="M12.5 7c0 2.48-2.02 4.5-4.5 4.5S3.5 9.48 3.5 7H2c0 3.03 2.25 5.54 5.17 5.92V15h1.66v-2.08C11.75 12.54 14 10.03 14 7h-1.5z" />
                </svg>

                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '14px' }}>
                  {[12, 18, 14, 16].map((baseH, i) => (
                    <div
                      key={i}
                      style={{
                        width: '2px',
                        height: `${Math.min(18, Math.max(5, baseH * audioLevel))}px`,
                        backgroundColor: '#FFFFFF',
                        borderRadius: '1px',
                        transition: 'height 0.08s ease',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Status / Live text */}
              <div
                style={{
                  flex: 1,
                  fontSize: '11.5px',
                  color: '#FFFFFF',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'tail',
                }}
              >
                {speechText || 'Listening… speak to transcribe'}
              </div>

              {/* Stop Button */}
              <button
                type="button"
                onClick={stopMicModeAndInsert}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '2px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
                <span style={{ fontSize: '10px', color: '#FFFFFF', fontWeight: 600 }}>Stop</span>
              </button>
            </div>
          )}

          {/* ==================================================================== */}
          {/* 3. MIC TRANSCRIBING STATE                                            */}
          {/* ==================================================================== */}
          {currentState === 'MIC_TRANSCRIBING' && (
            <div
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: '100%',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: '#38BDF8',
                    boxShadow: '0 0 6px #38BDF8',
                  }}
                />
                <span style={{ fontSize: '11.5px', color: '#FFFFFF', fontWeight: 600 }}>
                  Transcribing & inserting…
                </span>
              </div>
            </div>
          )}

          {/* ==================================================================== */}
          {/* 4. AGENT LISTENING / PROMPT INPUT STATE                             */}
          {/* ==================================================================== */}
          {currentState === 'AGENT_LISTENING' && (
            <div
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: '100%',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px' }}>✨</span>
              </div>

              {showPromptInput ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitAgentPrompt(agentInputPrompt);
                  }}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <input
                    type="text"
                    autoFocus
                    placeholder="Enter agent task or ask Murmur..."
                    value={agentInputPrompt}
                    onChange={(e) => setAgentInputPrompt(e.target.value)}
                    style={{
                      flex: 1,
                      backgroundColor: 'rgba(255, 255, 255, 0.12)',
                      border: '1px solid rgba(255, 255, 255, 0.16)',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontSize: '11px',
                      color: '#FFFFFF',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      backgroundColor: '#9333EA',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontSize: '10.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Run
                  </button>
                </form>
              ) : (
                <div style={{ flex: 1, fontSize: '11.5px', color: '#FFFFFF' }}>Listening for command…</div>
              )}

              <button
                type="button"
                onClick={cancelExecution}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.5)',
                  cursor: 'pointer',
                  fontSize: '11px',
                }}
              >
                ✕
              </button>
            </div>
          )}

          {/* ==================================================================== */}
          {/* 5. AGENT WORKING STATE: Tool Badge + Live Step Status                */}
          {/* ==================================================================== */}
          {currentState === 'AGENT_WORKING' && (
            <div
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: '100%',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: '11px' }}>⚙️</span>

                {currentTool && (
                  <span
                    style={{
                      fontSize: '9px',
                      fontWeight: 700,
                      color: '#FFFFFF',
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      letterSpacing: '0.04em',
                      flexShrink: 0,
                    }}
                  >
                    {currentTool.toUpperCase()}
                  </span>
                )}

                <span
                  style={{
                    fontSize: '11px',
                    color: 'rgba(255, 255, 255, 0.95)',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {stepDetail}
                </span>
              </div>

              <button
                type="button"
                onClick={cancelExecution}
                title="Cancel Task"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.5)',
                  cursor: 'pointer',
                  fontSize: '10px',
                  padding: '2px',
                }}
              >
                ✕
              </button>
            </div>
          )}

          {/* ==================================================================== */}
          {/* 6. AGENT PERMISSION CHECKPOINT: Allow & Deny Buttons                 */}
          {/* ==================================================================== */}
          {currentState === 'AGENT_PERMISSION' && (
            <div
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: '100%',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                <span style={{ color: '#F59E0B', fontSize: '11px' }}>🛡️</span>
                <span
                  style={{
                    fontSize: '11px',
                    color: '#FFFFFF',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {pendingPermission?.action || 'Confirm action'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => handleRespondPermission(true)}
                  style={{
                    backgroundColor: '#10B981',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    fontSize: '10px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Allow
                </button>
                <button
                  type="button"
                  onClick={() => handleRespondPermission(false)}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.18)',
                    color: 'rgba(255, 255, 255, 0.85)',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '2px 7px',
                    fontSize: '10px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Deny
                </button>
              </div>
            </div>
          )}

          {/* ==================================================================== */}
          {/* 7. SUCCESS STATE: Checkmark + Link                                  */}
          {/* ==================================================================== */}
          {currentState === 'SUCCESS' && (
            <div
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: '100%',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    backgroundColor: '#10B981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                    fontSize: '9px',
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  ✓
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {statusMessage || 'Completed'}
                </span>
              </div>

              {completedURL && (
                <a
                  href={completedURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.18)',
                    color: '#FFFFFF',
                    borderRadius: '12px',
                    padding: '2px 8px',
                    fontSize: '10px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    flexShrink: 0,
                  }}
                >
                  <span>{completedTitle || 'Open'}</span>
                  <span>↗</span>
                </a>
              )}

              <button
                type="button"
                onClick={() => updateState('IDLE')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#10B981',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          )}

          {/* ==================================================================== */}
          {/* 8. ERROR STATE                                                      */}
          {/* ==================================================================== */}
          {currentState === 'ERROR' && (
            <div
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: '100%',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                <span style={{ color: '#EF4444', fontSize: '11px' }}>⚠️</span>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'rgba(255, 255, 255, 0.95)',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {statusMessage || 'An error occurred'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => updateState('IDLE')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.6)',
                  cursor: 'pointer',
                  fontSize: '11px',
                }}
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
