'use client';

import React, { useState } from 'react';

interface AdminPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetTabName?: string;
  onSuccess: () => void;
  currentUserEmail?: string | null;
}

export function AdminPasswordModal({
  isOpen,
  onClose,
  targetTabName = 'this section',
  onSuccess,
  currentUserEmail,
}: AdminPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isUnauthorizedUser = Boolean(
    currentUserEmail && currentUserEmail.toLowerCase() !== 'arunkumarpatil24j2007@gmail.com'
  );

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (isUnauthorizedUser) {
      setErrorMessage('Access denied. Only arunkumarpatil24j2007@gmail.com has permission.');
      return;
    }

    const pwd = password.trim();
    if (!pwd) {
      setErrorMessage('Please enter the administrator password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Incorrect admin password.');
        setIsLoading(false);
        return;
      }

      // Success
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('murmur_admin_unlocked', 'true');
      }
      setIsLoading(false);
      setPassword('');
      onSuccess();
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Network error. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(28, 11, 18, 0.45)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '18px',
          width: '100%',
          maxWidth: '420px',
          boxShadow: '0 20px 48px -10px rgba(45, 13, 25, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.08)',
          border: '1px solid var(--murmur-border-solid)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'murmurModalIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '22px 24px 16px',
            borderBottom: '1px solid var(--murmur-border)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'rgba(45, 13, 25, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--murmur-plum)',
                border: '1px solid rgba(45, 13, 25, 0.15)',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div>
              <h2
                style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color: 'var(--murmur-text-primary)',
                  letterSpacing: '-0.02em',
                  margin: 0,
                }}
              >
                Admin Authorization Required
              </h2>
              <p
                style={{
                  fontSize: '12px',
                  color: 'var(--murmur-text-secondary)',
                  margin: '2px 0 0 0',
                }}
              >
                Access to {targetTabName} is restricted
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              backgroundColor: 'var(--murmur-sidebar-hover)',
              border: 'none',
              color: 'var(--murmur-text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        {isUnauthorizedUser ? (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#B91C1C',
                borderRadius: '10px',
                padding: '14px 16px',
                fontSize: '12.5px',
                lineHeight: 1.5,
              }}
            >
              <strong>Access Restricted</strong>
              <p style={{ margin: '6px 0 0 0', fontSize: '12px' }}>
                You are currently signed in as <strong>{currentUserEmail}</strong>. Only the administrator account (<strong style={{ color: 'var(--murmur-plum)' }}>arunkumarpatil24j2007@gmail.com</strong>) has access to {targetTabName}.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                backgroundColor: 'var(--murmur-plum)',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                backgroundColor: 'rgba(45, 13, 25, 0.04)',
                border: '1px solid rgba(45, 13, 25, 0.1)',
                borderRadius: '10px',
                padding: '10px 12px',
                fontSize: '12px',
                color: 'var(--murmur-text-secondary)',
                lineHeight: 1.45,
              }}
            >
              Only administrator (<strong style={{ color: 'var(--murmur-plum)' }}>arunkumarpatil24j2007@gmail.com</strong>) is authorized to access Tools & Users. Please enter your administrator password to unlock.
            </div>

            {errorMessage && (
              <div
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#DC2626',
                  borderRadius: '8px',
                  padding: '9px 12px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{errorMessage}</span>
              </div>
            )}

          <div>
            <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--murmur-text-secondary)', display: 'block', marginBottom: '5px' }}>
              Administrator Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoFocus
                placeholder="Enter admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 38px 9px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--murmur-border)',
                  fontSize: '13.5px',
                  outline: 'none',
                  backgroundColor: 'var(--murmur-surface)',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--murmur-text-tertiary)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPassword ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '9px',
                borderRadius: '8px',
                border: '1px solid var(--murmur-border)',
                backgroundColor: 'transparent',
                color: 'var(--murmur-text-secondary)',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              style={{
                flex: 2,
                padding: '9px',
                borderRadius: '8px',
                backgroundColor: 'var(--murmur-plum)',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: isLoading ? 'wait' : 'pointer',
                boxShadow: '0 2px 6px rgba(45, 13, 25, 0.2)',
              }}
            >
              {isLoading ? 'Verifying...' : 'Unlock Access'}
            </button>
          </div>
        </form>
      )}
      </div>
    </div>
  );
}
