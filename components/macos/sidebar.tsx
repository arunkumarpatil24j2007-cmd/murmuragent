'use client';

import React from 'react';
import Image from 'next/image';

export type NavTab = 'agent' | 'connectors' | 'insights' | 'tools';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onOpenSettings: () => void;
  toolsCount?: number;
  connectorsCount?: number;
  isProcessing?: boolean;
}

export function Sidebar({
  activeTab,
  onTabChange,
  onOpenSettings,
  toolsCount = 26,
  connectorsCount = 5,
  isProcessing = false,
}: SidebarProps) {
  return (
    <aside style={{
      width: '240px',
      minWidth: '240px',
      backgroundColor: 'var(--mac-sidebar-bg)',
      borderRight: '1px solid var(--mac-sidebar-border)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '16px 14px',
      userSelect: 'none',
    }}>
      {/* Top section */}
      <div>
        {/* macOS Window Traffic Lights */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '24px',
          paddingLeft: '2px',
          paddingTop: '2px',
        }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: 'var(--mac-traffic-close)',
            boxShadow: '0 0.5px 1px rgba(0,0,0,0.2)',
            cursor: 'pointer',
          }} />
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: 'var(--mac-traffic-minimize)',
            boxShadow: '0 0.5px 1px rgba(0,0,0,0.2)',
            cursor: 'pointer',
          }} />
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: 'var(--mac-traffic-maximize)',
            boxShadow: '0 0.5px 1px rgba(0,0,0,0.2)',
            cursor: 'pointer',
          }} />
        </div>

        {/* Murmur Logo & Title */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '26px',
          paddingLeft: '4px',
        }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            overflow: 'hidden',
            backgroundColor: '#F5EBE1',
            boxShadow: '0 1px 3px rgba(40, 8, 19, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Image
              src="/murmur-logo.png"
              alt="Murmur Logo"
              width={38}
              height={38}
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>

          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}>
              <span style={{
                fontSize: '14px',
                fontWeight: '800',
                letterSpacing: '0.04em',
                color: 'var(--mac-plum)',
                textTransform: 'uppercase',
              }}>
                Murmur
              </span>
              <span style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                backgroundColor: 'var(--mac-tag-pink)',
                display: 'inline-block',
              }} />
            </div>
            <div style={{
              fontSize: '11px',
              fontWeight: '500',
              color: 'var(--mac-text-secondary)',
              marginTop: '1px',
            }}>
              Flow Agent
            </div>
          </div>
        </div>

        {/* Navigation list */}
        <nav style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          {/* Dictation / Agent Tab */}
          <button
            onClick={() => onTabChange('agent')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '10px 12px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: activeTab === 'agent' ? 'var(--mac-sidebar-active)' : 'transparent',
              color: 'var(--mac-plum)',
              fontSize: '13px',
              fontWeight: activeTab === 'agent' ? '600' : '500',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Mic / Agent Icon */}
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
              <span>Agent</span>
            </div>

            {/* Indicator pill */}
            {activeTab === 'agent' && (
              <div style={{
                width: '14px',
                height: '5px',
                borderRadius: '3px',
                backgroundColor: isProcessing ? 'var(--mac-tag-pink)' : 'var(--mac-plum)',
                opacity: 0.8,
              }} />
            )}
          </button>

          {/* Connectors / Plugins Tab (NEW) */}
          <button
            onClick={() => onTabChange('connectors')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '10px 12px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: activeTab === 'connectors' ? 'var(--mac-sidebar-active)' : 'transparent',
              color: activeTab === 'connectors' ? 'var(--mac-plum)' : 'var(--mac-text-secondary)',
              fontSize: '13px',
              fontWeight: activeTab === 'connectors' ? '600' : '500',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Plug / Connector Icon */}
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v6" />
                <path d="m19 13-4-4" />
                <path d="m5 13 4-4" />
                <path d="M8 12v5a4 4 0 0 0 8 0v-5Z" />
                <path d="M12 21v1" />
              </svg>
              <span>Connectors</span>
            </div>
            <span style={{
              fontSize: '10px',
              fontWeight: '700',
              padding: '2px 7px',
              borderRadius: '8px',
              backgroundColor: activeTab === 'connectors' ? 'var(--mac-plum)' : 'rgba(16, 185, 129, 0.12)',
              color: activeTab === 'connectors' ? '#FFFFFF' : '#059669',
            }}>
              {connectorsCount} Live
            </span>
          </button>

          {/* Insights / Runs Tab */}
          <button
            onClick={() => onTabChange('insights')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '10px 12px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: activeTab === 'insights' ? 'var(--mac-sidebar-active)' : 'transparent',
              color: activeTab === 'insights' ? 'var(--mac-plum)' : 'var(--mac-text-secondary)',
              fontSize: '13px',
              fontWeight: activeTab === 'insights' ? '600' : '500',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Bar chart icon */}
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" x2="18" y1="20" y2="10" />
                <line x1="12" x2="12" y1="20" y2="4" />
                <line x1="6" x2="6" y1="20" y2="14" />
              </svg>
              <span>Insights</span>
            </div>
          </button>

          {/* Tools Tab */}
          <button
            onClick={() => onTabChange('tools')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '10px 12px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: activeTab === 'tools' ? 'var(--mac-sidebar-active)' : 'transparent',
              color: activeTab === 'tools' ? 'var(--mac-plum)' : 'var(--mac-text-secondary)',
              fontSize: '13px',
              fontWeight: activeTab === 'tools' ? '600' : '500',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Puzzle/Wrench icon */}
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="7" height="7" x="3" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="14" rx="1" />
                <rect width="7" height="7" x="3" y="14" rx="1" />
              </svg>
              <span>Tools</span>
            </div>
            <span style={{
              fontSize: '10px',
              fontWeight: '600',
              padding: '2px 6px',
              borderRadius: '8px',
              backgroundColor: 'rgba(40, 8, 19, 0.08)',
              color: 'var(--mac-plum)',
            }}>
              {toolsCount}
            </span>
          </button>
        </nav>
      </div>

      {/* Bottom section */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        {/* Settings button matching screenshot */}
        <button
          onClick={onOpenSettings}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '10px 12px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: 'var(--mac-sidebar-hover)',
            color: 'var(--mac-plum)',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background-color 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Gear icon */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span>Settings</span>
          </div>

          {/* Chevron right */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {/* Profile Card */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          paddingLeft: '4px',
        }}>
          {/* Avatar with dark plum background and bold white A */}
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: 'var(--mac-plum)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '700',
            fontSize: '13px',
            flexShrink: 0,
          }}>
            A
          </div>

          <div style={{ overflow: 'hidden' }}>
            <div style={{
              fontSize: '13px',
              fontWeight: '700',
              color: 'var(--mac-plum)',
              lineHeight: 1.2,
            }}>
              Arunkumar
            </div>
            <div style={{
              fontSize: '11px',
              fontWeight: '500',
              color: 'var(--mac-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              marginTop: '1px',
            }}>
              <span>Account Active</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
