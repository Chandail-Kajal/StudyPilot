'use client';

import React, { useState, useEffect } from 'react';
import { Exam, ExamAnalytics } from '@/types';
import { api } from '@/lib/api';
import { Icon } from '../Icons';

interface PerformanceAnalyticsViewProps {
  token: string | null;
  activeExam: Exam | null;
  onNavigate: (view: string) => void;
  showToast: (msg: string) => void;
}

export const PerformanceAnalyticsView: React.FC<PerformanceAnalyticsViewProps> = ({
  token,
  activeExam,
  onNavigate,
  showToast
}) => {
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState<ExamAnalytics | null>(null);

  const fetchAnalytics = async () => {
    if (!token || !activeExam) return;
    setLoading(true);
    try {
      const res = await api.getExamAnalytics(token, activeExam.id);
      setAnalytics(res.analytics);
    } catch (e: any) {
      showToast(e.message || 'Failed to load performance analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [token, activeExam]);

  if (!activeExam) {
    return (
      <div className="card text-center p-12">
        <Icon name="bar-chart" className="w-12 h-12 text-muted mx-auto mb-3" />
        <h3 className="text-xl font-bold mb-2">No Active Exam Selected</h3>
        <p className="text-muted mb-4">Please select an exam to view its performance analytics.</p>
        <button onClick={() => onNavigate('exams')} className="btn btn-primary">
          View My Exams
        </button>
      </div>
    );
  }

  const readiness = analytics?.readiness_index ?? 0;
  const totalTopics = analytics?.total_topics ?? 0;
  const masteredTopics = analytics?.mastered_topics ?? 0;
  const reviewingTopics = analytics?.reviewing_topics ?? 0;
  const unstartedTopics = analytics?.unstarted_topics ?? 0;
  const subjectProficiency = analytics?.subject_proficiency ?? [];
  const testStats = analytics?.test_stats ?? {
    total_attempts: 0,
    avg_score_pct: 0,
    total_questions_solved: 0,
    overall_accuracy_pct: 0
  };
  const weakTopics = analytics?.weak_topics ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="badge badge-primary">{activeExam.exam_category}</span>
            <span className="text-xs text-muted">Readiness & Mastery Analytics</span>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Icon name="bar-chart" className="text-primary w-6 h-6" />
            Performance Analytics: {activeExam.exam_name}
          </h1>
          <p className="text-sm text-muted">
            Holistic examination readiness index, subject proficiency meters, spaced repetition retention, and CBT test diagnostics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={fetchAnalytics} className="btn btn-outline flex items-center gap-2" disabled={loading}>
            <Icon name="refresh" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={() => onNavigate('mock_config')} className="btn btn-primary flex items-center gap-2">
            <Icon name="play" className="w-4 h-4" />
            Generate Assessment
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card p-12 text-center text-muted">
          <Icon name="refresh" className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
          Computing readiness metrics and analytics...
        </div>
      ) : (
        <>
          {/* Top Row: Readiness Index Banner & Testing KPIs */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Readiness Index Card */}
            <div className="card p-6 bg-gradient-to-br from-slate-900 via-primary/10 to-slate-900 border-primary/40 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider">Exam Readiness Index</span>
                  <span className={`badge ${readiness >= 75 ? 'badge-success' : readiness >= 50 ? 'badge-warning' : 'badge-danger'}`}>
                    {readiness >= 75 ? 'High Preparedness' : readiness >= 50 ? 'Moderate Progress' : 'Early Phase'}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black text-white">{readiness}</span>
                  <span className="text-xl text-muted font-bold">/ 100</span>
                </div>
                <p className="text-xs text-muted mt-2">
                  Calculated from syllabus completion ({masteredTopics}/{totalTopics} topics), spaced repetition review stages, and CBT test accuracy.
                </p>
              </div>

              <div className="mt-6">
                <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-700 ${
                      readiness >= 75 ? 'bg-success' : readiness >= 50 ? 'bg-primary' : 'bg-warning'
                    }`}
                    style={{ width: `${readiness}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted mt-2">
                  <span>Target: {activeExam.target_score || 85}%</span>
                  <span>Gap: {Math.max(0, (activeExam.target_score || 85) - readiness)}% to goal</span>
                </div>
              </div>
            </div>

            {/* Test Accuracy & Volume KPIs */}
            <div className="card p-6 col-span-1 lg:col-span-2 flex flex-col justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted mb-4">CBT Testing Trajectory</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="text-xs text-muted">Tests Taken</div>
                  <div className="text-2xl font-bold text-slate-100 mt-1">{testStats.total_attempts}</div>
                  <div className="text-xs text-muted mt-1">Mock attempts</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="text-xs text-muted">Avg Test Score</div>
                  <div className={`text-2xl font-bold mt-1 ${testStats.avg_score_pct >= 60 ? 'text-success' : 'text-warning'}`}>
                    {testStats.avg_score_pct}%
                  </div>
                  <div className="text-xs text-muted mt-1">Across all tests</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="text-xs text-muted">Questions Solved</div>
                  <div className="text-2xl font-bold text-info mt-1">{testStats.total_questions_solved}</div>
                  <div className="text-xs text-muted mt-1">CBT questions</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="text-xs text-muted">Overall Accuracy</div>
                  <div className={`text-2xl font-bold mt-1 ${testStats.overall_accuracy_pct >= 70 ? 'text-success' : 'text-warning'}`}>
                    {testStats.overall_accuracy_pct}%
                  </div>
                  <div className="text-xs text-muted mt-1">Hit rate</div>
                </div>
              </div>

              {/* Topic Mastery Distribution Bar */}
              <div className="mt-6 pt-4 border-t border-slate-800">
                <div className="flex justify-between items-center text-xs mb-2">
                  <span className="font-semibold text-slate-300">Syllabus Topic Mastery Status ({totalTopics} Total)</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-success"></span> Mastered: {masteredTopics}</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-warning"></span> Reviewing: {reviewingTopics}</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-slate-700"></span> Unstarted: {unstartedTopics}</span>
                  </div>
                </div>

                <div className="w-full bg-slate-800 rounded-full h-3 flex overflow-hidden">
                  <div style={{ width: `${totalTopics > 0 ? (masteredTopics / totalTopics) * 100 : 0}%` }} className="bg-success" title="Mastered" />
                  <div style={{ width: `${totalTopics > 0 ? (reviewingTopics / totalTopics) * 100 : 0}%` }} className="bg-warning" title="In Review" />
                  <div style={{ width: `${totalTopics > 0 ? (unstartedTopics / totalTopics) * 100 : 0}%` }} className="bg-slate-700" title="Unstarted" />
                </div>
              </div>
            </div>
          </div>

          {/* Subject Proficiency Meters */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Icon name="layers" className="w-5 h-5 text-primary" />
                Subject-Wise Proficiency Breakdown
              </h2>
              <button onClick={() => onNavigate('manage_syllabus')} className="btn btn-sm btn-outline text-xs">
                Manage Subjects
              </button>
            </div>

            {subjectProficiency.length === 0 ? (
              <p className="text-muted text-sm text-center py-6">No subjects found for this exam.</p>
            ) : (
              <div className="space-y-4">
                {subjectProficiency.map((subj: any) => {
                  const pct = subj.proficiency_percentage ?? subj.proficiency_percent ?? 0;
                  return (
                    <div key={subj.subject_name} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <span className="font-semibold text-slate-100 text-sm">{subj.subject_name}</span>
                          <span className="text-xs text-muted ml-2">
                            ({subj.mastered_topics} / {subj.total_topics || subj.topic_count || 0} topics mastered)
                          </span>
                        </div>
                        <span className={`font-mono font-bold text-sm ${pct >= 75 ? 'text-success' : pct >= 40 ? 'text-warning' : 'text-danger'}`}>
                          {pct}%
                        </span>
                      </div>

                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            pct >= 75 ? 'bg-success' : pct >= 40 ? 'bg-primary' : 'bg-warning'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Weak Topics Diagnostic */}
          {weakTopics.length > 0 && (
            <div className="card p-6 border-danger/30 bg-danger/5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-danger flex items-center gap-2">
                  <Icon name="alert-circle" className="w-5 h-5 text-danger" />
                  Priority Focus: Underperforming Topics
                </h3>
                <button onClick={() => onNavigate('smart_revision')} className="btn btn-sm btn-danger text-white">
                  Schedule Immediate Revision
                </button>
              </div>
              <p className="text-xs text-muted mb-4">
                These topics exhibited negative marks or high error rates during recent CBT test sessions:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {weakTopics.map((wt: any) => (
                  <div key={wt.topic_name} className="p-3 rounded-lg bg-slate-900/90 border border-danger/30 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-200">{wt.topic_name}</div>
                      <div className="text-xs text-muted">{wt.subject_name}</div>
                    </div>
                    <span className="badge badge-danger text-xs">{wt.incorrect_count || wt.completion_percentage || 0} Mistakes</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
