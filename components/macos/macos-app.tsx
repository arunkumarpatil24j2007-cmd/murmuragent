'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar, type NavTab } from './sidebar';
import { AgentConsole } from './agent-console';
import { ToolsView } from './tools-view';
import { ConnectorsView } from './connectors-view';
import { UsersView } from './users-view';
import { SettingsModal } from './settings-modal';
import { LoginModal } from './login-modal';
import { AdminPasswordModal } from './admin-password-modal';
import { AgentNotch } from '@/components/agent-notch';
import { AtmosphericGlow } from '@/components/atmospheric-glow';

interface UserSession {
  email: string;
  name: string;
  picture?: string | null;
}

export function MacOSApp() {
  const [activeTab, setActiveTab] = useState<NavTab>('agent');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isAdminPasswordModalOpen, setIsAdminPasswordModalOpen] = useState(false);
  const [pendingAdminTab, setPendingAdminTab] = useState<NavTab | null>(null);
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('murmur_admin_unlocked') === 'true';
    }
    return false;
  });
  const [connectedCount, setConnectedCount] = useState<number>(5);
  const [usersCount, setUsersCount] = useState<number>(0);
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [conversationKey, setConversationKey] = useState<number>(1);
  const [conversations, setConversations] = useState<Array<{ id: string; title: string; time: string; group: 'today' | 'yesterday' | 'previous' }>>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | undefined>(undefined);

  // Fetch conversations for authenticated user
  const fetchConversations = () => {
    fetch('/api/sessions')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.sessions)) {
          setConversations(
            data.sessions.map((s: any) => ({
              id: s.id,
              title: s.title || 'New Conversation',
              time: s.updatedAt ? new Date(s.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent',
              group: s.group || 'today',
            }))
          );
        } else {
          setConversations([]);
        }
      })
      .catch(() => setConversations([]));
  };

  // Fetch initial session & user profile
  const fetchSession = () => {
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data?.authenticated && data?.email) {
          setCurrentUser({
            email: data.email,
            name: data.name || data.email.split('@')[0],
            picture: data.picture || null,
          });
          fetchConversations();
        } else {
          setCurrentUser(null);
          setConversations([]);
          // Prompt for login whenever user opens the app without an active session
          if (typeof window !== 'undefined') {
            const hasDismissed = sessionStorage.getItem('murmur_guest_dismissed');
            if (!hasDismissed) {
              setIsLoginModalOpen(true);
            }
          }
        }
      })
      .catch(() => {
        setCurrentUser(null);
        setConversations([]);
      });
  };

  // Fetch initial users count
  const fetchUsersCount = () => {
    fetch('/api/users')
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.total === 'number') {
          setUsersCount(data.total);
        }
      })
      .catch(() => {});
  };

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

    fetchSession();
    fetchUsersCount();
  }, []);

  // Handle tab switching with admin protection for tools & users
  const handleTabChange = (tab: NavTab) => {
    if ((tab === 'tools' || tab === 'users') && !isAdminUnlocked) {
      setPendingAdminTab(tab);
      setIsAdminPasswordModalOpen(true);
      return;
    }
    setActiveTab(tab);
  };

  const handleAdminSuccess = () => {
    setIsAdminUnlocked(true);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('murmur_admin_unlocked', 'true');
    }
    if (pendingAdminTab) {
      setActiveTab(pendingAdminTab);
      setPendingAdminTab(null);
    }
    fetchUsersCount();
  };

  // Native tab switching & URL query param bridge support
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab') as NavTab | null;
    if (tabParam && ['agent', 'connectors', 'tools', 'users'].includes(tabParam)) {
      if ((tabParam === 'tools' || tabParam === 'users') && !isAdminUnlocked) {
        setPendingAdminTab(tabParam);
        setIsAdminPasswordModalOpen(true);
      } else {
        setActiveTab(tabParam);
      }
    }
  }, [isAdminUnlocked]);

  const handleNewChat = () => {
    setCurrentConversationId(undefined);
    setConversationKey((prev) => prev + 1);
    fetchConversations();
  };

  const handleSelectConversation = (id: string) => {
    setCurrentConversationId(id);
    setConversationKey((prev) => prev + 1);
  };

  const handleDeleteConversation = async (id: string) => {
    await fetch(`/api/sessions?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (currentConversationId === id) {
      handleNewChat();
    }
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
      {/* Central Interactive MacBook Notch */}
      <AgentNotch />

      {/* Atmospheric Ambient Glow Layer */}
      <AtmosphericGlow />

      {/* Minimalist Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onNewChat={handleNewChat}
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        connectorsCount={connectedCount}
        usersCount={usersCount}
        currentUser={currentUser}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        isAdminUnlocked={isAdminUnlocked}
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
            conversationId={currentConversationId}
            onNewConversation={handleNewChat}
            userName={currentUser?.name || 'Arunkumar'}
          />
        )}

        {activeTab === 'connectors' && (
          <ConnectorsView
            onConnectChange={(count) => setConnectedCount(count)}
          />
        )}

        {activeTab === 'tools' && (
          <ToolsView
            isAdminUnlocked={isAdminUnlocked}
            onUnlockRequest={() => {
              setPendingAdminTab('tools');
              setIsAdminPasswordModalOpen(true);
            }}
          />
        )}

        {activeTab === 'users' && (
          <UsersView
            onOpenLoginModal={() => setIsLoginModalOpen(true)}
            currentUserEmail={currentUser?.email}
            isAdminUnlocked={isAdminUnlocked}
            onUnlockRequest={() => {
              setPendingAdminTab('users');
              setIsAdminPasswordModalOpen(true);
            }}
          />
        )}
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Admin Password Modal */}
      <AdminPasswordModal
        isOpen={isAdminPasswordModalOpen}
        onClose={() => {
          setIsAdminPasswordModalOpen(false);
          setPendingAdminTab(null);
        }}
        targetTabName={
          pendingAdminTab === 'tools'
            ? 'Tools Directory'
            : pendingAdminTab === 'users'
            ? 'Users Directory'
            : 'this section'
        }
        onSuccess={handleAdminSuccess}
        currentUserEmail={currentUser?.email}
      />

      {/* Login Modal for Visitors & Murmur App Accounts */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => {
          setIsLoginModalOpen(false);
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('murmur_guest_dismissed', 'true');
          }
        }}
        onSuccess={() => {
          fetchSession();
          fetchUsersCount();
        }}
        returnTo={`/?tab=${activeTab}`}
      />
    </div>
  );
}
