'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Subject, Task, ExamInfo, TimerSettings, StudyPlan, SyllabusParseResult } from '@/types';
import { COLORS, clamp, today, addDays, parse, fmtWd, fmtShort, weekStartOf } from '@/lib/seed';
import { api } from '@/lib/api';
import { Icon } from './Icons';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register' | 'forgot';
  prefillToken?: string;
  prefillEmail?: string;
  onClose: () => void;
  onLogin: (data: { email: string; password: string }) => Promise<void>;
  onRegister: (data: {
    name: string;
    email: string;
    password: string;
    role?: 'student' | 'competitive_exam' | 'professional';
    exam_name?: string;
    exam_date?: string;
    goal_mins?: number;
    importCurrentPlan?: boolean;
    prototype_data?: any;
  }) => Promise<void>;
  onForgotPassword: (email: string) => Promise<any>;
  onResetPassword: (token: string, newPassword: string) => Promise<void>;
  hasLocalPlan?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  prefillToken,
  prefillEmail,
  onClose,
  onLogin,
  onRegister,
  onForgotPassword,
  onResetPassword,
  hasLocalPlan = false
}) => {
  const [tab, setTab] = useState<'login' | 'register' | 'forgot'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [selectedRole, setSelectedRole] = useState<'student' | 'competitive_exam' | 'professional'>('competitive_exam');
  const [examName, setExamName] = useState('Competitive Examination');
  const [examDate, setExamDate] = useState(addDays(today(), 28));
  const [goalMins, setGoalMins] = useState(180);
  const [importCurrentPlan, setImportCurrentPlan] = useState(hasLocalPlan);

  // Forgot password states
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);

  // Syllabus file upload & analysis states
  const [syllabusFile, setSyllabusFile] = useState<File | null>(null);
  const [isParsingSyllabus, setIsParsingSyllabus] = useState<boolean>(false);
  const [parsedSyllabus, setParsedSyllabus] = useState<SyllabusParseResult | null>(null);
  const [syllabusDragOver, setSyllabusDragOver] = useState<boolean>(false);
  const [syllabusError, setSyllabusError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTab(initialMode);
    setError(null);
    setSuccess(null);
    setSyllabusError(null);
    if (prefillEmail) setEmail(prefillEmail);
    if (prefillToken) {
      setResetToken(prefillToken);
      setForgotStep(2);
      setSuccess('Reset token verified from email link. Please set your new password below.');
    } else {
      setForgotStep(1);
    }
  }, [initialMode, isOpen, prefillToken, prefillEmail]);

  if (!isOpen) return null;

  const handleProcessSyllabusFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['pdf', 'xlsx', 'xls', 'csv'].includes(ext)) {
      setSyllabusError('Unsupported format. Please upload a PDF, Excel (.xlsx/.xls), or CSV file.');
      return;
    }
    setSyllabusError(null);
    setSyllabusFile(file);
    setIsParsingSyllabus(true);
    try {
      const res = await api.parseAndPlanSyllabus(file, {
        exam_name: examName,
        exam_date: examDate,
        daily_goal_mins: goalMins
      });
      setParsedSyllabus(res);
      setSuccess(`Syllabus analyzed! Extracted ${res.subjects_count} subjects and ${res.topics_count} topics.`);
    } catch (err: any) {
      setSyllabusError(err.message || 'Could not parse syllabus file. Please verify the document format.');
    } finally {
      setIsParsingSyllabus(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onLogin({ email, password });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Invalid email or password. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onRegister({
        name,
        email,
        password,
        role: selectedRole,
        exam_name: examName,
        exam_date: examDate,
        goal_mins: goalMins,
        importCurrentPlan: parsedSyllabus ? false : importCurrentPlan,
        prototype_data: parsedSyllabus?.plan
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Could not create account. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (forgotStep === 1) {
        const res = await onForgotPassword(email);
        const msg = typeof res === 'object' && res?.message
          ? res.message
          : `A password reset link has been dispatched to your registered email address (${email}). Please check your inbox or spam folder.`;

        setForgotStep(2);
        setSuccess(msg);
      } else {
        await onResetPassword(resetToken, newPassword);
        setSuccess('Password updated successfully! Please sign in with your new password.');
        setTab('login');
        setForgotStep(1);
        setPassword('');
      }
    } catch (err: any) {
      setError(err.message || 'Operation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: '480px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="mark" style={{ width: '28px', height: '28px', borderRadius: '8px' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M3 11.2 21 3l-4.6 18-4.2-7.1z" /></svg>
            </span>
            <h2 style={{ margin: 0, fontSize: '20px' }}>
              {tab === 'login' ? 'Sign in to StudyPilot' : tab === 'register' ? 'Create student account' : 'Reset password'}
            </h2>
          </div>
          <button className="iconbtn" onClick={onClose} aria-label="Close dialog">
            <Icon name="x" size={16} />
          </button>
        </div>

        {tab !== 'forgot' && (
          <div className="auth-tabs" role="tablist">
            <button
              className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
              role="tab"
              aria-selected={tab === 'login'}
              onClick={() => { setTab('login'); setError(null); }}
            >
              Sign In
            </button>
            <button
              className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
              role="tab"
              aria-selected={tab === 'register'}
              onClick={() => { setTab('register'); setError(null); }}
            >
              Sign Up
            </button>
          </div>
        )}

        {error && (
          <div className="alert-banner error" style={{ marginBottom: '16px' }}>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert-banner success" style={{ marginBottom: '16px' }}>
            <span>{success}</span>
          </div>
        )}

        {tab === 'login' && (
          <form className="form" onSubmit={handleLoginSubmit}>
            <label className="f">
              Email address
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="student@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="f">
              Password
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 0, background: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '12px' }}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-8px', marginBottom: '8px' }}>
              <button
                type="button"
                className="linkbtn"
                onClick={() => { setTab('forgot'); setError(null); setSuccess(null); }}
                style={{ fontSize: '12.5px', color: 'var(--accent)' }}
              >
                Forgot Password?
              </button>
            </div>

            <div style={{ marginTop: '8px' }}>
              <button className="btn primary" type="submit" style={{ width: '100%', height: '44px' }} disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>

            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <p className="hint">
                Don&apos;t have an account?{' '}
                <button type="button" className="linkbtn" onClick={() => { setTab('register'); setError(null); }}>
                  Create one now
                </button>
              </p>
            </div>
          </form>
        )}

        {tab === 'register' && (
          <form className="form" onSubmit={handleRegisterSubmit}>
            <label className="f">
              Full name
              <input
                type="text"
                required
                placeholder="e.g. John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <label className="f">
              Email address
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="student@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="f">
              Password (min. 6 characters)
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 0, background: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '12px' }}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            <div style={{ marginBottom: '14px' }}>
              <label className="f" style={{ marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                Select Your Role / Goal
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRole('student');
                    if (examName === 'Competitive Examination') setExamName('Semester / Board Exams');
                  }}
                  style={{
                    padding: '10px 6px',
                    borderRadius: '8px',
                    border: `2px solid ${selectedRole === 'student' ? 'var(--accent)' : 'var(--line)'}`,
                    background: selectedRole === 'student' ? 'var(--accent-soft)' : 'var(--surface2)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span style={{ fontSize: '18px' }}>🎓</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)' }}>Student</span>
                  <span style={{ fontSize: '10px', color: 'var(--muted)', lineHeight: '1.2' }}>School / College</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedRole('competitive_exam');
                    if (examName === 'Semester / Board Exams') setExamName('Target Competitive Exam');
                  }}
                  style={{
                    padding: '10px 6px',
                    borderRadius: '8px',
                    border: `2px solid ${selectedRole === 'competitive_exam' ? 'var(--accent)' : 'var(--line)'}`,
                    background: selectedRole === 'competitive_exam' ? 'var(--accent-soft)' : 'var(--surface2)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span style={{ fontSize: '18px' }}>🏆</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)' }}>Competitive</span>
                  <span style={{ fontSize: '10px', color: 'var(--muted)', lineHeight: '1.2' }}>JEE / NEET / UPSC</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedRole('professional');
                    if (examName === 'Semester / Board Exams' || examName === 'Competitive Examination') setExamName('Certification Exam');
                  }}
                  style={{
                    padding: '10px 6px',
                    borderRadius: '8px',
                    border: `2px solid ${selectedRole === 'professional' ? 'var(--accent)' : 'var(--line)'}`,
                    background: selectedRole === 'professional' ? 'var(--accent-soft)' : 'var(--surface2)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span style={{ fontSize: '18px' }}>💼</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)' }}>Professional</span>
                  <span style={{ fontSize: '10px', color: 'var(--muted)', lineHeight: '1.2' }}>Certifications</span>
                </button>
              </div>
              <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--muted)' }}>
                {selectedRole === 'competitive_exam' && '⚡ Competitive Mode: +4 / -1 negative marking enabled, strict timing discipline.'}
                {selectedRole === 'student' && '📘 Student Mode: Standard 1-mark grading without negative deduction, conceptual clarity focus.'}
                {selectedRole === 'professional' && '💼 Professional Mode: Applied scenario questions and industry certification benchmarks.'}
              </div>
            </div>

            <div className="row2">
              <label className="f">
                Exam target
                <input
                  type="text"
                  placeholder={selectedRole === 'student' ? 'e.g. CBSE 12th Board' : selectedRole === 'competitive_exam' ? 'e.g. JEE Advanced / NEET' : 'e.g. AWS Solutions Architect'}
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                />
              </label>
              <label className="f">
                Exam date
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                />
              </label>
            </div>

            {/* Syllabus Upload Dropzone & Analysis */}
            <div style={{ marginTop: '4px', marginBottom: '8px' }}>
              <label className="f" style={{ marginBottom: '6px' }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Upload Syllabus (PDF or Excel) <span style={{ color: 'var(--muted)', fontSize: '11px', fontWeight: 'normal' }}>(Optional)</span></span>
                  {parsedSyllabus && (
                    <span style={{ fontSize: '11px', color: 'var(--good)', fontWeight: 600 }}>
                      ✓ {parsedSyllabus.subjects_count} Subjects Found
                    </span>
                  )}
                </span>
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.xlsx,.xls,.csv"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleProcessSyllabusFile(e.target.files[0]);
                  }
                }}
              />

              {!parsedSyllabus ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setSyllabusDragOver(true); }}
                  onDragLeave={() => setSyllabusDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setSyllabusDragOver(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleProcessSyllabusFile(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${syllabusDragOver ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: '10px',
                    padding: '16px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: syllabusDragOver ? 'var(--surface2)' : 'var(--surface)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {isParsingSyllabus ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <div className="spinner" style={{ width: '22px', height: '22px' }} />
                      <span style={{ fontSize: '13px', color: 'var(--accent)', fontWeight: 500 }}>
                        Analyzing syllabus & building personalized study plan...
                      </span>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '18px' }}>📄</span>
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>Click to browse or drop syllabus file</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted)' }}>
                        PDF, Excel (.xlsx, .xls), or CSV • Auto-creates subjects, topics & daily plan
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px' }}>📚</span>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{parsedSyllabus.filename}</div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                          {parsedSyllabus.subjects_count} subjects • {parsedSyllabus.topics_count} topics • {parsedSyllabus.tasks_count} study tasks
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="linkbtn"
                      onClick={() => {
                        setParsedSyllabus(null);
                        setSyllabusFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      style={{ fontSize: '11px', color: 'var(--bad)' }}
                    >
                      Change
                    </button>
                  </div>

                  {/* Subject Pills Preview */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '2px' }}>
                    {parsedSyllabus.plan.subjects.map(s => (
                      <span
                        key={s.id}
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: `${s.color}22`,
                          color: s.color,
                          fontWeight: 500,
                          border: `1px solid ${s.color}44`
                        }}
                      >
                        {s.name} ({s.topics.length})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {syllabusError && (
                <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--bad)' }}>
                  {syllabusError}
                </p>
              )}
            </div>

            {hasLocalPlan && !parsedSyllabus && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  checked={importCurrentPlan}
                  onChange={(e) => setImportCurrentPlan(e.target.checked)}
                  style={{ width: '18px', height: '18px', margin: 0 }}
                />
                <span>Import current browser study plan to my new account</span>
              </label>
            )}

            <div style={{ marginTop: '8px' }}>
              <button className="btn primary" type="submit" style={{ width: '100%', height: '44px' }} disabled={loading || isParsingSyllabus}>
                {loading ? 'Creating account...' : parsedSyllabus ? 'Create Account & Generate Study Plan' : 'Create Account'}
              </button>
            </div>

            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <p className="hint">
                Already registered?{' '}
                <button type="button" className="linkbtn" onClick={() => { setTab('login'); setError(null); }}>
                  Sign in here
                </button>
              </p>
            </div>
          </form>
        )}

        {tab === 'forgot' && (
          <form className="form" onSubmit={handleForgotSubmit}>
            <div style={{ marginBottom: '14px', padding: '12px 14px', borderRadius: '10px', background: 'var(--surface2)', border: '1px solid var(--line)' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>✉️</span>
                <span>Registered Email Verification</span>
              </div>
              <p className="hint" style={{ margin: 0, fontSize: '12px', lineHeight: 1.5 }}>
                {forgotStep === 1
                  ? 'Enter your registered email address. StudyPilot will send a secure password reset link to your registered inbox.'
                  : `A reset code was dispatched to ${email || 'your registered email'}. Enter your new password below.`}
              </p>
            </div>

            {forgotStep === 1 ? (
              <label className="f">
                Registered email address
                <input
                  type="email"
                  required
                  placeholder="student@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            ) : (
              <>
                <label className="f">
                  Reset code / token from email
                  <input
                    type="text"
                    required
                    placeholder="rst_..."
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                  />
                </label>
                <label className="f">
                  New password (min. 6 chars)
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </label>
              </>
            )}

            <div className="formactions" style={{ marginTop: '16px' }}>
              <button
                type="button"
                className="btn"
                onClick={() => { setTab('login'); setError(null); }}
              >
                Back to sign in
              </button>
              <button className="btn primary" type="submit" disabled={loading}>
                {loading ? 'Processing...' : forgotStep === 1 ? 'Send reset link to email' : 'Reset password & sign in'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// ----------------- Task Modal -----------------

interface TaskModalProps {
  isOpen: boolean;
  task: Task | null;
  defaultDate?: string;
  subjects: Subject[];
  defaultSubjectId?: string;
  onClose: () => void;
  onSave: (taskData: Omit<Task, 'id' | 'done'>, taskId?: string) => void;
  onDelete?: (taskId: string) => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  task,
  defaultDate,
  subjects,
  defaultSubjectId,
  onClose,
  onSave,
  onDelete
}) => {
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [date, setDate] = useState(today());
  const [mins, setMins] = useState(45);
  const [prio, setPrio] = useState<'high' | 'med' | 'low'>('med');
  const [armedDelete, setArmedDelete] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setSubjectId(task.subjectId);
      setDate(task.date);
      setMins(task.mins);
      setPrio(task.prio);
    } else {
      setTitle('');
      setSubjectId(defaultSubjectId || (subjects[0] ? subjects[0].id : ''));
      setDate(defaultDate || today());
      setMins(45);
      setPrio('med');
    }
    setArmedDelete(false);
  }, [task, defaultDate, defaultSubjectId, subjects, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      subjectId,
      date,
      mins: clamp(mins, 5, 600),
      prio
    }, task?.id);
    onClose();
  };

  const handleDelete = () => {
    if (!task || !onDelete) return;
    if (!armedDelete) {
      setArmedDelete(true);
      setTimeout(() => setArmedDelete(false), 3000);
      return;
    }
    onDelete(task.id);
    onClose();
  };

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <h2>{task ? 'Edit task' : 'New task'}</h2>
        <form className="form" onSubmit={handleSubmit}>
          <label className="f">
            Title
            <input
              required
              maxLength={120}
              placeholder="What will you work on?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </label>

          <div className="row2">
            <label className="f">
              Subject
              <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
                <option value="">General</option>
              </select>
            </label>

            <label className="f">
              Date
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          </div>

          <div className="row2">
            <label className="f">
              Minutes
              <input
                type="number"
                min="5"
                max="600"
                step="5"
                required
                value={mins}
                onChange={(e) => setMins(parseInt(e.target.value, 10) || 30)}
              />
            </label>

            <label className="f">
              Priority
              <select value={prio} onChange={(e) => setPrio(e.target.value as any)}>
                <option value="high">High</option>
                <option value="med">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
          </div>

          <div className="formactions">
            {task && onDelete && (
              <button
                type="button"
                className="btn danger spacer"
                onClick={handleDelete}
              >
                {armedDelete ? 'Confirm delete?' : 'Delete'}
              </button>
            )}
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary">
              {task ? 'Save changes' : 'Add task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ----------------- Touch-Friendly Task Move Modal -----------------
// Specifically implements SOW Deliverable #5: "Touch-friendly planning - A way to move tasks between days on phones and tablets without dragging"

interface TouchMoveModalProps {
  isOpen: boolean;
  task: Task | null;
  weekStart: string;
  onClose: () => void;
  onMove: (taskId: string, newDate: string) => void;
}

export const TouchMoveModal: React.FC<TouchMoveModalProps> = ({
  isOpen,
  task,
  weekStart,
  onClose,
  onMove
}) => {
  const [customDate, setCustomDate] = useState(today());

  if (!isOpen || !task) return null;

  const days = [0, 1, 2, 3, 4, 5, 6].map(i => addDays(weekStart, i));

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: '420px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h2>Reschedule task</h2>
          <button className="iconbtn" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <p className="hint" style={{ marginBottom: '16px' }}>
          Move <b>&ldquo;{task.title}&rdquo;</b> to another day without dragging:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', marginBottom: '16px' }}>
          {days.map(d => {
            const isCurrent = d === task.date;
            const isToday = d === today();
            return (
              <button
                key={d}
                type="button"
                className={`btn ${isCurrent ? 'primary' : ''}`}
                style={{ justifyContent: 'space-between', height: '42px', padding: '0 14px' }}
                onClick={() => {
                  onMove(task.id, d);
                  onClose();
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="mono" style={{ fontWeight: 600 }}>{fmtWd(d)}</span>
                  <span>{fmtShort(d)}</span>
                  {isToday && <span className="pill accent" style={{ height: '20px', fontSize: '11px' }}>Today</span>}
                </span>
                {isCurrent && <span style={{ fontSize: '12px', fontWeight: 600 }}>Current day</span>}
              </button>
            );
          })}
        </div>

        <div style={{ borderTop: '1px solid var(--line)', paddingTop: '14px' }}>
          <label className="f" style={{ marginBottom: '12px' }}>
            Or pick a custom date
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn primary"
            style={{ width: '100%' }}
            onClick={() => {
              onMove(task.id, customDate);
              onClose();
            }}
          >
            Move to {fmtShort(customDate)}
          </button>
        </div>
      </div>
    </div>
  );
};

// ----------------- Subject Modal -----------------

interface SubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, color: string) => void;
}

export const SubjectModal: React.FC<SubjectModalProps> = ({ isOpen, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), color);
    setName('');
    onClose();
  };

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <h2>New subject</h2>
        <form className="form" onSubmit={handleSubmit}>
          <label className="f">
            Subject name
            <input
              required
              maxLength={40}
              placeholder="e.g. Economics, Organic Chemistry"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </label>

          <div className="f">
            <span>Color code</span>
            <div className="swatches" role="radiogroup" aria-label="Subject color">
              {COLORS.map((c) => (
                <label key={c} className="sw">
                  <input
                    type="radio"
                    name="color"
                    value={c}
                    checked={color === c}
                    onChange={() => setColor(c)}
                  />
                  <span style={{ background: c }}></span>
                </label>
              ))}
            </div>
          </div>

          <div className="formactions">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary">
              Add subject
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ----------------- Settings Modal -----------------

interface SettingsModalProps {
  isOpen: boolean;
  exam: ExamInfo;
  goalMins: number;
  settings: TimerSettings;
  onClose: () => void;
  onSave: (exam: ExamInfo, goalMins: number, settings: TimerSettings) => void;
  onResetData: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  exam,
  goalMins,
  settings,
  onClose,
  onSave,
  onResetData
}) => {
  const [examName, setExamName] = useState(exam.name);
  const [examDate, setExamDate] = useState(exam.date);
  const [goal, setGoal] = useState(goalMins);
  const [focus, setFocus] = useState(settings.focus);
  const [short, setShort] = useState(settings.short);
  const [long, setLong] = useState(settings.long);
  const [armedReset, setArmedReset] = useState(false);

  useEffect(() => {
    setExamName(exam.name);
    setExamDate(exam.date);
    setGoal(goalMins);
    setFocus(settings.focus);
    setShort(settings.short);
    setLong(settings.long);
    setArmedReset(false);
  }, [exam, goalMins, settings, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(
      { name: examName.trim() || 'Exam', date: examDate },
      clamp(goal, 15, 720),
      {
        focus: clamp(focus, 1, 120),
        short: clamp(short, 1, 60),
        long: clamp(long, 1, 60)
      }
    );
    onClose();
  };

  const handleReset = () => {
    if (!armedReset) {
      setArmedReset(true);
      setTimeout(() => setArmedReset(false), 3000);
      return;
    }
    onResetData();
    onClose();
  };

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <h2>Study Settings</h2>
        <form className="form" onSubmit={handleSubmit}>
          <label className="f">
            Exam or target milestone
            <input
              required
              maxLength={60}
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
            />
          </label>

          <div className="row2">
            <label className="f">
              Exam date
              <input
                type="date"
                required
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
              />
            </label>

            <label className="f">
              Daily goal (minutes)
              <input
                type="number"
                min="15"
                max="720"
                step="15"
                required
                value={goal}
                onChange={(e) => setGoal(parseInt(e.target.value, 10) || 180)}
              />
            </label>
          </div>

          <div className="row3">
            <label className="f">
              Focus (min)
              <input
                type="number"
                min="1"
                max="120"
                required
                value={focus}
                onChange={(e) => setFocus(parseInt(e.target.value, 10) || 25)}
              />
            </label>

            <label className="f">
              Short break
              <input
                type="number"
                min="1"
                max="60"
                required
                value={short}
                onChange={(e) => setShort(parseInt(e.target.value, 10) || 5)}
              />
            </label>

            <label className="f">
              Long break
              <input
                type="number"
                min="1"
                max="60"
                required
                value={long}
                onChange={(e) => setLong(parseInt(e.target.value, 10) || 15)}
              />
            </label>
          </div>

          <div className="formactions">
            <button
              type="button"
              className="btn danger spacer"
              onClick={handleReset}
            >
              {armedReset ? 'Click again to confirm reset' : 'Reset sample data'}
            </button>
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary">
              Save changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
