'use client';

import React, { useState } from 'react';
import { StudyPlan } from '@/types';
import { INTERVALS, today, addDays, daysBetween, fmtMins, getTopicImportanceClient } from '@/lib/seed';
import { Icon } from '../Icons';

interface SubjectsViewProps {
  plan: StudyPlan;
  onNewSubject: () => void;
  onDeleteSubject: (subjectId: string) => void;
  onAddTopic: (subjectId: string, name: string) => void;
  onDeleteTopic: (subjectId: string, topicId: string) => void;
  onReviewTopic: (subjectId: string, topicId: string) => void;
  onStartTopicTest?: (topicName: string) => void;
}

export const SubjectsView: React.FC<SubjectsViewProps> = ({
  plan,
  onNewSubject,
  onDeleteSubject,
  onAddTopic,
  onDeleteTopic,
  onReviewTopic,
  onStartTopicTest
}) => {
  const [topicInputs, setTopicInputs] = useState<{ [subjectId: string]: string }>({});
  const [armedSubjectId, setArmedSubjectId] = useState<string | null>(null);
  const [importanceFilter, setImportanceFilter] = useState<'all' | 'very_important' | 'important'>('all');

  const t = today();
  const past7Days = addDays(t, -6);

  const stageName = (n: number) => {
    if (n === 0) return 'New';
    if (n < 3) return 'Learning';
    if (n < 5) return 'Solid';
    return 'Mastered';
  };

  const getNextLabel = (tp: { stage: number; next: string }): [string, string] => {
    const d = daysBetween(t, tp.next);
    if (d < 0) return [`Overdue ${-d}d`, 'crit'];
    if (d === 0) return [tp.stage === 0 ? 'First pass today' : 'Due today', 'warn'];
    if (d === 1) return ['Tomorrow', ''];
    return [`In ${d} days`, ''];
  };

  const handleAddTopicSubmit = (e: React.FormEvent, subjectId: string) => {
    e.preventDefault();
    const name = (topicInputs[subjectId] || '').trim();
    if (!name) return;
    onAddTopic(subjectId, name);
    setTopicInputs(prev => ({ ...prev, [subjectId]: '' }));
  };

  const handleDeleteSubjectClick = (subjectId: string) => {
    if (armedSubjectId === subjectId) {
      onDeleteSubject(subjectId);
      setArmedSubjectId(null);
    } else {
      setArmedSubjectId(subjectId);
      setTimeout(() => setArmedSubjectId(null), 3000);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="pagehead">
        <div>
          <p className="eyebrow">Subjects and revision</p>
          <h1>What you know, and when to revisit it</h1>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={onNewSubject}>
            <Icon name="plus" size={16} /> Add subject
          </button>
        </div>
      </div>

      {/* Revision Ladder */}
      <section className="card">
        <div className="rungs-bar">
          <div>
            <h2>Revision ladder</h2>
            <p className="sub">
              Each time you review a topic, it moves up a rung and comes back later on spaced repetition intervals.
            </p>
          </div>
        </div>
        <div className="ladder">
          {INTERVALS.map((d, i) => (
            <div key={d} className="rung">
              <b>{d}d</b>
              <span>Review {i + 1}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Topic Importance Filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>Exam Priority Filter:</span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            className={`chip ${importanceFilter === 'all' ? 'on' : ''}`}
            onClick={() => setImportanceFilter('all')}
          >
            All Topics
          </button>
          <button
            className={`chip ${importanceFilter === 'very_important' ? 'on' : ''}`}
            onClick={() => setImportanceFilter('very_important')}
            style={importanceFilter === 'very_important' ? { background: '#D04F73', color: '#fff', borderColor: '#D04F73' } : {}}
          >
            🔥 Very Important Only
          </button>
          <button
            className={`chip ${importanceFilter === 'important' ? 'on' : ''}`}
            onClick={() => setImportanceFilter('important')}
          >
            ⭐ Core Important
          </button>
        </div>
      </div>

      {/* Subjects Grid */}
      <div className="subjgrid">
        {plan.subjects.length > 0 ? (
          plan.subjects.map(s => {
            const readiness = s.topics.length
              ? Math.round(
                  (s.topics.reduce((acc, t) => acc + t.stage / 5, 0) / s.topics.length) * 100
                )
              : 0;

            const weekMins = plan.sessions
              .filter(x => x.subjectId === s.id && x.date >= past7Days)
              .reduce((acc, x) => acc + x.mins, 0);

            const sortedTopics = s.topics.slice().sort((a, b) => a.next.localeCompare(b.next));
            const displayTopics = sortedTopics.filter(tp => {
              if (importanceFilter === 'all') return true;
              return getTopicImportanceClient(tp.name) === importanceFilter;
            });

            return (
              <section key={s.id} className="card">
                <div className="cardhead" style={{ marginBottom: '10px' }}>
                  <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <i className="dot" style={{ background: s.color, width: '12px', height: '12px' }}></i>
                    <span style={{ overflowWrap: 'anywhere' }}>{s.name}</span>
                  </h2>
                  <button
                    className="btn sm danger"
                    onClick={() => handleDeleteSubjectClick(s.id)}
                  >
                    {armedSubjectId === s.id ? 'Confirm remove?' : 'Remove'}
                  </button>
                </div>

                <div className="bar" role="img" aria-label={`Readiness ${readiness}%`}>
                  <i style={{ width: `${readiness}%`, background: s.color }}></i>
                </div>
                <p className="sub" style={{ marginTop: '8px' }}>
                  <span className="mono">{readiness}%</span> ready &middot;{' '}
                  <span className="mono">{fmtMins(weekMins)}</span> studied in the last 7 days
                </p>

                {displayTopics.length > 0 ? (
                  <ul className="topics">
                    {displayTopics.map(tp => {
                      const [nextText, nextClass] = getNextLabel(tp);
                      const imp = getTopicImportanceClient(tp.name);
                      return (
                        <li key={tp.id} className="topic">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flexWrap: 'wrap' }}>
                            <div className="tn">{tp.name}</div>
                            {imp === 'very_important' && (
                              <span className="pill crit" style={{ fontSize: '10px', padding: '1px 6px', fontWeight: 700 }}>
                                🔥 Very Important
                              </span>
                            )}
                            {imp === 'important' && (
                              <span className="pill warn" style={{ fontSize: '10px', padding: '1px 6px', fontWeight: 700 }}>
                                ⭐ Important
                              </span>
                            )}
                          </div>
                          <button
                            className="iconbtn"
                            onClick={() => onDeleteTopic(s.id, tp.id)}
                            aria-label={`Remove topic ${tp.name}`}
                          >
                            <Icon name="x" size={14} />
                          </button>

                          <div className="tools">
                            <div className="pips" role="img" aria-label={`Stage ${tp.stage} of 5`}>
                              {[1, 2, 3, 4, 5].map(i => (
                                <span
                                  key={i}
                                  className={`pip ${i <= tp.stage ? 'on' : ''}`}
                                  style={{ background: i <= tp.stage ? s.color : undefined }}
                                ></span>
                              ))}
                            </div>

                            <span className="pill">{stageName(tp.stage)}</span>
                            <span className={`pill ${nextClass}`}>{nextText}</span>

                            <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                              {onStartTopicTest && (
                                <button
                                  className="btn sm"
                                  title={`Take AI Mock Test on ${tp.name}`}
                                  onClick={() => onStartTopicTest(tp.name)}
                                >
                                  <Icon name="test" size={13} /> Mock Test
                                </button>
                              )}
                              <button
                                className="btn sm primary"
                                onClick={() => onReviewTopic(s.id, tp.id)}
                              >
                                {tp.stage === 0 ? 'Studied' : 'Reviewed'}
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="empty" style={{ marginTop: '12px' }}>
                    No topics yet. Add your first topic below.
                  </div>
                )}

                <form className="addtopic" onSubmit={(e) => handleAddTopicSubmit(e, s.id)}>
                  <input
                    placeholder="Add a topic..."
                    value={topicInputs[s.id] || ''}
                    onChange={(e) =>
                      setTopicInputs({ ...topicInputs, [s.id]: e.target.value })
                    }
                    maxLength={80}
                    required
                  />
                  <button className="btn" type="submit">
                    Add
                  </button>
                </form>
              </section>
            );
          })
        ) : (
          <div className="empty">No subjects added yet. Create one to begin your syllabus tracking.</div>
        )}
      </div>
    </div>
  );
};
