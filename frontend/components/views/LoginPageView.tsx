'use client';

import React, { useState, useEffect } from 'react';
import { Icon } from '../Icons';
import { api } from '@/lib/api';

interface LoginPageViewProps {
  onLogin: (data: { email: string; password: string }) => Promise<void>;
  onRegister: (data: {
    name: string;
    email: string;
    password: string;
    role?: 'student' | 'competitive_exam' | 'professional';
    exam_name?: string;
    exam_date?: string;
  }) => Promise<void>;
  onForgotPassword: (email: string) => Promise<any>;
  onResetPassword: (token: string, newPassword: string) => Promise<void>;
  prefillToken?: string;
  prefillEmail?: string;
  isDark: boolean;
  toggleTheme: () => void;
  toasts?: Array<{ id: string; msg: string }>;
}

export const LoginPageView: React.FC<LoginPageViewProps> = ({
  onLogin,
  onRegister,
  onForgotPassword,
  onResetPassword,
  prefillToken = '',
  prefillEmail = '',
  isDark,
  toggleTheme,
  toasts = []
}) => {
  // Modes: 'login' | 'register' | 'forgot' | 'reset'
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>(
    prefillToken ? 'reset' : 'login'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form Fields
  const [emailOrUsername, setEmailOrUsername] = useState(prefillEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [examName, setExamName] = useState('UGC NET Computer Science');

  // Forgot Password Confirmation State
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  // Reset Password State
  const [resetToken, setResetToken] = useState(prefillToken);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [tokenVerifying, setTokenVerifying] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState<string>('');

  // Handle Token verification from email link
  useEffect(() => {
    if (prefillToken) {
      setMode('reset');
      setResetToken(prefillToken);
      if (prefillEmail) setEmailOrUsername(prefillEmail);
      verifyToken(prefillToken);
    }
  }, [prefillToken, prefillEmail]);

  const verifyToken = async (tok: string) => {
    setTokenVerifying(true);
    setTokenError(null);
    try {
      const res = await api.verifyResetToken(tok);
      if (res.valid) {
        setTokenValid(true);
        if (res.email) {
          setVerifiedEmail(res.email);
          setEmailOrUsername(res.email);
        }
      } else {
        setTokenValid(false);
        setTokenError(res.message || 'This password reset link is invalid or has expired.');
      }
    } catch (e: any) {
      setTokenValid(false);
      setTokenError(e.message || 'Could not verify password reset link.');
    } finally {
      setTokenVerifying(false);
    }
  };

  // 1. Normal Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      await onLogin({
        email: emailOrUsername.trim(),
        password: password
      });
    } catch (err: any) {
      // Standard, clean error message without any intrusive password-reset prompts
      setError(err.message || 'Invalid email or password. Please verify your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Registration Submit
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      await onRegister({
        name: name.trim(),
        email: emailOrUsername.trim().toLowerCase(),
        password: password,
        role: 'competitive_exam',
        exam_name: examName.trim()
      });
    } catch (err: any) {
      setError(err.message || 'Registration failed. User may already exist.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Forgot Password Submit
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const emailToReset = emailOrUsername.trim().toLowerCase();
    if (!emailToReset) {
      setError('Please enter your registered email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await onForgotPassword(emailToReset);
      setForgotSubmitted(true);
      setSuccess(
        res?.message ||
        `If an account exists with ${emailToReset}, a password reset link has been dispatched to your inbox.`
      );
    } catch (err: any) {
      setError(err.message || 'Could not process password reset request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Reset Password Submit (From Email Link)
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please ensure both passwords match.');
      return;
    }

    setLoading(true);
    try {
      await onResetPassword(resetToken.trim(), newPassword);
      setSuccess('Password updated successfully! Please sign in with your new password.');
      setMode('login');
      setPassword('');
      setConfirmPassword('');
      setNewPassword('');
      setResetToken('');
      setTokenValid(null);
      if (verifiedEmail) {
        setEmailOrUsername(verifiedEmail);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: isDark
          ? 'radial-gradient(ellipse at top, #131c2e 0%, #0b0f19 100%)'
          : 'radial-gradient(ellipse at top, #eff6ff 0%, #f8fafc 100%)',
        padding: '24px 16px',
        position: 'relative',
        boxSizing: 'border-box'
      }}
    >
      {/* Top Bar Theme Toggle */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          right: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}
      >
        <button
          onClick={toggleTheme}
          className="tbtn iconly"
          aria-label="Toggle theme"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: '10px',
            padding: '8px',
            color: 'var(--ink)',
            cursor: 'pointer'
          }}
        >
          <Icon name={isDark ? 'sun' : 'moon'} size={18} />
        </button>
      </div>

      {/* Main Container Card */}
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: '24px',
          padding: '36px 32px',
          boxShadow: isDark
            ? '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)'
            : '0 20px 50px rgba(37, 99, 235, 0.08), 0 4px 16px rgba(0, 0, 0, 0.03)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative',
          zIndex: 1
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '26px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '54px',
              height: '54px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, var(--accent), #2563eb)',
              color: '#ffffff',
              boxShadow: '0 8px 20px rgba(37, 99, 235, 0.35)',
              marginBottom: '14px'
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 11.2 21 3l-4.6 18-4.2-7.1z" />
            </svg>
          </div>

          <h1
            style={{
              margin: '0 0 6px',
              fontSize: '24px',
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.02em'
            }}
          >
            StudyPilot AI
          </h1>

          <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--muted)' }}>
            {mode === 'login' && 'Sign in to access your personal dashboard & study timetable'}
            {mode === 'register' && 'Create your student account to get started'}
            {mode === 'forgot' && 'Reset your password to regain account access'}
            {mode === 'reset' && 'Create a new secure password for your account'}
          </p>
        </div>

        {/* Mode Tabs (Only for Login & Register) */}
        {(mode === 'login' || mode === 'register') && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              background: 'var(--surface2)',
              padding: '4px',
              borderRadius: '12px',
              marginBottom: '22px',
              border: '1px solid var(--line)'
            }}
          >
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); setSuccess(null); }}
              style={{
                padding: '10px 14px',
                borderRadius: '9px',
                border: 0,
                fontWeight: 700,
                fontSize: '13.5px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: mode === 'login' ? 'var(--surface)' : 'transparent',
                color: mode === 'login' ? 'var(--ink)' : 'var(--muted)',
                boxShadow: mode === 'login' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(null); setSuccess(null); }}
              style={{
                padding: '10px 14px',
                borderRadius: '9px',
                border: 0,
                fontWeight: 700,
                fontSize: '13.5px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: mode === 'register' ? 'var(--surface)' : 'transparent',
                color: mode === 'register' ? 'var(--ink)' : 'var(--muted)',
                boxShadow: mode === 'register' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Feedback Messages */}
        {error && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: 'var(--bad)',
              fontSize: '13px',
              fontWeight: 500,
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>⚠️</span>
            <div style={{ flex: 1 }}>
              <div>{error}</div>
              {/* Only on register failure when account already exists: show a simple Switch to Sign In button without password change suggestions */}
              {error.toLowerCase().includes('already exists') && mode === 'register' && (
                <div style={{ marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setError(null); }}
                    style={{
                      padding: '5px 12px',
                      fontSize: '12px',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: 'none',
                      background: 'var(--accent)',
                      color: '#ffffff',
                      cursor: 'pointer'
                    }}
                  >
                    Switch to Sign In &rarr;
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {success && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              color: 'var(--good)',
              fontSize: '13px',
              fontWeight: 500,
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>✓</span>
            <div style={{ flex: 1 }}>{success}</div>
          </div>
        )}

        {/* 1. Normal Sign In Form */}
        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--ink)',
                  marginBottom: '6px'
                }}
              >
                Email Address or Username
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  placeholder="e.g. scholar@example.com"
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 38px',
                    borderRadius: '12px',
                    border: '1px solid var(--line)',
                    background: 'var(--surface2)',
                    color: 'var(--ink)',
                    fontSize: '14px',
                    fontWeight: 500,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--muted)',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <Icon name="user" size={16} />
                </span>
              </div>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--ink)',
                  marginBottom: '6px'
                }}
              >
                Password
              </label>

              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 42px 12px 38px',
                    borderRadius: '12px',
                    border: '1px solid var(--line)',
                    background: 'var(--surface2)',
                    color: 'var(--ink)',
                    fontSize: '14px',
                    fontWeight: 500,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--muted)',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <Icon name="focus" size={16} />
                </span>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    border: 0,
                    background: 'none',
                    color: 'var(--muted)',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Icon name="eye" size={16} />
                </button>
              </div>

              {/* Requirement: Forgot Password? link directly below the password field */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setForgotSubmitted(false);
                    setError(null);
                    setSuccess(null);
                  }}
                  style={{
                    background: 'none',
                    border: 0,
                    color: 'var(--accent)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '2px 0'
                  }}
                >
                  Forgot Password?
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '4px',
                width: '100%',
                padding: '13px 20px',
                borderRadius: '12px',
                border: 0,
                background: 'linear-gradient(135deg, var(--accent), #2563eb)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '14.5px',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {loading ? (
                <>
                  <span className="spinner" style={{ width: '16px', height: '16px' }} />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <Icon name="user" size={16} />
                  <span>Sign In to Dashboard</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* 2. Create Account Form */}
        {mode === 'register' && (
          <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '5px' }}>
                Full Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Aarav Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '11px',
                  border: '1px solid var(--line)',
                  background: 'var(--surface2)',
                  color: 'var(--ink)',
                  fontSize: '13.5px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '5px' }}>
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '11px',
                  border: '1px solid var(--line)',
                  background: 'var(--surface2)',
                  color: 'var(--ink)',
                  fontSize: '13.5px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '5px' }}>
                Password (min 6 characters)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 40px 11px 14px',
                    borderRadius: '11px',
                    border: '1px solid var(--line)',
                    background: 'var(--surface2)',
                    color: 'var(--ink)',
                    fontSize: '13.5px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    border: 0,
                    background: 'none',
                    color: 'var(--muted)',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  <Icon name="eye" size={15} />
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '5px' }}>
                Target Examination / Study Goal
              </label>
              <input
                type="text"
                required
                placeholder="e.g. UGC NET, JEE, NEET, Class 12 Boards"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '11px',
                  border: '1px solid var(--line)',
                  background: 'var(--surface2)',
                  color: 'var(--ink)',
                  fontSize: '13.5px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '6px',
                width: '100%',
                padding: '13px 20px',
                borderRadius: '12px',
                border: 0,
                background: 'linear-gradient(135deg, var(--accent), #2563eb)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '14.5px',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {loading ? 'Creating account...' : 'Create Account & Access Dashboard'}
            </button>
          </form>
        )}

        {/* 3. Forgot Password Form */}
        {mode === 'forgot' && (
          <div>
            {!forgotSubmitted ? (
              <form onSubmit={handleForgotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: '12px',
                    background: 'var(--surface2)',
                    border: '1px solid var(--line)',
                    fontSize: '13px',
                    color: 'var(--muted)',
                    lineHeight: 1.5
                  }}
                >
                  <div style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>✉️</span>
                    <span>Forgot Password?</span>
                  </div>
                  Enter your registered email address below. StudyPilot will send a secure password reset link to your inbox.
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
                    Registered Email Address
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    placeholder="e.g. student@example.com"
                    value={emailOrUsername}
                    onChange={(e) => setEmailOrUsername(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: '1px solid var(--line)',
                      background: 'var(--surface2)',
                      color: 'var(--ink)',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                      setSuccess(null);
                    }}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '12px',
                      border: '1px solid var(--line)',
                      background: 'var(--surface2)',
                      color: 'var(--ink)',
                      fontSize: '13.5px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Back to Sign In
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      flex: 1.5,
                      padding: '12px',
                      borderRadius: '12px',
                      border: 0,
                      background: 'linear-gradient(135deg, var(--accent), #2563eb)',
                      color: '#ffffff',
                      fontSize: '13.5px',
                      fontWeight: 700,
                      cursor: loading ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </div>
              </form>
            ) : (
              /* Confirmation Screen after email link sent */
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: '42px', marginBottom: '12px' }}>✉️</div>
                <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 800, color: 'var(--ink)' }}>
                  Check Your Email
                </h3>
                <p style={{ margin: '0 0 16px', fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.5 }}>
                  If an account is associated with <strong>{emailOrUsername.trim()}</strong>, a password reset link has been dispatched to your inbox.
                </p>
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: 'var(--surface2)',
                    border: '1px solid var(--line)',
                    fontSize: '12.5px',
                    color: 'var(--muted)',
                    marginBottom: '20px',
                    textAlign: 'left'
                  }}
                >
                  💡 <strong>Next steps:</strong> Please check your email inbox and spam folder. Click the reset button or link inside to set your new password. The link expires in <strong>30 minutes</strong>.
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setForgotSubmitted(false);
                    setError(null);
                    setSuccess(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '12px',
                    border: 0,
                    background: 'linear-gradient(135deg, var(--accent), #2563eb)',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Return to Sign In
                </button>
              </div>
            )}
          </div>
        )}

        {/* 4. Password Reset Form (From Email Link) */}
        {mode === 'reset' && (
          <div>
            {tokenVerifying ? (
              <div style={{ textAlign: 'center', padding: '36px 0' }}>
                <div className="spinner" style={{ width: '28px', height: '28px', margin: '0 auto 14px' }} />
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)' }}>
                  Verifying your password reset link...
                </p>
              </div>
            ) : tokenValid === false ? (
              /* Invalid or expired token error */
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: '42px', marginBottom: '12px' }}>⚠️</div>
                <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 800, color: 'var(--bad)' }}>
                  Link Expired or Invalid
                </h3>
                <p style={{ margin: '0 0 20px', fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.5 }}>
                  {tokenError || 'This password reset link has expired or has already been used. Password reset links are valid for 30 minutes.'}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setForgotSubmitted(false);
                      setError(null);
                      setSuccess(null);
                    }}
                    style={{
                      padding: '12px',
                      borderRadius: '12px',
                      border: 0,
                      background: 'linear-gradient(135deg, var(--accent), #2563eb)',
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Request a New Reset Link
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                      setSuccess(null);
                    }}
                    style={{
                      padding: '10px',
                      borderRadius: '12px',
                      border: '1px solid var(--line)',
                      background: 'var(--surface2)',
                      color: 'var(--ink)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Back to Sign In
                  </button>
                </div>
              </div>
            ) : (
              /* Valid token: New password form */
              <form onSubmit={handleResetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: 'var(--surface2)',
                    border: '1px solid var(--line)',
                    fontSize: '13px',
                    color: 'var(--muted)'
                  }}
                >
                  <div style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: '2px' }}>
                    🔐 Reset Account Password
                  </div>
                  {verifiedEmail ? `Setting a new password for ${verifiedEmail}` : 'Enter your new password below.'}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '5px' }}>
                    New Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      autoFocus
                      minLength={6}
                      placeholder="Enter new password (min 6 characters)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '11px 40px 11px 14px',
                        borderRadius: '11px',
                        border: '1px solid var(--line)',
                        background: 'var(--surface2)',
                        color: 'var(--ink)',
                        fontSize: '13.5px',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        border: 0,
                        background: 'none',
                        color: 'var(--muted)',
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      <Icon name="eye" size={15} />
                    </button>
                  </div>
                  <div style={{ fontSize: '11.5px', color: newPassword.length >= 6 ? 'var(--good)' : 'var(--muted)', marginTop: '4px' }}>
                    {newPassword.length >= 6 ? '✓ Minimum 6 characters met' : '• Minimum 6 characters required'}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '5px' }}>
                    Confirm New Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '11px 40px 11px 14px',
                        borderRadius: '11px',
                        border: '1px solid var(--line)',
                        background: 'var(--surface2)',
                        color: 'var(--ink)',
                        fontSize: '13.5px',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        border: 0,
                        background: 'none',
                        color: 'var(--muted)',
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      <Icon name="eye" size={15} />
                    </button>
                  </div>
                  {confirmPassword.length > 0 && (
                    <div style={{ fontSize: '11.5px', color: newPassword === confirmPassword ? 'var(--good)' : 'var(--bad)', marginTop: '4px' }}>
                      {newPassword === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                      setSuccess(null);
                    }}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '12px',
                      border: '1px solid var(--line)',
                      background: 'var(--surface2)',
                      color: 'var(--ink)',
                      fontSize: '13.5px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || newPassword.length < 6 || newPassword !== confirmPassword}
                    style={{
                      flex: 1.5,
                      padding: '12px',
                      borderRadius: '12px',
                      border: 0,
                      background: 'linear-gradient(135deg, var(--accent), #2563eb)',
                      color: '#ffffff',
                      fontSize: '13.5px',
                      fontWeight: 700,
                      cursor: loading || newPassword.length < 6 || newPassword !== confirmPassword ? 'not-allowed' : 'pointer',
                      opacity: newPassword.length >= 6 && newPassword === confirmPassword ? 1 : 0.6
                    }}
                  >
                    {loading ? 'Updating...' : 'Save New Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Floating Toast Alerts */}
      {toasts.length > 0 && (
        <div className="toasts" style={{ zIndex: 9999 }}>
          {toasts.map(t => (
            <div key={t.id} className="toast" role="status">
              {t.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
