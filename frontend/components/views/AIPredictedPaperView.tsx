'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Exam } from '@/types';
import { api } from '@/lib/api';
import { Icon } from '../Icons';

interface AIPredictedPaperViewProps {
  token: string | null;
  activeExam: Exam | null;
  onNavigate: (view: string) => void;
  showToast: (msg: string) => void;
}

export const AIPredictedPaperView: React.FC<AIPredictedPaperViewProps> = ({
  token,
  activeExam,
  onNavigate,
  showToast
}) => {
  const [papers, setPapers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Generation Modal Form state
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedMode, setSelectedMode] = useState<string>('exam_pattern');
  const [numQuestions, setNumQuestions] = useState<number>(20);
  const [timeLimitMins, setTimeLimitMins] = useState<number>(60);

  // Active Test-Taking State
  const [activePaper, setActivePaper] = useState<any | null>(null);
  const [currentQIndex, setCurrentQIndex] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [timeRemainingSecs, setTimeRemainingSecs] = useState<number>(60 * 60);
  const [testActive, setTestActive] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const loadPapers = async () => {
    if (!token || !activeExam) return;
    setLoading(true);
    try {
      const res = await api.listPredictedPapers(token, activeExam.id);
      setPapers(res.papers || []);
    } catch (e: any) {
      showToast(e.message || 'Failed to load predicted practice papers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPapers();
  }, [token, activeExam]);

  // Timer tick for active test
  useEffect(() => {
    if (testActive && timeRemainingSecs > 0) {
      timerRef.current = setTimeout(() => {
        setTimeRemainingSecs(prev => prev - 1);
      }, 1000);
    } else if (testActive && timeRemainingSecs <= 0) {
      handleAutoSubmitTest();
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [testActive, timeRemainingSecs]);

  const handleGeneratePaper = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeExam) return;
    setGenerating(true);
    try {
      const res = await api.generatePredictedPaper(token, {
        exam_id: activeExam.id,
        generation_mode: selectedMode,
        num_questions: numQuestions,
        time_limit_mins: timeLimitMins
      });
      showToast('AI predicted practice paper generated successfully!');
      setShowGenerateModal(false);
      loadPapers();
      if (res.paper) {
        startPaperAttempt(res.paper);
      }
    } catch (e: any) {
      showToast(e.message || 'Failed to generate practice paper');
    } finally {
      setGenerating(false);
    }
  };

  const startPaperAttempt = async (paperData: any) => {
    if (!token) return;
    try {
      // If questions are not attached, fetch detail
      let fullPaper = paperData;
      if (!paperData.questions || paperData.questions.length === 0) {
        const detailRes = await api.getPredictedPaperDetail(token, paperData.id);
        fullPaper = detailRes.paper;
      }
      setActivePaper(fullPaper);
      setCurrentQIndex(0);
      setUserAnswers({});
      setFlaggedQuestions(new Set());
      setTimeRemainingSecs((fullPaper.duration_minutes || 60) * 60);
      setTestResult(null);
      setTestActive(true);
    } catch (e: any) {
      showToast(e.message || 'Failed to launch paper');
    }
  };

  const handleAutoSubmitTest = () => {
    showToast('Time expired! Auto-submitting paper attempt.');
    handleSubmitTest();
  };

  const handleSubmitTest = () => {
    if (!activePaper) return;
    setTestActive(false);

    const questions = activePaper.questions || [];
    let correct = 0;
    let incorrect = 0;
    let unanswered = 0;
    let score = 0.0;
    const breakdown: any[] = [];
    const weakTopicsSet = new Set<string>();

    questions.forEach((q: any) => {
      const chosen = userAnswers[q.id];
      const correctAns = q.correct_answer;
      const isAnswered = chosen !== undefined && chosen !== null && chosen !== '';
      const isCorrect = isAnswered && chosen === correctAns;

      const marks = q.marks || 2.0;
      const negMarks = q.negative_marks || 0.5;

      if (!isAnswered) {
        unanswered++;
        breakdown.push({ ...q, chosen: null, is_correct: null, marks_awarded: 0 });
      } else if (isCorrect) {
        correct++;
        score += marks;
        breakdown.push({ ...q, chosen, is_correct: true, marks_awarded: marks });
      } else {
        incorrect++;
        score -= negMarks;
        weakTopicsSet.add(q.topic_name || 'General');
        breakdown.push({ ...q, chosen, is_correct: false, marks_awarded: -negMarks });
      }
    });

    const totalMarks = questions.reduce((acc: number, q: any) => acc + (q.marks || 2.0), 0);
    const pct = Math.max(0, Math.round((score / totalMarks) * 100));

    setTestResult({
      paper_title: activePaper.title,
      total_questions: questions.length,
      correct,
      incorrect,
      unanswered,
      score: Math.max(0, Math.round(score * 10) / 10),
      total_marks: totalMarks,
      percentage: pct,
      breakdown,
      weak_topics: Array.from(weakTopicsSet)
    });
  };

  const padNum = (n: number) => String(n).padStart(2, '0');
  const timerStr = `${padNum(Math.floor(timeRemainingSecs / 60))}:${padNum(timeRemainingSecs % 60)}`;

  if (!activeExam) {
    return (
      <div className="view-container" style={{ padding: '40px', textAlign: 'center' }}>
        <div className="card" style={{ maxWidth: '500px', margin: '40px auto', padding: '36px' }}>
          <Icon name="sparkles" size={40} />
          <h2 style={{ marginTop: '16px' }}>Select an Examination</h2>
          <p style={{ color: 'var(--muted)', margin: '12px 0 20px' }}>
            Please select an active examination to generate AI predicted practice papers.
          </p>
          <button className="btn primary" onClick={() => onNavigate('exams')}>
            Go to My Exams
          </button>
        </div>
      </div>
    );
  }

  // ACTIVE TEST TAKING VIEW
  if (testActive && activePaper) {
    const questions = activePaper.questions || [];
    const currentQ = questions[currentQIndex];
    const isFlagged = currentQ ? flaggedQuestions.has(currentQ.id) : false;
    const selectedAns = currentQ ? userAnswers[currentQ.id] : undefined;

    return (
      <div className="view-container" style={{ padding: '20px', maxWidth: '1280px', margin: '0 auto' }}>
        {/* CBT Top Bar */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '14px 20px',
            marginBottom: '18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>{activePaper.title}</h2>
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
              Mode: <span style={{ textTransform: 'capitalize' }}>{activePaper.generation_mode?.replace('_', ' ')}</span> &middot; CBT Simulation Mode
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: timeRemainingSecs < 300 ? 'rgba(231, 76, 60, 0.15)' : 'var(--bg)',
                color: timeRemainingSecs < 300 ? '#e74c3c' : 'var(--text)',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                fontWeight: 700,
                fontSize: '15px'
              }}
            >
              <Icon name="clock" size={16} />
              <span>{timerStr}</span>
            </div>

            <button
              className="btn danger sm"
              onClick={() => {
                if (window.confirm('Are you sure you want to finish and submit this predicted practice paper?')) {
                  handleSubmitTest();
                }
              }}
            >
              Submit Test
            </button>
          </div>
        </div>

        {/* Mandatory Disclaimer Ribbon */}
        <div
          style={{
            background: 'rgba(243, 156, 18, 0.08)',
            border: '1px solid rgba(243, 156, 18, 0.3)',
            borderRadius: '8px',
            padding: '10px 14px',
            fontSize: '11.5px',
            color: 'var(--muted)',
            marginBottom: '18px'
          }}
        >
          ⚠️ <strong>Mandatory Notice:</strong> AI-generated predicted practice paper — not an official examination paper or a guaranteed prediction of the upcoming exam. Historical patterns are evidence for practice planning, not a guarantee of future questions.
        </div>

        {/* CBT Body: Question Area (left) + Question Palette (right) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px' }}>
          {/* Question Box */}
          {currentQ && (
            <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <span className="badge" style={{ fontSize: '12px' }}>
                    Question {currentQIndex + 1} of {questions.length}
                  </span>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '12px', color: 'var(--muted)' }}>
                    <span>Marks: +{currentQ.marks || 2.0}</span>
                    <span>Negative: -{currentQ.negative_marks || 0.5}</span>
                    <button
                      className={`btn sm ${isFlagged ? 'warning' : ''}`}
                      onClick={() => {
                        const next = new Set(flaggedQuestions);
                        if (isFlagged) next.delete(currentQ.id);
                        else next.add(currentQ.id);
                        setFlaggedQuestions(next);
                      }}
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                    >
                      {isFlagged ? '🚩 Flagged' : '🏳️ Flag for Review'}
                    </button>
                  </div>
                </div>

                <div style={{ fontWeight: 600, fontSize: '16px', lineHeight: '1.6', marginBottom: '20px', color: 'var(--text)' }}>
                  {currentQ.question_text}
                </div>

                {/* Options List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {currentQ.options?.map((opt: string, optIdx: number) => {
                    const isChosen = selectedAns === opt;
                    return (
                      <div
                        key={optIdx}
                        style={{
                          padding: '14px 18px',
                          borderRadius: '10px',
                          border: isChosen ? '2px solid var(--primary)' : '1px solid var(--border)',
                          background: isChosen ? 'rgba(62, 123, 224, 0.12)' : 'var(--surface)',
                          cursor: 'pointer',
                          fontSize: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px'
                        }}
                        onClick={() => {
                          setUserAnswers(prev => ({ ...prev, [currentQ.id]: opt }));
                        }}
                      >
                        <span
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            border: isChosen ? '2px solid var(--primary)' : '1px solid var(--border)',
                            background: isChosen ? 'var(--primary)' : 'transparent',
                            color: isChosen ? '#fff' : 'var(--text)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '12px'
                          }}
                        >
                          {String.fromCharCode(65 + optIdx)}
                        </span>
                        <span>{opt}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Navigation Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '28px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <button
                  className="btn sm"
                  disabled={currentQIndex === 0}
                  onClick={() => setCurrentQIndex(prev => prev - 1)}
                >
                  &larr; Previous Question
                </button>

                <button
                  className="btn sm"
                  onClick={() => {
                    setUserAnswers(prev => {
                      const next = { ...prev };
                      delete next[currentQ.id];
                      return next;
                    });
                  }}
                >
                  Clear Selection
                </button>

                <button
                  className="btn sm primary"
                  disabled={currentQIndex === questions.length - 1}
                  onClick={() => setCurrentQIndex(prev => prev + 1)}
                >
                  Next Question &rarr;
                </button>
              </div>
            </div>
          )}

          {/* Question Palette Sidebar */}
          <div className="card" style={{ padding: '18px' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>
              Question Palette
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '16px' }}>
              {questions.map((q: any, i: number) => {
                const isAns = userAnswers[q.id] !== undefined;
                const isFlag = flaggedQuestions.has(q.id);
                const isCurr = i === currentQIndex;

                let bg = 'var(--surface)';
                let color = 'var(--text)';
                let border = '1px solid var(--border)';

                if (isCurr) {
                  border = '2px solid var(--primary)';
                }
                if (isAns) {
                  bg = 'rgba(46, 204, 113, 0.2)';
                  border = '1px solid #2ecc71';
                }
                if (isFlag) {
                  bg = 'rgba(243, 156, 18, 0.2)';
                  border = '1px solid #f39c12';
                }

                return (
                  <button
                    key={q.id || i}
                    onClick={() => setCurrentQIndex(i)}
                    style={{
                      height: '34px',
                      borderRadius: '6px',
                      background: bg,
                      color,
                      border,
                      fontWeight: 600,
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(46, 204, 113, 0.2)', border: '1px solid #2ecc71' }} />
                <span>Answered</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(243, 156, 18, 0.2)', border: '1px solid #f39c12' }} />
                <span>Flagged for Review</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--surface)', border: '1px solid var(--border)' }} />
                <span>Unanswered</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // TEST RESULTS BREAKDOWN VIEW
  if (testResult) {
    return (
      <div className="view-container" style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
        <div className="card" style={{ padding: '32px', textAlign: 'center', marginBottom: '24px' }}>
          <span className="badge" style={{ fontSize: '12px', marginBottom: '8px' }}>
            Test Performance Summary
          </span>
          <h1 style={{ margin: '8px 0', fontSize: '26px', fontWeight: 800 }}>
            {testResult.paper_title}
          </h1>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', margin: '24px 0', flexWrap: 'wrap' }}>
            <div style={{ padding: '16px 24px', background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--primary)' }}>{testResult.score} / {testResult.total_marks}</div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>Total Score ({testResult.percentage}%)</div>
            </div>
            <div style={{ padding: '16px 24px', background: 'rgba(46, 204, 113, 0.08)', borderRadius: '12px', border: '1px solid rgba(46, 204, 113, 0.3)' }}>
              <div style={{ fontSize: '32px', fontWeight: 800, color: '#27ae60' }}>{testResult.correct}</div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>Correct Questions</div>
            </div>
            <div style={{ padding: '16px 24px', background: 'rgba(231, 76, 60, 0.08)', borderRadius: '12px', border: '1px solid rgba(231, 76, 60, 0.3)' }}>
              <div style={{ fontSize: '32px', fontWeight: 800, color: '#c0392b' }}>{testResult.incorrect}</div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>Incorrect Answers</div>
            </div>
            <div style={{ padding: '16px 24px', background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--muted)' }}>{testResult.unanswered}</div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>Unanswered</div>
            </div>
          </div>

          {/* Weak Topics Recommended for Revision */}
          {testResult.weak_topics?.length > 0 && (
            <div style={{ background: 'rgba(231, 76, 60, 0.06)', border: '1px solid rgba(231, 76, 60, 0.2)', borderRadius: '10px', padding: '16px', maxWidth: '640px', margin: '0 auto 20px', textAlign: 'left' }}>
              <div style={{ fontWeight: 700, fontSize: '13px', color: '#c0392b', marginBottom: '6px' }}>
                ⚠️ Targeted Weak Areas to Revise:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {testResult.weak_topics.map((t: string, i: number) => (
                  <span key={i} className="pill danger" style={{ fontSize: '11px' }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button className="btn primary" onClick={() => startPaperAttempt(activePaper)}>
              Retake Practice Paper
            </button>
            <button className="btn" onClick={() => setTestResult(null)}>
              Back to Predicted Papers
            </button>
          </div>
        </div>

        {/* Detailed Question by Question Solution Breakdown */}
        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
          Solution Breakdown & Explanations ({testResult.breakdown?.length} Questions)
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {testResult.breakdown?.map((q: any, idx: number) => (
            <div key={q.id || idx} className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span className="badge" style={{ fontSize: '11px' }}>Question {idx + 1}</span>
                <span className={`pill ${q.is_correct === true ? 'good' : q.is_correct === false ? 'danger' : ''}`} style={{ fontSize: '11px' }}>
                  {q.is_correct === true ? '✓ Correct (+2.0)' : q.is_correct === false ? '✗ Incorrect (-0.5)' : 'Unanswered (0.0)'}
                </span>
              </div>

              <div style={{ fontWeight: 600, fontSize: '14.5px', marginBottom: '14px' }}>
                {q.question_text}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
                {q.options?.map((opt: string, optIdx: number) => {
                  const isCorrect = opt === q.correct_answer;
                  const isUserChoice = opt === q.chosen;

                  let border = '1px solid var(--border)';
                  let bg = 'var(--surface)';

                  if (isCorrect) {
                    border = '1px solid #2ecc71';
                    bg = 'rgba(46, 204, 113, 0.12)';
                  } else if (isUserChoice && !isCorrect) {
                    border = '1px solid #e74c3c';
                    bg = 'rgba(231, 76, 60, 0.12)';
                  }

                  return (
                    <div
                      key={optIdx}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '6px',
                        border,
                        background: bg,
                        fontSize: '13px'
                      }}
                    >
                      <span style={{ fontWeight: 600, marginRight: '8px' }}>
                        {String.fromCharCode(65 + optIdx)}.
                      </span>
                      {opt}
                      {isCorrect && <span style={{ float: 'right', color: '#27ae60', fontWeight: 700, fontSize: '11px' }}>✓ Correct Answer</span>}
                      {isUserChoice && !isCorrect && <span style={{ float: 'right', color: '#e74c3c', fontWeight: 700, fontSize: '11px' }}>Your Choice</span>}
                    </div>
                  );
                })}
              </div>

              {q.explanation && (
                <div style={{ fontSize: '12.5px', color: 'var(--text)', background: 'var(--bg)', padding: '10px 14px', borderRadius: '8px', lineHeight: '1.5' }}>
                  <strong>Solution & Rationale: </strong>{q.explanation}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // DEFAULT VIEW: LIST OF PREDICTED PAPERS + GENERATION MODES
  return (
    <div className="view-container" style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--muted)', marginBottom: '4px' }}>
            <button className="linkbtn" onClick={() => onNavigate('dashboard')}>
              Dashboard
            </button>
            <span>/</span>
            <span>AI Predicted Practice Papers</span>
          </div>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800 }}>
            AI Predicted Practice Papers
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '14px' }}>
            Target Exam: <strong>{activeExam.exam_name}</strong> &middot; Syllabus-based practice papers informed by verified historical patterns and user diagnostics.
          </p>
        </div>

        <button className="btn primary" onClick={() => setShowGenerateModal(true)}>
          <Icon name="sparkles" size={15} /> Generate New Predicted Paper
        </button>
      </div>

      {/* Mandatory Disclaimer Box */}
      <div
        style={{
          background: 'rgba(243, 156, 18, 0.08)',
          border: '1px solid rgba(243, 156, 18, 0.3)',
          borderRadius: '10px',
          padding: '14px 18px',
          fontSize: '12.5px',
          color: 'var(--text)',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}
      >
        <span style={{ fontSize: '22px' }}>⚠️</span>
        <div>
          <strong>AI Prediction Methodology & Disclaimer:</strong> AI-generated predicted practice paper — not an official examination paper or a guaranteed prediction of the upcoming exam. Historical patterns are evidence for strategic practice planning, not a guarantee of future questions.
        </div>
      </div>

      {/* Generation Modes Overview */}
      <div style={{ marginBottom: '28px' }}>
        <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '14px' }}>
          Available Prediction Modes
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          {[
            { mode: 'exam_pattern', title: '🎯 Exam Pattern Practice', desc: 'Mimics the configured examination format, section balance, and marking rules.' },
            { mode: 'high_priority', title: '🔥 High-Priority Topics', desc: 'Focuses strictly on historically recurring concepts and fundamental syllabus pillars.' },
            { mode: 'full_syllabus', title: '🌐 Full-Syllabus Practice', desc: 'Balanced question distribution across all units, chapters, and topics.' },
            { mode: 'weak_areas', title: '💡 Weak-Area Diagnostic', desc: 'Custom diagnostic targeted directly at your lower-performing syllabus topics.' },
            { mode: 'revision_paper', title: '🔁 Spaced Revision Paper', desc: 'Covers previously studied material to strengthen retention curve.' },
            { mode: 'last_minute', title: '⚡ Last-Minute Essentials', desc: 'Prioritizes maximum-yield formulas and concepts for crunch-time revision.' }
          ].map(m => (
            <div
              key={m.mode}
              className="card"
              style={{
                padding: '18px',
                cursor: 'pointer',
                border: '1px solid var(--border)',
                transition: 'border-color 0.2s ease'
              }}
              onClick={() => {
                setSelectedMode(m.mode);
                setShowGenerateModal(true);
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '14.5px', marginBottom: '6px' }}>{m.title}</div>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)', lineHeight: '1.4' }}>{m.desc}</p>
              <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>
                Click to Configure &rarr;
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Generated Papers History Grid */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
            Generated Predicted Papers ({papers.length})
          </h3>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
            Loading generated papers...
          </div>
        ) : papers.length === 0 ? (
          <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
            <Icon name="file-text" size={40} />
            <h4 style={{ marginTop: '14px', fontSize: '16px' }}>No Predicted Papers Generated Yet</h4>
            <p style={{ color: 'var(--muted)', maxWidth: '420px', margin: '8px auto 18px', fontSize: '13px' }}>
              Generate your first pattern-based practice paper for <strong>{activeExam.exam_name}</strong> to test your exam readiness.
            </p>
            <button className="btn primary" onClick={() => setShowGenerateModal(true)}>
              <Icon name="sparkles" size={14} /> Generate First Paper
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
            {papers.map(p => (
              <div key={p.id} className="card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span className="pill primary" style={{ fontSize: '10px', textTransform: 'capitalize' }}>
                      {p.generation_mode?.replace('_', ' ')}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                      {new Date(p.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 style={{ margin: '0 0 10px', fontSize: '16px', fontWeight: 700 }}>
                    {p.title}
                  </h3>

                  <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--muted)', background: 'var(--bg)', padding: '10px', borderRadius: '8px', marginBottom: '16px' }}>
                    <div>{p.total_questions || 20} Questions</div>
                    <div>&middot;</div>
                    <div>{p.duration_minutes || 60} Minutes</div>
                    <div>&middot;</div>
                    <div>Max Marks: {p.total_marks || 40}</div>
                  </div>
                </div>

                <button
                  className="btn primary sm"
                  style={{ width: '100%' }}
                  onClick={() => startPaperAttempt(p)}
                >
                  <Icon name="play" size={14} /> Launch Timed CBT Practice
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Generation Config Modal */}
      {showGenerateModal && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowGenerateModal(false); }}>
          <div className="modal" style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '20px' }}>Generate AI Predicted Paper</h2>
              <button className="linkbtn" onClick={() => setShowGenerateModal(false)}><Icon name="x" size={18} /></button>
            </div>

            <form onSubmit={handleGeneratePaper} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                Prediction Mode
                <select
                  value={selectedMode}
                  onChange={(e) => setSelectedMode(e.target.value)}
                  style={{ padding: '8px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                >
                  <option value="exam_pattern">🎯 Exam Pattern Practice (Standard Format)</option>
                  <option value="high_priority">🔥 High-Priority Topics (Recurring Concepts)</option>
                  <option value="full_syllabus">🌐 Full-Syllabus Practice (Complete Scope)</option>
                  <option value="weak_areas">💡 Weak-Area Reinforcement (Diagnostic)</option>
                  <option value="revision_paper">🔁 Spaced Retention Revision Paper</option>
                  <option value="last_minute">⚡ Last-Minute High-Yield Practice</option>
                </select>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                  Questions Count
                  <input
                    type="number"
                    min={5}
                    max={50}
                    value={numQuestions}
                    onChange={(e) => setNumQuestions(parseInt(e.target.value))}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                  Time Limit (Minutes)
                  <input
                    type="number"
                    min={10}
                    max={180}
                    value={timeLimitMins}
                    onChange={(e) => setTimeLimitMins(parseInt(e.target.value))}
                  />
                </label>
              </div>

              <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '12px', fontSize: '12px', color: 'var(--muted)', lineHeight: '1.4' }}>
                ℹ️ The predicted paper will correlate available previous-year papers with your current syllabus progress and synthesize verified-style problems.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn" onClick={() => setShowGenerateModal(false)}>Cancel</button>
                <button type="submit" className="btn primary" disabled={generating}>
                  {generating ? 'Synthesizing Paper...' : 'Generate & Begin Test'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
