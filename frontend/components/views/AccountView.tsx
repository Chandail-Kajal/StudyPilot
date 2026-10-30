/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import { StudyPlan, User, UserStats } from '@/types';
import { fmtMins, fmtShort, parse } from '@/lib/seed';
import { Icon } from '../Icons';
import { api } from '@/lib/api';

interface AccountViewProps {
  user: User | null;
  stats: UserStats | null;
  plan: StudyPlan;
  isAuthenticated: boolean;
  syncStatus: 'synced' | 'syncing' | 'local' | 'error';
  lastSyncedTime: string | null;
  onSyncNow: () => Promise<void>;
  onImportPrototype: () => Promise<void>;
  onExportData: () => void;
  onExportCSV: () => void;
  onUpdateProfile: (updates: Partial<User>) => Promise<void>;
  onChangePassword: (current: string, next: string) => Promise<void>;
  onSignOut: () => void;
  onOpenAuth: () => void;
  onResetData: () => void;
}

export const AccountView: React.FC<AccountViewProps> = ({
  user,
  stats,
  plan,
  isAuthenticated,
  syncStatus,
  lastSyncedTime,
  onSyncNow,
  onImportPrototype,
  onExportData,
  onExportCSV,
  onUpdateProfile,
  onChangePassword,
  onSignOut,
  onOpenAuth,
  onResetData
}) => {
  // Settings form
  const [examName, setExamName] = useState(user?.exam_name || plan.exam.name);
  const [examDate, setExamDate] = useState(user?.exam_date || plan.exam.date);
  const [goalMins, setGoalMins] = useState(user?.goal_mins || plan.goalMins);
  const [focus, setFocus] = useState(user?.settings?.focus || plan.settings.focus);
  const [short, setShort] = useState(user?.settings?.short || plan.settings.short);
  const [long, setLong] = useState(user?.settings?.long || plan.settings.long);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ text: string; error: boolean } | null>(null);

  // AI API Key configuration state
  const [apiKey, setApiKey] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('studypilot.ai_api_key') || '';
    }
    return '';
  });
  const [keyStatus, setKeyStatus] = useState<any>(null);
  const [savingKey, setSavingKey] = useState(false);
  const [keySavedMsg, setKeySavedMsg] = useState<string | null>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('studypilot.auth_token') : null;
    if (token) {
      api.getAiKeyStatus(token)
        .then(res => {
          setKeyStatus(res);
        })
        .catch(() => {});
    }
  }, []);

  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingKey(true);
    setKeySavedMsg(null);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('studypilot.ai_api_key', apiKey.trim());
      }
      const token = typeof window !== 'undefined' ? localStorage.getItem('studypilot.auth_token') : null;
      if (token) {
        await api.saveAiKey(apiKey.trim(), token);
        const updatedStatus = await api.getAiKeyStatus(token);
        setKeyStatus(updatedStatus);
      }
      setKeySavedMsg('AI API Key saved and activated successfully!');
      setTimeout(() => setKeySavedMsg(null), 4000);
    } catch (err: any) {
      setKeySavedMsg('Failed to save API key: ' + (err.message || 'Error'));
    } finally {
      setSavingKey(false);
    }
  };

  // Syncing state
  const [manualSyncing, setManualSyncing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [armedReset, setArmedReset] = useState(false);

  const getInitials = (name?: string) => {
    if (!name) return 'SP';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      await onUpdateProfile({
        exam_name: examName,
        exam_date: examDate,
        goal_mins: goalMins,
        settings: { focus, short, long }
      });
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg(null);
    if (newPassword.length < 6) {
      setPwdMsg({ text: 'New password must be at least 6 characters.', error: true });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdMsg({ text: 'New passwords do not match.', error: true });
      return;
    }

    setPwdLoading(true);
    try {
      await onChangePassword(currentPassword, newPassword);
      setPwdMsg({ text: 'Password updated successfully.', error: false });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwdMsg({ text: err.message || 'Failed to change password.', error: true });
    } finally {
      setPwdLoading(false);
    }
  };

  const handleSyncClick = async () => {
    setManualSyncing(true);
    try {
      await onSyncNow();
    } finally {
      setManualSyncing(false);
    }
  };

  const handleImportClick = async () => {
    setImporting(true);
    try {
      await onImportPrototype();
    } finally {
      setImporting(false);
    }
  };

  const handleResetClick = () => {
    if (!armedReset) {
      setArmedReset(true);
      setTimeout(() => setArmedReset(false), 3000);
      return;
    }
    onResetData();
  };

  const totalStudyMins = plan.sessions.reduce((acc, s) => acc + s.mins, 0);
  const completedTasks = plan.tasks.filter(t => t.done).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div className="pagehead">
        <div>
          <p className="eyebrow">Student Account &amp; Settings</p>
          <h1>My Account</h1>
          <p className="lede">
            Manage your student profile, cloud synchronization, prototype data migration, and data export.
          </p>
        </div>
        {isAuthenticated && (
          <div className="actions">
            <button className="btn danger" onClick={onSignOut}>
              <Icon name="logout" size={15} /> Sign out
            </button>
          </div>
        )}
      </div>

      {!isAuthenticated ? (
        <section className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'var(--surface2)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--muted)'
              }}
            >
              <Icon name="user" size={28} />
            </div>
            <div style={{ flex: 1, minWidth: '240px' }}>
              <h2>Guest Student Mode</h2>
              <p className="sub" style={{ marginTop: '4px' }}>
                Your study plan is stored locally in this browser. To sync across phone and laptop, export your plan, or protect your study history, create a free StudyPilot account.
              </p>
            </div>
            <button className="btn primary" onClick={onOpenAuth}>
              Sign In or Sign Up
            </button>
          </div>
        </section>
      ) : (
        /* Profile Summary Card */
        <section className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'var(--accent)',
                color: 'var(--accent-ink)',
                display: 'grid',
                placeItems: 'center',
                fontSize: '22px',
                fontWeight: 700,
                fontFamily: 'var(--f-mono)',
                boxShadow: '0 4px 16px rgba(10, 108, 158, 0.25)'
              }}
            >
              {getInitials(user?.name)}
            </div>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '22px' }}>{user?.name}</h2>
                <span className="pill good">
                  <Icon name="check" size={12} /> Active Student
                </span>
                <span className="pill accent">
                  <Icon name="cloud-check" size={13} /> Cloud Synced
                </span>
              </div>
              <p className="sub" style={{ marginTop: '4px', fontSize: '14px' }}>
                {user?.email} &middot; Member since{' '}
                {user?.created_at ? parse(user.created_at.slice(0, 10)).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '2026'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center', padding: '0 12px' }}>
                <div style={{ fontSize: '20px', fontWeight: 700 }} className="num">
                  {fmtMins(totalStudyMins)}
                </div>
                <div className="sub">Total studied</div>
              </div>
              <div style={{ textAlign: 'center', padding: '0 12px', borderLeft: '1px solid var(--line)' }}>
                <div style={{ fontSize: '20px', fontWeight: 700 }} className="num">
                  {completedTasks}
                </div>
                <div className="sub">Tasks done</div>
              </div>
              <div style={{ textAlign: 'center', padding: '0 12px', borderLeft: '1px solid var(--line)' }}>
                <div style={{ fontSize: '20px', fontWeight: 700 }} className="num">
                  {plan.subjects.reduce((acc, s) => acc + s.topics.length, 0)}
                </div>
                <div className="sub">Topics tracked</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Grid of Account Deliverables */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
        {/* Deliverable #2: Cloud Storage and Sync */}
        <section className="card">
          <div className="cardhead">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon name="cloud" size={18} /> Cloud Storage &amp; Sync
            </h2>
            <span className={`pill ${syncStatus === 'synced' ? 'good' : syncStatus === 'syncing' ? 'warn' : 'accent'}`}>
              {syncStatus === 'synced' ? 'Synced to server' : syncStatus === 'syncing' ? 'Syncing...' : 'Local storage'}
            </span>
          </div>
          <p className="sub" style={{ marginBottom: '14px' }}>
            Your subjects, spaced revision ladder, weekly tasks, and study sessions are saved to the server and load seamlessly on any signed-in phone, tablet, or laptop.
          </p>
          <div style={{ background: 'var(--surface2)', padding: '12px 14px', borderRadius: '12px', marginBottom: '16px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ color: 'var(--muted)' }}>Server connection:</span>
              <span className="mono" style={{ color: 'var(--good)', fontWeight: 600 }}>Active (FastAPI)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--muted)' }}>Last synced:</span>
              <span className="mono">
                {lastSyncedTime ? new Date(lastSyncedTime).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', second: '2-digit' }) : 'Never'}
              </span>
            </div>
          </div>
          <button
            className="btn primary"
            style={{ width: '100%' }}
            onClick={handleSyncClick}
            disabled={!isAuthenticated || manualSyncing}
          >
            {manualSyncing ? 'Syncing...' : 'Sync With Cloud Now'}
          </button>
        </section>

        {/* Deliverable #3: Import of Prototype Data */}
        <section className="card">
          <div className="cardhead">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon name="upload" size={18} /> Prototype Data Import
            </h2>
            <span className="pill">Deliverable #3</span>
          </div>
          <p className="sub" style={{ marginBottom: '14px' }}>
            A one-time step to bring an existing browser plan into your account. Brings in every subject, topic, task, and session from the StudyPilot prototype.
          </p>
          <div style={{ background: 'var(--surface2)', padding: '12px 14px', borderRadius: '12px', marginBottom: '16px', fontSize: '13px' }}>
            <div style={{ color: 'var(--muted)', marginBottom: '4px' }}>Current local cache contains:</div>
            <div className="mono" style={{ fontWeight: 600 }}>
              {plan.subjects.length} subjects &middot; {plan.tasks.length} tasks &middot; {plan.sessions.length} study sessions
            </div>
          </div>
          <button
            className="btn"
            style={{ width: '100%' }}
            onClick={handleImportClick}
            disabled={!isAuthenticated || importing}
          >
            {importing ? 'Importing plan...' : 'Import Prototype Plan to Account'}
          </button>
        </section>

        {/* Deliverable #6: Data Export */}
        <section className="card">
          <div className="cardhead">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon name="download" size={18} /> Study Data Export
            </h2>
            <span className="pill">Deliverable #6</span>
          </div>
          <p className="sub" style={{ marginBottom: '14px' }}>
            Download your own plan and study log for offline backup or analysis. A downloaded file contains the student&apos;s full plan and study sessions.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button className="btn primary" style={{ width: '100%' }} onClick={onExportData}>
              <Icon name="download" size={15} /> Download Full Plan (JSON)
            </button>
            <button className="btn" style={{ width: '100%' }} onClick={onExportCSV}>
              <Icon name="download" size={15} /> Download Study Log (CSV)
            </button>
          </div>
        </section>
      </div>

      {/* Target Exam & Timer Goal Preferences */}
      <section className="card">
        <div className="cardhead">
          <h2>Exam Target &amp; Study Schedule Preferences</h2>
        </div>
        <form className="form" onSubmit={handleProfileSubmit}>
          <div className="row2">
            <label className="f">
              Exam or target milestone
              <input
                type="text"
                required
                maxLength={60}
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
              />
            </label>

            <label className="f">
              Exam target date
              <input
                type="date"
                required
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
              />
            </label>
          </div>

          <div className="row2">
            <label className="f">
              Daily study goal (minutes)
              <input
                type="number"
                min={15}
                max={720}
                step={15}
                required
                value={goalMins}
                onChange={(e) => setGoalMins(parseInt(e.target.value, 10) || 180)}
              />
            </label>

            <div className="row3">
              <label className="f">
                Focus (min)
                <input
                  type="number"
                  min={1}
                  max={120}
                  required
                  value={focus}
                  onChange={(e) => setFocus(parseInt(e.target.value, 10) || 25)}
                />
              </label>

              <label className="f">
                Short break
                <input
                  type="number"
                  min={1}
                  max={60}
                  required
                  value={short}
                  onChange={(e) => setShort(parseInt(e.target.value, 10) || 5)}
                />
              </label>

              <label className="f">
                Long break
                <input
                  type="number"
                  min={1}
                  max={60}
                  required
                  value={long}
                  onChange={(e) => setLong(parseInt(e.target.value, 10) || 15)}
                />
              </label>
            </div>
          </div>

          {profileSuccess && (
            <div className="alert-banner success">
              <span>Settings and study goals saved successfully!</span>
            </div>
          )}

          <div className="formactions">
            <button className="btn primary" type="submit" disabled={profileSaving}>
              {profileSaving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </form>
      </section>

      {/* Security & Password */}
      {isAuthenticated && (
        <section className="card">
          <div className="cardhead">
            <h2>Account Security</h2>
          </div>
          <p className="sub" style={{ marginBottom: '14px' }}>
            Update your account password to ensure your study data remains secure.
          </p>

          <form className="form" onSubmit={handlePasswordSubmit}>
            <div className="row3">
              <label className="f">
                Current password
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </label>

              <label className="f">
                New password (min. 6 chars)
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </label>

              <label className="f">
                Confirm new password
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </label>
            </div>

            {pwdMsg && (
              <div className={`alert-banner ${pwdMsg.error ? 'error' : 'success'}`}>
                <span>{pwdMsg.text}</span>
              </div>
            )}

            <div className="formactions">
              <button className="btn primary" type="submit" disabled={pwdLoading}>
                {pwdLoading ? 'Updating password...' : 'Update Password'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* AI API Key Configuration */}
      <section className="card">
        <div className="cardhead" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>AI API Key & Model Configuration</h2>
            <p className="sub" style={{ margin: '4px 0 0 0' }}>
              Power dynamic timetable generation, interactive topic content, and mock tests with Google Gemini or OpenAI.
            </p>
          </div>
          {keyStatus?.is_configured ? (
            <span className="pill good" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--good)' }}></span>
              Live AI Active ({keyStatus.provider})
            </span>
          ) : (
            <span className="pill neutral">Built-in AI Fallback</span>
          )}
        </div>

        <form className="form" onSubmit={handleSaveApiKey} style={{ marginTop: '16px' }}>
          <label className="f">
            <span>Google Gemini or OpenAI API Key</span>
            <input
              type="password"
              placeholder={keyStatus?.masked_key ? `Configured: ${keyStatus.masked_key}` : "Enter Gemini API key (AIzaSy...) or OpenAI (sk-...)"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <span style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
              StudyPilot uses your API key to generate customized syllabi timetables, interactive lesson notes, and CBT mock exam papers.
            </span>
          </label>

          {keySavedMsg && (
            <div className={`alert-banner ${keySavedMsg.includes('Failed') ? 'error' : 'success'}`}>
              <span>{keySavedMsg}</span>
            </div>
          )}

          <div className="formactions" style={{ display: 'flex', gap: '10px' }}>
            <button className="btn primary" type="submit" disabled={savingKey}>
              {savingKey ? 'Saving...' : 'Save AI Key'}
            </button>
            {apiKey && (
              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  setApiKey('');
                  if (typeof window !== 'undefined') localStorage.removeItem('studypilot.ai_api_key');
                  const token = typeof window !== 'undefined' ? localStorage.getItem('studypilot.auth_token') : null;
                  if (token) api.saveAiKey('', token).then(() => api.getAiKeyStatus(token).then(setKeyStatus));
                }}
              >
                Clear Key
              </button>
            )}
          </div>
        </form>
      </section>

      {/* Danger Zone */}
      <section className="card" style={{ borderColor: 'var(--crit-soft)' }}>
        <div className="cardhead">
          <h2 style={{ color: 'var(--crit)' }}>Danger Zone</h2>
        </div>
        <p className="sub" style={{ marginBottom: '14px' }}>
          Reset sample prototype study data back to the default state.
        </p>
        <button className="btn danger" onClick={handleResetClick}>
          {armedReset ? 'Click again to confirm reset' : 'Reset Sample Study Data'}
        </button>
      </section>
    </div>
  );
};
