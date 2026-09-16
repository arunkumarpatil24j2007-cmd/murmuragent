'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar, type NavTab } from './sidebar';
import { AgentConsole } from './agent-console';
import { ToolsView } from './tools-view';
import { ConnectorsView } from './connectors-view';
import { SettingsModal } from './settings-modal';

export function MacOSApp() {
  const [activeTab, setActiveTab] = useState<NavTab>('agent');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [connectedCount, setConnectedCount] = useState<number>(5);
  const [conversationKey, setConversationKey] = useState<number>(1);

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

  // Native tab switching bridge support
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') as NavTab;
      if (tabParam && ['agent', 'connectors', 'tools'].includes(tabParam)) {
        setActiveTab(tabParam);
      }

      (window as any).murmurSetTab = (tab: NavTab) => {
        if (['agent', 'connectors', 'tools'].includes(tab)) {
          setActiveTab(tab);
        }
      };
    }
  }, []);

  const handleNewChat = () => {
    setActiveTab('agent');
    setConversationKey((k) => k + 1);
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        maxWidth: '100vw',
        maxHeight: '100vh',
        backgroundColor: 'var(--murmur-canvas)',
        display: 'flex',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Minimalist Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onNewChat={handleNewChat}
        connectorsCount={connectedCount}
      />

      {/* Main Workspace Canvas */}
      <main
        style={{
          flex: 1,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--murmur-canvas)',
          overflow: 'hidden',
          minWidth: 0,
          minHeight: 0,
        }}
      >
        {activeTab === 'agent' && (
          <AgentConsole
            key={conversationKey}
            onNewConversation={handleNewChat}
          />
        )}

        {activeTab === 'connectors' && (
          <ConnectorsView
            onConnectChange={(count) => setConnectedCount(count)}
          />
        )}

        {activeTab === 'tools' && (
          <ToolsView />
        )}
      </main>

      {/* Redesigned Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
