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
  targetTabName = 'Tools Directory',
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

  const displayCategory = targetTabName.toUpperCase();

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(28, 11, 18, 0.45)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
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
          backgroundColor: '#FCFAF8',
          borderRadius: '28px',
          width: '100%',
          maxWidth: '560px',
          boxShadow: '0 24px 60px -15px rgba(35, 12, 22, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          border: '1px solid rgba(230, 220, 215, 0.7)',
          padding: '34px 38px 30px 38px',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          animation: 'murmurModalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Top Header Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#8E847E',
            }}
          >
            {displayCategory}
          </span>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 0, 0, 0.04)',
              border: 'none',
              color: '#827873',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.08)';
              e.currentTarget.style.color = '#1B1115';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
              e.currentTarget.style.color = '#827873';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Big Bold Headline & Subtitle */}
        {isUnauthorizedUser ? (
          <>
            <h2
              style={{
                fontSize: '36px',
                fontWeight: 800,
                color: '#1B1115',
                letterSpacing: '-0.035em',
                lineHeight: 1.1,
                margin: '0 0 6px 0',
              }}
            >
              Nice try.
            </h2>
            <p
              style={{
                fontSize: '20px',
                fontWeight: 500,
                color: '#4A4045',
                letterSpacing: '-0.02em',
                margin: '0 0 22px 0',
              }}
            >
              This part’s for the boss only.
            </p>

            {/* Content Row: Pink Card + Buddy Character */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '14px',
                marginBottom: '26px',
              }}
            >
              {/* Pink Card */}
              <div
                style={{
                  flex: 1,
                  backgroundColor: '#FDF3F3',
                  border: '1px solid #FCE4E4',
                  borderRadius: '18px',
                  padding: '16px 18px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px',
                }}
              >
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '12px',
                    backgroundColor: '#FCE6E6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#250E18',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '12.5px', lineHeight: 1.45 }}>
                  <span style={{ color: '#685F61' }}>You’re signed in as</span>
                  <span style={{ fontWeight: 700, color: '#1B1115', fontSize: '13.5px', wordBreak: 'break-all' }}>
                    {currentUserEmail}
                  </span>
                  <div style={{ marginTop: '5px', color: '#685F61', fontSize: '12px' }}>
                    Only the admin account{' '}
                    <div><strong style={{ color: '#1B1115' }}>(arunkumarpatil24j2007@gmail.com)</strong></div>
                    can access the {targetTabName}.
                  </div>
                </div>
              </div>

              {/* Right Illustration */}
              <div
                style={{
                  width: '135px',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img
                  src="/admin-guard-buddy.png"
                  alt="Not today buddy"
                  style={{
                    width: '100%',
                    height: 'auto',
                    objectFit: 'contain',
                    mixBlendMode: 'multiply',
                  }}
                />
              </div>
            </div>

            {/* Bottom Row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <button
                type="button"
                onClick={onClose}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '11px 26px',
                  borderRadius: '9999px',
                  backgroundColor: '#250E18',
                  color: '#FFFFFF',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(37, 14, 24, 0.22)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.backgroundColor = '#381525';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.backgroundColor = '#250E18';
                }}
              >
                <span>Got it</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>

              <div
                style={{
                  textAlign: 'right',
                  fontSize: '9.5px',
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: '#A39994',
                  lineHeight: 1.45,
                }}
              >
                <div>SOME TOOLS</div>
                <div>REQUIRE A BIGGER HAT.</div>
              </div>
            </div>
          </>
        ) : (
          /* Password Entry Screen for Admin */
          <form onSubmit={handleSubmit}>
            <h2
              style={{
                fontSize: '36px',
                fontWeight: 800,
                color: '#1B1115',
                letterSpacing: '-0.035em',
                lineHeight: 1.1,
                margin: '0 0 6px 0',
              }}
            >
              Admin Access.
            </h2>
            <p
              style={{
                fontSize: '19px',
                fontWeight: 500,
                color: '#4A4045',
                letterSpacing: '-0.02em',
                margin: '0 0 22px 0',
              }}
            >
              Enter your password to unlock the {targetTabName}.
            </p>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '14px',
                marginBottom: '22px',
              }}
            >
              {/* Form Input Box */}
              <div
                style={{
                  flex: 1,
                  backgroundColor: '#FDF3F3',
                  border: '1px solid #FCE4E4',
                  borderRadius: '18px',
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '10px',
                      backgroundColor: '#FCE6E6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#250E18',
                      flexShrink: 0,
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#8E847E', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Administrator Key
                    </div>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#1B1115' }}>
                      arunkumarpatil24j2007@gmail.com
                    </div>
                  </div>
                </div>

                <div style={{ position: 'relative', marginTop: '2px' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    placeholder="Enter admin password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 36px 9px 12px',
                      borderRadius: '10px',
                      border: '1px solid rgba(220, 190, 190, 0.7)',
                      fontSize: '13.5px',
                      outline: 'none',
                      backgroundColor: '#FFFFFF',
                      color: '#1B1115',
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
                      color: '#8E847E',
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
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Right Illustration */}
              <div
                style={{
                  width: '135px',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img
                  src="/admin-guard-buddy.png"
                  alt="Not today buddy"
                  style={{
                    width: '100%',
                    height: 'auto',
                    objectFit: 'contain',
                    mixBlendMode: 'multiply',
                  }}
                />
              </div>
            </div>

            {errorMessage && (
              <div
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#DC2626',
                  borderRadius: '10px',
                  padding: '9px 14px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px',
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

            {/* Bottom Row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '11px 26px',
                  borderRadius: '9999px',
                  backgroundColor: '#250E18',
                  color: '#FFFFFF',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: isLoading ? 'wait' : 'pointer',
                  boxShadow: '0 4px 14px rgba(37, 14, 24, 0.22)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.backgroundColor = '#381525';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.backgroundColor = '#250E18';
                }}
              >
                <span>{isLoading ? 'Verifying...' : 'Unlock Access'}</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>

              <div
                style={{
                  textAlign: 'right',
                  fontSize: '9.5px',
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: '#A39994',
                  lineHeight: 1.45,
                }}
              >
                <div>SOME TOOLS</div>
                <div>REQUIRE A BIGGER HAT.</div>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
