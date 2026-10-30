'use client';

import React, { useState, useEffect } from 'react';
import { Exam } from '@/types';
import { api } from '@/lib/api';
import { Icon } from '../Icons';

interface PracticeViewProps {
  token: string | null;
  activeExam: Exam | null;
  initialTopicId?: string | null;
  onNavigate: (view: string) => void;
  showToast: (msg: string) => void;
  onOpenTopicInStudio?: (topicId: string) => void;
}

interface SyllabusTopic {
  id: string;
  topic_name: string;
  subject_id: string;
  subject_name: string;
  difficulty?: string;
  importance?: string;
  stage?: number;
}

interface PracticeQuestion {
  id: string;
  question_text: string;
  question_type?: 'mcq' | 'short_answer' | 'numerical' | 'application';
  options?: string[];
  correct_answer?: string | number;
  explanation: string;
  marks?: number;
  difficulty?: string;
  mistake_analysis?: string;
  key_takeaway?: string;
}

export const PracticeView: React.FC<PracticeViewProps> = ({
  token,
  activeExam,
  initialTopicId,
  onNavigate,
  showToast,
  onOpenTopicInStudio
}) => {
  const [topics, setTopics] = useState<SyllabusTopic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(initialTopicId || null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('intermediate');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  
  // Drill State
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string | number>>({});
  const [submittedAnswers, setSubmittedAnswers] = useState<Record<number, boolean>>({});
  const [drillCompleted, setDrillCompleted] = useState(false);
  const [evaluations, setEvaluations] = useState<Record<number, { is_correct: boolean; explanation: string; mistake: string }>>({});

  useEffect(() => {
    if (!token || !activeExam) return;
    setLoadingTopics(true);
    api.getSyllabusHierarchy(token, activeExam.id)
      .then(res => {
        const flat: SyllabusTopic[] = [];
        (res.hierarchy || []).forEach((subj: any) => {
          (subj.units || []).forEach((u: any) => {
            (u.topics || []).forEach((t: any) => {
              flat.push({
                id: t.id,
                topic_name: t.topic_name,
                subject_id: subj.id,
                subject_name: subj.subject_name,
                difficulty: t.difficulty,
                importance: t.importance,
                stage: t.stage || 0
              });
            });
          });
        });
        setTopics(flat);
        if (initialTopicId) {
          setSelectedTopicId(initialTopicId);
        } else if (flat.length > 0 && !selectedTopicId) {
          setSelectedTopicId(flat[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingTopics(false));
  }, [token, activeExam?.id]);

  useEffect(() => {
    if (selectedTopicId) {
      startPracticeDrill(selectedTopicId, selectedDifficulty);
    }
  }, [selectedTopicId, selectedDifficulty]);

  const startPracticeDrill = async (topicId: string, diff: string) => {
    if (!token) return;
    setLoadingQuestions(true);
    setCurrentIndex(0);
    setUserAnswers({});
    setSubmittedAnswers({});
    setEvaluations({});
    setDrillCompleted(false);

    try {
      const res = await api.getTopicPracticeQuestions(token, topicId, diff);
      setQuestions(res.questions || []);
    } catch (e: any) {
      showToast(e.message || 'Failed to generate practice questions');
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleSelectOption = (qIdx: number, val: string | number) => {
    if (submittedAnswers[qIdx]) return;
    setUserAnswers(prev => ({ ...prev, [qIdx]: val }));
  };

  const handleCheckAnswer = async (qIdx: number) => {
    const q = questions[qIdx];
    const ans = userAnswers[qIdx];
    if (ans === undefined || ans === '') {
      showToast('Please select or enter an answer first');
      return;
    }

    if (!token || !selectedTopicId) return;

    try {
      const res = await api.submitTopicPracticeAnswer(token, selectedTopicId, {
        question_id: q.id || `q_${qIdx}`,
        user_answer: String(ans),
        question_text: q.question_text,
        correct_answer: String(q.correct_answer || (q.options ? q.options[0] : '')),
        difficulty: selectedDifficulty,
        explanation: q.explanation || ''
      });

      const evalData = res.evaluation || res;

      setEvaluations(prev => ({
        ...prev,
        [qIdx]: {
          is_correct: !!evalData.is_correct,
          explanation: evalData.explanation || q.explanation,
          mistake: evalData.mistake_analysis || q.mistake_analysis || ''
        }
      }));
      setSubmittedAnswers(prev => ({ ...prev, [qIdx]: true }));

      if (evalData.is_correct) {
        showToast('✓ Correct! Great job.');
      } else {
        showToast('Review the detailed solution and mistake diagnosis below.');
      }
    } catch (e: any) {
      // Local fallback evaluation
      const isCorrect = typeof q.correct_answer === 'number'
        ? ans === q.correct_answer
        : String(ans).trim().toLowerCase() === String(q.correct_answer).trim().toLowerCase();
      
      setEvaluations(prev => ({
        ...prev,
        [qIdx]: {
          is_correct: isCorrect,
          explanation: q.explanation,
          mistake: isCorrect ? '' : (q.mistake_analysis || 'Concept application error.')
        }
      }));
      setSubmittedAnswers(prev => ({ ...prev, [qIdx]: true }));
    }
  };

  const handleFinishDrill = () => {
    setDrillCompleted(true);
    if (token && selectedTopicId) {
      const total = questions.length;
      const correct = Object.values(evaluations).filter(e => e.is_correct).length;
      const scorePct = Math.round((correct / Math.max(1, total)) * 100);
      
      api.updateTopicInteraction(token, selectedTopicId, {
        comprehension_score: scorePct,
        mark_mastered: scorePct >= 80
      }).catch(() => {});
    }
  };

  const selectedTopic = topics.find(t => t.id === selectedTopicId);
  const subjectsList = Array.from(new Set(topics.map(t => t.subject_name)));
  const filteredTopics = topics.filter(t => subjectFilter === 'all' || t.subject_name === subjectFilter);

  // Drill summary stats
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(submittedAnswers).length;
  const correctCount = Object.values(evaluations).filter(e => e.is_correct).length;
  const accuracyPct = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;

  if (!activeExam) {
    return (
      <div className="view-container" style={{ padding: '40px 24px', maxWidth: '800px', margin: '40px auto', textAlign: 'center' }}>
        <div className="card" style={{ padding: '48px 32px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 10px' }}>No Active Examination Selected</h2>
          <p style={{ color: 'var(--muted)', fontSize: '14px', maxWidth: '480px', margin: '0 auto 24px' }}>
            Please select or configure your target examination to access topic drills, practice questions, and instant mistake diagnostics.
          </p>
          <button className="btn primary" onClick={() => onNavigate('exams')}>
            Go to Examinations &rarr;
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="view-container" style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>📝</span>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>Topic-Wise Practice & Diagnostic Assessments</h1>
          </div>
          <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: '14px' }}>
            {activeExam ? `Topic drills, numerical solving & instant mistake diagnosis for ${activeExam.exam_name}.` : 'Practice & Assessments'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {selectedTopicId && onOpenTopicInStudio && (
            <button
              className="btn secondary"
              onClick={() => onOpenTopicInStudio(selectedTopicId)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
            >
              <Icon name="sparkles" size={15} /> Open in AI Class Studio
            </button>
          )}
          <button
            className="btn primary"
            onClick={() => onNavigate('mock_tests')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
          >
            <Icon name="test" size={15} /> Full CBT Mock Tests
          </button>
        </div>
      </div>

      {/* Main Grid: Left Topic Selector, Right Interactive Practice Drill */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 320px) 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Left Topic Selector Accordion */}
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>
              Syllabus Topics ({filteredTopics.length})
            </span>
          </div>

          {/* Subject Filter */}
          <div style={{ marginBottom: '14px' }}>
            <select
              value={subjectFilter}
              onChange={e => setSubjectFilter(e.target.value)}
              style={{ width: '100%', height: '36px', fontSize: '13px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--surface)' }}
            >
              <option value="all">All Subjects</option>
              {subjectsList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Difficulty Toggle */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase' }}>Difficulty Level</div>
            <div style={{ display: 'flex', gap: '4px', background: 'var(--surface2)', padding: '3px', borderRadius: '8px' }}>
              {(['easy', 'intermediate', 'hard'] as const).map(diff => (
                <button
                  key={diff}
                  className={`btn sm ${selectedDifficulty === diff ? 'primary' : 'secondary'}`}
                  style={{ flex: 1, padding: '4px 6px', fontSize: '11px', textTransform: 'capitalize' }}
                  onClick={() => setSelectedDifficulty(diff)}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>

          {/* Topic List */}
          {loadingTopics ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--muted)', fontSize: '13px' }}>Loading syllabus topics...</div>
          ) : (
            <div style={{ maxHeight: '520px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filteredTopics.map(t => {
                const isSelected = t.id === selectedTopicId;
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTopicId(t.id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(10, 108, 158, 0.12)' : 'var(--surface2)',
                      border: `1px solid ${isSelected ? 'var(--accent)' : 'transparent'}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: isSelected ? 800 : 600, color: isSelected ? 'var(--accent)' : 'var(--ink)' }}>
                        {t.topic_name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                        {t.subject_name}
                      </div>
                    </div>
                    {t.stage !== undefined && t.stage >= 3 && (
                      <span style={{ fontSize: '11px', color: 'var(--good)' }}>✓ Mastered</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Active Drill Interface */}
        <div>
          {loadingQuestions ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center', color: 'var(--muted)' }}>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>Generating Adaptive Questions...</div>
              <p style={{ fontSize: '13px', marginTop: '6px' }}>Preparing exam-oriented multiple choice, numerical, and conceptual questions.</p>
            </div>
          ) : !selectedTopic ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
              <div style={{ fontSize: '16px', fontWeight: 600 }}>Please select a topic from the left to start practice.</div>
            </div>
          ) : drillCompleted ? (
            /* Drill Complete Summary */
            <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
              <div style={{ fontSize: '42px', marginBottom: '14px' }}>🎯</div>
              <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 8px' }}>Practice Drill Completed!</h2>
              <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '24px' }}>
                Topic: <b>{selectedTopic.topic_name}</b> ({selectedTopic.subject_name})
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px', maxWidth: '600px', margin: '0 auto 28px' }}>
                <div style={{ padding: '16px', borderRadius: '10px', background: 'var(--surface2)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Questions</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>{totalQuestions}</div>
                </div>
                <div style={{ padding: '16px', borderRadius: '10px', background: 'var(--surface2)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>Correct Answers</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--good)', marginTop: '4px' }}>{correctCount}</div>
                </div>
                <div style={{ padding: '16px', borderRadius: '10px', background: 'var(--surface2)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>Accuracy Rate</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: accuracyPct >= 70 ? 'var(--good)' : 'var(--amber)', marginTop: '4px' }}>
                    {accuracyPct}%
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                <button
                  className="btn secondary"
                  onClick={() => startPracticeDrill(selectedTopic.id, selectedDifficulty)}
                >
                  <Icon name="refresh" size={15} /> Retake Drill
                </button>
                {onOpenTopicInStudio && (
                  <button
                    className="btn primary"
                    onClick={() => onOpenTopicInStudio(selectedTopic.id)}
                  >
                    <Icon name="sparkles" size={15} /> Review in AI Class Studio
                  </button>
                )}
              </div>
            </div>
          ) : questions.length === 0 ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
              <div style={{ fontSize: '16px', fontWeight: 600 }}>No practice questions available for this topic yet.</div>
              <button
                className="btn primary"
                style={{ marginTop: '16px' }}
                onClick={() => startPracticeDrill(selectedTopic.id, selectedDifficulty)}
              >
                Generate Practice Questions
              </button>
            </div>
          ) : (
            /* Active Question Card */
            <div>
              {/* Question Navigation Stepper */}
              <div className="card" style={{ padding: '12px 18px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ink)' }}>
                    Question {currentIndex + 1} of {questions.length}
                  </span>
                  <span style={{ marginLeft: '10px', fontSize: '12px', color: 'var(--muted)' }}>
                    ({selectedTopic.topic_name})
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  {questions.map((_, idx) => {
                    const isAns = submittedAnswers[idx];
                    const isCur = idx === currentIndex;
                    const isCorr = evaluations[idx]?.is_correct;

                    return (
                      <button
                        key={idx}
                        onClick={() => setCurrentIndex(idx)}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 700,
                          border: isCur ? '2px solid var(--accent)' : '1px solid var(--line)',
                          background: isAns ? (isCorr ? 'var(--good)' : 'var(--crit)') : (isCur ? 'var(--accent)' : 'var(--surface2)'),
                          color: isAns || isCur ? '#fff' : 'var(--muted)',
                          cursor: 'pointer'
                        }}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Question Body */}
              {(() => {
                const q = questions[currentIndex];
                const isSubmitted = submittedAnswers[currentIndex];
                const evalData = evaluations[currentIndex];
                const selectedOpt = userAnswers[currentIndex];

                return (
                  <div className="card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <span className="pill neutral" style={{ fontSize: '11px', textTransform: 'uppercase' }}>
                        {q.question_type || 'Multiple Choice'} • {q.difficulty || selectedDifficulty}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)' }}>
                        Marks: {q.marks || 2}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '16px', fontWeight: 700, lineHeight: 1.6, margin: '0 0 20px', color: 'var(--ink)' }}>
                      {q.question_text}
                    </h3>

                    {/* Options Grid */}
                    {q.options && q.options.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                        {q.options.map((opt, oIdx) => {
                          const isPicked = selectedOpt === oIdx;
                          let optBg = 'var(--surface2)';
                          let optBorder = 'var(--line)';

                          if (isSubmitted) {
                            if (evalData?.is_correct && isPicked) {
                              optBg = 'rgba(27, 133, 83, 0.15)';
                              optBorder = 'var(--good)';
                            } else if (!evalData?.is_correct && isPicked) {
                              optBg = 'rgba(194, 59, 48, 0.15)';
                              optBorder = 'var(--crit)';
                            } else if (typeof q.correct_answer === 'number' && q.correct_answer === oIdx) {
                              optBg = 'rgba(27, 133, 83, 0.15)';
                              optBorder = 'var(--good)';
                            }
                          } else if (isPicked) {
                            optBg = 'rgba(10, 108, 158, 0.12)';
                            optBorder = 'var(--accent)';
                          }

                          return (
                            <div
                              key={oIdx}
                              onClick={() => handleSelectOption(currentIndex, oIdx)}
                              style={{
                                padding: '12px 16px',
                                borderRadius: '10px',
                                border: `1px solid ${optBorder}`,
                                background: optBg,
                                cursor: isSubmitted ? 'default' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <span
                                style={{
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  background: isPicked ? 'var(--accent)' : 'var(--surface)',
                                  color: isPicked ? '#fff' : 'var(--muted)'
                                }}
                              >
                                {String.fromCharCode(65 + oIdx)}
                              </span>
                              <span style={{ fontSize: '14px', color: 'var(--ink)', flex: 1 }}>{opt}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ marginBottom: '20px' }}>
                        <input
                          type="text"
                          placeholder="Type your answer or numerical result..."
                          value={String(selectedOpt || '')}
                          disabled={isSubmitted}
                          onChange={e => handleSelectOption(currentIndex, e.target.value)}
                          style={{ width: '100%', height: '44px', fontSize: '14px', padding: '0 14px', borderRadius: '10px', border: '1px solid var(--line)', background: 'var(--surface)' }}
                        />
                      </div>
                    )}

                    {/* Submit / Check Answer Button */}
                    {!isSubmitted ? (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                        <button
                          className="btn primary"
                          onClick={() => handleCheckAnswer(currentIndex)}
                          disabled={selectedOpt === undefined}
                          style={{ padding: '8px 22px', fontSize: '13px' }}
                        >
                          Check Answer
                        </button>
                      </div>
                    ) : (
                      /* Post-Submission Feedback & Explanation */
                      <div
                        style={{
                          marginTop: '20px',
                          padding: '18px',
                          borderRadius: '10px',
                          background: evalData?.is_correct ? 'rgba(27, 133, 83, 0.08)' : 'rgba(194, 59, 48, 0.08)',
                          border: `1px solid ${evalData?.is_correct ? 'var(--good)' : 'var(--crit)'}`
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 800, color: evalData?.is_correct ? 'var(--good)' : 'var(--crit)', marginBottom: '8px' }}>
                          <Icon name={evalData?.is_correct ? 'check' : 'x'} size={18} />
                          {evalData?.is_correct ? 'Correct Answer!' : 'Incorrect Answer'}
                        </div>

                        <div style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--ink)', marginBottom: '10px' }}>
                          <b>Step-by-Step Solution:</b> {evalData?.explanation || q.explanation}
                        </div>

                        {evalData?.mistake && (
                          <div style={{ fontSize: '12px', color: 'var(--crit)', background: 'rgba(194, 59, 48, 0.1)', padding: '8px 12px', borderRadius: '6px' }}>
                            <b>Mistake Diagnosis:</b> {evalData.mistake}
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', gap: '10px' }}>
                          {currentIndex < questions.length - 1 ? (
                            <button
                              className="btn primary"
                              onClick={() => setCurrentIndex(currentIndex + 1)}
                            >
                              Next Question →
                            </button>
                          ) : (
                            <button
                              className="btn primary"
                              onClick={handleFinishDrill}
                            >
                              Complete Drill & View Score
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
