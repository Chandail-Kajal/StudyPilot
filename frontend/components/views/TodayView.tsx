'use client';

import React, { useState } from 'react';
import { StudyPlan, Subject, Task } from '@/types';
import { today, addDays, parse, daysBetween, fmtMins, fmtShort, fmtWd, clamp, getYesterdayTopics } from '@/lib/seed';
import { Icon } from '../Icons';

interface TodayViewProps {
  plan: StudyPlan;
  isAuthenticated: boolean;
  onAddTask: (date: string) => void;
  onEditTask: (task: Task) => void;
  onToggleTask: (taskId: string) => void;
  onQuickAdd: (title: string, subjectId: string) => void;
  onStartFocusOnTask: (task: Task) => void;
  onStartGeneralFocus: () => void;
  onReviewTopic: (subjectId: string, topicId: string) => void;
  onOpenSettings: () => void;
  onOpenAuth: () => void;
  onOpenTouchMove: (task: Task) => void;
  onNavigateToView: (view: string) => void;
}

export const TodayView: React.FC<TodayViewProps> = ({
  plan,
  isAuthenticated,
  onAddTask,
  onEditTask,
  onToggleTask,
  onQuickAdd,
  onStartFocusOnTask,
  onStartGeneralFocus,
  onReviewTopic,
  onOpenSettings,
  onOpenAuth,
  onOpenTouchMove,
  onNavigateToView
}) => {
  const [quickTitle, setQuickTitle] = useState('');
  const [quickSubj, setQuickSubj] = useState(plan.subjects[0]?.id || '');

  const t = today();
  const tasks = plan.tasks.filter(x => x.date === t).sort((a, b) => {
    return (Number(a.done) - Number(b.done)) || (a.prio === 'high' ? -1 : 1) || a.title.localeCompare(b.title);
  });
  const left = tasks.filter(x => !x.done);
  const planned = left.reduce((a, x) => a + x.mins, 0);

  // Yesterday topics recall detection
  const yesterdayTopics = getYesterdayTopics(plan);

  // Due topics calculation
  const dueTopics: Array<{ s: Subject; tp: any; late: number }> = [];
  plan.subjects.forEach(s => {
    s.topics.forEach(tp => {
      if (tp.next <= t) {
        dueTopics.push({ s, tp, late: daysBetween(tp.next, t) });
      }
    });
  });
  dueTopics.sort((a, b) => b.late - a.late);

  // Minutes studied today
  const studied = plan.sessions.filter(s => s.date === t).reduce((a, s) => a + s.mins, 0);
  const goal = plan.goalMins || 180;
  const pct = clamp(studied / goal, 0, 1);
  const C = 2 * Math.PI * 50;

  // Streak calculation
  const minsOn = (d: string) => plan.sessions.filter(s => s.date === d).reduce((a, s) => a + s.mins, 0);
  let streak = 0;
  let checkDate = t;
  if (minsOn(checkDate) === 0) checkDate = addDays(checkDate, -1);
  while (minsOn(checkDate) > 0 && streak < 400) {
    streak++;
    checkDate = addDays(checkDate, -1);
  }

  // 7-day dot indicators
  const dots = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(t, -i);
    dots.push({
      date: d,
      mins: minsOn(d),
      char: fmtWd(d).charAt(0),
      hasStudied: minsOn(d) > 0
    });
  }

  // Syllabus readiness
  let topicCount = 0;
  let stageSum = 0;
  plan.subjects.forEach(s => {
    s.topics.forEach(tp => {
      topicCount++;
      stageSum += tp.stage / 5;
    });
  });
  const readiness = topicCount ? Math.round((stageSum / topicCount) * 100) : 0;

  // Exam countdown
  const examDays = daysBetween(t, plan.exam.date);

  const hr = typeof window === 'undefined' ? 10 : new Date().getHours();
  const greeting = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const dateFormatted = parse(t).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    onQuickAdd(quickTitle.trim(), quickSubj);
    setQuickTitle('');
  };

  const getSubj = (id: string) => 
    plan.subjects.find(s => s.id === id) || { id: '', name: 'General', color: '#7A8899', topics: [] };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {!isAuthenticated && (
        <div className="guest-callout">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: 'var(--accent)' }}><Icon name="cloud" size={24} /></span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>Save your plan across all devices</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                You are currently in browser prototype mode. Create an account or sign in to sync your plan and revision schedule to the cloud.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn primary sm" onClick={onOpenAuth}>
              Sign In / Sign Up
            </button>
          </div>
        </div>
      )}

      <div className="pagehead">
        <div>
          <p className="eyebrow" suppressHydrationWarning>{dateFormatted}</p>
          <h1 suppressHydrationWarning>{greeting}</h1>
          <p className="lede">
            {left.length} task{left.length === 1 ? '' : 's'} left, {fmtMins(planned)} planned, {dueTopics.length} revision{dueTopics.length === 1 ? '' : 's'} due.
          </p>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => onNavigateToView('ai')}>
            <Icon name="sparkles" size={15} /> AI Plan & Tests
          </button>
          <button className="btn" onClick={() => onAddTask(t)}>
            <Icon name="plus" size={16} /> Add task
          </button>
          <button className="btn primary" onClick={onStartGeneralFocus}>
            <Icon name="play" size={14} /> Start focus
          </button>
        </div>
      </div>

      {/* Empty Syllabus Upload Callout */}
      {plan.subjects.length === 0 && (
        <div
          style={{
            padding: '24px 20px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)',
            border: '2px dashed var(--accent)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div style={{ fontSize: '32px' }}>📚</div>
          <div style={{ maxWidth: '480px' }}>
            <h3 style={{ fontSize: '18px', margin: '0 0 6px 0' }}>Get Started: Upload Your Syllabus</h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
              Upload your syllabus in PDF, Excel, or CSV format. StudyPilot will extract your real subjects and topics, schedule your daily study tasks, and prepare subject-wise exam papers without any dummy data.
            </p>
          </div>
          <button
            className="btn primary sm"
            onClick={() => onNavigateToView('planner')}
          >
            Upload Syllabus in Planner ➡
          </button>
        </div>
      )}

      {/* Yesterday's Recall Test Banner */}
      {yesterdayTopics.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)',
          borderLeft: '4px solid var(--accent)',
          borderRadius: '16px',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          boxShadow: 'var(--shadow)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="pill good">Yesterday&apos;s Recall Test Ready</span>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>• 24h Spaced Retrieval Practice</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>
              Recall Test Paper: {yesterdayTopics.map(t => t.name).join(', ')}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
              Topics covered yesterday are ready for rapid testing. Testing solidifies retention and adapts upcoming schedule.
            </div>
          </div>
          <button
            className="btn primary sm"
            onClick={() => onNavigateToView('ai')}
          >
            <Icon name="test" size={14} /> Take 5-Min Test
          </button>
        </div>
      )}

      <div className="todaygrid">
        <div className="stack">
          {/* Today's Tasks */}
          <section className="card">
            <div className="cardhead">
              <h2>Today&apos;s plan</h2>
              <span className="pill">
                {tasks.length - left.length} of {tasks.length} done
              </span>
            </div>

            {tasks.length > 0 ? (
              <ul className="tasklist">
                {tasks.map(task => {
                  const s = getSubj(task.subjectId);
                  return (
                    <li key={task.id} className={`task ${task.done ? 'done' : ''}`}>
                      <button
                        className="check"
                        role="checkbox"
                        aria-checked={task.done}
                        aria-label={`Mark done: ${task.title}`}
                        onClick={() => onToggleTask(task.id)}
                      >
                        <Icon name="check" size={14} />
                      </button>

                      <div style={{ minWidth: 0 }}>
                        <button className="ttl" onClick={() => onEditTask(task)}>
                          {task.title}
                        </button>
                        <div className="meta">
                          <span>
                            <i className="dot" style={{ background: s.color }}></i>
                            {s.name}
                          </span>
                          <span className="mono">{fmtMins(task.mins)}</span>
                          {task.prio === 'high' && <span className="pill crit">High</span>}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          className="iconbtn"
                          title="Reschedule / Move day"
                          onClick={() => onOpenTouchMove(task)}
                          aria-label="Reschedule task"
                        >
                          <Icon name="move" size={14} />
                        </button>
                        {!task.done && (
                          <button
                            className="btn sm"
                            onClick={() => onStartFocusOnTask(task)}
                            aria-label={`Start focus on ${task.title}`}
                          >
                            <Icon name="play" size={12} /> Focus
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="empty">Nothing planned yet for today. Add your first task below.</div>
            )}

            {/* Quick Add Form */}
            <form className="quick" onSubmit={handleQuickSubmit}>
              <input
                placeholder="Add a task for today..."
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                maxLength={120}
                required
              />
              <select value={quickSubj} onChange={(e) => setQuickSubj(e.target.value)}>
                {plan.subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
                <option value="">General</option>
              </select>
              <button className="btn primary" type="submit">
                Add
              </button>
            </form>
          </section>
        </div>

        <div className="stack">
          {/* Daily Goal & Streak */}
          <section className="card">
            <div className="cardhead">
              <h2>Daily goal</h2>
              <button className="linkbtn" onClick={onOpenSettings}>Change</button>
            </div>
            <div className="goalwrap">
              <svg className="ring" width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
                <circle cx="60" cy="60" r="50" fill="none" stroke="var(--surface2)" strokeWidth="12" />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={C}
                  strokeDashoffset={C * (1 - pct)}
                  transform="rotate(-90 60 60)"
                />
                <text x="60" y="66" textAnchor="middle" fontSize="20" fill="var(--ink)" fontWeight="600">
                  {Math.round(pct * 100)}%
                </text>
              </svg>
              <div className="goalnums">
                <b className="num">{fmtMins(studied)}</b>
                <span>of {fmtMins(goal)} studied today</span>
              </div>
            </div>

            <div className="streakrow">
              <span className="lbl">
                <span className="flame"><Icon name="flame" size={18} /></span>
                {streak}-day streak
              </span>
              {dots.map(d => (
                <span
                  key={d.date}
                  className={`dayDot ${d.hasStudied ? 'on' : ''}`}
                  title={`${fmtShort(d.date)}: ${fmtMins(d.mins)}`}
                >
                  {d.char}
                </span>
              ))}
            </div>
          </section>

          {/* Target Exam Countdown */}
          <section className="card">
            <div className="cardhead">
              <h2>{plan.exam.name}</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="linkbtn" onClick={() => onNavigateToView('ai')} style={{ color: 'var(--accent)', fontWeight: 600 }}>
                  AI Plan
                </button>
                <button className="linkbtn" onClick={onOpenSettings}>Edit</button>
              </div>
            </div>
            {examDays >= 0 ? (
              <div className="countdown">
                <b className="num">{examDays}</b>
                <span>{examDays === 1 ? 'day' : 'days'} to go</span>
              </div>
            ) : (
              <div className="countdown">
                <b className="num">Completed</b>
                <span>exam date has passed</span>
              </div>
            )}
            <p className="sub" style={{ margin: '6px 0 12px' }}>
              {parse(plan.exam.date).toLocaleDateString('en-IN', {
                weekday: 'short',
                day: 'numeric',
                month: 'short'
              })}
            </p>
            <div className="bar" role="img" aria-label={`Syllabus readiness ${readiness}%`}>
              <i style={{ width: `${readiness}%` }}></i>
            </div>
            <p className="sub" style={{ marginTop: '6px' }}>
              Syllabus readiness <span className="mono">{readiness}%</span> across {topicCount} topics
            </p>
          </section>

          {/* Revisions Due (Spaced Repetition) */}
          <section className="card">
            <div className="cardhead">
              <h2>Revisions due</h2>
              <button className="linkbtn" onClick={() => onNavigateToView('subjects')}>
                All topics
              </button>
            </div>
            {dueTopics.length > 0 ? (
              dueTopics.slice(0, 5).map(item => {
                const lateLabel = item.late > 0 ? `Overdue ${item.late}d` : 'Due today';
                const lateClass = item.late > 0 ? 'crit' : 'warn';
                return (
                  <div key={item.tp.id} className="rev">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
                        {item.tp.name}
                      </div>
                      <div className="meta">
                        <span>
                          <i className="dot" style={{ background: item.s.color }}></i>
                          {item.s.name}
                        </span>
                        <span className={`pill ${lateClass}`}>
                          {item.tp.stage === 0 ? 'First pass' : lateLabel}
                        </span>
                      </div>
                    </div>
                    <button
                      className="btn sm"
                      onClick={() => onReviewTopic(item.s.id, item.tp.id)}
                    >
                      {item.tp.stage === 0 ? 'Studied' : 'Reviewed'}
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="empty">All caught up! No revisions due today.</div>
            )}
            {dueTopics.length > 5 && (
              <p className="hint" style={{ marginTop: '10px' }}>
                + {dueTopics.length - 5} more due in Subjects
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
