'use client';

import React from 'react';
import { CBTTestSubmitResponse, Exam } from '@/types';
import { Icon } from '../Icons';

interface TestResultsViewProps {
  result: CBTTestSubmitResponse | null;
  activeExam: Exam | null;
  onNavigate: (view: string) => void;
  onRetakeTest?: () => void;
}

export const TestResultsView: React.FC<TestResultsViewProps> = ({
  result,
  activeExam,
  onNavigate,
  onRetakeTest
}) => {
  if (!result) {
    return (
      <div className="card text-center p-12">
        <Icon name="award" className="w-12 h-12 text-muted mx-auto mb-3" />
        <h3 className="text-xl font-bold mb-2">No Test Results Available</h3>
        <p className="text-muted mb-4">Complete a mock test or select a test from history to view results.</p>
        <button onClick={() => onNavigate('mock_config')} className="btn btn-primary">
          Take a Mock Test
        </button>
      </div>
    );
  }

  const testName = result.test_name || (result as any).attempt?.test_name || 'CBT Mock Test';
  const score = result.score ?? (result as any).attempt?.score ?? 0;
  const total_marks = result.total_marks ?? (result as any).attempt?.test_total_marks ?? (result as any).attempt?.max_marks ?? 100;
  const correct_count = result.correct_count ?? (result as any).attempt?.correct_count ?? 0;
  const incorrect_count = result.incorrect_count ?? (result as any).attempt?.incorrect_count ?? 0;
  const unanswered_count = result.unanswered_count ?? (result as any).attempt?.unanswered_count ?? 0;
  const time_taken_seconds = result.time_taken_seconds ?? (result as any).attempt?.time_taken_seconds ?? 0;
  const negative_marks_deducted = result.negative_marks_deducted ?? 0;
  const weak_topics = result.weak_topics || [];
  const qList: any[] = result.question_breakdown || (result as any).breakdown || (result as any).answers || [];

  const totalQuestions = correct_count + incorrect_count + unanswered_count;
  const accuracyPct = totalQuestions > 0 ? Math.round((correct_count / totalQuestions) * 100) : 0;
  const scorePct = total_marks > 0 ? Math.round((score / total_marks) * 100) : 0;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="card p-6 bg-gradient-to-r from-slate-900 via-primary/10 to-slate-900 border-primary/30">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="badge badge-success">Attempt Submitted</span>
              {activeExam && <span className="text-xs text-muted">{activeExam.exam_name}</span>}
            </div>
            <h1 className="text-2xl font-bold">{testName} — Scorecard</h1>
            <p className="text-sm text-muted">
              Computer-Based Test (CBT) submission breakdown and active recall diagnostics.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onRetakeTest && (
              <button onClick={onRetakeTest} className="btn btn-primary flex items-center gap-2">
                <Icon name="refresh" className="w-4 h-4" />
                Retake Test
              </button>
            )}
            <button onClick={() => onNavigate('test_history')} className="btn btn-outline flex items-center gap-2">
              <Icon name="award" className="w-4 h-4" />
              All Attempts
            </button>
          </div>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="card p-4 text-center">
          <div className="text-xs font-semibold text-muted uppercase">Final Score</div>
          <div className="text-2xl font-black text-primary mt-1">
            {score} <span className="text-xs text-muted font-normal">/ {total_marks}</span>
          </div>
          <div className="text-xs text-muted mt-1">{scorePct}% marks</div>
        </div>

        <div className="card p-4 text-center">
          <div className="text-xs font-semibold text-muted uppercase">Accuracy</div>
          <div className={`text-2xl font-black mt-1 ${accuracyPct >= 70 ? 'text-success' : accuracyPct >= 40 ? 'text-warning' : 'text-danger'}`}>
            {accuracyPct}%
          </div>
          <div className="text-xs text-muted mt-1">Hit rate</div>
        </div>

        <div className="card p-4 text-center">
          <div className="text-xs font-semibold text-muted uppercase">Correct</div>
          <div className="text-2xl font-black text-success mt-1">{correct_count}</div>
          <div className="text-xs text-muted mt-1">+{correct_count * 2} raw marks</div>
        </div>

        <div className="card p-4 text-center">
          <div className="text-xs font-semibold text-muted uppercase">Incorrect</div>
          <div className="text-2xl font-black text-danger mt-1">{incorrect_count}</div>
          <div className="text-xs text-danger/80 mt-1">-{negative_marks_deducted || 0} neg</div>
        </div>

        <div className="card p-4 text-center">
          <div className="text-xs font-semibold text-muted uppercase">Unanswered</div>
          <div className="text-2xl font-black text-slate-400 mt-1">{unanswered_count}</div>
          <div className="text-xs text-muted mt-1">Skipped</div>
        </div>

        <div className="card p-4 text-center">
          <div className="text-xs font-semibold text-muted uppercase">Time Taken</div>
          <div className="text-2xl font-black text-info mt-1">{formatTime(time_taken_seconds || 0)}</div>
          <div className="text-xs text-muted mt-1">Avg {totalQuestions > 0 ? Math.round((time_taken_seconds || 0) / totalQuestions) : 0}s / Q</div>
        </div>
      </div>

      {/* Weak Topics Diagnostic Banner */}
      {weak_topics && weak_topics.length > 0 && (
        <div className="card p-5 border-warning/40 bg-warning/5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-warning flex items-center gap-2">
                <Icon name="alert-circle" className="w-5 h-5 text-warning" />
                Diagnostic: Weak Topics Identified for Revision
              </h3>
              <p className="text-xs text-muted mt-1">
                You made mistakes in these topics. StudyPilot has queued these for your next spaced revision cycle.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {weak_topics.map((t: string) => (
                  <span key={t} className="badge bg-warning/20 text-warning border-warning/40 font-mono text-xs">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={() => onNavigate('smart_revision')}
              className="btn btn-sm btn-warning text-slate-950 font-bold whitespace-nowrap"
            >
              Start Smart Revision
            </button>
          </div>
        </div>
      )}

      {/* Question by Question Detailed Review */}
      <div className="card p-6">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Icon name="layers" className="w-5 h-5 text-primary" />
          Question Breakdown & Explanations ({qList.length})
        </h2>

        <div className="space-y-4">
          {qList.map((item: any, idx: number) => {
            const isCorrect = item.is_correct === true;
            const selAnswer = item.selected_option !== undefined ? item.selected_option : item.user_answer ?? item.selected_answer;
            const isUnanswered = selAnswer === null || selAnswer === undefined || selAnswer === -1 || selAnswer === '-1';
            const isIncorrect = !isCorrect && !isUnanswered;
            const qText = item.question_text || item.question || 'Exam Question';
            const correctAnsStr = String(item.correct_option !== undefined ? item.correct_option : item.correct_answer ?? 0);

            return (
              <div
                key={item.question_id || idx}
                className={`p-4 rounded-xl border transition-all ${
                  isCorrect
                    ? 'border-success/30 bg-success/5'
                    : isIncorrect
                    ? 'border-danger/30 bg-danger/5'
                    : 'border-slate-800 bg-slate-900/40'
                }`}
              >
                {/* Question Header */}
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-300">Q{idx + 1}.</span>
                    {item.topic_name && (
                      <span className="badge badge-outline text-xs text-muted">
                        {item.topic_name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isCorrect && (
                      <span className="badge badge-success text-xs flex items-center gap-1">
                        <Icon name="check" className="w-3 h-3" /> Correct (+{item.marks_awarded})
                      </span>
                    )}
                    {isIncorrect && (
                      <span className="badge badge-danger text-xs">
                        Incorrect ({item.marks_awarded})
                      </span>
                    )}
                    {isUnanswered && (
                      <span className="badge bg-slate-800 text-slate-400 text-xs">
                        Unattempted (0)
                      </span>
                    )}
                  </div>
                </div>

                {/* Question Text */}
                <p className="text-base font-medium text-slate-100 mb-3 whitespace-pre-line">
                  {qText}
                </p>

                {/* Options List */}
                {item.options && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                    {item.options.map((opt: string, optIdx: number) => {
                      const isOptionCorrect = optIdx === Number(correctAnsStr) || opt === correctAnsStr;
                      const isOptionSelected = optIdx === Number(selAnswer) || opt === String(selAnswer);

                      let optClass = 'bg-slate-900 border-slate-800 text-slate-300';
                      if (isOptionCorrect) {
                        optClass = 'bg-success/20 border-success/60 text-success font-semibold';
                      } else if (isOptionSelected && !isCorrect) {
                        optClass = 'bg-danger/20 border-danger/60 text-danger font-semibold';
                      }

                      return (
                        <div
                          key={optIdx}
                          className={`p-2.5 rounded-lg border text-sm flex items-start gap-2 ${optClass}`}
                        >
                          <span className="font-mono text-xs w-5 h-5 rounded flex items-center justify-center bg-slate-800/80 shrink-0">
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <span className="flex-1">{opt}</span>
                          {isOptionCorrect && (
                            <span className="text-xs text-success font-bold shrink-0">✓ Correct Answer</span>
                          )}
                          {isOptionSelected && !isOptionCorrect && (
                            <span className="text-xs text-danger font-bold shrink-0">✗ Your Choice</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Explanation */}
                {item.explanation && (
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300 mt-2">
                    <span className="font-semibold text-primary block mb-1">Explanation:</span>
                    {item.explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
