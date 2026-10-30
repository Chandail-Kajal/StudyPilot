'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Exam } from '@/types';
import { api } from '@/lib/api';
import { Icon } from '../Icons';

interface AILearningStudioViewProps {
  token: string | null;
  activeExam: Exam | null;
  topicId: string | null;
  onNavigate: (view: string) => void;
  showToast: (msg: string) => void;
  onOpenPracticeForTopic?: (topicId: string) => void;
}

export const AILearningStudioView: React.FC<AILearningStudioViewProps> = ({
  token,
  activeExam,
  topicId,
  onNavigate,
  showToast,
  onOpenPracticeForTopic
}) => {
  const [loading, setLoading] = useState(false);
  const [studioData, setStudioData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'learn' | 'activities' | 'comprehension' | 'practice' | 'tutor'>('learn');

  // Flashcards & Activities state
  const [currentFcIndex, setCurrentFcIndex] = useState(0);
  const [fcFlipped, setFcFlipped] = useState(false);
  const [reviewedFcIds, setReviewedFcIds] = useState<Set<string>>(new Set());
  
  // Flipcards state
  const [openFlipCardIds, setOpenFlipCardIds] = useState<Set<string>>(new Set());
  
  // Mini Quiz state
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  
  // Worked Examples state
  const [expandedExamples, setExpandedExamples] = useState<Set<number>>(new Set([0]));

  // Matching Exercise state
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Record<string, string>>({});

  // Comprehension checks state
  const [compAnswers, setCompAnswers] = useState<Record<number, number>>({});
  const [compSubmitted, setCompSubmitted] = useState(false);
  const [compScore, setCompScore] = useState<number>(0);

  // In-Topic AI Tutor Chat state
  const [chatMessages, setChatMessages] = useState<Array<{ role: string; message: string; created_at?: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Practice state inside studio
  const [practiceQuestions, setPracticeQuestions] = useState<any[]>([]);
  const [practiceDifficulty, setPracticeDifficulty] = useState<string>('intermediate');
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceAnswers, setPracticeAnswers] = useState<Record<string, string>>({});
  const [practiceEvaluations, setPracticeEvaluations] = useState<Record<string, any>>({});
  const [revealedHints, setRevealedHints] = useState<Set<string>>(new Set());
  const [immediateReveal, setImmediateReveal] = useState(true);

  // Load Studio Content
  const loadStudioContent = async (tid: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api.getInteractiveTopicStudio(token, tid);
      setStudioData(res);
      // Load chat history
      try {
        const hRes = await api.getTopicChatHistory(token, tid);
        if (hRes.history && hRes.history.length > 0) {
          setChatMessages(hRes.history);
        } else {
          setChatMessages([
            {
              role: 'assistant',
              message: `Hello! I am your AI Tutor for **${res.topic?.topic_name}**. Ask me to explain concepts in simpler words, provide more real-life examples, or test your comprehension step-by-step!`
            }
          ]);
        }
      } catch (err) {}
      // Load practice questions
      loadPracticeQuestions(tid, 'intermediate');
    } catch (e: any) {
      showToast(e.message || 'Failed to load topic studio');
    } finally {
      setLoading(false);
    }
  };

  const loadPracticeQuestions = async (tid: string, diff: string) => {
    if (!token) return;
    setPracticeLoading(true);
    try {
      const res = await api.getTopicPracticeQuestions(token, tid, diff);
      setPracticeQuestions(res.questions || []);
      setPracticeAnswers({});
      setPracticeEvaluations({});
    } catch (e: any) {
      console.error(e);
    } finally {
      setPracticeLoading(false);
    }
  };

  useEffect(() => {
    if (topicId) {
      loadStudioContent(topicId);
    }
  }, [topicId, token]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, activeTab]);

  // Flashcard Actions
  const handleNextFc = () => {
    const flashcards = studioData?.studio_content?.interactive_elements?.flashcards || [];
    if (currentFcIndex < flashcards.length - 1) {
      setCurrentFcIndex(currentFcIndex + 1);
      setFcFlipped(false);
    }
  };

  const handlePrevFc = () => {
    if (currentFcIndex > 0) {
      setCurrentFcIndex(currentFcIndex - 1);
      setFcFlipped(false);
    }
  };

  const handleMarkFcReviewed = (fcId: string) => {
    const nextSet = new Set(reviewedFcIds);
    nextSet.add(fcId);
    setReviewedFcIds(nextSet);
    if (token && topicId) {
      api.updateTopicInteraction(token, topicId, {
        flashcards_reviewed: nextSet.size
      }).catch(() => {});
    }
    showToast('Flashcard marked reviewed!');
  };

  // Submit Comprehension Checks
  const handleSubmitComprehension = async () => {
    const checks = studioData?.studio_content?.comprehension_checks || [];
    if (checks.length === 0) return;

    let correct = 0;
    checks.forEach((c: any, i: number) => {
      if (compAnswers[i] === c.correct_index) {
        correct++;
      }
    });

    const scorePct = Math.round((correct / checks.length) * 100);
    setCompScore(scorePct);
    setCompSubmitted(true);

    if (token && topicId) {
      try {
        await api.updateTopicInteraction(token, topicId, {
          comprehension_score: scorePct,
          mark_mastered: scorePct >= 75
        });
        if (scorePct >= 75) {
          showToast(`Mastery Achieved! Score: ${scorePct}%`);
        } else {
          showToast(`Comprehension recorded: ${scorePct}%. Review the explanations below.`);
        }
      } catch (err) {}
    }
  };

  // Chat with AI Tutor
  const handleSendChatMessage = async (msgOverride?: string) => {
    const query = (msgOverride || chatInput).trim();
    if (!query || !token || !topicId || chatLoading) return;

    const newMsgs = [...chatMessages, { role: 'user', message: query }];
    setChatMessages(newMsgs);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await api.chatWithTopicTutor(token, topicId, query, newMsgs);
      setChatMessages([...newMsgs, { role: 'assistant', message: res.reply }]);
    } catch (e: any) {
      showToast(e.message || 'AI Tutor temporarily unavailable');
      setChatMessages([...newMsgs, { role: 'assistant', message: 'I encountered an error replying. Please ask again.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Submit Single Practice Question
  const handlePracticeSubmit = async (q: any, chosenAnswer: string) => {
    if (!token || !topicId) return;
    setPracticeAnswers(prev => ({ ...prev, [q.id]: chosenAnswer }));

    try {
      const res = await api.submitTopicPracticeAnswer(token, topicId, {
        question_id: q.id,
        question_text: q.question,
        user_answer: chosenAnswer,
        correct_answer: q.correct_answer || (q.options ? q.options[q.correct_index || 0] : 'A'),
        difficulty: practiceDifficulty,
        used_hint: revealedHints.has(q.id)
      });
      setPracticeEvaluations(prev => ({ ...prev, [q.id]: res.evaluation }));
      if (res.evaluation?.is_correct) {
        showToast('Correct! Great job.');
      } else {
        showToast('Not quite. Review the mistake explanation.');
      }
    } catch (e: any) {
      showToast(e.message || 'Failed to submit practice question');
    }
  };

  if (!topicId) {
    return (
      <div className="view-container" style={{ padding: '32px', textAlign: 'center' }}>
        <div className="card" style={{ maxWidth: '540px', margin: '60px auto', padding: '40px' }}>
          <Icon name="sparkles" size={48} />
          <h2 style={{ marginTop: '16px', fontSize: '22px' }}>Interactive AI Learning Studio</h2>
          <p style={{ color: 'var(--muted)', margin: '12px 0 24px' }}>
            Select a topic from your syllabus to open its level-adapted interactive learning studio, flashcards, tutor, and practice exercises.
          </p>
          <button className="btn primary" onClick={() => onNavigate('manage_syllabus')}>
            <Icon name="layers" size={16} /> Open Syllabus Hierarchy
          </button>
        </div>
      </div>
    );
  }

  if (loading || !studioData) {
    return (
      <div className="view-container" style={{ padding: '60px', textAlign: 'center', color: 'var(--muted)' }}>
        <div style={{ animation: 'pulse 1.5s infinite', fontSize: '18px', fontWeight: 600 }}>
          <Icon name="sparkles" size={32} />
          <div style={{ marginTop: '12px' }}>Preparing Interactive AI Learning Studio...</div>
          <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
            Adapting explanations, flashcards, and checks to your learning level.
          </div>
        </div>
      </div>
    );
  }

  const topic = studioData.topic || {};
  const levelProfile = studioData.level_profile || {};
  const studioContent = studioData.studio_content || {};
  const interaction = studioData.interaction || {};
  const sections = studioContent.sections || [];
  const interactiveEls = studioContent.interactive_elements || {};
  const flashcards = interactiveEls.flashcards || [];
  const flipcards = interactiveEls.flip_cards || interactiveEls.flipcards || [];
  const miniQuiz = interactiveEls.mini_quiz || [];
  const matchingPairs = interactiveEls.matching_pairs || [];
  const workedExamples = interactiveEls.worked_examples || [];
  const mnemonics = interactiveEls.mnemonics || [];
  const compChecks = studioContent.comprehension_checks || [];
  const keyTakeaways = studioContent.key_takeaways || [];
  const prerequisites = studioContent.prerequisites || [];

  const currentFlashcard = flashcards[currentFcIndex];

  return (
    <div className="view-container" style={{ padding: '24px', maxWidth: '1300px', margin: '0 auto' }}>
      {/* Studio Header & Level Breadcrumb */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>
          <button className="linkbtn" onClick={() => onNavigate('manage_syllabus')}>
            &larr; Syllabus Hierarchy
          </button>
          <span>/</span>
          <span>{topic.subject_name || 'Subject'}</span>
          <span>/</span>
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>{topic.topic_name}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800 }}>
                {topic.topic_name}
              </h1>
              <span className="pill primary" style={{ fontSize: '11px', textTransform: 'capitalize' }}>
                🎓 {levelProfile.name || 'Level-Adapted'}
              </span>
              {interaction.has_mastered ? (
                <span className="pill good" style={{ fontSize: '11px' }}>
                  ✓ Mastered ({interaction.comprehension_score || 100}%)
                </span>
              ) : interaction.has_studied ? (
                <span className="pill" style={{ fontSize: '11px', background: 'var(--surface-hover)' }}>
                  📖 In Progress
                </span>
              ) : (
                <span className="pill" style={{ fontSize: '11px' }}>New Topic</span>
              )}
            </div>
            <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: '13px', maxWidth: '850px' }}>
              {studioContent.summary || `Personalized learning experience adapted for ${levelProfile.name || 'your education level'}.`}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              className="btn sm"
              onClick={() => {
                api.updateTopicInteraction(token!, topicId, { mark_mastered: true });
                showToast('Topic marked as Mastered!');
                setStudioData((prev: any) => ({
                  ...prev,
                  interaction: { ...prev.interaction, has_mastered: true, has_studied: true }
                }));
              }}
            >
              <Icon name="check" size={14} /> Mark Mastered
            </button>
            <button
              className="btn sm primary"
              onClick={() => setActiveTab('practice')}
            >
              <Icon name="play" size={14} /> Quick Practice
            </button>
          </div>
        </div>
      </div>

      {/* Topic Learning Flow Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '8px',
          marginBottom: '24px',
          overflowX: 'auto'
        }}
      >
        <button
          className={`btn sm ${activeTab === 'learn' ? 'primary' : ''}`}
          onClick={() => setActiveTab('learn')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Icon name="book" size={15} /> 1. Learn & Explore
        </button>
        <button
          className={`btn sm ${activeTab === 'activities' ? 'primary' : ''}`}
          onClick={() => setActiveTab('activities')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Icon name="layers" size={15} /> 2. Flashcards & Activities ({flashcards.length + flipcards.length})
        </button>
        <button
          className={`btn sm ${activeTab === 'comprehension' ? 'primary' : ''}`}
          onClick={() => setActiveTab('comprehension')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Icon name="check" size={15} /> 3. Check Understanding
          {compSubmitted && <span className="badge badge-sm" style={{ background: 'var(--good)' }}>{compScore}%</span>}
        </button>
        <button
          className={`btn sm ${activeTab === 'practice' ? 'primary' : ''}`}
          onClick={() => setActiveTab('practice')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Icon name="play" size={15} /> 4. Topic Practice ({practiceQuestions.length})
        </button>
        <button
          className={`btn sm ${activeTab === 'tutor' ? 'primary' : ''}`}
          onClick={() => setActiveTab('tutor')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}
        >
          <Icon name="sparkles" size={15} /> Ask AI Tutor
        </button>
      </div>

      {/* TAB 1: LEARN & EXPLORE (Chunked sections, no walls of text) */}
      {activeTab === 'learn' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Prerequisites Banner if any */}
            {prerequisites.length > 0 && (
              <div
                style={{
                  background: 'rgba(62, 123, 224, 0.08)',
                  border: '1px solid rgba(62, 123, 224, 0.25)',
                  borderRadius: '12px',
                  padding: '16px'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--primary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Icon name="info" size={14} /> Recommended Prerequisites Before You Begin
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {prerequisites.map((pre: string, idx: number) => (
                    <span key={idx} className="pill" style={{ fontSize: '12px' }}>
                      ✓ {pre}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Chunked Section Cards */}
            {sections.map((sec: any, idx: number) => (
              <div
                key={sec.id || idx}
                className="card"
                style={{ padding: '24px', borderRadius: '14px', border: '1px solid var(--border)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>
                    {sec.title}
                  </h3>
                  <span className="badge" style={{ fontSize: '10px' }}>Part {idx + 1} of {sections.length}</span>
                </div>

                {/* Concept text in clear paragraphs */}
                <p style={{ lineHeight: '1.7', fontSize: '14.5px', color: 'var(--text)', margin: '0 0 16px' }}>
                  {sec.content}
                </p>

                {/* Real-life example box */}
                {sec.real_life_example && (
                  <div
                    style={{
                      background: 'rgba(46, 204, 113, 0.08)',
                      borderLeft: '4px solid #2ecc71',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      marginBottom: '14px',
                      fontSize: '13.5px'
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#27ae60', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      🌱 Real-Life Example & Application
                    </div>
                    <div style={{ color: 'var(--text)', lineHeight: '1.5' }}>
                      {sec.real_life_example}
                    </div>
                  </div>
                )}

                {/* Analogy Box */}
                {sec.analogy && (
                  <div
                    style={{
                      background: 'rgba(243, 156, 18, 0.08)',
                      borderLeft: '4px solid #f39c12',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      marginBottom: '14px',
                      fontSize: '13.5px'
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#d35400', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      💡 Everyday Analogy
                    </div>
                    <div style={{ color: 'var(--text)', lineHeight: '1.5' }}>
                      {sec.analogy}
                    </div>
                  </div>
                )}

                {/* Formula or Code box if present */}
                {sec.formula_or_code && (
                  <div
                    style={{
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      marginBottom: '14px',
                      fontFamily: 'monospace',
                      fontSize: '13px',
                      whiteSpace: 'pre-wrap'
                    }}
                  >
                    <div style={{ fontWeight: 700, fontFamily: 'sans-serif', fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>
                      📐 Formula / Demonstration Snippet
                    </div>
                    <code>{sec.formula_or_code}</code>
                  </div>
                )}

                {/* Diagram Concept */}
                {sec.diagram_concept && (
                  <div
                    style={{
                      background: 'rgba(155, 89, 182, 0.08)',
                      border: '1px dashed rgba(155, 89, 182, 0.4)',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>📊</span>
                    <div>
                      <span style={{ fontWeight: 700, color: '#8e44ad' }}>Mental Concept Diagram: </span>
                      <span style={{ color: 'var(--text)' }}>{sec.diagram_concept}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Next Step Action Banner */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(62, 123, 224, 0.12), rgba(155, 89, 182, 0.12))',
                borderRadius: '12px',
                padding: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '15px' }}>Concept Reading Completed!</div>
                <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>
                  Next step in your learning sequence: Explore interactive flashcards and check your understanding.
                </div>
              </div>
              <button className="btn primary" onClick={() => setActiveTab('activities')}>
                Next: Flashcards & Activities &rarr;
              </button>
            </div>
          </div>

          {/* Sidebar: Key Takeaways & Quick Tutor Prompt */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Key Takeaways */}
            <div className="card" style={{ padding: '20px' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icon name="check" size={16} /> Key Takeaways
              </h4>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {keyTakeaways.map((point: string, idx: number) => (
                  <li key={idx} style={{ color: 'var(--text)' }}>{point}</li>
                ))}
              </ul>
            </div>

            {/* Quick Ask Tutor Box */}
            <div className="card" style={{ padding: '20px', background: 'rgba(62, 123, 224, 0.05)', border: '1px solid rgba(62, 123, 224, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <Icon name="sparkles" size={16} />
                <span style={{ fontWeight: 700, fontSize: '14px' }}>Stuck on this topic?</span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 12px' }}>
                Your level-adapted AI tutor is ready with instant personalized explanations:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button
                  className="btn sm"
                  style={{ textAlign: 'left', fontSize: '12px' }}
                  onClick={() => {
                    setActiveTab('tutor');
                    handleSendChatMessage('Can you explain this concept in simpler words for me?');
                  }}
                >
                  💬 Explain in simpler words
                </button>
                <button
                  className="btn sm"
                  style={{ textAlign: 'left', fontSize: '12px' }}
                  onClick={() => {
                    setActiveTab('tutor');
                    handleSendChatMessage('Can you give me another real-life example of this?');
                  }}
                >
                  🌱 Give me another real-life example
                </button>
                <button
                  className="btn sm"
                  style={{ textAlign: 'left', fontSize: '12px' }}
                  onClick={() => {
                    setActiveTab('tutor');
                    handleSendChatMessage('Break down this concept step-by-step for a beginner.');
                  }}
                >
                  🔢 Explain step-by-step for a beginner
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INTERACTIVE ACTIVITIES (Flashcards, Flip Cards, Matching, Worked Examples, Mnemonics) */}
      {activeTab === 'activities' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* Section 1: Active Recall Flashcard Deck */}
          {flashcards.length > 0 && currentFlashcard && (
            <div className="card" style={{ padding: '24px', maxWidth: '720px', margin: '0 auto', width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🃏 Interactive Flashcard Deck
                </span>
                <span className="badge" style={{ fontSize: '12px' }}>
                  Card {currentFcIndex + 1} of {flashcards.length}
                </span>
              </div>

              {/* 3D Flip Card Container */}
              <div
                onClick={() => setFcFlipped(!fcFlipped)}
                style={{
                  minHeight: '220px',
                  borderRadius: '16px',
                  background: fcFlipped
                    ? 'linear-gradient(135deg, var(--surface), rgba(62, 123, 224, 0.15))'
                    : 'linear-gradient(135deg, var(--surface), var(--surface-hover))',
                  border: fcFlipped ? '2px solid var(--primary)' : '1px solid var(--border)',
                  padding: '32px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
                }}
              >
                <span className="pill" style={{ fontSize: '10px', marginBottom: '16px' }}>
                  {fcFlipped ? 'Answer / Concept Insight' : currentFlashcard.tag || 'Definition'}
                </span>
                <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text)', lineHeight: '1.5' }}>
                  {fcFlipped ? currentFlashcard.back : currentFlashcard.front}
                </div>
                <span style={{ marginTop: '20px', fontSize: '11px', color: 'var(--muted)' }}>
                  Click to {fcFlipped ? 'view front' : 'flip & reveal answer'}
                </span>
              </div>

              {/* Flashcard Navigation Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                <button
                  className="btn sm"
                  onClick={handlePrevFc}
                  disabled={currentFcIndex === 0}
                >
                  &larr; Previous Card
                </button>
                <button
                  className={`btn sm ${reviewedFcIds.has(currentFlashcard.id) ? 'good' : ''}`}
                  onClick={() => handleMarkFcReviewed(currentFlashcard.id)}
                >
                  {reviewedFcIds.has(currentFlashcard.id) ? '✓ Reviewed' : 'Mark as Reviewed'}
                </button>
                <button
                  className="btn sm"
                  onClick={handleNextFc}
                  disabled={currentFcIndex === flashcards.length - 1}
                >
                  Next Card &rarr;
                </button>
              </div>
            </div>
          )}

          {/* Section 2: Flip Cards for Q&A */}
          {flipcards.length > 0 && (
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🎯 Concept Q&A Flip Cards
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                {flipcards.map((fl: any, idx: number) => {
                  const isOpen = openFlipCardIds.has(fl.id || String(idx));
                  return (
                    <div
                      key={fl.id || idx}
                      className="card"
                      style={{ padding: '18px', border: isOpen ? '1px solid var(--primary)' : '1px solid var(--border)' }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px' }}>
                        Q: {fl.question}
                      </div>
                      {isOpen ? (
                        <div style={{ background: 'rgba(62, 123, 224, 0.08)', borderRadius: '8px', padding: '12px', marginTop: '10px', fontSize: '13px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>Answer: </span>
                          <span>{fl.answer}</span>
                        </div>
                      ) : (
                        fl.hint && (
                          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                            Hint: {fl.hint}
                          </div>
                        )
                      )}
                      <button
                        className="btn sm"
                        style={{ marginTop: '12px', width: '100%' }}
                        onClick={() => {
                          const next = new Set(openFlipCardIds);
                          if (isOpen) next.delete(fl.id || String(idx));
                          else next.add(fl.id || String(idx));
                          setOpenFlipCardIds(next);
                        }}
                      >
                        {isOpen ? 'Hide Answer' : 'Reveal Answer'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 3: Worked Examples with Step-by-Step Expansion */}
          {workedExamples.length > 0 && (
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📐 Step-by-Step Worked Problems
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {workedExamples.map((ex: any, idx: number) => {
                  const isExp = expandedExamples.has(idx);
                  return (
                    <div key={idx} className="card" style={{ padding: '20px' }}>
                      <div
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                        onClick={() => {
                          const next = new Set(expandedExamples);
                          if (isExp) next.delete(idx);
                          else next.add(idx);
                          setExpandedExamples(next);
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: '15px' }}>
                          Example #{idx + 1}: {ex.problem}
                        </div>
                        <button className="linkbtn">
                          {isExp ? 'Collapse Steps ▲' : 'Show Solution Steps ▼'}
                        </button>
                      </div>

                      {isExp && (
                        <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                            {ex.steps?.map((step: string, sIdx: number) => (
                              <div
                                key={sIdx}
                                style={{
                                  background: 'var(--bg)',
                                  borderRadius: '8px',
                                  padding: '10px 14px',
                                  fontSize: '13px',
                                  borderLeft: '3px solid var(--primary)'
                                }}
                              >
                                {step}
                              </div>
                            ))}
                          </div>
                          <div
                            style={{
                              background: 'rgba(46, 204, 113, 0.1)',
                              border: '1px solid rgba(46, 204, 113, 0.3)',
                              borderRadius: '8px',
                              padding: '12px',
                              fontSize: '13.5px',
                              fontWeight: 600,
                              color: '#27ae60'
                            }}
                          >
                            Final Result: {ex.final_answer}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 4: Memory Tricks & Mnemonics */}
          {mnemonics.length > 0 && (
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🧠 Memory Tricks & Mnemonics
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                {mnemonics.map((mn: any, idx: number) => (
                  <div key={idx} className="card" style={{ padding: '18px', borderLeft: '4px solid #9b59b6' }}>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: '#8e44ad', marginBottom: '6px' }}>
                      "{mn.trick_phrase || mn.phrase || mn}"
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: '1.5' }}>
                      {mn.memory_explanation || mn.explanation || 'Use this trick to recall sequence and formulas under exam pressure.'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CHECK UNDERSTANDING (3 Graded Comprehension Checks) */}
      {activeTab === 'comprehension' && (
        <div style={{ maxWidth: '850px', margin: '0 auto' }}>
          <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px' }}>
              Comprehension Check: Demonstrate Understanding
            </h2>
            <p style={{ fontSize: '13.5px', color: 'var(--muted)', margin: 0 }}>
              Before marking this topic as mastered, answer these 3 quick concept verification questions.
              A score of 75% or higher unlocks topic mastery!
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {compChecks.map((q: any, qIdx: number) => {
              const selectedIdx = compAnswers[qIdx];
              const isSubmitted = compSubmitted;
              const isCorrect = selectedIdx === q.correct_index;

              return (
                <div key={qIdx} className="card" style={{ padding: '22px' }}>
                  <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '14px' }}>
                    {qIdx + 1}. {q.question}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {q.options?.map((opt: string, optIdx: number) => {
                      let btnStyle: React.CSSProperties = {
                        textAlign: 'left',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        cursor: isSubmitted ? 'default' : 'pointer',
                        fontSize: '13.5px'
                      };

                      if (isSubmitted) {
                        if (optIdx === q.correct_index) {
                          btnStyle.border = '2px solid #2ecc71';
                          btnStyle.background = 'rgba(46, 204, 113, 0.12)';
                        } else if (selectedIdx === optIdx) {
                          btnStyle.border = '2px solid #e74c3c';
                          btnStyle.background = 'rgba(231, 76, 60, 0.12)';
                        }
                      } else if (selectedIdx === optIdx) {
                        btnStyle.border = '2px solid var(--primary)';
                        btnStyle.background = 'rgba(62, 123, 224, 0.12)';
                      }

                      return (
                        <div
                          key={optIdx}
                          style={btnStyle}
                          onClick={() => {
                            if (!isSubmitted) {
                              setCompAnswers({ ...compAnswers, [qIdx]: optIdx });
                            }
                          }}
                        >
                          <span style={{ fontWeight: 600, marginRight: '8px' }}>
                            {String.fromCharCode(65 + optIdx)}.
                          </span>
                          {opt}
                        </div>
                      );
                    })}
                  </div>

                  {isSubmitted && (
                    <div
                      style={{
                        marginTop: '14px',
                        padding: '12px 14px',
                        borderRadius: '8px',
                        background: isCorrect ? 'rgba(46, 204, 113, 0.08)' : 'rgba(231, 76, 60, 0.08)',
                        fontSize: '13px'
                      }}
                    >
                      <div style={{ fontWeight: 700, color: isCorrect ? '#27ae60' : '#c0392b', marginBottom: '4px' }}>
                        {isCorrect ? '✓ Correct!' : '✗ Explanation:'}
                      </div>
                      <div style={{ color: 'var(--text)' }}>{q.explanation}</div>
                    </div>
                  )}
                </div>
              );
            })}

            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              {!compSubmitted ? (
                <button
                  className="btn primary"
                  style={{ padding: '12px 32px', fontSize: '15px' }}
                  disabled={Object.keys(compAnswers).length < compChecks.length}
                  onClick={handleSubmitComprehension}
                >
                  Submit Comprehension Checks
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button
                    className="btn"
                    onClick={() => {
                      setCompSubmitted(false);
                      setCompAnswers({});
                    }}
                  >
                    Retake Checks
                  </button>
                  <button
                    className="btn primary"
                    onClick={() => setActiveTab('practice')}
                  >
                    Proceed to Topic Practice &rarr;
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TOPIC PRACTICE (Configurable difficulty, instant feedback, hints) */}
      {activeTab === 'practice' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Practice Controls Bar */}
          <div className="card" style={{ padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontWeight: 700, fontSize: '14px' }}>Difficulty Level:</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['beginner', 'easy', 'intermediate', 'advanced', 'exam_level'].map(d => (
                  <button
                    key={d}
                    className={`btn sm ${practiceDifficulty === d ? 'primary' : ''}`}
                    style={{ textTransform: 'capitalize', fontSize: '12px' }}
                    onClick={() => {
                      setPracticeDifficulty(d);
                      if (topicId) loadPracticeQuestions(topicId, d);
                    }}
                  >
                    {d.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={immediateReveal}
                  onChange={(e) => setImmediateReveal(e.target.checked)}
                />
                Instant Answer Feedback
              </label>
              <button
                className="btn sm"
                onClick={() => topicId && loadPracticeQuestions(topicId, practiceDifficulty)}
              >
                <Icon name="refresh" size={14} /> Generate More Questions
              </button>
            </div>
          </div>

          {practiceLoading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
              Generating {practiceDifficulty} practice questions for {topic.topic_name}...
            </div>
          ) : practiceQuestions.length === 0 ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
              No practice questions generated yet. Click "Generate More Questions" above!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {practiceQuestions.map((q: any, qIdx: number) => {
                const userAns = practiceAnswers[q.id];
                const evalData = practiceEvaluations[q.id];
                const hintRevealed = revealedHints.has(q.id);

                return (
                  <div key={q.id || qIdx} className="card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span className="badge" style={{ fontSize: '11px', textTransform: 'capitalize' }}>
                        Question {qIdx + 1} &middot; {q.difficulty || practiceDifficulty}
                      </span>
                      {evalData && (
                        <span className={`pill ${evalData.is_correct ? 'good' : 'danger'}`} style={{ fontSize: '11px' }}>
                          {evalData.is_correct ? '✓ Correct Answer' : '✗ Incorrect Response'}
                        </span>
                      )}
                    </div>

                    <div style={{ fontWeight: 600, fontSize: '15px', lineHeight: '1.6', marginBottom: '16px' }}>
                      {q.question}
                    </div>

                    {/* Options Grid */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {q.options?.map((opt: string, optIdx: number) => {
                        const isChosen = userAns === opt || userAns === String(optIdx);
                        let borderStyle = '1px solid var(--border)';
                        let bgStyle = 'var(--surface)';

                        if (evalData) {
                          if (opt === evalData.correct_answer || optIdx === evalData.correct_index) {
                            borderStyle = '2px solid #2ecc71';
                            bgStyle = 'rgba(46, 204, 113, 0.12)';
                          } else if (isChosen && !evalData.is_correct) {
                            borderStyle = '2px solid #e74c3c';
                            bgStyle = 'rgba(231, 76, 60, 0.12)';
                          }
                        } else if (isChosen) {
                          borderStyle = '2px solid var(--primary)';
                          bgStyle = 'rgba(62, 123, 224, 0.12)';
                        }

                        return (
                          <div
                            key={optIdx}
                            style={{
                              padding: '12px 16px',
                              borderRadius: '8px',
                              border: borderStyle,
                              background: bgStyle,
                              cursor: evalData ? 'default' : 'pointer',
                              fontSize: '13.5px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}
                            onClick={() => {
                              if (!evalData) {
                                if (immediateReveal) {
                                  handlePracticeSubmit(q, opt);
                                } else {
                                  setPracticeAnswers(prev => ({ ...prev, [q.id]: opt }));
                                }
                              }
                            }}
                          >
                            <div>
                              <span style={{ fontWeight: 600, marginRight: '10px' }}>
                                {String.fromCharCode(65 + optIdx)}.
                              </span>
                              {opt}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Hint Button if not yet submitted or if struggling */}
                    {!evalData && q.hint && (
                      <div style={{ marginTop: '12px' }}>
                        {hintRevealed ? (
                          <div style={{ fontSize: '12.5px', color: '#f39c12', background: 'rgba(243, 156, 18, 0.08)', padding: '8px 12px', borderRadius: '6px' }}>
                            💡 <strong>Hint:</strong> {q.hint}
                          </div>
                        ) : (
                          <button
                            className="linkbtn"
                            style={{ fontSize: '12px', color: 'var(--muted)' }}
                            onClick={() => {
                              setRevealedHints(prev => new Set(prev).add(q.id));
                            }}
                          >
                            💡 Need a hint before answering?
                          </button>
                        )}
                      </div>
                    )}

                    {/* Submit button when immediateReveal is disabled */}
                    {!immediateReveal && !evalData && userAns && (
                      <button
                        className="btn sm primary"
                        style={{ marginTop: '14px' }}
                        onClick={() => handlePracticeSubmit(q, userAns)}
                      >
                        Submit Answer
                      </button>
                    )}

                    {/* Evaluation Details */}
                    {evalData && (
                      <div
                        style={{
                          marginTop: '16px',
                          borderTop: '1px solid var(--border)',
                          paddingTop: '14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          fontSize: '13px'
                        }}
                      >
                        <div>
                          <strong>Explanation: </strong>
                          <span style={{ color: 'var(--text)' }}>{evalData.explanation}</span>
                        </div>
                        {evalData.mistake_analysis && (
                          <div style={{ color: '#e74c3c' }}>
                            <strong>Common Pitfall: </strong>{evalData.mistake_analysis}
                          </div>
                        )}
                        {evalData.prerequisite_topic && (
                          <div style={{ color: 'var(--primary)', marginTop: '4px' }}>
                            📚 <strong>Recommended Review: </strong>{evalData.prerequisite_topic}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: ASK AI TUTOR (Contextual In-Topic Conversational AI) */}
      {activeTab === 'tutor' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px' }}>
          {/* Chat Window */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '620px', padding: 0 }}>
            {/* Chat Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <span className="mark" style={{ width: '28px', height: '28px', borderRadius: '8px' }}>
                <Icon name="sparkles" size={15} />
              </span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '14px' }}>AI Topic Tutor: {topic.topic_name}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                  Level: {levelProfile.name} &middot; Contextual In-Topic Assistant
                </div>
              </div>
            </div>

            {/* Chat Messages List */}
            <div
              ref={chatScrollRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}
            >
              {chatMessages.map((m, idx) => {
                const isUser = m.role === 'user';
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: isUser ? 'flex-end' : 'flex-start',
                      gap: '8px'
                    }}
                  >
                    {!isUser && (
                      <span className="mark" style={{ width: '26px', height: '26px', borderRadius: '6px', flexShrink: 0, marginTop: '2px' }}>
                        <Icon name="sparkles" size={13} />
                      </span>
                    )}
                    <div
                      style={{
                        maxWidth: '80%',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        background: isUser ? 'var(--primary)' : 'var(--surface-hover)',
                        color: isUser ? '#fff' : 'var(--text)',
                        fontSize: '13.5px',
                        lineHeight: '1.6',
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      {m.message}
                    </div>
                  </div>
                );
              })}
              {chatLoading && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                  <span className="mark" style={{ width: '24px', height: '24px', borderRadius: '6px' }}>
                    <Icon name="sparkles" size={12} />
                  </span>
                  <span>AI Tutor is thinking and structuring explanation...</span>
                </div>
              )}
            </div>

            {/* Chat Input Bar */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendChatMessage();
                }}
                style={{ display: 'flex', gap: '10px' }}
              >
                <input
                  type="text"
                  placeholder={`Ask anything about ${topic.topic_name}...`}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  style={{ flex: 1, borderRadius: '8px' }}
                  disabled={chatLoading}
                />
                <button type="submit" className="btn primary" disabled={chatLoading || !chatInput.trim()}>
                  <Icon name="send" size={16} /> Send
                </button>
              </form>
            </div>
          </div>

          {/* Quick Prompts Helper Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="card" style={{ padding: '18px' }}>
              <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icon name="sparkles" size={14} /> Quick In-Topic Questions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  'Explain this concept in simpler words.',
                  'Give me another real-life example.',
                  'Explain it step by step.',
                  'What is the difference between this and related concepts?',
                  'Why do students commonly get this wrong?',
                  'Test whether I have understood this topic.'
                ].map((promptText, i) => (
                  <button
                    key={i}
                    className="btn sm"
                    style={{ textAlign: 'left', fontSize: '12px', whiteSpace: 'normal', lineHeight: '1.4' }}
                    onClick={() => handleSendChatMessage(promptText)}
                    disabled={chatLoading}
                  >
                    💬 {promptText}
                  </button>
                ))}
              </div>
            </div>

            <div className="card" style={{ padding: '16px', background: 'var(--bg)' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted)', lineHeight: '1.5' }}>
                💡 <strong>Tutor Note:</strong> Answers are strictly contextualized to <strong>{topic.topic_name}</strong> and adhere to the <strong>{levelProfile.name}</strong> vocabulary and depth level.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

