'use client';

import React, { useState } from 'react';
import Image from 'next/image';

export type NavTab = 'agent' | 'connectors' | 'insights' | 'tools' | 'users';

export interface HistoryItem {
  id: string;
  title: string;
  time: string;
  group: 'today' | 'yesterday' | 'previous';
}

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onOpenSettings: () => void;
  onNewChat?: () => void;
  conversations?: HistoryItem[];
  currentConversationId?: string;
  onSelectConversation?: (id: string) => void;
  onDeleteConversation?: (id: string) => void;
  connectorsCount?: number;
  usersCount?: number;
  currentUser?: { name?: string; email?: string; picture?: string | null } | null;
  onOpenLogin?: () => void;
  isProcessing?: boolean;
  isAdminUnlocked?: boolean;
}

export function Sidebar({
  activeTab,
  onTabChange,
  onOpenSettings,
  onNewChat,
  conversations = [
    { id: 'c1', title: 'Recursion explanation in C', time: '14:20', group: 'today' },
    { id: 'c2', title: 'Google Calendar sync review', time: '11:05', group: 'today' },
    { id: 'c3', title: 'Vercel deployment logs', time: 'Yesterday', group: 'yesterday' },
    { id: 'c4', title: 'Notion task organization', time: '3 days ago', group: 'previous' },
  ],
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  connectorsCount = 5,
  usersCount = 0,
  currentUser = null,
  onOpenLogin,
  isProcessing = false,
  isAdminUnlocked = false,
}: SidebarProps) {
  const [hoveredConvId, setHoveredConvId] = useState<string | null>(null);

  const todayItems = conversations.filter((c) => c.group === 'today');
  const yesterdayItems = conversations.filter((c) => c.group === 'yesterday');
  const previousItems = conversations.filter((c) => c.group === 'previous');

  return (
    <aside
      style={{
        width: '240px',
        minWidth: '240px',
        height: '100%',
        backgroundColor: 'var(--murmur-sidebar)',
        borderRight: '1px solid var(--murmur-border)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '20px 14px 16px 14px',
        userSelect: 'none',
        position: 'relative',
        zIndex: 10,
      }}
    >
      {/* Top Header & Brand */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {/* Brand Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '18px',
            paddingLeft: '4px',
            paddingRight: '4px',
          }}
        >
          <div
            onClick={() => {
              onTabChange('agent');
              onNewChat?.();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '7px',
                overflow: 'hidden',
                backgroundColor: 'var(--murmur-plum)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 1px 3px rgba(40, 8, 19, 0.15)',
              }}
            >
              <Image
                src="/murmur-logo.png"
                alt="Murmur Logo"
                width={26}
                height={26}
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
            <span
              style={{
                fontSize: '15px',
                fontWeight: '700',
                letterSpacing: '-0.02em',
                color: 'var(--murmur-text-primary)',
              }}
            >
              Murmur
            </span>
          </div>

          {/* New Chat Icon Button */}
          <button
            type="button"
            onClick={() => {
              onTabChange('agent');
              onNewChat?.();
            }}
            title="Start new conversation (⌘N)"
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              border: '1px solid var(--murmur-border)',
              backgroundColor: 'transparent',
              color: 'var(--murmur-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--murmur-sidebar-hover)';
              e.currentTarget.style.color = 'var(--murmur-plum)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--murmur-text-secondary)';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </button>
        </div>

        {/* New Conversation Button */}
        <button
          type="button"
          onClick={() => {
            onTabChange('agent');
            onNewChat?.();
          }}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 12px',
            borderRadius: '10px',
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--murmur-border)',
            color: 'var(--murmur-text-primary)',
            fontSize: '13px',
            fontWeight: '600',
            letterSpacing: '-0.01em',
            cursor: 'pointer',
            boxShadow: 'var(--murmur-shadow-subtle)',
            marginBottom: '16px',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--murmur-plum)';
            e.currentTarget.style.transform = 'translateY(-0.5px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--murmur-border)';
            e.currentTarget.style.transform = 'none';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
          <span>New Chat</span>
        </button>

        {/* Primary Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '18px' }}>
          {[
            {
              tab: 'agent' as NavTab,
              label: 'Workspace',
              icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              ),
            },
            {
              tab: 'connectors' as NavTab,
              label: 'Connections',
              badge: connectorsCount,
              icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v6" />
                  <path d="m19 13-4-4" />
                  <path d="m5 13 4-4" />
                  <path d="M8 12v5a4 4 0 0 0 8 0v-5Z" />
                  <path d="M12 21v1" />
                </svg>
              ),
            },
            {
              tab: 'tools' as NavTab,
              label: 'Tools Directory',
              icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                </svg>
              ),
            },
            {
              tab: 'users' as NavTab,
              label: 'Users Directory',
              badge: usersCount > 0 ? usersCount : undefined,
              icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              ),
            },
          ].map((item) => {
            const isActive = activeTab === item.tab;
            return (
              <button
                key={item.tab}
                type="button"
                onClick={() => onTabChange(item.tab)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  borderRadius: '8px',
                  backgroundColor: isActive ? 'var(--murmur-sidebar-active)' : 'transparent',
                  color: isActive ? 'var(--murmur-plum)' : 'var(--murmur-text-secondary)',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.12s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'var(--murmur-sidebar-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                  <span style={{ opacity: isActive ? 1 : 0.75 }}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {(item.tab === 'tools' || item.tab === 'users') && !isAdminUnlocked && (
                    <span
                      title="Admin password protected"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0.65,
                        color: isActive ? 'var(--murmur-plum)' : 'var(--murmur-text-tertiary)',
                      }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </span>
                  )}
                  {item.badge !== undefined && (
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '1px 6px',
                        borderRadius: '10px',
                        backgroundColor: isActive ? 'rgba(45, 13, 25, 0.1)' : 'rgba(107, 94, 85, 0.12)',
                        color: isActive ? 'var(--murmur-plum)' : 'var(--murmur-text-secondary)',
                        fontWeight: 600,
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div style={{ height: '1px', backgroundColor: 'var(--murmur-border)', marginBottom: '14px' }} />

        {/* Conversation History List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            paddingRight: '2px',
          }}
        >
          {todayItems.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'var(--murmur-text-muted)',
                  padding: '2px 8px 6px',
                }}
              >
                Today
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {todayItems.map((c) => (
                  <div
                    key={c.id}
                    onMouseEnter={() => setHoveredConvId(c.id)}
                    onMouseLeave={() => setHoveredConvId(null)}
                    onClick={() => {
                      onTabChange('agent');
                      onSelectConversation?.(c.id);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      borderRadius: '7px',
                      fontSize: '12.5px',
                      color: currentConversationId === c.id ? 'var(--murmur-plum)' : 'var(--murmur-text-secondary)',
                      fontWeight: currentConversationId === c.id ? 600 : 400,
                      backgroundColor: currentConversationId === c.id ? 'var(--murmur-sidebar-active)' : hoveredConvId === c.id ? 'var(--murmur-sidebar-hover)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.1s ease',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.title}
                    </span>
                    {hoveredConvId === c.id && onDeleteConversation && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConversation(c.id);
                        }}
                        title="Delete conversation"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--murmur-text-tertiary)',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {yesterdayItems.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'var(--murmur-text-muted)',
                  padding: '6px 8px 4px',
                }}
              >
                Yesterday
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {yesterdayItems.map((c) => (
                  <div
                    key={c.id}
                    onMouseEnter={() => setHoveredConvId(c.id)}
                    onMouseLeave={() => setHoveredConvId(null)}
                    onClick={() => {
                      onTabChange('agent');
                      onSelectConversation?.(c.id);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      borderRadius: '7px',
                      fontSize: '12.5px',
                      color: currentConversationId === c.id ? 'var(--murmur-plum)' : 'var(--murmur-text-secondary)',
                      fontWeight: currentConversationId === c.id ? 600 : 400,
                      backgroundColor: currentConversationId === c.id ? 'var(--murmur-sidebar-active)' : hoveredConvId === c.id ? 'var(--murmur-sidebar-hover)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.1s ease',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.title}
                    </span>
                    {hoveredConvId === c.id && onDeleteConversation && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConversation(c.id);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--murmur-text-tertiary)',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {previousItems.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'var(--murmur-text-muted)',
                  padding: '6px 8px 4px',
                }}
              >
                Previous 7 Days
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {previousItems.map((c) => (
                  <div
                    key={c.id}
                    onMouseEnter={() => setHoveredConvId(c.id)}
                    onMouseLeave={() => setHoveredConvId(null)}
                    onClick={() => {
                      onTabChange('agent');
                      onSelectConversation?.(c.id);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      borderRadius: '7px',
                      fontSize: '12.5px',
                      color: currentConversationId === c.id ? 'var(--murmur-plum)' : 'var(--murmur-text-secondary)',
                      fontWeight: currentConversationId === c.id ? 600 : 400,
                      backgroundColor: currentConversationId === c.id ? 'var(--murmur-sidebar-active)' : hoveredConvId === c.id ? 'var(--murmur-sidebar-hover)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.1s ease',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.title}
                    </span>
                    {hoveredConvId === c.id && onDeleteConversation && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConversation(c.id);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--murmur-text-tertiary)',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Footer: Settings & Account */}
      <div
        style={{
          borderTop: '1px solid var(--murmur-border)',
          paddingTop: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        <button
          type="button"
          onClick={onOpenSettings}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
            padding: '7px 8px',
            borderRadius: '8px',
            backgroundColor: 'transparent',
            color: 'var(--murmur-text-secondary)',
            border: 'none',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'background-color 0.12s ease, color 0.12s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--murmur-sidebar-hover)';
            e.currentTarget.style.color = 'var(--murmur-plum)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--murmur-text-secondary)';
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.75 }}>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>Settings</span>
        </button>

        {/* User profile row or Sign in with Google */}
        {currentUser && currentUser.email ? (
          <div
            onClick={onOpenSettings}
            title={`${currentUser.name || currentUser.email} (${currentUser.email}) - Settings`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 8px',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'background-color 0.12s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--murmur-sidebar-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
              {currentUser.picture ? (
                <img
                  src={currentUser.picture}
                  alt={currentUser.name || 'User'}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--murmur-plum)',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: '700',
                    flexShrink: 0,
                  }}
                >
                  {(currentUser.name || currentUser.email || 'A').charAt(0).toUpperCase()}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span
                  style={{
                    fontSize: '12.5px',
                    fontWeight: 600,
                    color: 'var(--murmur-text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {currentUser.name || currentUser.email.split('@')[0]}
                </span>
                <span
                  style={{
                    fontSize: '10.5px',
                    color: 'var(--murmur-text-tertiary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {currentUser.email}
                </span>
              </div>
            </div>

            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#10B981',
                flexShrink: 0,
              }}
              title="Active session"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenLogin}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '8px 10px',
              borderRadius: '8px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--murmur-border)',
              color: 'var(--murmur-text-primary)',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: 'var(--murmur-shadow-subtle)',
              transition: 'all 0.15s ease',
              width: '100%',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--murmur-plum)';
              e.currentTarget.style.transform = 'translateY(-0.5px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--murmur-border)';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <div
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '4px',
                backgroundColor: 'var(--murmur-plum)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <span>Sign In to Murmur</span>
          </button>
        )}
      </div>
    </aside>
  );
}
