'use client';

import React, { useState, useEffect } from 'react';
import { Subject, Task, ExamInfo, TimerSettings, StudyPlan } from '@/types';
import { COLORS, clamp, today, addDays, parse, fmtWd, fmtShort, weekStartOf } from '@/lib/seed';
import { Icon } from './Icons';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register' | 'forgot';
  onClose: () => void;
  onLogin: (data: { email: string; password: string }) => Promise<void>;
  onRegister: (data: {
    name: string;
    email: string;
    password: string;
    exam_name?: string;
    exam_date?: string;
    goal_mins?: number;
    importCurrentPlan?: boolean;
  }) => Promise<void>;
  onForgotPassword: (email: string) => Promise<string>;
  onResetPassword: (token: string, newPassword: string) => Promise<void>;
  hasLocalPlan?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
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
  const [examName, setExamName] = useState('Mid-term exams');
  const [examDate, setExamDate] = useState(addDays(today(), 23));
  const [goalMins, setGoalMins] = useState(180);
  const [importCurrentPlan, setImportCurrentPlan] = useState(hasLocalPlan);

  // Forgot password states
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);

  useEffect(() => {
    setTab(initialMode);
    setError(null);
    setSuccess(null);
  }, [initialMode, isOpen]);

  if (!isOpen) return null;

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
        exam_name: examName,
        exam_date: examDate,
        goal_mins: goalMins,
        importCurrentPlan
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
        const token = await onForgotPassword(email);
        setResetToken(token);
        setForgotStep(2);
        setSuccess('Reset token generated. Enter a new password below.');
      } else {
        await onResetPassword(resetToken, newPassword);
        setSuccess('Password updated successfully! Please sign in with your new password.');
        setTab('login');
        setForgotStep(1);
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Password</span>
                <button
                  type="button"
                  className="linkbtn"
                  onClick={() => { setTab('forgot'); setError(null); setSuccess(null); }}
                  style={{ fontSize: '12px' }}
                >
                  Forgot password?
                </button>
              </div>
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
                placeholder="e.g. Kajal Sharma"
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

            <div className="row2">
              <label className="f">
                Exam target
                <input
                  type="text"
                  placeholder="e.g. Mid-term exams"
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

            {hasLocalPlan && (
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
              <button className="btn primary" type="submit" style={{ width: '100%', height: '44px' }} disabled={loading}>
                {loading ? 'Creating account...' : 'Create Account'}
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
            <p className="hint" style={{ marginBottom: '8px' }}>
              {forgotStep === 1
                ? 'Enter your registered email address and we will generate a password reset code.'
                : 'Enter your new password below.'}
            </p>

            {forgotStep === 1 ? (
              <label className="f">
                Registered email
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
                  Reset code / token
                  <input
                    type="text"
                    required
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

            <div className="formactions">
              <button
                type="button"
                className="btn"
                onClick={() => { setTab('login'); setError(null); }}
              >
                Back to sign in
              </button>
              <button className="btn primary" type="submit" disabled={loading}>
                {loading ? 'Processing...' : forgotStep === 1 ? 'Send reset code' : 'Reset password'}
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
