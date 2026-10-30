'use client';

import React, { useState, useEffect } from 'react';
import { Exam, CBTTestSubmitResponse } from '@/types';
import { api } from '@/lib/api';
import { Icon } from '../Icons';

interface TestHistoryViewProps {
  token: string | null;
  activeExam: Exam | null;
  onNavigate: (view: string) => void;
  showToast: (msg: string) => void;
  onSelectAttemptReview: (result: CBTTestSubmitResponse) => void;
}

interface AttemptItem {
  id: string;
  mock_test_id: string;
  test_name: string;
  test_type: string;
  total_questions: number;
  total_marks: number;
  score: number | null;
  correct_count: number;
  incorrect_count: number;
  unanswered_count: number;
  time_taken_seconds: number;
  status: string;
  started_at: string;
  submitted_at: string | null;
}

export const TestHistoryView: React.FC<TestHistoryViewProps> = ({
  token,
  activeExam,
  onNavigate,
  showToast,
  onSelectAttemptReview
}) => {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<AttemptItem[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [loadingAttemptId, setLoadingAttemptId] = useState<string | null>(null);

  const fetchHistory = async () => {
    if (!token || !activeExam) return;
    setLoading(true);
    try {
      const res = await api.getExamTestsHistory(token, activeExam.id);
      setHistory(res.history || []);
    } catch (e: any) {
      showToast(e.message || 'Failed to fetch test history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [token, activeExam]);

  const handleReviewAttempt = async (attemptId: string) => {
    if (!token) return;
    setLoadingAttemptId(attemptId);
    try {
      const res = await api.getAttemptReview(token, attemptId);
      onSelectAttemptReview(res);
      onNavigate('test_results');
    } catch (e: any) {
      showToast(e.message || 'Failed to load attempt breakdown');
    } finally {
      setLoadingAttemptId(null);
    }
  };

  const filteredHistory = history.filter(item => {
    if (typeFilter !== 'all' && item.test_type !== typeFilter) return false;
    return true;
  });

  const totalCompleted = history.filter(h => h.status === 'completed').length;
  const avgScorePct = totalCompleted > 0
    ? Math.round(
        history
          .filter(h => h.status === 'completed' && h.total_marks > 0)
          .reduce((acc, h) => acc + ((h.score || 0) / h.total_marks) * 100, 0) / totalCompleted
      )
    : 0;

  if (!activeExam) {
    return (
      <div className="card text-center p-12">
        <Icon name="award" className="w-12 h-12 text-muted mx-auto mb-3" />
        <h3 className="text-xl font-bold mb-2">No Active Exam Selected</h3>
        <p className="text-muted mb-4">Please select an exam to view past mock test attempts.</p>
        <button onClick={() => onNavigate('exams')} className="btn btn-primary">
          View My Exams
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="badge badge-primary">{activeExam.exam_category}</span>
            <span className="text-xs text-muted">Test Logs & CBT History</span>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Icon name="award" className="text-primary w-6 h-6" />
            Test History: {activeExam.exam_name}
          </h1>
          <p className="text-sm text-muted">
            Track past mock tests, performance trajectory, accuracy percentages, and in-depth question breakdowns.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={fetchHistory} className="btn btn-outline flex items-center gap-2" disabled={loading}>
            <Icon name="refresh" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={() => onNavigate('mock_config')} className="btn btn-primary flex items-center gap-2">
            <Icon name="plus" className="w-4 h-4" />
            Configure New Test
          </button>
        </div>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-xs font-medium text-muted uppercase tracking-wider mb-1">Tests Attempted</div>
          <div className="text-2xl font-bold text-primary">{history.length}</div>
          <div className="text-xs text-muted mt-1">{totalCompleted} completed</div>
        </div>

        <div className="card p-4">
          <div className="text-xs font-medium text-muted uppercase tracking-wider mb-1">Average Marks</div>
          <div className={`text-2xl font-bold ${avgScorePct >= 60 ? 'text-success' : 'text-warning'}`}>{avgScorePct}%</div>
          <div className="text-xs text-muted mt-1">Overall scoring avg</div>
        </div>

        <div className="card p-4">
          <div className="text-xs font-medium text-muted uppercase tracking-wider mb-1">Questions Answered</div>
          <div className="text-2xl font-bold text-info">
            {history.reduce((a, b) => a + (b.correct_count + b.incorrect_count), 0)}
          </div>
          <div className="text-xs text-muted mt-1">CBT test questions</div>
        </div>

        <div className="card p-4">
          <div className="text-xs font-medium text-muted uppercase tracking-wider mb-1">Overall Accuracy</div>
          <div className="text-2xl font-bold text-success">
            {(() => {
              const c = history.reduce((a, b) => a + b.correct_count, 0);
              const total = history.reduce((a, b) => a + (b.correct_count + b.incorrect_count), 0);
              return total > 0 ? `${Math.round((c / total) * 100)}%` : '0%';
            })()}
          </div>
          <div className="text-xs text-muted mt-1">Correct answer hit rate</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto">
          {['all', 'full_syllabus', 'subject', 'unit', 'topic', 'monthly'].map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`btn btn-sm capitalize ${typeFilter === t ? 'btn-primary' : 'btn-outline'}`}
            >
              {t.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="text-xs text-muted">
          Showing {filteredHistory.length} of {history.length} attempts
        </div>
      </div>

      {/* History Table */}
      {loading ? (
        <div className="card p-12 text-center text-muted">
          <Icon name="refresh" className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
          Loading your test history...
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="card p-12 text-center">
          <Icon name="award" className="w-12 h-12 text-muted mx-auto mb-3" />
          <h3 className="text-lg font-bold mb-1">No test attempts recorded yet</h3>
          <p className="text-sm text-muted mb-4">
            Take a mock test to generate CBT test attempt logs and diagnostic analytics.
          </p>
          <button onClick={() => onNavigate('mock_config')} className="btn btn-primary">
            Start a Mock Test
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/80 text-xs font-semibold text-muted uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-4">Test Name</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Date</th>
                  <th className="p-4 text-center">Score</th>
                  <th className="p-4 text-center">Accuracy</th>
                  <th className="p-4 text-center">Duration</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredHistory.map(item => {
                  const isCompleted = item.status === 'completed';
                  const totalAnswered = item.correct_count + item.incorrect_count;
                  const accuracy = totalAnswered > 0 ? Math.round((item.correct_count / totalAnswered) * 100) : 0;
                  const mins = Math.floor(item.time_taken_seconds / 60);
                  const secs = item.time_taken_seconds % 60;
                  const isReviewing = loadingAttemptId === item.id;

                  return (
                    <tr key={item.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="p-4">
                        <div className="font-semibold text-slate-100">{item.test_name}</div>
                        <div className="text-xs text-muted">{item.total_questions} Questions • {item.total_marks} Marks Max</div>
                      </td>

                      <td className="p-4">
                        <span className="badge badge-outline text-xs capitalize">
                          {item.test_type?.replace('_', ' ') || 'General'}
                        </span>
                      </td>

                      <td className="p-4 text-xs text-muted whitespace-nowrap">
                        {new Date(item.started_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </td>

                      <td className="p-4 text-center font-mono font-bold">
                        {isCompleted && item.score !== null ? (
                          <span className={item.score > (item.total_marks * 0.5) ? 'text-success' : 'text-warning'}>
                            {item.score} <span className="text-xs text-muted font-normal">/ {item.total_marks}</span>
                          </span>
                        ) : (
                          <span className="text-muted text-xs">—</span>
                        )}
                      </td>

                      <td className="p-4 text-center">
                        {isCompleted ? (
                          <span className={`font-semibold text-xs ${accuracy >= 70 ? 'text-success' : accuracy >= 40 ? 'text-warning' : 'text-danger'}`}>
                            {accuracy}%
                          </span>
                        ) : (
                          <span className="text-muted text-xs">—</span>
                        )}
                      </td>

                      <td className="p-4 text-center text-xs text-muted font-mono whitespace-nowrap">
                        {mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}
                      </td>

                      <td className="p-4 text-center">
                        <span className={`badge text-xs ${isCompleted ? 'badge-success' : 'badge-warning'}`}>
                          {item.status}
                        </span>
                      </td>

                      <td className="p-4 text-right">
                        {isCompleted ? (
                          <button
                            onClick={() => handleReviewAttempt(item.id)}
                            disabled={isReviewing}
                            className="btn btn-sm btn-outline text-xs flex items-center gap-1 ml-auto"
                          >
                            <Icon name="award" className="w-3.5 h-3.5 text-primary" />
                            {isReviewing ? 'Loading...' : 'Scorecard'}
                          </button>
                        ) : (
                          <button
                            onClick={() => onNavigate('mock_config')}
                            className="btn btn-sm btn-primary text-xs ml-auto"
                          >
                            Resume
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
