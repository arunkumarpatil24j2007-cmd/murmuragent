'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Sidebar, type NavTab } from './sidebar';
import { TopCards } from './top-cards';
import { AgentConsole } from './agent-console';
import { ToolsView } from './tools-view';
import { ConnectorsView } from './connectors-view';
import { InsightsView } from './insights-view';
import { SettingsModal } from './settings-modal';
import { AgentNotch, type AgentNotchState } from '../agent-notch';

export function MacOSApp() {
  const [activeTab, setActiveTab] = useState<NavTab>('agent');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [agentStatus, setAgentStatus] = useState<'idle' | 'thinking' | 'executing' | 'error'>('idle');
  const [notchState, setNotchState] = useState<AgentNotchState>('IDLE');
  const [isEmbedded, setIsEmbedded] = useState(false);
  const [connectedCount, setConnectedCount] = useState<number>(5);
  
  const composerInputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch initial connectors count
  useEffect(() => {
    fetch('/api/connectors')
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.connected === 'number') {
          setConnectedCount(data.connected);
        }
      })
      .catch(() => {});
  }, []);

  // Detect embedded mode inside native macOS app
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('embedded') === 'true' || params.has('embedded') || (window as any).isMurmurNative) {
        setIsEmbedded(true);
      }
      const tabParam = params.get('tab') as NavTab;
      if (tabParam && ['agent', 'connectors', 'insights', 'tools'].includes(tabParam)) {
        setActiveTab(tabParam);
      }

      // Allow native macOS app to switch tabs
      (window as any).murmurSetTab = (tab: NavTab) => {
        if (['agent', 'connectors', 'insights', 'tools'].includes(tab)) {
          setActiveTab(tab);
        }
      };
    }
  }, []);

  const handleDictateClick = () => {
    setActiveTab('agent');
    setNotchState((prev) => (prev === 'IDLE' ? 'LISTENING' : 'IDLE'));
    setTimeout(() => {
      composerInputRef.current?.focus();
    }, 50);
  };

  return (
    <div style={isEmbedded ? {
      width: '100%',
      height: '100vh',
      backgroundColor: 'var(--mac-main-bg)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    } : {
      width: '100vw',
      height: '100vh',
      backgroundColor: '#EAE1D7', // Soft warm desktop background behind window
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* MacBook Hardware Notch Integrated Agent UI (Standalone web only) */}
      {!isEmbedded && (
        <AgentNotch
          state={notchState}
          onStateChange={setNotchState}
          onActionConfirm={() => {
            setNotchState('SUCCESS');
            setTimeout(() => setNotchState('IDLE'), 1800);
          }}
          onCancel={() => setNotchState('IDLE')}
        />
      )}

      {/* macOS Window Frame */}
      <div style={isEmbedded ? {
        width: '100%',
        height: '100%',
        backgroundColor: 'var(--mac-main-bg)',
        display: 'flex',
        overflow: 'hidden',
      } : {
        width: '100%',
        maxWidth: '1280px',
        height: '100%',
        maxHeight: '880px',
        backgroundColor: 'var(--mac-main-bg)',
        borderRadius: 'var(--mac-window-radius)',
        boxShadow: 'var(--mac-window-shadow)',
        border: '1px solid rgba(40, 8, 19, 0.08)',
        display: 'flex',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Left macOS Sidebar (Standalone web only) */}
        {!isEmbedded && (
          <Sidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onOpenSettings={() => setIsSettingsOpen(true)}
            toolsCount={26}
            connectorsCount={connectedCount}
            isProcessing={agentStatus === 'thinking' || agentStatus === 'executing'}
          />
        )}

        {/* Right Main Content View */}
        <main style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--mac-main-bg)',
          padding: '24px 32px',
          overflowY: 'auto',
          minWidth: 0,
        }}>
          {/* Top Window Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
            flexShrink: 0,
          }}>
            <div>
              <h1 style={{
                fontSize: '24px',
                fontWeight: '800',
                letterSpacing: '-0.03em',
                color: 'var(--mac-plum)',
                marginBottom: '4px',
              }}>
                Welcome back, Arunkumar
              </h1>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                color: 'var(--mac-text-secondary)',
                fontWeight: '500',
              }}>
                <span>Press</span>
                <kbd style={{
                  backgroundColor: '#EFE5D8',
                  border: '1px solid #DFD2C3',
                  borderRadius: '5px',
                  padding: '1px 6px',
                  fontSize: '11px',
                  fontWeight: '600',
                  color: 'var(--mac-plum)',
                }}>
                  ⌥ Space
                </kbd>
                <span>anywhere to dictate / execute agent</span>
              </div>
            </div>

            {/* Embedded Sub-tabs Navigation */}
            {isEmbedded && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'rgba(40, 8, 19, 0.05)',
                padding: '3px',
                borderRadius: '20px',
                gap: '2px',
              }}>
                {(['agent', 'connectors', 'tools', 'insights'] as NavTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: '5px 14px',
                      borderRadius: '16px',
                      border: 'none',
                      backgroundColor: activeTab === tab ? '#FFFFFF' : 'transparent',
                      color: activeTab === tab ? 'var(--mac-plum)' : 'var(--mac-text-secondary)',
                      fontSize: '12px',
                      fontWeight: activeTab === tab ? '600' : '500',
                      cursor: 'pointer',
                      boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {tab === 'agent' ? 'Agent Console' : tab === 'connectors' ? `Connectors (${connectedCount})` : tab === 'tools' ? 'Tools Directory' : 'Telemetry'}
                  </button>
                ))}
              </div>
            )}

            {/* Header Right Action Pill + Avatar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              {/* Dictate / Run Agent Pill button matching reference */}
              <button
                onClick={handleDictateClick}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'var(--mac-plum)',
                  color: '#FFFFFF',
                  padding: '9px 18px',
                  borderRadius: '30px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(40, 8, 19, 0.15)',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--mac-plum-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--mac-plum)'}
              >
                {/* Microphone icon */}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
                <span>Dictate</span>
              </button>

              {/* Avatar circle */}
              <div
                onClick={() => setIsSettingsOpen(true)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--mac-plum)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700',
                  fontSize: '14px',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                A
              </div>
            </div>
          </div>

          {/* Top Banner & Metrics Cards */}
          <TopCards
            toolsCount={21}
            activeTasksCount={agentStatus !== 'idle' ? 1 : 0}
          />

          {/* Subheader: Section label + Search input */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
            flexShrink: 0,
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: '700',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--mac-text-tertiary)',
            }}>
              {activeTab === 'agent'
                ? 'Today'
                : activeTab === 'connectors'
                ? 'Cloud Connectors & Plugins'
                : activeTab === 'insights'
                ? 'Telemetry'
                : 'Tool Directory'}
            </div>

            {/* Search Pill Input matching reference screenshot */}
            <div style={{
              position: 'relative',
              width: '240px',
            }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search recordings..."
                style={{
                  width: '100%',
                  backgroundColor: '#FFFFFF',
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
                strokeLinecap="round"
                strokeLinejoin="round"
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

          {/* Dynamic Active Tab View */}
          {activeTab === 'agent' && (
            <AgentConsole
              onStatusChange={setAgentStatus}
              composerRef={composerInputRef}
              searchQuery={searchQuery}
            />
          )}

          {activeTab === 'connectors' && <ConnectorsView />}

          {activeTab === 'insights' && <InsightsView />}

          {activeTab === 'tools' && <ToolsView />}
        </main>

        {/* Settings Modal */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      </div>
    </div>
  );
}
