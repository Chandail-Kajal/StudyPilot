/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import { Exam } from '@/types';
import { api } from '@/lib/api';
import { Icon } from '../Icons';

interface ExamTrendAnalyzerViewProps {
  token: string | null;
  activeExam: Exam | null;
  onNavigate: (view: string) => void;
  showToast: (msg: string) => void;
  onOpenTopicInStudio?: (topicId: string) => void;
}

export const ExamTrendAnalyzerView: React.FC<ExamTrendAnalyzerViewProps> = ({
  token,
  activeExam,
  onNavigate,
  showToast,
  onOpenTopicInStudio
}) => {
  const [trendsData, setTrendsData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadTrends = async (refresh: boolean = false) => {
    if (!token || !activeExam) return;
    setLoading(true);
    try {
      const res = await api.getPypTrendAnalysis(token, activeExam.id, refresh);
      setTrendsData(res);
      if (refresh) {
        showToast('Trend analysis refreshed with latest PYP records!');
      }
    } catch (e: any) {
      showToast(e.message || 'Failed to compute exam trend analysis');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrends(false);
  }, [token, activeExam]);

  if (!activeExam) {
    return (
      <div className="view-container" style={{ padding: '40px', textAlign: 'center' }}>
        <div className="card" style={{ maxWidth: '500px', margin: '40px auto', padding: '36px' }}>
          <Icon name="bar-chart" size={40} />
          <h2 style={{ marginTop: '16px' }}>Select an Examination</h2>
          <p style={{ color: 'var(--muted)', margin: '12px 0 20px' }}>
            Please select an active examination to analyze historical examination trends and important topics.
          </p>
          <button className="btn primary" onClick={() => onNavigate('exams')}>
            Go to My Exams
          </button>
        </div>
      </div>
    );
  }

  const trends = trendsData?.trends || [];
  const papersAnalyzed = trendsData?.papers_analyzed || 0;
  const yearsCovered = trendsData?.years_covered || 'None';

  const categoryMap: Record<string, { label: string; icon: string; color: string }> = {
    high_historical_frequency: { label: 'High Historical Frequency', icon: '🔥', color: '#e74c3c' },
    high: { label: 'High Historical Frequency', icon: '🔥', color: '#e74c3c' },
    moderate_historical_frequency: { label: 'Moderate Historical Frequency', icon: '⚡', color: '#f39c12' },
    moderate: { label: 'Moderate Historical Frequency', icon: '⚡', color: '#f39c12' },
    lower_historical_frequency: { label: 'Lower Historical Frequency', icon: '📘', color: '#3498db' },
    lower: { label: 'Lower Historical Frequency', icon: '📘', color: '#3498db' },
    important_syllabus_fundamentals: { label: 'Important Syllabus Fundamentals', icon: '🎯', color: '#2ecc71' },
    fundamental: { label: 'Important Syllabus Fundamentals', icon: '🎯', color: '#2ecc71' },
    weak_areas_for_current_user: { label: 'User Weak Area', icon: '⚠️', color: '#e67e22' },
    weak_spot: { label: 'User Weak Area', icon: '⚠️', color: '#e67e22' },
    topics_requiring_revision: { label: 'Requires Spaced Revision', icon: '🔁', color: '#9b59b6' },
    insufficient_historical_data: { label: 'Insufficient Historical Data', icon: 'ℹ️', color: 'var(--muted)' }
  };

  const filteredTrends = trends.filter((t: any) => {
    if (selectedCategory !== 'all') {
      const cat = t.importance_category || t.frequency_category;
      if (selectedCategory === 'high' && !cat.includes('high')) return false;
      if (selectedCategory === 'moderate' && !cat.includes('moderate')) return false;
      if (selectedCategory === 'fundamental' && !cat.includes('fundamental')) return false;
      if (selectedCategory === 'weak' && !cat.includes('weak')) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        t.topic_name?.toLowerCase().includes(q) ||
        t.subject_name?.toLowerCase().includes(q) ||
        t.evidence_notes?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="view-container" style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--muted)', marginBottom: '4px' }}>
            <button className="linkbtn" onClick={() => onNavigate('pyp_library')}>
              Previous-Year Papers
            </button>
            <span>/</span>
            <span>AI Exam Trend Analyzer</span>
          </div>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800 }}>
            AI Exam Trend Analyzer & Important Topics
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '14px' }}>
            Evidence-based syllabus prioritization for <strong>{activeExam.exam_name}</strong> derived from verified question papers.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn" onClick={() => loadTrends(true)} disabled={loading}>
            <Icon name="refresh" size={14} /> Recalculate Trends
          </button>
          <button className="btn primary" onClick={() => onNavigate('predicted_papers')}>
            <Icon name="sparkles" size={14} /> Generate Predicted Paper &rarr;
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '18px' }}>
          <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Papers Analyzed
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
            {papersAnalyzed}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
            Verified examination sets
          </div>
        </div>

        <div className="card" style={{ padding: '18px' }}>
          <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Years Covered
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#f39c12', marginTop: '4px' }}>
            {yearsCovered}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
            Historical question window
          </div>
        </div>

        <div className="card" style={{ padding: '18px' }}>
          <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Syllabus Topics Tracked
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#2ecc71', marginTop: '4px' }}>
            {trends.length}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
            Topics categorized by priority
          </div>
        </div>

        <div className="card" style={{ padding: '18px' }}>
          <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Analysis Confidence
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: papersAnalyzed >= 2 ? '#2ecc71' : '#e67e22', marginTop: '6px' }}>
            {papersAnalyzed >= 3 ? 'High Evidence' : papersAnalyzed >= 1 ? 'Moderate Sample' : 'Preliminary'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
            Transparent methodology
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={`btn sm ${selectedCategory === 'all' ? 'primary' : ''}`}
            onClick={() => setSelectedCategory('all')}
          >
            All Topics ({trends.length})
          </button>
          <button
            className={`btn sm ${selectedCategory === 'high' ? 'primary' : ''}`}
            onClick={() => setSelectedCategory('high')}
          >
            🔥 High Frequency
          </button>
          <button
            className={`btn sm ${selectedCategory === 'moderate' ? 'primary' : ''}`}
            onClick={() => setSelectedCategory('moderate')}
          >
            ⚡ Moderate Frequency
          </button>
          <button
            className={`btn sm ${selectedCategory === 'fundamental' ? 'primary' : ''}`}
            onClick={() => setSelectedCategory('fundamental')}
          >
            🎯 Core Fundamentals
          </button>
          <button
            className={`btn sm ${selectedCategory === 'weak' ? 'primary' : ''}`}
            onClick={() => setSelectedCategory('weak')}
          >
            ⚠️ User Weak Areas
          </button>
        </div>

        <div style={{ minWidth: '240px' }}>
          <input
            type="text"
            placeholder="Search topic or concept..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', borderRadius: '8px' }}
          />
        </div>
      </div>

      {/* Transparent Disclaimer Banner */}
      <div
        style={{
          background: 'rgba(62, 123, 224, 0.05)',
          border: '1px solid rgba(62, 123, 224, 0.2)',
          borderRadius: '10px',
          padding: '14px 18px',
          marginBottom: '20px',
          fontSize: '12.5px',
          color: 'var(--muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}
      >
        <Icon name="info" size={16} />
        <div>
          <strong>Transparent Analysis Note:</strong> Topic frequency reflects occurrences in verified papers analyzed ({yearsCovered}).
          Lower historical frequency does not mean a syllabus topic is unimportant — fundamentals and syllabus changes remain fully preserved in your timetable.
        </div>
      </div>

      {/* Ranked Topic List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
          Computing historical question frequencies and topic correlation...
        </div>
      ) : filteredTrends.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          No topics matched the selected category filter.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredTrends.map((item: any, idx: number) => {
            const catInfo = categoryMap[item.importance_category || item.frequency_category] || {
              label: 'General Syllabus Topic',
              icon: '📘',
              color: 'var(--primary)'
            };
            const weightPct = item.weightage_percentage || item.weightage_percent || 0;
            const years = item.years_appeared || [];

            return (
              <div
                key={item.id || idx}
                className="card"
                style={{
                  padding: '20px',
                  borderRadius: '12px',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  alignItems: 'center',
                  gap: '20px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '18px' }}>{catInfo.icon}</span>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>
                      {item.topic_name}
                    </h3>
                    <span
                      className="pill"
                      style={{ fontSize: '10.5px', border: `1px solid ${catInfo.color}`, color: catInfo.color }}
                    >
                      {catInfo.label}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      &middot; {item.subject_name}
                    </span>
                  </div>

                  <p style={{ margin: '0 0 10px', fontSize: '13px', color: 'var(--muted)', lineHeight: '1.5' }}>
                    {item.evidence_notes || `Appeared frequently in competitive sets. Recommended focus for active recall.`}
                  </p>

                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center', fontSize: '12px' }}>
                    <div>
                      Questions in Analyzed Papers: <strong>{item.frequency_count || 0}</strong>
                    </div>
                    <div>&middot;</div>
                    <div>
                      Estimated Weightage: <strong>{weightPct}%</strong>
                    </div>
                    {years.length > 0 && (
                      <>
                        <div>&middot;</div>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <span>Appeared in:</span>
                          {years.map((y: any, yIdx: number) => (
                            <span key={yIdx} className="badge" style={{ fontSize: '10px' }}>{y}</span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '180px' }}>
                  <button
                    className="btn sm primary"
                    onClick={() => {
                      if (onOpenTopicInStudio && item.topic_id) {
                        onOpenTopicInStudio(item.topic_id);
                      } else {
                        onNavigate('ai_learning_studio');
                      }
                    }}
                  >
                    <Icon name="sparkles" size={13} /> Study in AI Studio
                  </button>
                  <button
                    className="btn sm"
                    onClick={() => onNavigate('mock_config')}
                  >
                    <Icon name="play" size={13} /> Practice Questions
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

