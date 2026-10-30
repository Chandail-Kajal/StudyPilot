/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/immutability */
/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CBTQuestion, CBTTestStartResponse, CBTTestSubmitResponse } from '@/types';
import { api } from '@/lib/api';
import { Icon } from '../Icons';

interface TestTakingViewProps {
  token: string | null;
  testId: string;
  onFinishTest: (result: CBTTestSubmitResponse) => void;
  onExit: () => void;
  showToast: (msg: string) => void;
}

export const TestTakingView: React.FC<TestTakingViewProps> = ({
  token,
  testId,
  onFinishTest,
  onExit,
  showToast
}) => {
  const [testData, setTestData] = useState<CBTTestStartResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);

  // User responses
  const [userAnswers, setUserAnswers] = useState<Record<string, number | null>>({});
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({});

  // Timer
  const [timeRemaining, setTimeRemaining] = useState<number>(3600);
  const timerRef = useRef<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    if (!token || !testId) return;
    setLoading(true);

    api.startCBTTest(token, testId)
      .then(res => {
        setTestData(res);
        const durationSecs = (res.test.duration_minutes || 60) * 60;
        setTimeRemaining(durationSecs);

        // Initialize user answers
        const initAnswers: Record<string, number | null> = {};
        res.questions.forEach((q: CBTQuestion) => {
          initAnswers[q.id] = null;
        });
        setUserAnswers(initAnswers);
        setLoading(false);
      })
      .catch((e: any) => {
        showToast(e.message || 'Failed to initialize test');
        setLoading(false);
        onExit();
      });
  }, [token, testId]);

  // Live Timer Interval
  useEffect(() => {
    if (loading || submitting || timeRemaining <= 0) return;

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleSubmitFinal();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [loading, submitting, timeRemaining]);

  const handleSubmitFinal = async () => {
    if (!token || !testData || submitting) return;
    setSubmitting(true);
    setShowConfirmModal(false);

    try {
      const elapsed = (testData.test.duration_minutes * 60) - timeRemaining;
      const res = await api.submitCBTTest(token, testData.test.id, {
        attempt_id: testData.attempt_id,
        user_answers: userAnswers,
        time_taken_seconds: Math.max(1, elapsed)
      });
      showToast(`Test submitted! Scored ${res.score} / ${res.total_marks}`);
      onFinishTest(res);
    } catch (e: any) {
      showToast(e.message || 'Failed to submit test');
      setSubmitting(false);
    }
  };

  if (loading || !testData) {
    return (
      <div className="view-container" style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--muted)' }}>
        <Icon name="test" size={48} />
        <h3 style={{ marginTop: '16px' }}>Entering CBT Exam Chamber...</h3>
        <p>Initializing secure question paper and candidate session.</p>
      </div>
    );
  }

  const questions = testData.questions;
  const currentQ = questions[currentIdx];
  const totalQ = questions.length;

  const answeredCount = Object.values(userAnswers).filter(a => a !== null).length;
  const markedCount = Object.values(markedForReview).filter(Boolean).length;
  const unansweredCount = totalQ - answeredCount;

  const mins = Math.floor(timeRemaining / 60);
  const secs = timeRemaining % 60;
  const timeFormatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  const isTimeCritical = timeRemaining < 300; // < 5 mins

  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* Top CBT Navigation Bar */}
      <header
        style={{
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🖥️ CBT Assessment:</span>
            <span style={{ color: 'var(--accent)' }}>{testData.test.test_name}</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
            Negative marking: {testData.test.negative_marking_enabled ? 'Enforced (-0.25 pts)' : 'Disabled'} &middot; Total Questions: {totalQ}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Countdown Clock */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              background: isTimeCritical ? 'rgba(229, 83, 83, 0.15)' : 'var(--bg)',
              color: isTimeCritical ? 'var(--danger)' : 'var(--text)',
              fontWeight: 800,
              fontSize: '18px',
              border: '1px solid var(--border)'
            }}
          >
            <span>⏱️</span>
            <span>{timeFormatted}</span>
          </div>

          <button
            className="btn primary"
            onClick={() => setShowConfirmModal(true)}
            disabled={submitting}
            style={{ fontWeight: 700 }}
          >
            {submitting ? 'Submitting...' : 'Submit Test'}
          </button>
        </div>
      </header>

      {/* Main CBT Workspace: Split Screen */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', overflow: 'hidden' }}>
        {/* Left: Question Viewer & Options */}
        <div style={{ padding: '32px 40px', overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span className="pill" style={{ fontSize: '12px', fontWeight: 700, background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                Question {currentIdx + 1} of {totalQ}
              </span>

              <div style={{ display: 'flex', gap: '8px', fontSize: '12px', color: 'var(--muted)' }}>
                <span>Subject: <b>{currentQ.subject}</b></span>
                <span>&middot;</span>
                <span>Topic: <b>{currentQ.topic}</b></span>
                <span>&middot;</span>
                <span>Marks: <b>+{currentQ.marks}</b></span>
              </div>
            </div>

            {/* Question Text */}
            <div
              style={{
                fontSize: '18px',
                fontWeight: 600,
                lineHeight: 1.5,
                marginBottom: '28px',
                color: 'var(--text)'
              }}
            >
              {currentQ.question}
            </div>

            {/* Options List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {currentQ.options.map((opt, optIdx) => {
                const isSelected = userAnswers[currentQ.id] === optIdx;

                return (
                  <label
                    key={optIdx}
                    onClick={() => {
                      setUserAnswers(prev => ({ ...prev, [currentQ.id]: optIdx }));
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '14px 18px',
                      borderRadius: '8px',
                      border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                      background: isSelected ? 'var(--accent-soft)' : 'var(--surface)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <input
                      type="radio"
                      name={`q_${currentQ.id}`}
                      checked={isSelected}
                      onChange={() => {}}
                      style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                    />
                    <span style={{ fontSize: '15px', color: isSelected ? 'var(--accent)' : 'var(--text)', fontWeight: isSelected ? 600 : 400 }}>
                      {String.fromCharCode(65 + optIdx)}. {opt}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Bottom Action Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '40px',
              borderTop: '1px solid var(--border)',
              paddingTop: '20px'
            }}
          >
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn"
                onClick={() => {
                  setMarkedForReview(prev => ({ ...prev, [currentQ.id]: !prev[currentQ.id] }));
                }}
                style={{
                  color: markedForReview[currentQ.id] ? '#7C62D9' : undefined,
                  borderColor: markedForReview[currentQ.id] ? '#7C62D9' : undefined
                }}
              >
                {markedForReview[currentQ.id] ? 'Unmark Review' : 'Mark for Review'}
              </button>

              <button
                className="btn"
                onClick={() => {
                  setUserAnswers(prev => ({ ...prev, [currentQ.id]: null }));
                }}
              >
                Clear Response
              </button>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn"
                disabled={currentIdx === 0}
                onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))}
              >
                &larr; Previous
              </button>

              <button
                className="btn primary"
                onClick={() => {
                  if (currentIdx < totalQ - 1) {
                    setCurrentIdx(prev => prev + 1);
                  } else {
                    setShowConfirmModal(true);
                  }
                }}
              >
                {currentIdx < totalQ - 1 ? 'Save & Next \u2192' : 'Review & Submit'}
              </button>
            </div>
          </div>
        </div>

        {/* Right: CBT Question Palette */}
        <aside
          style={{
            background: 'var(--surface)',
            borderLeft: '1px solid var(--border)',
            padding: '24px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            overflowY: 'auto'
          }}
        >
          <div>
            <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700 }}>
              Question Palette
            </h3>

            {/* Legend */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', marginBottom: '20px', color: 'var(--muted)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--good)' }} />
                <span>Answered ({answeredCount})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--border)' }} />
                <span>Not Answered ({unansweredCount})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#7C62D9' }} />
                <span>Marked Review ({markedCount})</span>
              </div>
            </div>

            {/* Palette Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
              {questions.map((q, idx) => {
                const isAns = userAnswers[q.id] !== null;
                const isMarked = markedForReview[q.id];
                const isCurrent = currentIdx === idx;

                let bg = 'var(--bg)';
                let color = 'var(--text)';
                if (isMarked) {
                  bg = '#7C62D9';
                  color = '#fff';
                } else if (isAns) {
                  bg = 'var(--good)';
                  color = '#fff';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIdx(idx)}
                    style={{
                      aspectRatio: '1',
                      borderRadius: '6px',
                      border: isCurrent ? '2px solid var(--text)' : '1px solid var(--border)',
                      background: bg,
                      color: color,
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <button
              className="btn danger"
              onClick={() => {
                if (window.confirm('Are you sure you want to abandon this examination attempt?')) {
                  onExit();
                }
              }}
              style={{ width: '100%', fontSize: '12px' }}
            >
              Abandon Examination
            </button>
          </div>
        </aside>
      </div>

      {/* Confirmation Modal before Submit */}
      {showConfirmModal && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowConfirmModal(false); }}>
          <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: '440px', textAlign: 'center' }}>
            <h2 style={{ margin: '0 0 12px', fontSize: '20px', fontWeight: 800 }}>Confirm Test Submission</h2>
            <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '20px' }}>
              Are you ready to submit your exam paper? Review your progress before proceeding:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', background: 'var(--bg)', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
              <div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--good)' }}>{answeredCount}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>Answered</div>
              </div>
              <div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--danger)' }}>{unansweredCount}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>Unanswered</div>
              </div>
              <div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#7C62D9' }}>{markedCount}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>Marked</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="btn" onClick={() => setShowConfirmModal(false)}>
                Return to Exam
              </button>
              <button className="btn primary" onClick={handleSubmitFinal} disabled={submitting}>
                {submitting ? 'Grading...' : 'Confirm Submission'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
