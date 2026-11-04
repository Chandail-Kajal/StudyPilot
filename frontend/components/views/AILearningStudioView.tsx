/* eslint-disable prefer-const */
/* eslint-disable react/no-unescaped-entities */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
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

// Helper to ensure flowchart and diagram SVGs never overflow their boxes and wrap text cleanly
const formatDiagramSvg = (rawSvg?: string | null, topicName: string = 'Core Concept'): string => {
  if (!rawSvg) return '';
  const cleanT = topicName.trim() || 'Core Concept';

  // Check if this SVG is the 3-node flowchart: Input -> Topic -> Output
  if ((rawSvg.includes('Input Stimulus') || rawSvg.includes('Input State')) && rawSvg.includes('Output')) {
    return `<svg viewBox="0 0 620 140" width="100%" height="100%" style="max-height: 140px; display: block; margin: 0 auto;">
      <defs>
        <linearGradient id="coreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0A6C9E" />
          <stop offset="100%" stop-color="#0284C7" />
        </linearGradient>
        <linearGradient id="outGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1B8553" />
          <stop offset="100%" stop-color="#10B981" />
        </linearGradient>
      </defs>
      
      <!-- Input State Box -->
      <rect x="20" y="42" width="125" height="52" rx="10" fill="#141E2A" stroke="#263648" stroke-width="1.5" />
      <text x="82" y="73" fill="#92A3B5" font-size="12" font-weight="600" font-family="system-ui, sans-serif" text-anchor="middle">Input State</text>
      
      <!-- Connecting Arrow 1 -->
      <line x1="145" y1="68" x2="195" y2="68" stroke="#54C2F0" stroke-width="2.5" stroke-dasharray="4" />
      <polygon points="195,68 188,64 188,72" fill="#54C2F0" />
      
      <!-- Center Topic Box: Wide 230px, foreignObject wraps text automatically without clipping -->
      <rect x="195" y="28" width="230" height="80" rx="14" fill="url(#coreGrad)" stroke="#54C2F0" stroke-width="1.5" />
      <foreignObject x="195" y="28" width="230" height="80">
        <div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;align-items:center;justify-content:center;height:100%;text-align:center;color:#FFFFFF;font-size:13px;font-weight:700;line-height:1.25;padding:6px 14px;font-family:system-ui,-apple-system,sans-serif;word-break:break-word;overflow:hidden;">
          ${cleanT}
        </div>
      </foreignObject>
      
      <!-- Connecting Arrow 2 -->
      <line x1="425" y1="68" x2="475" y2="68" stroke="#4CC98A" stroke-width="2.5" />
      <polygon points="475,68 468,64 468,72" fill="#4CC98A" />
      
      <!-- Output Box -->
      <rect x="475" y="42" width="125" height="52" rx="10" fill="url(#outGrad)" stroke="#4CC98A" stroke-width="1.5" />
      <text x="537" y="73" fill="#FFFFFF" font-size="12" font-weight="700" font-family="system-ui, sans-serif" text-anchor="middle">Output State</text>
    </svg>`;
  }

  // Check if this SVG is the concept badge
  if (rawSvg.includes('✦') && (rawSvg.includes('circle') || rawSvg.includes('concept_badge'))) {
    return `<svg viewBox="0 0 420 180" width="100%" height="100%" style="max-height: 160px; display: block; margin: 0 auto;">
      <rect x="20" y="20" width="380" height="140" rx="16" fill="#141E2A" stroke="#0A6C9E" stroke-width="2"/>
      <circle cx="210" cy="60" r="28" fill="#0A6C9E"/>
      <text x="210" y="67" fill="#FFFFFF" font-size="18" text-anchor="middle" font-weight="bold">✦</text>
      <foreignObject x="30" y="100" width="360" height="50">
        <div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;align-items:center;justify-content:center;height:100%;text-align:center;color:#E8EEF4;font-size:14px;font-weight:700;font-family:system-ui,-apple-system,sans-serif;word-break:break-word;overflow:hidden;">
          ${cleanT}
        </div>
      </foreignObject>
    </svg>`;
  }

  if (rawSvg.includes("width='140'") || rawSvg.includes('width="140"')) {
    return rawSvg.replace(/width=['"]140['"]/g, 'width="220"');
  }

  return rawSvg;
};

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
  const [activeTab, setActiveTab] = useState<'learn' | 'video' | 'activities' | 'comprehension' | 'practice' | 'tutor'>('learn');

  // Animated Video Player state
  const [videoData, setVideoData] = useState<any>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoEngine, setVideoEngine] = useState<'remotion' | 'manim' | 'hybrid'>('remotion');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSceneIdx, setCurrentSceneIdx] = useState(0);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [showCaptions, setShowCaptions] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [checkpointAnswers, setCheckpointAnswers] = useState<Record<number, number>>({});
  const [checkpointRevealed, setCheckpointRevealed] = useState<Record<number, boolean>>({});
  const [simParams, setSimParams] = useState<Record<number, number>>({});
  const [activeHotspot, setActiveHotspot] = useState<string | null>(null);
  const [showAnalogyMode, setShowAnalogyMode] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

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
  const [revealedSolutions, setRevealedSolutions] = useState<Set<number>>(new Set());
  const [revealedLearnHints, setRevealedLearnHints] = useState<Set<number>>(new Set());

  // Load Studio Content
  const loadStudioContent = async (tid: string) => {
    if (!token) return;
    setLoading(true);
    setRevealedSolutions(new Set());
    setRevealedLearnHints(new Set());
    setCheckpointAnswers({});
    setCheckpointRevealed({});
    setSimParams({});
    setActiveHotspot(null);
    try {
      const res = await api.getInteractiveTopicStudio(token, tid);
      setStudioData(res);
      if (res.video) {
        setVideoData(res.video);
      } else {
        try {
          const vRes = await api.getTopicVideo(token, tid);
          if (vRes.has_video && vRes.video) setVideoData(vRes.video);
        } catch (err) {}
      }
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

  // Video Generation & Playback Handlers
  const handleGenerateVideo = async (engine: string = videoEngine) => {
    if (!token || !topicId) return;
    setVideoLoading(true);
    try {
      const res = await api.generateTopicVideo(token, topicId, engine);
      if (res.video) {
        setVideoData(res.video);
        showToast('🎬 Animated Educational Video generated with voiceover!');
      }
    } catch (e: any) {
      showToast(e.message || 'Failed to generate video');
    } finally {
      setVideoLoading(false);
    }
  };

  const handleRegenerateVideo = async () => {
    if (!token || !topicId) return;
    setVideoLoading(true);
    try {
      const res = await api.regenerateTopicVideo(token, topicId, videoEngine);
      if (res.video) {
        setVideoData(res.video);
        showToast('🎬 Video regenerated successfully!');
      }
    } catch (e: any) {
      showToast(e.message || 'Failed to regenerate video');
    } finally {
      setVideoLoading(false);
    }
  };

  const togglePlayPause = () => {
    if (!audioRef.current) {
      setIsPlaying(!isPlaying);
      return;
    }
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(true));
    }
  };

  const jumpToScene = (idx: number) => {
    if (!videoData?.scenes_json) return;
    const scenes = videoData.scenes_json;
    if (idx < 0 || idx >= scenes.length) return;
    setCurrentSceneIdx(idx);
    setActiveHotspot(null);
    let targetTime = 0;
    for (let i = 0; i < idx; i++) {
      targetTime += parseFloat(scenes[i].duration_seconds || 18);
    }
    setPlaybackTime(targetTime);
    if (audioRef.current) {
      audioRef.current.currentTime = targetTime;
      if (!isPlaying) {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    }
  };

  // Synchronize playback timeline when playing without audio or updating time
  useEffect(() => {
    let interval: any;
    if (isPlaying && (!audioRef.current || audioRef.current.paused)) {
      interval = setInterval(() => {
        setPlaybackTime(prev => {
          const totalDur = parseFloat(videoData?.duration_seconds || 90);
          const next = prev + 0.5 * playbackSpeed;
          if (next >= totalDur) {
            setIsPlaying(false);
            return totalDur;
          }
          // Find matching scene
          let acc = 0;
          const scenes = videoData?.scenes_json || [];
          for (let i = 0; i < scenes.length; i++) {
            acc += parseFloat(scenes[i].duration_seconds || 18);
            if (next <= acc) {
              setCurrentSceneIdx(i);
              break;
            }
          }
          return next;
        });
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, videoData]);

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

  // 13-Point Structured Curriculum Content
  const topicIntro = studioContent.topic_introduction || topic.topic_name;
  const learningObjs: string[] = studioContent.learning_objectives || [];
  const simpleExpl = studioContent.simple_explanation || '';
  const detailedExpl = studioContent.detailed_explanation || '';
  const importantDefs: Array<{ term: string; definition: string }> = studioContent.important_definitions || [];
  const stepExamples: Array<{ title: string; problem: string; steps: string[]; solution: string }> = studioContent.step_by_step_examples || [];
  const realWorldApps: string[] = studioContent.real_world_applications || [];
  const importantFormulas: Array<{ name: string; formula: string; description: string; variables?: string[] }> = studioContent.important_formulas || [];
  const diagramsVisuals = studioContent.diagrams_and_visuals || null;
  const pointsToRemember: string[] = studioContent.points_to_remember || keyTakeaways || [];
  const topicSummary = studioContent.topic_summary || studioContent.summary || '';
  const practiceQList: Array<any> = studioContent.practice_questions || [];
  const faqList: Array<{ question: string; answer: string }> = studioContent.faqs || [];

  // Solutions and hints are tracked at top of component


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
          <Icon name="book" size={15} /> 1. 13-Point Curriculum
        </button>
        <button
          className={`btn sm ${activeTab === 'video' ? 'primary' : ''}`}
          onClick={() => setActiveTab('video')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Icon name="play" size={15} /> 2. Animated Video & Visuals {videoData ? '🎬' : ''}
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

      {/* TAB 1: 13-POINT COMPLETE CURRICULUM (All 13 Structured Sections) */}
      {activeTab === 'learn' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            {/* 1 & 2: Topic Introduction & Learning Objectives */}
            <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span className="pill primary" style={{ fontSize: '11px', fontWeight: 700 }}>SECTION 1 & 2</span>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Overview & Target Objectives</span>
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 10px', color: 'var(--text)' }}>
                {topic.topic_name}: Introduction
              </h2>
              <p style={{ fontSize: '14.5px', lineHeight: '1.7', color: 'var(--text)', margin: '0 0 16px' }}>
                {topicIntro}
              </p>

              {learningObjs.length > 0 && (
                <div style={{ background: 'var(--surface-hover)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Icon name="check" size={14} /> Core Learning Objectives
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {learningObjs.map((obj: string, oIdx: number) => (
                      <div key={oIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13.5px', color: 'var(--text)' }}>
                        <span style={{ color: 'var(--primary)', fontWeight: 700 }}>🎯</span>
                        <span>{obj}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 3: Simple Explanation (Analogy) */}
            {simpleExpl && (
              <div
                className="card"
                style={{
                  padding: '22px',
                  borderRadius: '16px',
                  background: 'rgba(243, 156, 18, 0.07)',
                  border: '1px solid rgba(243, 156, 18, 0.3)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span className="pill" style={{ background: 'rgba(243, 156, 18, 0.2)', color: '#d35400', fontSize: '11px', fontWeight: 700 }}>
                    SECTION 3 &middot; SIMPLE EXPLANATION
                  </span>
                  <span style={{ fontSize: '12px', color: '#d35400', fontWeight: 600 }}>💡 Intuitive Everyday Analogy</span>
                </div>
                <div style={{ fontSize: '14.5px', lineHeight: '1.7', color: 'var(--text)' }}>
                  {simpleExpl}
                </div>
              </div>
            )}

            {/* 4: Detailed Academic Explanation */}
            <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span className="pill primary" style={{ fontSize: '11px', fontWeight: 700 }}>SECTION 4</span>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Detailed Academic Theory</span>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 12px', color: 'var(--text)' }}>
                Comprehensive Theoretical Analysis
              </h3>
              <p style={{ fontSize: '14.5px', lineHeight: '1.75', color: 'var(--text)', margin: '0 0 16px' }}>
                {detailedExpl || (sections[0]?.content || 'Theoretical foundations and governing principles.')}
              </p>

              {/* Additional chunked parts if present */}
              {sections.slice(1).map((sec: any, idx: number) => (
                <div key={sec.id || idx} style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700 }}>{sec.title}</h4>
                  <p style={{ fontSize: '14px', lineHeight: '1.7', color: 'var(--text)', margin: 0 }}>{sec.content}</p>
                </div>
              ))}
            </div>

            {/* 5: Important Definitions */}
            {importantDefs.length > 0 && (
              <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span className="pill primary" style={{ fontSize: '11px', fontWeight: 700 }}>SECTION 5</span>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Key Definitions & Glossary</span>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 14px', color: 'var(--text)' }}>
                  Important Definitions
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                  {importantDefs.map((def: any, dIdx: number) => (
                    <div key={dIdx} style={{ padding: '14px 16px', background: 'var(--surface-hover)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--primary)', marginBottom: '4px' }}>
                        {def.term}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: '1.55' }}>
                        {def.definition}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 6: Step-by-Step Examples */}
            {stepExamples.length > 0 && (
              <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span className="pill primary" style={{ fontSize: '11px', fontWeight: 700 }}>SECTION 6</span>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Step-by-Step Worked Problems</span>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 14px', color: 'var(--text)' }}>
                  Worked Examples & Solutions
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {stepExamples.map((ex: any, eIdx: number) => (
                    <div key={eIdx} style={{ padding: '18px', background: 'var(--surface-hover)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)', marginBottom: '6px' }}>
                        {ex.title || `Worked Problem ${eIdx + 1}`}
                      </div>
                      <p style={{ fontSize: '14px', color: 'var(--text)', margin: '0 0 12px', fontStyle: 'italic' }}>
                        {ex.problem}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '0 0 12px' }}>
                        {(ex.steps || []).map((step: string, sIdx: number) => (
                          <div key={sIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13.5px', color: 'var(--text)' }}>
                            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{sIdx + 1}.</span>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ padding: '10px 14px', background: 'rgba(46, 204, 113, 0.08)', borderRadius: '8px', borderLeft: '4px solid #2ecc71', fontSize: '13px', color: 'var(--text)' }}>
                        <span style={{ fontWeight: 700, color: '#27ae60' }}>Final Verified Solution: </span>
                        <span>{ex.solution || ex.final_answer}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 7: Real-World Applications */}
            {realWorldApps.length > 0 && (
              <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span className="pill good" style={{ fontSize: '11px', fontWeight: 700 }}>SECTION 7</span>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Real-World & Industry Applications</span>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 14px', color: 'var(--text)' }}>
                  Practical Applications
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {realWorldApps.map((appStr: string, aIdx: number) => (
                    <div key={aIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px', background: 'var(--surface-hover)', borderRadius: '10px', fontSize: '13.5px' }}>
                      <span style={{ color: '#2ecc71', fontWeight: 700, flexShrink: 0 }}>🌍</span>
                      <span style={{ color: 'var(--text)' }}>{appStr}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 8: Important Formulas */}
            {importantFormulas.length > 0 && (
              <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span className="pill" style={{ background: 'rgba(240, 178, 60, 0.15)', color: '#A86B00', fontSize: '11px', fontWeight: 700 }}>
                    SECTION 8 &middot; FORMULAS
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Mathematical & Governing Laws</span>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 14px', color: 'var(--text)' }}>
                  Important Formulas
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {importantFormulas.map((form: any, fIdx: number) => (
                    <div key={fIdx} style={{ padding: '14px 18px', background: 'var(--surface-hover)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)' }}>{form.name}</span>
                      </div>
                      <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: '8px', fontFamily: 'monospace', fontSize: '14px', color: 'var(--primary)', marginBottom: '8px' }}>
                        📐 {form.formula}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '6px' }}>{form.description}</div>
                      {form.variables && form.variables.length > 0 && (
                        <div style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                          {form.variables.map((v: string, vIdx: number) => (
                            <span key={vIdx} className="pill" style={{ fontSize: '11px' }}>{v}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 9: Diagrams & Visual Representations */}
            {diagramsVisuals && (
              <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span className="pill primary" style={{ fontSize: '11px', fontWeight: 700 }}>SECTION 9</span>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Diagrams & Visual Models</span>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px', color: 'var(--text)' }}>
                  {diagramsVisuals.title || 'Visual Model Representation'}
                </h3>
                <p style={{ fontSize: '13.5px', color: 'var(--muted)', margin: '0 0 16px' }}>
                  {diagramsVisuals.description}
                </p>
                {diagramsVisuals.diagram_svg && (
                  <div
                    style={{
                      background: '#0C131B',
                      borderRadius: '14px',
                      padding: '24px 16px',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      overflowX: 'auto',
                      border: '1px solid #263648',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)'
                    }}
                    dangerouslySetInnerHTML={{ __html: formatDiagramSvg(diagramsVisuals.diagram_svg, topic.topic_name) }}
                  />
                )}
                {diagramsVisuals.ascii_art && !diagramsVisuals.diagram_svg && (
                  <pre style={{ background: 'var(--bg)', padding: '16px', borderRadius: '10px', fontSize: '12px', fontFamily: 'monospace', overflowX: 'auto', border: '1px solid var(--border)' }}>
                    {diagramsVisuals.ascii_art}
                  </pre>
                )}
              </div>
            )}

            {/* 10 & 11: Points to Remember & Topic Summary */}
            <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span className="pill primary" style={{ fontSize: '11px', fontWeight: 700 }}>SECTION 10 & 11</span>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Points to Remember & Summary</span>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 12px', color: 'var(--text)' }}>
                Important Points to Remember
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
                {pointsToRemember.map((pt: string, pIdx: number) => (
                  <div key={pIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13.5px' }}>
                    <span style={{ color: 'var(--primary)', fontWeight: 700 }}>📌</span>
                    <span style={{ color: 'var(--text)' }}>{pt}</span>
                  </div>
                ))}
              </div>

              <div style={{ padding: '16px', background: 'var(--surface-hover)', borderRadius: '12px', borderLeft: '4px solid var(--primary)' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--primary)', marginBottom: '4px' }}>
                  Topic Summary
                </div>
                <div style={{ fontSize: '13.5px', color: 'var(--text)', lineHeight: '1.6' }}>
                  {topicSummary}
                </div>
              </div>
            </div>

            {/* 12: Practice Questions with Step-by-Step Solutions */}
            {practiceQList.length > 0 && (
              <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span className="pill primary" style={{ fontSize: '11px', fontWeight: 700 }}>SECTION 12</span>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Self-Assessment Questions</span>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 14px', color: 'var(--text)' }}>
                  Practice Questions & Evaluation
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {practiceQList.map((q: any, qIdx: number) => {
                    const isSolRevealed = revealedSolutions.has(qIdx);
                    const isHintRevealed = revealedLearnHints.has(qIdx);

                    return (
                      <div key={qIdx} style={{ padding: '18px', background: 'var(--surface-hover)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <div style={{ fontWeight: 700, fontSize: '14.5px', color: 'var(--text)', marginBottom: '10px' }}>
                          Q{qIdx + 1}: {q.question}
                        </div>
                        {q.options && q.options.length > 0 && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', marginBottom: '12px' }}>
                            {q.options.map((opt: string, optIdx: number) => (
                              <div
                                key={optIdx}
                                style={{
                                  padding: '8px 12px',
                                  borderRadius: '8px',
                                  background: 'var(--bg)',
                                  border: '1px solid var(--border)',
                                  fontSize: '13px'
                                }}
                              >
                                <span style={{ fontWeight: 700, marginRight: '6px' }}>{String.fromCharCode(65 + optIdx)}.</span>
                                {opt}
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {q.hint && (
                            <button
                              className="btn sm"
                              style={{ fontSize: '11px' }}
                              onClick={() => {
                                const next = new Set(revealedLearnHints);
                                if (next.has(qIdx)) next.delete(qIdx);
                                else next.add(qIdx);
                                setRevealedLearnHints(next);
                              }}
                            >
                              💡 {isHintRevealed ? 'Hide Hint' : 'Show Hint'}
                            </button>
                          )}
                          <button
                            className="btn sm primary"
                            style={{ fontSize: '11px' }}
                            onClick={() => {
                              const next = new Set(revealedSolutions);
                              if (next.has(qIdx)) next.delete(qIdx);
                              else next.add(qIdx);
                              setRevealedSolutions(next);
                            }}
                          >
                            ✓ {isSolRevealed ? 'Hide Solution' : 'Reveal Solution'}
                          </button>
                        </div>
                        {isHintRevealed && q.hint && (
                          <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(243, 156, 18, 0.08)', borderRadius: '8px', fontSize: '12.5px', color: '#d35400' }}>
                            <strong>Hint: </strong>{q.hint}
                          </div>
                        )}
                        {isSolRevealed && (
                          <div style={{ marginTop: '10px', padding: '12px', background: 'rgba(46, 204, 113, 0.08)', borderRadius: '8px', fontSize: '13px', color: 'var(--text)' }}>
                            <strong>Correct Option: </strong>{String.fromCharCode(65 + (q.correct_idx || 0))}<br />
                            <strong>Step-by-Step Solution: </strong>{q.solution}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 13: Frequently Asked Questions (FAQs) */}
            {faqList.length > 0 && (
              <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span className="pill primary" style={{ fontSize: '11px', fontWeight: 700 }}>SECTION 13</span>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Frequently Asked Questions</span>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 14px', color: 'var(--text)' }}>
                  Frequently Asked Questions (FAQs)
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {faqList.map((faq: any, fIdx: number) => (
                    <div key={fIdx} style={{ padding: '14px 16px', background: 'var(--surface-hover)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)', marginBottom: '4px' }}>
                        ❓ {faq.question}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.55' }}>
                        {faq.answer}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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

      {/* TAB: ANIMATED EDUCATIONAL VIDEO & VISUALS */}
      {activeTab === 'video' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Video Header Card */}
          <div className="card" style={{ padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span className="pill primary" style={{ fontSize: '11px', fontWeight: 700 }}>
                  🎬 {videoData?.engine ? videoData.engine.toUpperCase() : videoEngine.toUpperCase()} VIDEO
                </span>
                <span className="pill" style={{ fontSize: '11px' }}>
                  ⏱ {videoData?.duration_seconds ? `${Math.round(videoData.duration_seconds)}s` : '90s'}
                </span>
                {videoData?.status === 'completed' && (
                  <span className="pill good" style={{ fontSize: '11px' }}>✓ Audio Synced</span>
                )}
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>
                {videoData?.title || `Visual Masterclass: ${topic.topic_name}`}
              </h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <select
                value={videoEngine}
                onChange={(e) => setVideoEngine(e.target.value as any)}
                style={{ height: '34px', fontSize: '12px', padding: '0 10px', borderRadius: '8px', background: 'var(--surface2)', borderColor: 'var(--line)', color: 'var(--ink)' }}
              >
                <option value="remotion">Remotion Animated Slides</option>
                <option value="manim">Manim Mathematical Engine</option>
                <option value="hybrid">Hybrid (Remotion + Manim)</option>
              </select>

              <button
                className="btn sm"
                onClick={handleRegenerateVideo}
                disabled={videoLoading}
                title="Regenerate educational video script, narration, and scenes"
              >
                <Icon name="refresh" size={14} className={videoLoading ? 'animate-spin' : ''} />
                {videoLoading ? 'Generating...' : 'Regenerate Video'}
              </button>
            </div>
          </div>

          {/* Main Video Theater Player */}
          {videoLoading ? (
            <div className="card" style={{ padding: '80px 24px', textAlign: 'center', background: '#0C131B', color: '#E8EEF4', borderRadius: '18px', border: '1px solid #263648' }}>
              <Icon name="sparkles" size={42} style={{ color: '#54C2F0', margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
                Synthesizing Educational Video & Voice Narration...
              </h3>
              <p style={{ color: '#92A3B5', fontSize: '13px', maxWidth: '460px', margin: '0 auto' }}>
                Dividing syllabus lesson into visual scenes, compiling mathematical animations, and synchronizing offline voiceover audio.
              </p>
            </div>
          ) : !videoData ? (
            <div className="card" style={{ padding: '60px 24px', textAlign: 'center', borderRadius: '18px', border: '1px dashed var(--line)' }}>
              <Icon name="play" size={48} style={{ color: 'var(--accent)', margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>
                No Video Generated Yet for {topic.topic_name}
              </h3>
              <p style={{ color: 'var(--muted)', fontSize: '14px', maxWidth: '480px', margin: '0 auto 20px' }}>
                StudyPilot AI can automatically build an animated visual masterclass complete with scene slides, formulas, voiceover narration, and synchronized subtitles.
              </p>
              <button
                className="btn primary"
                onClick={() => handleGenerateVideo(videoEngine)}
                style={{ fontSize: '14px', padding: '0 20px' }}
              >
                <Icon name="sparkles" size={16} /> Generate Animated Educational Video
              </button>
            </div>
          ) : (
            <div
              className="card"
              style={{
                background: '#0C131B',
                color: '#E8EEF4',
                borderRadius: '18px',
                border: '1px solid #263648',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                boxShadow: '0 12px 36px rgba(0, 0, 0, 0.45)'
              }}
            >
              {/* 1. Basic to Advanced Progressive Level Stepper */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#54C2F0', fontWeight: 800 }}>
                    🚀 Progressive Learning Path: Basic ➔ Foundation ➔ Intermediate ➔ Advanced ➔ Mastery
                  </div>
                  <div style={{ fontSize: '11px', color: '#92A3B5' }}>
                    Stage {currentSceneIdx + 1} of {(videoData.scenes_json || []).length}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                  {(videoData.scenes_json || []).map((sc: any, idx: number) => {
                    const isActive = currentSceneIdx === idx;
                    const isPassed = checkpointRevealed[idx] && checkpointAnswers[idx] === (sc.checkpoint_quiz?.correct_index ?? 0);
                    const stageColors = ['#4CC98A', '#54C2F0', '#B073F0', '#F08C3C', '#F0C83C'];
                    const stageColor = stageColors[idx % stageColors.length];

                    return (
                      <button
                        key={sc.id || idx}
                        onClick={() => jumpToScene(idx)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: '4px',
                          padding: '10px 14px',
                          borderRadius: '12px',
                          border: '1.5px solid',
                          borderColor: isActive ? stageColor : '#263648',
                          background: isActive ? `${stageColor}1A` : '#141E2A',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: stageColor, fontWeight: 800 }}>
                            {sc.level_key ? `Stage ${idx + 1}` : `Scene ${idx + 1}`}
                          </span>
                          {isPassed && (
                            <span style={{ fontSize: '10px', background: 'rgba(76, 201, 138, 0.2)', color: '#4CC98A', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                              ✓ Mastered
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: isActive ? '#FFFFFF' : '#C4D3E0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                          {sc.level_badge || sc.title}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Pedagogical Goal & Mode Toggles */}
              {(() => {
                const scenes = videoData.scenes_json || [];
                const currentScene = scenes[currentSceneIdx] || scenes[0] || {};
                const slide = currentScene.slide_content || {};

                return (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', padding: '10px 16px', background: '#141E2A', borderRadius: '12px', border: '1px solid #263648' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                        <span style={{ color: '#54C2F0', fontWeight: 700 }}>🎯 Pedagogical Goal:</span>
                        <span style={{ color: '#E8EEF4' }}>{currentScene.pedagogical_goal || 'Step-by-step conceptual mastery'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {currentScene.analogy && (
                          <button
                            onClick={() => setShowAnalogyMode(!showAnalogyMode)}
                            className="btn sm"
                            style={{
                              background: showAnalogyMode ? 'rgba(240, 178, 60, 0.25)' : 'transparent',
                              borderColor: showAnalogyMode ? '#F0B23C' : '#263648',
                              color: showAnalogyMode ? '#F0B23C' : '#92A3B5',
                              fontSize: '11px',
                              fontWeight: 700
                            }}
                            title="Toggle everyday analogy explanation"
                          >
                            💡 {showAnalogyMode ? 'Everyday Analogy (Active)' : 'Everyday Analogy'}
                          </button>
                        )}
                        <button
                          onClick={() => setShowTranscript(!showTranscript)}
                          className="btn sm"
                          style={{
                            background: showTranscript ? 'rgba(84, 194, 240, 0.2)' : 'transparent',
                            borderColor: showTranscript ? '#54C2F0' : '#263648',
                            color: showTranscript ? '#54C2F0' : '#92A3B5',
                            fontSize: '11px',
                            fontWeight: 700
                          }}
                          title="View interactive sentence transcript"
                        >
                          📜 {showTranscript ? 'Hide Transcript' : 'Transcript'}
                        </button>
                      </div>
                    </div>

                    {/* Everyday Analogy Banner */}
                    {showAnalogyMode && currentScene.analogy && (
                      <div style={{ padding: '12px 18px', background: 'rgba(240, 178, 60, 0.1)', border: '1px solid rgba(240, 178, 60, 0.35)', borderRadius: '12px', color: '#F8DF9E', fontSize: '13.5px', lineHeight: 1.55 }}>
                        <strong style={{ color: '#F0B23C', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          💡 Beginner Intuition & Everyday Analogy:
                        </strong>
                        {currentScene.analogy}
                      </div>
                    )}

                    {/* 3. Theater Canvas (16:9 Presentation Frame) */}
                    <div
                      style={{
                        background: '#141E2A',
                        borderRadius: '14px',
                        border: '1px solid #263648',
                        padding: '30px',
                        minHeight: '380px',
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
                        gap: '28px',
                        alignItems: 'center',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Visual glow */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '-80px',
                          right: '-80px',
                          width: '260px',
                          height: '260px',
                          borderRadius: '50%',
                          background: 'radial-gradient(circle, rgba(84, 194, 240, 0.12) 0%, transparent 70%)',
                          pointerEvents: 'none'
                        }}
                      />

                      {/* Left Pane: Slide Content */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#54C2F0', fontWeight: 800 }}>
                            {currentScene.level_badge || `Scene ${currentSceneIdx + 1} of ${scenes.length}`}
                          </span>
                        </div>

                        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#E8EEF4', lineHeight: 1.25, margin: 0 }}>
                          {slide.heading || currentScene.title}
                        </h1>

                        {slide.subheading && (
                          <div style={{ fontSize: '14px', color: '#92A3B5', fontWeight: 500 }}>
                            {slide.subheading}
                          </div>
                        )}

                        {/* Bullet points */}
                        {slide.bullet_points && slide.bullet_points.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                            {slide.bullet_points.map((pt: string, pIdx: number) => (
                              <div key={pIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13.5px', color: '#E8EEF4' }}>
                                <span style={{ color: '#4CC98A', fontWeight: 700, flexShrink: 0 }}>✦</span>
                                <span>{pt}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* LaTeX Formula Box */}
                        {slide.formula_latex && (
                          <div style={{ padding: '10px 14px', background: '#0C131B', border: '1px solid #F0B23C', borderRadius: '10px', fontFamily: 'monospace', fontSize: '14px', color: '#F0B23C', width: 'fit-content', marginTop: '6px' }}>
                            📐 {slide.formula_latex}
                          </div>
                        )}
                      </div>

                      {/* Right Pane: Animated SVG Diagram & Clickable Hotspots */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div
                          style={{
                            background: '#0C131B',
                            borderRadius: '12px',
                            border: '1px solid #263648',
                            padding: '16px',
                            minHeight: '190px',
                            display: 'grid',
                            placeItems: 'center',
                            overflow: 'hidden'
                          }}
                        >
                          {slide.diagram_svg ? (
                            <div
                              style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
                              dangerouslySetInnerHTML={{ __html: formatDiagramSvg(slide.diagram_svg, topic.topic_name) }}
                            />
                          ) : (
                            <div style={{ textAlign: 'center', color: '#92A3B5', fontSize: '13px' }}>
                              <Icon name="brain" size={36} style={{ color: '#54C2F0', margin: '0 auto 8px' }} />
                              <div>Visual Concept Diagram</div>
                              <div style={{ fontSize: '11px', marginTop: '4px' }}>{currentScene.visual_instructions || 'Animated concept demonstration'}</div>
                            </div>
                          )}
                        </div>

                        {/* Interactive Diagram Hotspots */}
                        {currentScene.hotspots && currentScene.hotspots.length > 0 && (
                          <div style={{ background: '#0C131B', borderRadius: '10px', border: '1px solid #263648', padding: '10px 14px' }}>
                            <div style={{ fontSize: '11px', color: '#92A3B5', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                              Interactive Diagram Components:
                            </div>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {currentScene.hotspots.map((h: any) => {
                                const isSpotActive = activeHotspot === h.id;
                                return (
                                  <button
                                    key={h.id}
                                    onClick={() => setActiveHotspot(isSpotActive ? null : h.id)}
                                    style={{
                                      padding: '4px 10px',
                                      borderRadius: '6px',
                                      fontSize: '11px',
                                      border: '1px solid',
                                      borderColor: isSpotActive ? '#54C2F0' : '#263648',
                                      background: isSpotActive ? 'rgba(84, 194, 240, 0.25)' : '#141E2A',
                                      color: isSpotActive ? '#FFFFFF' : '#92A3B5',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease'
                                    }}
                                  >
                                    <span style={{ color: '#54C2F0', fontWeight: 800, marginRight: '4px' }}>[{h.badge || '✦'}]</span>
                                    {h.title}
                                  </button>
                                );
                              })}
                            </div>
                            {activeHotspot && (() => {
                              const spot = currentScene.hotspots.find((h: any) => h.id === activeHotspot);
                              if (!spot) return null;
                              return (
                                <div style={{ marginTop: '8px', padding: '8px 12px', background: '#141E2A', borderRadius: '8px', border: '1px solid #54C2F0', fontSize: '12px', color: '#E8EEF4', lineHeight: 1.45 }}>
                                  <strong style={{ color: '#54C2F0' }}>{spot.title}:</strong> {spot.desc}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>

                      {/* Live Synchronized Subtitle Caption Bar */}
                      {showCaptions && (
                        <div
                          style={{
                            gridColumn: '1 / -1',
                            background: 'rgba(12, 19, 27, 0.88)',
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(84, 194, 240, 0.3)',
                            borderRadius: '10px',
                            padding: '10px 18px',
                            textAlign: 'center',
                            fontSize: '14px',
                            color: '#FFFFFF',
                            fontWeight: 500,
                            lineHeight: 1.45,
                            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
                          }}
                        >
                          {(() => {
                            const subs = videoData.subtitles_json || [];
                            const matchingSub = subs.find((s: any) => playbackTime >= s.start && playbackTime <= s.end);
                            if (matchingSub) return `“${matchingSub.text}”`;
                            return `“${currentScene.voiceover_text || 'Listening to visual concept lecture...'}”`;
                          })()}
                        </div>
                      )}
                    </div>

                    {/* 4. Hands-On Variable Parameter Simulator */}
                    {currentScene.interactive_sim && (() => {
                      const sim = currentScene.interactive_sim;
                      const curVal = simParams[currentSceneIdx] ?? sim.default ?? 2;
                      const stateInfo = sim.states ? (sim.states[String(curVal)] || sim.states[curVal]) : null;

                      return (
                        <div style={{ background: '#141E2A', borderRadius: '12px', border: '1px solid #263648', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 800, color: '#4CC98A' }}>🔬 Hands-On Parameter Simulator:</span>
                              <span style={{ fontSize: '13px', color: '#E8EEF4', fontWeight: 600 }}>{sim.param_name}</span>
                            </div>
                            <div style={{ fontSize: '12px', color: '#92A3B5', background: '#0C131B', padding: '4px 10px', borderRadius: '6px', border: '1px solid #263648' }}>
                              Setting: <strong style={{ color: '#54C2F0' }}>{curVal} {sim.unit || ''}</strong> {stateInfo?.label ? `(${stateInfo.label})` : ''}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <span style={{ fontSize: '11px', color: '#92A3B5' }}>Min ({sim.min || 1})</span>
                            <input
                              type="range"
                              min={sim.min || 1}
                              max={sim.max || 5}
                              step={1}
                              value={curVal}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setSimParams(prev => ({ ...prev, [currentSceneIdx]: val }));
                              }}
                              style={{ flex: 1, accentColor: '#4CC98A', height: '6px', cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '11px', color: '#92A3B5' }}>Max ({sim.max || 5})</span>
                          </div>

                          {stateInfo && (
                            <div style={{ fontSize: '12.5px', color: '#C4D3E0', background: 'rgba(76, 201, 138, 0.08)', padding: '8px 14px', borderRadius: '8px', borderLeft: '3px solid #4CC98A', lineHeight: 1.45 }}>
                              <strong style={{ color: '#4CC98A' }}>Dynamic System Response:</strong> {stateInfo.effect}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* 5. Level Understanding Checkpoint Pop-Quiz */}
                    {currentScene.checkpoint_quiz && (() => {
                      const quiz = currentScene.checkpoint_quiz;
                      const selectedOpt = checkpointAnswers[currentSceneIdx];
                      const isRevealed = checkpointRevealed[currentSceneIdx];
                      const isCorrect = selectedOpt === quiz.correct_index;

                      return (
                        <div style={{ background: '#141E2A', borderRadius: '12px', border: '1px solid #263648', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 800, color: '#F0B23C' }}>💡 Level {currentSceneIdx + 1} Understanding Check:</span>
                              <span style={{ fontSize: '12px', color: '#92A3B5' }}>(Confirm comprehension before advancing)</span>
                            </div>
                            {isRevealed && (
                              <span style={{ fontSize: '12px', fontWeight: 700, color: isCorrect ? '#4CC98A' : '#F06565' }}>
                                {isCorrect ? '✓ Correct! Stage Mastered.' : '✘ Not quite. Check the hint below.'}
                              </span>
                            )}
                          </div>

                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#E8EEF4', lineHeight: 1.45 }}>
                            {quiz.question}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {(quiz.options || []).map((opt: string, oIdx: number) => {
                              const isThisSelected = selectedOpt === oIdx;
                              let optBg = '#0C131B';
                              let optBorder = '#263648';
                              let optColor = '#E8EEF4';

                              if (isRevealed) {
                                if (oIdx === quiz.correct_index) {
                                  optBg = 'rgba(76, 201, 138, 0.2)';
                                  optBorder = '#4CC98A';
                                  optColor = '#4CC98A';
                                } else if (isThisSelected) {
                                  optBg = 'rgba(240, 101, 101, 0.2)';
                                  optBorder = '#F06565';
                                  optColor = '#F06565';
                                }
                              } else if (isThisSelected) {
                                optBg = 'rgba(84, 194, 240, 0.2)';
                                optBorder = '#54C2F0';
                                optColor = '#FFFFFF';
                              }

                              return (
                                <button
                                  key={oIdx}
                                  onClick={() => {
                                    setCheckpointAnswers(prev => ({ ...prev, [currentSceneIdx]: oIdx }));
                                    setCheckpointRevealed(prev => ({ ...prev, [currentSceneIdx]: true }));
                                  }}
                                  style={{
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    textAlign: 'left',
                                    fontSize: '13px',
                                    background: optBg,
                                    border: `1px solid ${optBorder}`,
                                    color: optColor,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  <span style={{ fontWeight: 700, marginRight: '8px' }}>{String.fromCharCode(65 + oIdx)}.</span>
                                  {opt}
                                </button>
                              );
                            })}
                          </div>

                          {isRevealed && (
                            <div style={{ padding: '10px 14px', borderRadius: '8px', background: isCorrect ? 'rgba(76, 201, 138, 0.1)' : 'rgba(240, 101, 101, 0.1)', border: `1px solid ${isCorrect ? 'rgba(76, 201, 138, 0.3)' : 'rgba(240, 101, 101, 0.3)'}`, fontSize: '12.5px', color: '#E8EEF4', lineHeight: 1.5 }}>
                              <strong>{isCorrect ? 'Explanation:' : 'Hint:'}</strong> {isCorrect ? quiz.explanation : (quiz.hint || quiz.explanation)}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* 6. Ask AI Tutor About This Scene Direct Action */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: '#141E2A', borderRadius: '12px', border: '1px solid #263648', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#92A3B5' }}>
                        <Icon name="sparkles" size={16} style={{ color: '#54C2F0' }} />
                        <span>Need an even simpler explanation or more examples for this stage?</span>
                      </div>
                      <button
                        className="btn sm primary"
                        onClick={() => {
                          setActiveTab('tutor');
                          handleSendChatMessage(`In the animated visual class for "${topic.topic_name}", Stage ${currentSceneIdx + 1} (${currentScene.title}): can you explain this from basic to advanced using another simple, everyday real-world example?`);
                        }}
                        style={{ fontSize: '12px' }}
                      >
                        <Icon name="robot" size={14} /> Ask AI Tutor About Stage {currentSceneIdx + 1}
                      </button>
                    </div>

                    {/* 7. Interactive Synchronized Transcript */}
                    {showTranscript && (
                      <div style={{ background: '#141E2A', borderRadius: '12px', border: '1px solid #263648', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '220px', overflowY: 'auto' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#54C2F0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Icon name="file-text" size={14} />
                          <span>Interactive Synchronized Transcript (Click any line to jump)</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {(videoData.subtitles_json || []).map((sub: any, sIdx: number) => {
                            const isCurrent = playbackTime >= sub.start && playbackTime <= sub.end;
                            return (
                              <button
                                key={sIdx}
                                onClick={() => {
                                  setPlaybackTime(sub.start);
                                  if (audioRef.current) {
                                    audioRef.current.currentTime = sub.start;
                                    if (!isPlaying) audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
                                  }
                                }}
                                style={{
                                  textAlign: 'left',
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  fontSize: '12.5px',
                                  background: isCurrent ? 'rgba(84, 194, 240, 0.18)' : 'transparent',
                                  border: isCurrent ? '1px solid #54C2F0' : '1px solid transparent',
                                  color: isCurrent ? '#FFFFFF' : '#92A3B5',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  gap: '10px',
                                  alignItems: 'baseline'
                                }}
                              >
                                <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#54C2F0', flexShrink: 0 }}>
                                  {Math.floor(sub.start / 60)}:{String(Math.floor(sub.start % 60)).padStart(2, '0')}
                                </span>
                                <span>{sub.text}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* 8. Video Player Controls Bar */}
              <div
                style={{
                  background: '#141E2A',
                  borderRadius: '12px',
                  border: '1px solid #263648',
                  padding: '12px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  flexWrap: 'wrap'
                }}
              >
                {/* Play / Pause Button */}
                <button
                  onClick={togglePlayPause}
                  className="btn sm"
                  style={{
                    background: '#54C2F0',
                    color: '#06202D',
                    border: 'none',
                    fontWeight: 700,
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    padding: 0,
                    display: 'grid',
                    placeItems: 'center'
                  }}
                  title={isPlaying ? 'Pause Animation' : 'Play Animated Video'}
                >
                  <Icon name={isPlaying ? 'pause' : 'play'} size={16} />
                </button>

                {/* Timeline Seek Slider */}
                <div style={{ flex: 1, minWidth: '180px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#92A3B5' }}>
                    {Math.floor(playbackTime / 60)}:{String(Math.floor(playbackTime % 60)).padStart(2, '0')}
                  </span>
                  <input
                    type="range"
                    min="0"
                    max={videoData.duration_seconds || 90}
                    step="0.5"
                    value={playbackTime}
                    onChange={(e) => {
                      const t = parseFloat(e.target.value);
                      setPlaybackTime(t);
                      if (audioRef.current) audioRef.current.currentTime = t;
                    }}
                    style={{ flex: 1, accentColor: '#54C2F0', height: '6px' }}
                  />
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#92A3B5' }}>
                    {Math.floor((videoData.duration_seconds || 90) / 60)}:{String(Math.floor((videoData.duration_seconds || 90) % 60)).padStart(2, '0')}
                  </span>
                </div>

                {/* Subtitles CC Toggle */}
                <button
                  onClick={() => setShowCaptions(!showCaptions)}
                  className="btn sm"
                  style={{
                    background: showCaptions ? 'rgba(84, 194, 240, 0.2)' : 'transparent',
                    borderColor: showCaptions ? '#54C2F0' : '#263648',
                    color: showCaptions ? '#54C2F0' : '#92A3B5',
                    fontSize: '11px',
                    fontWeight: 700
                  }}
                  title="Toggle Closed Captions / Subtitles"
                >
                  CC {showCaptions ? 'ON' : 'OFF'}
                </button>

                {/* Playback Speed */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#92A3B5' }}>Speed:</span>
                  <select
                    value={playbackSpeed}
                    onChange={(e) => {
                      const spd = parseFloat(e.target.value);
                      setPlaybackSpeed(spd);
                      if (audioRef.current) audioRef.current.playbackRate = spd;
                    }}
                    style={{ height: '28px', padding: '0 6px', fontSize: '11px', borderRadius: '6px', background: '#0C131B', borderColor: '#263648', color: '#E8EEF4' }}
                  >
                    <option value="1.0">1.0x</option>
                    <option value="1.25">1.25x</option>
                    <option value="1.5">1.5x</option>
                  </select>
                </div>

                {/* Hidden Audio Element for Offline Synthesized Narration */}
                {videoData.audio_url && (
                  <audio
                    ref={audioRef}
                    src={videoData.audio_url.startsWith('http') ? videoData.audio_url : `http://127.0.0.1:8000${videoData.audio_url}`}
                    onTimeUpdate={() => {
                      if (audioRef.current) {
                        const ct = audioRef.current.currentTime;
                        setPlaybackTime(ct);
                        let acc = 0;
                        const scenes = videoData.scenes_json || [];
                        for (let i = 0; i < scenes.length; i++) {
                          acc += parseFloat(scenes[i].duration_seconds || 18);
                          if (ct <= acc) {
                            setCurrentSceneIdx(i);
                            break;
                          }
                        }
                      }
                    }}
                    onEnded={() => setIsPlaying(false)}
                    style={{ display: 'none' }}
                  />
                )}
              </div>
            </div>
          )}
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

