'use client';

import React, { useState, useEffect } from 'react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  returnTo?: string;
  onSuccess?: () => void;
}

type AuthMethod = 'otp' | 'password';

export function LoginModal({ isOpen, onClose, returnTo = '/?tab=users', onSuccess }: LoginModalProps) {
  const [authMethod, setAuthMethod] = useState<AuthMethod>('otp');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  
  // OTP state
  const [otpEmail, setOtpEmail] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isOtpLoading, setIsOtpLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  // Password state
  const [passwordMode, setPasswordMode] = useState<'signin' | 'signup'>('signin');
  const [pwdEmail, setPwdEmail] = useState('');
  const [pwdPassword, setPwdPassword] = useState('');
  const [pwdName, setPwdName] = useState('');
  const [isPwdSubmitting, setIsPwdSubmitting] = useState(false);

  // General state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((t) => Math.max(0, t - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  if (!isOpen) return null;

  const handleGoogleLogin = () => {
    setIsGoogleLoading(true);
    const loginUrl = `/api/auth/google/login?return_to=${encodeURIComponent(returnTo)}`;
    window.location.href = loginUrl;
  };

  // OTP Send
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    const emailToUse = otpEmail.trim();
    if (!emailToUse || !emailToUse.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsOtpLoading(true);
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToUse }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Failed to send verification code. Please try again.');
        setIsOtpLoading(false);
        return;
      }

      setOtpSent(true);
      setResendTimer(60);
      setInfoMessage(`A verification code was sent to ${emailToUse}`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Network error. Please try again.');
    } finally {
      setIsOtpLoading(false);
    }
  };

  // OTP Verify
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    const tokenToUse = otpToken.trim();
    if (!tokenToUse || tokenToUse.length < 4) {
      setErrorMessage('Please enter the verification code you received.');
      return;
    }

    setIsOtpLoading(true);
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: otpEmail.trim(),
          token: tokenToUse,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Invalid or expired verification code.');
        setIsOtpLoading(false);
        return;
      }

      if (onSuccess) {
        onSuccess();
      }
      onClose();
      window.location.reload();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Network error. Please try again.');
      setIsOtpLoading(false);
    }
  };

  // Password Login / Signup
  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    if (!pwdEmail || !pwdPassword) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    if (pwdPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setIsPwdSubmitting(true);
    try {
      const res = await fetch('/api/auth/email-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: pwdEmail,
          password: pwdPassword,
          name: passwordMode === 'signup' ? pwdName : undefined,
          mode: passwordMode === 'signup' ? 'signup' : 'login',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Authentication failed. Please try again.');
        setIsPwdSubmitting(false);
        return;
      }

      if (onSuccess) {
        onSuccess();
      }
      onClose();
      window.location.reload();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Network error. Please try again.');
      setIsPwdSubmitting(false);
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
        zIndex: 9999,
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
          maxWidth: '440px',
          boxShadow: '0 20px 48px -10px rgba(45, 13, 25, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.08)',
          border: '1px solid var(--murmur-border-solid)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'murmurModalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Top Header */}
        <div
          style={{
            padding: '22px 24px 16px 24px',
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
                backgroundColor: 'var(--murmur-plum)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(45, 13, 25, 0.2)',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v6" />
                <path d="m19 13-4-4" />
                <path d="m5 13 4-4" />
                <path d="M8 12v5a4 4 0 0 0 8 0v-5Z" />
                <path d="M12 21v1" />
              </svg>
            </div>
            <div>
              <h2
                style={{
                  fontSize: '17px',
                  fontWeight: '700',
                  color: 'var(--murmur-text-primary)',
                  letterSpacing: '-0.02em',
                  margin: 0,
                }}
              >
                Sign In to Murmur
              </h2>
              <p
                style={{
                  fontSize: '12px',
                  color: 'var(--murmur-text-secondary)',
                  margin: '2px 0 0 0',
                }}
              >
                Unified authentication with the Murmur native app
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
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--murmur-text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--murmur-text-tertiary)';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {errorMessage && (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#DC2626',
                borderRadius: '9px',
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

          {infoMessage && (
            <div
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                color: '#059669',
                borderRadius: '9px',
                padding: '9px 12px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>{infoMessage}</span>
            </div>
          )}

          {/* Primary Action Button: Continue with Google */}
          <button
            type="button"
            disabled={isGoogleLoading}
            onClick={handleGoogleLogin}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '11px 18px',
              borderRadius: '12px',
              backgroundColor: '#FFFFFF',
              border: '1.5px solid #E2E8F0',
              color: '#1A202C',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: isGoogleLoading ? 'wait' : 'pointer',
              boxShadow: '0 2px 5px rgba(0, 0, 0, 0.06)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#CBD5E1';
              e.currentTarget.style.backgroundColor = '#F8FAFC';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#E2E8F0';
              e.currentTarget.style.backgroundColor = '#FFFFFF';
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
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
            <span>{isGoogleLoading ? 'Connecting to Google...' : 'Continue with Google'}</span>
          </button>

          {/* Or Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--murmur-border)' }} />
            <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--murmur-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Or use email
            </span>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--murmur-border)' }} />
          </div>

          {/* Tab Switcher: OTP vs Password */}
          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--murmur-sidebar-hover)',
              padding: '3px',
              borderRadius: '9px',
              gap: '2px',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setAuthMethod('otp');
                setErrorMessage(null);
                setInfoMessage(null);
              }}
              style={{
                flex: 1,
                padding: '6px',
                borderRadius: '7px',
                border: 'none',
                backgroundColor: authMethod === 'otp' ? '#FFFFFF' : 'transparent',
                color: authMethod === 'otp' ? 'var(--murmur-plum)' : 'var(--murmur-text-secondary)',
                fontSize: '12px',
                fontWeight: authMethod === 'otp' ? 600 : 500,
                cursor: 'pointer',
                boxShadow: authMethod === 'otp' ? '0 1px 2px rgba(0, 0, 0, 0.05)' : 'none',
                transition: 'all 0.1s ease',
              }}
            >
              Email Code (OTP)
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMethod('password');
                setErrorMessage(null);
                setInfoMessage(null);
              }}
              style={{
                flex: 1,
                padding: '6px',
                borderRadius: '7px',
                border: 'none',
                backgroundColor: authMethod === 'password' ? '#FFFFFF' : 'transparent',
                color: authMethod === 'password' ? 'var(--murmur-plum)' : 'var(--murmur-text-secondary)',
                fontSize: '12px',
                fontWeight: authMethod === 'password' ? 600 : 500,
                cursor: 'pointer',
                boxShadow: authMethod === 'password' ? '0 1px 2px rgba(0, 0, 0, 0.05)' : 'none',
                transition: 'all 0.1s ease',
              }}
            >
              Password
            </button>
          </div>

          {/* Tab 1: Email OTP */}
          {authMethod === 'otp' && (
            <div>
              {!otpSent ? (
                <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--murmur-text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="name@example.com"
                      value={otpEmail}
                      onChange={(e) => setOtpEmail(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--murmur-border)',
                        fontSize: '13px',
                        outline: 'none',
                        backgroundColor: 'var(--murmur-surface)',
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isOtpLoading}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '10px',
                      backgroundColor: 'var(--murmur-plum)',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: isOtpLoading ? 'wait' : 'pointer',
                      marginTop: '2px',
                      boxShadow: '0 2px 6px rgba(45, 13, 25, 0.2)',
                    }}
                  >
                    {isOtpLoading ? 'Sending Verification Code...' : 'Send Verification Code'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--murmur-text-secondary)' }}>
                      Enter Verification Code
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setOtpToken('');
                        setErrorMessage(null);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--murmur-plum)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Change email
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Enter 6 or 8-digit code"
                    value={otpToken}
                    onChange={(e) => setOtpToken(e.target.value)}
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--murmur-border)',
                      fontSize: '15px',
                      letterSpacing: '0.15em',
                      textAlign: 'center',
                      fontWeight: 600,
                      outline: 'none',
                      backgroundColor: 'var(--murmur-surface)',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={isOtpLoading}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '10px',
                      backgroundColor: 'var(--murmur-plum)',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: isOtpLoading ? 'wait' : 'pointer',
                      marginTop: '2px',
                      boxShadow: '0 2px 6px rgba(45, 13, 25, 0.2)',
                    }}
                  >
                    {isOtpLoading ? 'Verifying...' : 'Verify & Sign In'}
                  </button>
                  <div style={{ textAlign: 'center', marginTop: '2px' }}>
                    <button
                      type="button"
                      disabled={resendTimer > 0 || isOtpLoading}
                      onClick={handleSendOtp}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: resendTimer > 0 ? 'var(--murmur-text-tertiary)' : 'var(--murmur-plum)',
                        fontSize: '11.5px',
                        cursor: resendTimer > 0 ? 'default' : 'pointer',
                      }}
                    >
                      {resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend verification code'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Tab 2: Password */}
          {authMethod === 'password' && (
            <form onSubmit={handlePasswordAuth} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {passwordMode === 'signup' && (
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--murmur-text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Arunkumar Patil"
                    value={pwdName}
                    onChange={(e) => setPwdName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--murmur-border)',
                      fontSize: '13px',
                      outline: 'none',
                      backgroundColor: 'var(--murmur-surface)',
                    }}
                  />
                </div>
              )}

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--murmur-text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={pwdEmail}
                  onChange={(e) => setPwdEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--murmur-border)',
                    fontSize: '13px',
                    outline: 'none',
                    backgroundColor: 'var(--murmur-surface)',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--murmur-text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={pwdPassword}
                  onChange={(e) => setPwdPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--murmur-border)',
                    fontSize: '13px',
                    outline: 'none',
                    backgroundColor: 'var(--murmur-surface)',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isPwdSubmitting}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--murmur-plum)',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isPwdSubmitting ? 'wait' : 'pointer',
                  marginTop: '2px',
                  boxShadow: '0 2px 6px rgba(45, 13, 25, 0.2)',
                }}
              >
                {isPwdSubmitting
                  ? 'Authenticating...'
                  : passwordMode === 'signin'
                  ? 'Sign In with Password'
                  : 'Create Account'}
              </button>

              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', fontSize: '11.5px' }}>
                <span style={{ color: 'var(--murmur-text-secondary)' }}>
                  {passwordMode === 'signin' ? "Don't have a password set?" : 'Already have an account?'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setPasswordMode(passwordMode === 'signin' ? 'signup' : 'signin');
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--murmur-plum)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  {passwordMode === 'signin' ? 'Create one' : 'Sign In'}
                </button>
              </div>
            </form>
          )}

          {/* Dismiss option: Continue as Guest */}
          <div style={{ textAlign: 'center', paddingTop: '4px' }}>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  sessionStorage.setItem('murmur_guest_dismissed', 'true');
                }
                onClose();
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--murmur-text-tertiary)',
                fontSize: '11.5px',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Continue to workspace as guest
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
