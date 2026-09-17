'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { MurmurUser } from '@/app/api/users/route';

interface UsersViewProps {
  onOpenLoginModal?: () => void;
  currentUserEmail?: string;
}

export function UsersView({ onOpenLoginModal, currentUserEmail }: UsersViewProps) {
  const [users, setUsers] = useState<MurmurUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'google' | 'primary'>('all');
  const [selectedUser, setSelectedUser] = useState<MurmurUser | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchUsers = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        setUsers(data.users);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;
      if (filterType === 'google') return user.provider === 'google';
      if (filterType === 'primary') return user.isPrimary;
      return true;
    });
  }, [users, searchQuery, filterType]);

  const primaryUser = users.find((u) => u.isPrimary) || users[0];

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Recently';
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--murmur-canvas)',
        overflowY: 'auto',
        overflowX: 'hidden',
        position: 'relative',
        padding: '32px 36px 60px 36px',
      }}
    >
      {/* Header Section */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: '28px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'var(--murmur-plum)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h1
              style={{
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--murmur-text-primary)',
                letterSpacing: '-0.025em',
                margin: 0,
              }}
            >
              Users Directory
            </h1>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: 'rgba(45, 13, 25, 0.08)',
                color: 'var(--murmur-plum)',
              }}
            >
              {users.length} Registered
            </span>
          </div>
          <p
            style={{
              fontSize: '13.5px',
              color: 'var(--murmur-text-secondary)',
              marginTop: '6px',
              marginBottom: 0,
              maxWidth: '560px',
            }}
          >
            Accounts stored in the Supabase PostgreSQL database. Users who authenticate with Google on the website automatically appear here.
          </p>
        </div>

        {/* Top Right Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={fetchUsers}
            disabled={isRefreshing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '9px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--murmur-border)',
              color: 'var(--murmur-text-primary)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: isRefreshing ? 'wait' : 'pointer',
              boxShadow: 'var(--murmur-shadow-subtle)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--murmur-plum)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--murmur-border)';
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none',
              }}
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (onOpenLoginModal) {
                onOpenLoginModal();
              } else {
                window.location.href = '/api/auth/google/login?return_to=' + encodeURIComponent('/?tab=users');
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '9px',
              backgroundColor: 'var(--murmur-plum)',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(45, 13, 25, 0.25)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.92';
              e.currentTarget.style.transform = 'translateY(-0.5px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.transform = 'none';
            }}
          >
            {/* Google Icon */}
            <svg width="15" height="15" viewBox="0 0 24 24">
              <path
                fill="#ffffff"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#ffffff"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#ffffff"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#ffffff"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Log In with Google</span>
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          marginBottom: '26px',
        }}
      >
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            padding: '16px 18px',
            border: '1px solid var(--murmur-border)',
            boxShadow: 'var(--murmur-shadow-subtle)',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--murmur-text-muted)', letterSpacing: '0.04em' }}>
            Total Database Users
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--murmur-text-primary)', marginTop: '4px' }}>
            {users.length}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--murmur-text-secondary)', marginTop: '2px' }}>
            Pulled from Supabase
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            padding: '16px 18px',
            border: '1px solid var(--murmur-border)',
            boxShadow: 'var(--murmur-shadow-subtle)',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--murmur-text-muted)', letterSpacing: '0.04em' }}>
            Primary Account
          </div>
          <div
            style={{
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--murmur-text-primary)',
              marginTop: '6px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {primaryUser ? primaryUser.name : 'None'}
          </div>
          <div
            style={{
              fontSize: '12px',
              color: 'var(--murmur-text-secondary)',
              marginTop: '2px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {primaryUser ? primaryUser.email : 'No primary user'}
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            padding: '16px 18px',
            border: '1px solid var(--murmur-border)',
            boxShadow: 'var(--murmur-shadow-subtle)',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--murmur-text-muted)', letterSpacing: '0.04em' }}>
            Database Sync State
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#10B981',
                boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.2)',
              }}
            />
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--murmur-text-primary)' }}>
              Supabase Connected
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--murmur-text-secondary)', marginTop: '2px' }}>
            Realtime PostgREST API
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '18px',
          flexWrap: 'wrap',
        }}
      >
        {/* Search input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--murmur-border)',
            borderRadius: '10px',
            padding: '7px 12px',
            width: '100%',
            maxWidth: '320px',
            boxShadow: 'var(--murmur-shadow-subtle)',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--murmur-text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              fontSize: '13px',
              color: 'var(--murmur-text-primary)',
              width: '100%',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--murmur-text-tertiary)',
                cursor: 'pointer',
                padding: '2px',
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--murmur-surface)',
            padding: '3px',
            borderRadius: '8px',
            border: '1px solid var(--murmur-border)',
          }}
        >
          {[
            { id: 'all', label: 'All Users' },
            { id: 'google', label: 'Google OAuth' },
            { id: 'primary', label: 'Primary' },
          ].map((tab) => {
            const isActive = filterType === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterType(tab.id as any)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                  color: isActive ? 'var(--murmur-plum)' : 'var(--murmur-text-secondary)',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Users List / Table */}
      {isLoading ? (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid var(--murmur-border)',
            padding: '60px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              border: '3px solid rgba(45, 13, 25, 0.1)',
              borderTopColor: 'var(--murmur-plum)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <span style={{ fontSize: '13.5px', color: 'var(--murmur-text-secondary)' }}>
            Loading users from database...
          </span>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid var(--murmur-border)',
            padding: '50px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'var(--murmur-surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--murmur-text-tertiary)',
              marginBottom: '12px',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--murmur-text-primary)', margin: 0 }}>
            No users found
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--murmur-text-secondary)', marginTop: '4px', maxWidth: '360px' }}>
            {searchQuery
              ? `No users match "${searchQuery}". Try a different search term.`
              : 'Sign in with Google on the Murmur Agent website to add your first user record.'}
          </p>
        </div>
      ) : (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid var(--murmur-border)',
            overflow: 'hidden',
            boxShadow: 'var(--murmur-shadow-subtle)',
          }}
        >
          {/* Table Header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(220px, 2fr) 1.2fr 1.2fr 1fr',
              padding: '12px 20px',
              borderBottom: '1px solid var(--murmur-border)',
              backgroundColor: 'var(--murmur-surface)',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--murmur-text-muted)',
            }}
          >
            <div>User Profile</div>
            <div>Auth Provider</div>
            <div>Last Active / Login</div>
            <div style={{ textAlign: 'right' }}>Status</div>
          </div>

          {/* User Rows */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredUsers.map((u, index) => {
              const isCurrentSession = currentUserEmail?.toLowerCase() === u.email.toLowerCase();
              return (
                <div
                  key={u.id || u.email}
                  onClick={() => setSelectedUser(u)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(220px, 2fr) 1.2fr 1.2fr 1fr',
                    alignItems: 'center',
                    padding: '14px 20px',
                    borderBottom: index < filteredUsers.length - 1 ? '1px solid var(--murmur-border)' : 'none',
                    cursor: 'pointer',
                    transition: 'background-color 0.12s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--murmur-sidebar-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {/* User Profile Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    {u.picture ? (
                      <img
                        src={u.picture}
                        alt={u.name}
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '1.5px solid var(--murmur-border)',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--murmur-plum)',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '13px',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {u.name ? u.name.charAt(0).toUpperCase() : u.email.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '13.5px',
                            fontWeight: 600,
                            color: 'var(--murmur-text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {u.name}
                        </span>
                        {u.isPrimary && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(45, 13, 25, 0.08)',
                              color: 'var(--murmur-plum)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.03em',
                            }}
                          >
                            Primary
                          </span>
                        )}
                        {isCurrentSession && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(16, 185, 129, 0.12)',
                              color: '#059669',
                              textTransform: 'uppercase',
                              letterSpacing: '0.03em',
                            }}
                          >
                            You
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--murmur-text-secondary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {u.email}
                      </div>
                    </div>
                  </div>

                  {/* Auth Provider */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {u.provider === 'google' ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          />
                        </svg>
                        <span style={{ fontSize: '12.5px', color: 'var(--murmur-text-primary)', fontWeight: 500 }}>
                          Google Workspace
                        </span>
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        <span style={{ fontSize: '12.5px', color: 'var(--murmur-text-primary)', fontWeight: 500 }}>
                          Supabase Profile
                        </span>
                      </>
                    )}
                  </div>

                  {/* Last Login / Activity */}
                  <div>
                    <span style={{ fontSize: '12.5px', color: 'var(--murmur-text-secondary)' }}>
                      {formatDate(u.lastLoginAt)}
                    </span>
                  </div>

                  {/* Status Indicator */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                    <span
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        backgroundColor: '#10B981',
                      }}
                    />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#059669' }}>
                      Connected
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* User Details Drawer / Modal */}
      {selectedUser && (
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
          onClick={() => setSelectedUser(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '460px',
              padding: '24px',
              boxShadow: 'var(--murmur-shadow-modal)',
              border: '1px solid var(--murmur-border-solid)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--murmur-text-primary)' }}>
                User Details
              </h3>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--murmur-text-tertiary)',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
              {selectedUser.picture ? (
                <img
                  src={selectedUser.picture}
                  alt={selectedUser.name}
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--murmur-plum)',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    fontWeight: 700,
                  }}
                >
                  {selectedUser.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--murmur-text-primary)' }}>
                  {selectedUser.name}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--murmur-text-secondary)' }}>
                  {selectedUser.email}
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                backgroundColor: 'var(--murmur-surface)',
                borderRadius: '12px',
                padding: '14px',
                border: '1px solid var(--murmur-border)',
                marginBottom: '20px',
                fontSize: '13px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--murmur-text-secondary)' }}>User ID / Account:</span>
                <span style={{ fontWeight: 600, color: 'var(--murmur-text-primary)', wordBreak: 'break-all', maxWidth: '240px', textAlign: 'right' }}>
                  {selectedUser.id}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--murmur-text-secondary)' }}>Provider:</span>
                <span style={{ fontWeight: 600, color: 'var(--murmur-text-primary)', textTransform: 'capitalize' }}>
                  {selectedUser.provider}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--murmur-text-secondary)' }}>First Joined:</span>
                <span style={{ fontWeight: 600, color: 'var(--murmur-text-primary)' }}>
                  {formatDate(selectedUser.createdAt)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--murmur-text-secondary)' }}>Last Activity:</span>
                <span style={{ fontWeight: 600, color: 'var(--murmur-text-primary)' }}>
                  {formatDate(selectedUser.lastLoginAt)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedUser(null)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '10px',
                backgroundColor: 'var(--murmur-plum)',
                color: '#FFFFFF',
                border: 'none',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
