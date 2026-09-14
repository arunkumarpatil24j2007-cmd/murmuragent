'use client';

import React, { useState, useEffect } from 'react';

export type AgentNotchState =
  | 'IDLE'
  | 'LISTENING'
  | 'TRANSCRIBING'
  | 'PROCESSING'
  | 'WORKING'
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

// Default action card matching reference Image 4
const DEFAULT_EMAIL_ACTION: ActionCardData = {
  type: 'email',
  serviceIcon: 'gmail',
  title: 'New Message',
  to: 'david@company.com',
  subject: 'Project update and Thursday sync',
  preview: 'Hi David,\n\nThe designs look great. Let\'s sync Thursday.\n\nBest',
  actionButtonText: 'Send',
};

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
  // Internal state when not externally controlled
  const [internalState, setInternalState] = useState<AgentNotchState>('IDLE');
  const [isHovered, setIsHovered] = useState(false);
  const [demoAction, setDemoAction] = useState<ActionCardData>(DEFAULT_EMAIL_ACTION);

  const currentState = controlledState || internalState;

  const updateState = (newState: AgentNotchState) => {
    if (onStateChange) {
      onStateChange(newState);
    } else {
      setInternalState(newState);
    }
  };

  // Auto-dismiss timers for SUCCESS and ERROR states
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (currentState === 'SUCCESS') {
      timer = setTimeout(() => {
        updateState('IDLE');
      }, 1500);
    } else if (currentState === 'ERROR') {
      timer = setTimeout(() => {
        updateState('IDLE');
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [currentState]);

  // Global shortcut to toggle notch demo / activate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌥ + N to cycle state for demonstration
      if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        const states: AgentNotchState[] = [
          'IDLE',
          'LISTENING',
          'TRANSCRIBING',
          'PROCESSING',
          'WORKING',
          'SUCCESS',
          'ERROR',
        ];
        const nextIdx = (states.indexOf(currentState) + 1) % states.length;
        updateState(states[nextIdx]);
      } else if (e.key === 'Escape' && currentState !== 'IDLE') {
        updateState('IDLE');
        onCancel?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentState]);

  const activeAction = externalActionDetails || demoAction;

  // Render authentic 3D Glossy Earth Globe (exact match to Image 3 & 4)
  const renderGlobeIcon = () => (
    <div
      style={{
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 35%, #93C5FD 0%, #3B82F6 45%, #1D4ED8 80%, #1E3A8A 100%)',
        position: 'relative',
        boxShadow: '0 0 8px rgba(59, 130, 246, 0.4), inset -1px -1px 3px rgba(0, 0, 0, 0.6), inset 1px 1px 2px rgba(255, 255, 255, 0.7)',
        overflow: 'hidden',
        flexShrink: 0,
      }}
      className="animate-globe-glow"
      title="Murmur System Agent"
    >
      {/* Cloud swirl overlay */}
      <svg
        viewBox="0 0 20 20"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0.85,
        }}
      >
        <path
          d="M 4 8 Q 8 6 12 7 Q 15 8 17 6 Q 16 11 11 11 Q 7 12 4 8 Z"
          fill="#FFFFFF"
          opacity="0.85"
        />
        <path
          d="M 2 13 Q 6 10 9 14 Q 13 15 15 13 Q 13 17 8 16 Q 4 16 2 13 Z"
          fill="#FFFFFF"
          opacity="0.75"
        />
      </svg>
      {/* Gloss specular reflection */}
      <div
        style={{
          position: 'absolute',
          top: '2px',
          left: '3px',
          width: '7px',
          height: '4px',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0) 100%)',
          transform: 'rotate(-25deg)',
        }}
      />
    </div>
  );

  // Width & height transitions based on state
  const getDimensions = () => {
    switch (currentState) {
      case 'IDLE':
        return { width: isHovered ? '208px' : '196px', minHeight: '34px', padding: '0 14px' };
      case 'LISTENING':
        return { width: '330px', minHeight: '48px', padding: '0 16px' };
      case 'TRANSCRIBING':
        return { width: '310px', minHeight: '48px', padding: '0 16px' };
      case 'PROCESSING':
        return { width: '270px', minHeight: '46px', padding: '0 16px' };
      case 'WORKING':
        return { width: '420px', minHeight: '280px', padding: '16px 20px 18px 20px' };
      case 'SUCCESS':
        return { width: '240px', minHeight: '44px', padding: '0 16px' };
      case 'ERROR':
        return { width: '350px', minHeight: '46px', padding: '0 16px' };
    }
  };

  const dim = getDimensions();

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
      {/* The Central Notch Surface (Directly under top bezel) */}
      <div
        style={{
          position: 'relative',
          top: 'env(safe-area-inset-top, 0px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pointerEvents: 'auto',
        }}
      >
        {/* Left Notch Ear Fillet (Seamless outward corner curve to top bezel) */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{
            position: 'absolute',
            top: 0,
            left: '-12px',
            pointerEvents: 'none',
          }}
        >
          <path
            d="M 12 0 C 4 0 0 6 0 12 L 12 12 Z"
            fill="#050506"
          />
        </svg>

        {/* Right Notch Ear Fillet (Seamless outward corner curve to top bezel) */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{
            position: 'absolute',
            top: 0,
            right: '-12px',
            pointerEvents: 'none',
          }}
        >
          <path
            d="M 0 0 C 8 0 12 6 12 12 L 0 12 Z"
            fill="#050506"
          />
        </svg>

        {/* Main Expanding Dynamic Island Notch Body */}
        <div
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={() => {
            if (currentState === 'IDLE') {
              updateState('LISTENING');
              onClick?.();
            }
          }}
          style={{
            width: dim.width,
            minHeight: dim.minHeight,
            padding: dim.padding,
            backgroundColor: '#050506',
            backgroundImage: 'linear-gradient(180deg, rgba(20, 20, 24, 0.4) 0%, rgba(5, 5, 6, 0.95) 100%)',
            borderBottomLeftRadius: currentState === 'WORKING' ? '24px' : '16px',
            borderBottomRightRadius: currentState === 'WORKING' ? '24px' : '16px',
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderTop: 'none',
            boxShadow: currentState === 'IDLE'
              ? '0 4px 14px rgba(0, 0, 0, 0.4)'
              : '0 24px 60px rgba(0, 0, 0, 0.7), 0 6px 18px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: currentState === 'WORKING' ? 'column' : 'row',
            alignItems: currentState === 'WORKING' ? 'stretch' : 'center',
            justifyContent: currentState === 'IDLE' ? 'space-between' : 'flex-start',
            cursor: currentState === 'IDLE' ? 'pointer' : 'default',
            userSelect: 'none',
            overflow: 'hidden',
          }}
          className="notch-spring"
        >
          {/* ==================================================================== */}
          {/* 1. IDLE STATE: Authentic MacBook Notch + Globe on Left */}
          {/* ==================================================================== */}
          {currentState === 'IDLE' && (
            <div
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: '34px',
              }}
            >
              {/* Globe on left notch wing (Image 3) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {renderGlobeIcon()}
              </div>

              {/* Hardware camera pinhole & green/amber privacy indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                {/* Hardware camera lens reflection */}
                <div
                  style={{
                    width: '9px',
                    height: '9px',
                    borderRadius: '50%',
                    backgroundColor: '#0F1115',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    boxShadow: 'inset 0 0 2px rgba(0, 0, 0, 0.9)',
                  }}
                />
                {/* Subtle activity dot */}
                <div
                  style={{
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    backgroundColor: isHovered ? '#38BDF8' : 'rgba(255, 255, 255, 0.25)',
                    transition: 'background-color 0.2s ease',
                  }}
                />
              </div>
            </div>
          )}

          {/* ==================================================================== */}
          {/* 2. LISTENING STATE: Voice Waveform + Red Pulse + Stop button (Image 1) */}
          {/* ==================================================================== */}
          {currentState === 'LISTENING' && (
            <div
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: '48px',
                gap: '12px',
              }}
            >
              {/* Left: Red recording pulse ring */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: '#EF4444',
                    }}
                    className="animate-record-pulse"
                  />
                </div>

                {/* Animated 4-bar audio waveform */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '16px' }}>
                  <span style={{ width: '3px', backgroundColor: '#FFFFFF', borderRadius: '2px', animation: 'waveBar 0.9s infinite ease-in-out', animationDelay: '0.1s' }} />
                  <span style={{ width: '3px', backgroundColor: '#FFFFFF', borderRadius: '2px', animation: 'waveBar 1.2s infinite ease-in-out', animationDelay: '0.3s' }} />
                  <span style={{ width: '3px', backgroundColor: '#FFFFFF', borderRadius: '2px', animation: 'waveBar 0.8s infinite ease-in-out', animationDelay: '0.5s' }} />
                  <span style={{ width: '3px', backgroundColor: '#FFFFFF', borderRadius: '2px', animation: 'waveBar 1.1s infinite ease-in-out', animationDelay: '0.2s' }} />
                </div>
              </div>

              {/* Center: "Listening..." / Live speech transcript */}
              <div
                style={{
                  flex: 1,
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#FFFFFF',
                  letterSpacing: '-0.01em',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {externalTranscript || externalMessage || 'Listening…'}
              </div>

              {/* Right: Rounded Stop Recording Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateState('WORKING');
                }}
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.22)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)'}
                title="Stop listening and execute"
              >
                <div
                  style={{
                    width: '9px',
                    height: '9px',
                    borderRadius: '2px',
                    backgroundColor: '#FFFFFF',
                  }}
                />
              </button>
            </div>
          )}

          {/* ==================================================================== */}
          {/* 3. TRANSCRIBING STATE */}
          {/* ==================================================================== */}
          {currentState === 'TRANSCRIBING' && (
            <div
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: '48px',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    borderTopColor: '#38BDF8',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
                <span style={{ fontSize: '13px', fontWeight: '500', color: '#E2E8F0' }}>
                  {externalMessage || 'Transcribing speech…'}
                </span>
              </div>
            </div>
          )}

          {/* ==================================================================== */}
          {/* 4. PROCESSING STATE */}
          {/* ==================================================================== */}
          {currentState === 'PROCESSING' && (
            <div
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '46px',
                gap: '10px',
              }}
            >
              <div
                style={{
                  width: '14px',
                  height: '14px',
                  border: '2px solid rgba(255, 255, 255, 0.2)',
                  borderTopColor: '#60A5FA',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite',
                }}
              />
              <span style={{ fontSize: '13px', fontWeight: '500', color: '#F1F5F9' }}>
                {externalMessage || 'Murmur is thinking…'}
              </span>
            </div>
          )}

          {/* ==================================================================== */}
          {/* 5. WORKING / AGENTIC ACTION CARD (Matching Image 4) */}
          {/* ==================================================================== */}
          {currentState === 'WORKING' && (
            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              {/* Notch Top Bar: Globe on left + dismiss/collapse on right */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: '2px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {renderGlobeIcon()}
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#94A3B8', letterSpacing: '0.02em' }}>
                    ● Murmur Agent
                  </span>
                </div>

                <button
                  onClick={() => updateState('IDLE')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255, 255, 255, 0.5)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    padding: '2px',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#FFFFFF'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)'}
                  title="Collapse notch"
                >
                  ✕
                </button>
              </div>

              {/* Embedded Native Action Card (Exact match to Image 4) */}
              <div
                style={{
                  backgroundColor: '#1E1E22',
                  borderRadius: '16px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                {/* Header: Service Icon + Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Gmail Icon */}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4Z"
                      fill="#EA4335"
                    />
                    <path
                      d="M2 6L12 13L22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6Z"
                      fill="#FBBC04"
                      opacity="0.2"
                    />
                    <path
                      d="M12 13L2 6V18H4V8L12 13.5L20 8V18H22V6L12 13Z"
                      fill="#FFFFFF"
                    />
                  </svg>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#FFFFFF' }}>
                    {activeAction.title || 'New Message'}
                  </span>
                </div>

                {/* Recipient line with chip */}
                {activeAction.to && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      paddingBottom: '8px',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '500' }}>To</span>
                    <span
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        color: '#E2E8F0',
                        fontSize: '11px',
                        padding: '3px 10px',
                        borderRadius: '20px',
                        fontWeight: '500',
                      }}
                    >
                      {activeAction.to}
                    </span>
                  </div>
                )}

                {/* Subject line */}
                {activeAction.subject && (
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#F8FAFC',
                      paddingBottom: '4px',
                    }}
                  >
                    {activeAction.subject}
                  </div>
                )}

                {/* Body Preview */}
                {activeAction.preview && (
                  <div
                    style={{
                      fontSize: '12px',
                      lineHeight: '1.5',
                      color: '#CBD5E1',
                      whiteSpace: 'pre-line',
                      minHeight: '52px',
                    }}
                  >
                    {activeAction.preview}
                  </div>
                )}

                {/* Action Button: macOS Accent Blue Pill (Matching Image 4) */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onActionConfirm?.();
                      updateState('SUCCESS');
                    }}
                    style={{
                      backgroundColor: '#2563EB',
                      color: '#FFFFFF',
                      border: 'none',
                      padding: '7px 22px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1D4ED8'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2563EB'}
                  >
                    {activeAction.actionButtonText || 'Send'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================================== */}
          {/* 6. SUCCESS STATE: Done Confirmation */}
          {/* ==================================================================== */}
          {currentState === 'SUCCESS' && (
            <div
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '44px',
                gap: '8px',
              }}
            >
              <div
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: '#10B981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  fontSize: '11px',
                  fontWeight: '700',
                }}
              >
                ✓
              </div>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#FFFFFF' }}>
                {externalMessage || 'Done'}
              </span>
            </div>
          )}

          {/* ==================================================================== */}
          {/* 7. ERROR STATE: Calm restrained error (Matching Image 2) */}
          {/* ==================================================================== */}
          {currentState === 'ERROR' && (
            <div
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: '46px',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#F59E0B', fontSize: '15px' }}>⚠️</span>
                <span style={{ fontSize: '12px', fontWeight: '500', color: '#F1F5F9' }}>
                  {externalMessage || 'No speech detected. Please try again.'}
                </span>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateState('IDLE');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.6)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  padding: '4px',
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#FFFFFF'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)'}
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
