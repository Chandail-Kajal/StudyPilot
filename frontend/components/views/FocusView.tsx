'use client';

import React from 'react';
import { StudyPlan } from '@/types';
import { fmtMins, today } from '@/lib/seed';
import { Icon } from '../Icons';

interface FocusViewProps {
  plan: StudyPlan;
  timerMode: 'focus' | 'short' | 'long';
  timerRemaining: number;
  timerTotal: number;
  timerRunning: boolean;
  timerCycles: number;
  timerTaskId: string;
  timerSubjectId: string;
  onSetMode: (mode: 'focus' | 'short' | 'long') => void;
  onToggleTimer: () => void;
  onResetTimer: () => void;
  onLogTimer: () => void;
  onSkipTimerDemo: () => void;
  onSelectTask: (taskId: string) => void;
  onSelectSubject: (subjectId: string) => void;
}

export const FocusView: React.FC<FocusViewProps> = ({
  plan,
  timerMode,
  timerRemaining,
  timerTotal,
  timerRunning,
  timerCycles,
  timerTaskId,
  timerSubjectId,
  onSetMode,
  onToggleTimer,
  onResetTimer,
  onLogTimer,
  onSkipTimerDemo,
  onSelectTask,
  onSelectSubject
}) => {
  const t = today();
  const pendingTasks = plan.tasks.filter(x => x.date === t && !x.done);
  const todaySessions = plan.sessions
    .filter(s => s.date === t)
    .sort((a, b) => b.at - a.at)
    .slice(0, 8);

  const isFocus = timerMode === 'focus';
  const elapsed = timerTotal - timerRemaining;
  const canLog = isFocus && elapsed >= 60;
  const cyc = timerCycles % 4;

  const RC = 2 * Math.PI * 108;
  const strokeColor = isFocus ? 'var(--accent)' : 'var(--good)';
  const modeLabels = { focus: 'Focus', short: 'Short break', long: 'Long break' };

  const pad = (n: number) => String(n).padStart(2, '0');
  const mmss = `${pad(Math.floor(timerRemaining / 60))}:${pad(timerRemaining % 60)}`;

  const getSubj = (id: string) =>
    plan.subjects.find(s => s.id === id) || { id: '', name: 'General', color: '#7A8899', topics: [] };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="pagehead">
        <div>
          <p className="eyebrow">Focus timer</p>
          <h1>One thing at a time</h1>
          <p className="lede">
            Finished sessions are logged to the subject you pick and count toward today&apos;s goal.
          </p>
        </div>
      </div>

      <div className="focusgrid">
        {/* Timer Box */}
        <section className="card">
          <div className="modes" role="tablist" aria-label="Timer mode">
            {(['focus', 'short', 'long'] as const).map(m => (
              <button
                key={m}
                className="modebtn"
                role="tab"
                aria-selected={timerMode === m}
                disabled={timerRunning}
                onClick={() => onSetMode(m)}
              >
                {modeLabels[m]}{' '}
                <span className="mono">{plan.settings[m]}</span>
              </button>
            ))}
          </div>

          <div className="timerbox">
            <div className="ringbox">
              <svg viewBox="0 0 240 240" aria-hidden="true">
                <circle cx="120" cy="120" r="108" fill="none" stroke="var(--surface2)" strokeWidth="12" />
                <circle
                  id="ringProg"
                  cx="120"
                  cy="120"
                  r="108"
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={RC}
                  strokeDashoffset={RC * (timerRemaining / (timerTotal || 1))}
                  transform="rotate(-90 120 120)"
                  style={{ transition: 'stroke-dashoffset 0.25s linear' }}
                />
              </svg>
              <div className="ringcenter">
                <div className="time" role="timer">
                  {mmss}
                </div>
                <div className="st">
                  {timerRunning ? modeLabels[timerMode] : elapsed > 0 ? 'Paused' : 'Ready'}
                </div>
              </div>
            </div>

            <div className="controls">
              <button
                className="btn primary"
                style={{ minWidth: '136px' }}
                onClick={onToggleTimer}
              >
                {timerRunning ? (
                  <>
                    <Icon name="pause" size={14} /> Pause
                  </>
                ) : (
                  <>
                    <Icon name="play" size={14} /> {elapsed > 0 ? 'Resume' : 'Start'}
                  </>
                )}
              </button>

              <button
                className="btn"
                onClick={onResetTimer}
                disabled={elapsed === 0 && !timerRunning}
              >
                <Icon name="reset" size={15} /> Reset
              </button>

              {canLog && (
                <button className="btn" onClick={onLogTimer}>
                  Log time and stop
                </button>
              )}
            </div>

            <div className="cycles" aria-label="Focus sessions in this cycle">
              {[0, 1, 2, 3].map(i => (
                <span key={i} className={`cyc ${i < cyc ? 'on' : ''}`}></span>
              ))}
              <span>{4 - cyc} until a long break</span>
            </div>

            <button className="linkbtn" onClick={onSkipTimerDemo}>
              Complete this session now (demo)
            </button>
          </div>
        </section>

        {/* Task & Subject Assignment + History */}
        <div className="stack">
          <section className="card">
            <h2 style={{ marginBottom: '14px' }}>What are you working on?</h2>
            <div className="form">
              <label className="f">
                Task from today&apos;s plan
                <select
                  value={timerTaskId}
                  onChange={(e) => onSelectTask(e.target.value)}
                >
                  <option value="">No specific task</option>
                  {pendingTasks.map(task => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="f">
                Log time to subject
                <select
                  value={timerSubjectId}
                  disabled={Boolean(timerTaskId)}
                  onChange={(e) => onSelectSubject(e.target.value)}
                >
                  {plan.subjects.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                  <option value="">General</option>
                </select>
              </label>
            </div>
          </section>

          <section className="card">
            <div className="cardhead">
              <h2>Sessions today</h2>
              <span className="pill accent">
                {fmtMins(plan.sessions.filter(s => s.date === t).reduce((a, s) => a + s.mins, 0))} total
              </span>
            </div>

            {todaySessions.length > 0 ? (
              <ul className="sessions">
                {todaySessions.map(session => {
                  const s = getSubj(session.subjectId);
                  return (
                    <li key={session.id}>
                      <i className="dot" style={{ background: s.color }}></i>
                      <span>{s.name}</span>
                      <span className="t">
                        {fmtMins(session.mins)} &middot;{' '}
                        {new Date(session.at).toLocaleTimeString('en-IN', {
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="empty">No sessions yet today. Start the timer to log one.</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
