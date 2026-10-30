'use client';

import React, { useState, useEffect } from 'react';
import { Exam, TopicProgressItem } from '@/types';
import { api } from '@/lib/api';
import { Icon } from '../Icons';

interface TopicProgressViewProps {
  token: string | null;
  activeExam: Exam | null;
  onNavigate: (view: string) => void;
  showToast: (msg: string) => void;
  onOpenTopicStudio?: (topicId: string) => void;
}

export const TopicProgressView: React.FC<TopicProgressViewProps> = ({
  token,
  activeExam,
  onNavigate,
  showToast,
  onOpenTopicStudio
}) => {
  const [topics, setTopics] = useState<TopicProgressItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadProgress = async () => {
    if (!token || !activeExam) return;
    setLoading(true);
    try {
      const res = await api.getTopicProgress(token, activeExam.id);
      setTopics(res.progress || []);
    } catch (e: any) {
      showToast(e.message || 'Failed to load topic progress');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProgress();
  }, [token, activeExam]);

  const handleAdvanceStage = async (topicId: string, currentStage: number) => {
    if (!token) return;
    const nextStage = Math.min(5, currentStage + 1);
    try {
      await api.updateTopicProgress(token, topicId, {
        stage: nextStage,
        completion_percentage: Math.min(100, (nextStage / 5) * 100),
        status: nextStage >= 5 ? 'mastered' : 'reviewing'
      });
      showToast(`Topic advanced to Stage ${nextStage}/5!`);
      loadProgress();
    } catch (e: any) {
      showToast(e.message || 'Failed to update progress');
    }
  };

  const handleMarkMastered = async (topicId: string) => {
    if (!token) return;
    try {
      await api.updateTopicProgress(token, topicId, {
        stage: 5,
        completion_percentage: 100,
        status: 'mastered'
      });
      showToast('Topic marked as Mastered (Stage 5)!');
      loadProgress();
    } catch (e: any) {
      showToast(e.message || 'Failed to update progress');
    }
  };

  const uniqueSubjects = Array.from(new Set(topics.map(t => t.subject_name))).filter(Boolean);

  const filteredTopics = topics.filter(t => {
    if (filterSubject !== 'all' && t.subject_name !== filterSubject) return false;
    if (filterStatus === 'mastered' && t.stage < 5) return false;
    if (filterStatus === 'reviewing' && (t.stage < 2 || t.stage >= 5)) return false;
    if (filterStatus === 'learning' && t.stage !== 1) return false;
    if (filterStatus === 'not_started' && t.stage !== 0) return false;
    if (searchQuery.trim() && !t.topic_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const masteredCount = topics.filter(t => t.stage >= 5).length;
  const reviewingCount = topics.filter(t => t.stage >= 2 && t.stage < 5).length;
  const learningCount = topics.filter(t => t.stage === 1).length;
  const notStartedCount = topics.filter(t => t.stage === 0).length;

  return (
    <div className="view-container" style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800 }}>Topic Progress & Mastery</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '14px' }}>
            {activeExam ? `Active Exam: ${activeExam.exam_name}` : 'Select an exam'} &middot; Spaced Repetition Retention Ladder (Stage 0 to 5).
          </p>
        </div>

        <button className="btn sm primary" onClick={() => onNavigate('smart_revision')}>
          <Icon name="refresh" size={14} /> Smart Revision Due
        </button>
      </div>

      {/* KPI Cards */}
      <div
        className="card"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '16px',
          padding: '16px 20px',
          marginBottom: '20px',
          background: 'var(--surface)'
        }}
      >
        <div>
          <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Topics</div>
          <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '2px' }}>{topics.length}</div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--good)', fontWeight: 700, textTransform: 'uppercase' }}>Mastered (Stage 5)</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--good)', marginTop: '2px' }}>{masteredCount}</div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase' }}>Reviewing (2-4)</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent)', marginTop: '2px' }}>{reviewingCount}</div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#1FA095', fontWeight: 700, textTransform: 'uppercase' }}>Learning (Stage 1)</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#1FA095', marginTop: '2px' }}>{learningCount}</div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Not Started</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--muted)', marginTop: '2px' }}>{notStartedCount}</div>
        </div>
      </div>

      {/* Filter and Search controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['all', 'mastered', 'reviewing', 'learning', 'not_started'].map(st => (
            <button
              key={st}
              className={`btn sm ${filterStatus === st ? 'primary' : ''}`}
              onClick={() => setFilterStatus(st)}
              style={{ textTransform: 'capitalize', fontSize: '12px' }}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: '13px'
            }}
          >
            <option value="all">All Subjects</option>
            {uniqueSubjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <input
            type="text"
            placeholder="Search topic..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: '13px',
              width: '180px'
            }}
          />
        </div>
      </div>

      {/* Topics Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
          Loading topic progress...
        </div>
      ) : filteredTopics.length === 0 ? (
        <div className="card" style={{ padding: '36px', textAlign: 'center', color: 'var(--muted)' }}>
          No topics matched the selected filters.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '16px'
          }}
        >
          {filteredTopics.map(t => (
            <div
              key={t.topic_id}
              className="card"
              style={{
                padding: '18px',
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
                  <span
                    className={`pill ${t.stage >= 5 ? 'good' : ''}`}
                    style={{ fontSize: '11px', textTransform: 'capitalize' }}
                  >
                    Stage {t.stage}/5 &middot; {t.status.replace('_', ' ')}
                  </span>
                </div>

                <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700 }}>
                  {t.topic_name}
                </h3>
                {t.subtopic_name && (
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>
                    {t.subtopic_name}
                  </div>
                )}

                {/* Visual Spaced Repetition 5-Step Ladder */}
                <div style={{ display: 'flex', gap: '4px', margin: '12px 0 8px' }}>
                  {[1, 2, 3, 4, 5].map(step => (
                    <div
                      key={step}
                      style={{
                        flex: 1,
                        height: '6px',
                        borderRadius: '3px',
                        background: step <= t.stage ? (t.stage >= 5 ? 'var(--good)' : 'var(--accent)') : 'var(--border)'
                      }}
                    />
                  ))}
                </div>

                <div style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Next Rev: {t.next_revision_date || 'Not scheduled'}</span>
                  <span>{t.completion_percentage}% done</span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '14px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                <button
                  className="btn sm"
                  onClick={() => {
                    if (onOpenTopicStudio) {
                      onOpenTopicStudio(t.topic_id);
                    } else {
                      onNavigate('ai_learning_studio');
                    }
                  }}
                  style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  title="Open in AI Learning Studio"
                >
                  <Icon name="sparkles" size={12} /> Studio
                </button>
                {t.stage < 5 ? (
                  <>
                    <button
                      className="btn sm primary"
                      onClick={() => handleAdvanceStage(t.topic_id, t.stage)}
                      style={{ flex: 1, fontSize: '12px' }}
                    >
                      Advance to Stage {t.stage + 1}
                    </button>
                    <button
                      className="btn sm"
                      onClick={() => handleMarkMastered(t.topic_id)}
                      style={{ fontSize: '12px' }}
                      title="Directly mark stage 5"
                    >
                      Master
                    </button>
                  </>
                ) : (
                  <div style={{ flex: 1, fontSize: '12px', color: 'var(--good)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Icon name="check" size={14} /> Topic Mastered on Spaced Ladder
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
