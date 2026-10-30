'use client';

import React, { useState, useEffect } from 'react';
import { Exam, DueRevisionTopic } from '@/types';
import { api } from '@/lib/api';
import { Icon } from '../Icons';

interface SmartRevisionViewProps {
  token: string | null;
  activeExam: Exam | null;
  onNavigate: (view: string) => void;
  showToast: (msg: string) => void;
}

export const SmartRevisionView: React.FC<SmartRevisionViewProps> = ({
  token,
  activeExam,
  onNavigate,
  showToast
}) => {
  const [dueTopics, setDueTopics] = useState<DueRevisionTopic[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSessionTopic, setActiveSessionTopic] = useState<DueRevisionTopic | null>(null);
  const [completing, setCompleting] = useState(false);

  const loadDueRevisions = async () => {
    if (!token || !activeExam) return;
    setLoading(true);
    try {
      const res = await api.getDueRevisions(token, activeExam.id);
      setDueTopics(res.due_topics || []);
    } catch (e: any) {
      showToast(e.message || 'Failed to load revision queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDueRevisions();
  }, [token, activeExam]);

  const handleStartDrill = async (topic: DueRevisionTopic) => {
    if (!token || !activeExam) return;
    try {
      const res = await api.startRevisionSession(token, {
        exam_id: activeExam.id,
        topic_id: topic.topic_id
      });
      setActiveSessionTopic(topic);
    } catch (e: any) {
      showToast(e.message || 'Failed to start revision session');
    }
  };

  const handleFinishDrill = async (success: boolean) => {
    if (!token || !activeSessionTopic) return;
    setCompleting(true);
    try {
      await api.completeRevisionSession(token, `rev_session_${activeSessionTopic.topic_id}`, success ? 100 : 50);
      showToast(success ? 'Revision complete! Topic advanced on spaced ladder.' : 'Revision logged. Keep practicing!');
      setActiveSessionTopic(null);
      loadDueRevisions();
    } catch (e: any) {
      showToast(e.message || 'Failed to record revision');
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="view-container" style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800 }}>Smart Revision Engine</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '14px' }}>
            {activeExam ? `Active Exam: ${activeExam.exam_name}` : 'Select an exam'} &middot; Spaced repetition intervals prevent memory decay before exam day.
          </p>
        </div>

        <button className="btn sm" onClick={() => onNavigate('mock_config')}>
          <Icon name="test" size={14} /> Full CBT Mock Test
        </button>
      </div>

      {/* Info Card */}
      <div
        className="card"
        style={{
          padding: '18px 24px',
          marginBottom: '24px',
          background: 'linear-gradient(135deg, rgba(31, 160, 149, 0.1), rgba(62, 123, 224, 0.1))',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}
      >
        <div style={{ color: '#1FA095', fontSize: '28px' }}>🧠</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '15px' }}>
            Spaced Repetition Schedule: 2d &rarr; 4d &rarr; 7d &rarr; 14d &rarr; 30d
          </div>
          <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>
            Topics below are due today based on their retention ladder or low scores in recent mock tests.
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
          Loading revision queue...
        </div>
      ) : dueTopics.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <Icon name="award" size={48} />
          <h3 style={{ marginTop: '16px' }}>All Revisions Caught Up!</h3>
          <p style={{ color: 'var(--muted)', maxWidth: '440px', margin: '8px auto 20px' }}>
            You have no topics due for review today. Great work staying ahead of the forgetting curve!
          </p>
          <button className="btn primary" onClick={() => onNavigate('mock_config')}>
            Take a Comprehensive Mock Test
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '16px'
          }}
        >
          {dueTopics.map(t => (
            <div
              key={t.topic_id}
              className="card"
              style={{
                padding: '20px',
                borderLeft: `5px solid ${t.subject_color || 'var(--accent)'}`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <span className="pill" style={{ fontSize: '11px', background: 'var(--bg)', color: t.subject_color || 'var(--text)', fontWeight: 600 }}>
                    {t.subject_name}
                  </span>
                  <span className="pill" style={{ fontSize: '11px', background: 'rgba(217, 146, 17, 0.15)', color: '#D99211', fontWeight: 600 }}>
                    Stage {t.stage}/5 &middot; Due
                  </span>
                </div>

                <h3 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: 700 }}>
                  {t.topic_name}
                </h3>

                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
                  Difficulty: <span style={{ textTransform: 'capitalize' }}>{t.difficulty}</span> &middot; Last studied: {t.last_studied_at ? new Date(t.last_studied_at).toLocaleDateString() : 'Initial'}
                </div>
              </div>

              <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                <button
                  className="btn primary"
                  onClick={() => handleStartDrill(t)}
                  style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                >
                  <Icon name="play" size={14} /> Start Active Recall Drill
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Interactive Active Recall Modal */}
      {activeSessionTopic && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setActiveSessionTopic(null); }}>
          <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: '580px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="pill" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 700, fontSize: '11px' }}>
                  {activeSessionTopic.subject_name}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                  Stage {activeSessionTopic.stage}/5
                </span>
              </div>
              <button className="linkbtn" onClick={() => setActiveSessionTopic(null)}><Icon name="x" size={18} /></button>
            </div>

            <h2 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 800 }}>
              {activeSessionTopic.topic_name}
            </h2>
            <p style={{ margin: '0 0 20px', color: 'var(--muted)', fontSize: '14px' }}>
              Active Recall Session: Test your memory on this topic before viewing the notes.
            </p>

            <div
              style={{
                background: 'var(--bg)',
                padding: '20px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                marginBottom: '24px'
              }}
            >
              <h4 style={{ margin: '0 0 10px', fontSize: '14px', color: 'var(--accent)' }}>
                💡 Diagnostic Self-Assessment Prompts:
              </h4>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', lineHeight: 1.6, color: 'var(--text)' }}>
                <li>Can you state the primary definition and standard mathematical / technical formulation without referring to notes?</li>
                <li>What are the edge cases, common pitfalls, and typical multiple-choice tricks on this topic?</li>
                <li>How does this topic link with neighboring syllabus modules?</li>
              </ul>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                className="btn"
                onClick={() => handleFinishDrill(false)}
                disabled={completing}
                style={{ flex: 1 }}
              >
                Need More Practice
              </button>
              <button
                className="btn primary"
                onClick={() => handleFinishDrill(true)}
                disabled={completing}
                style={{ flex: 1 }}
              >
                <Icon name="check" size={14} /> Confident (Advance Stage)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
