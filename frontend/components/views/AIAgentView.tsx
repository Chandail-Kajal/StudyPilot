/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { StudyPlan, Subject, Task, MockTest, TestResult, ChatMessage, AISchedulePlan, TopicImportanceAnalysis } from '@/types';
import { today, addDays, daysBetween, fmtMins, getYesterdayTopics } from '@/lib/seed';
import { api } from '@/lib/api';
import { Icon } from '../Icons';

interface AIAgentViewProps {
  plan: StudyPlan;
  token?: string | null;
  onApplyPlanTasks: (tasks: Task[], sittingCapacity?: number) => void;
  onUpdateTopicStage: (topicName: string, advance: boolean) => void;
  onNavigateToView: (view: string) => void;
  showToast: (msg: string) => void;
  initialTopicForTest?: string | null;
}

export const AIAgentView: React.FC<AIAgentViewProps> = ({
  plan,
  token,
  onApplyPlanTasks,
  onUpdateTopicStage,
  onNavigateToView,
  showToast,
  initialTopicForTest
}) => {
  const [activeTab, setActiveTab] = useState<'agent' | 'importance' | 'mocktest' | 'history' | 'settings'>('agent');
  
  // Sitting capacity & exam setup
  const [sittingCapacity, setSittingCapacity] = useState<number>(plan.sittingCapacityMins || 45);
  const [dailyGoalMins, setDailyGoalMins] = useState<number>(plan.goalMins || 180);
  const [apiKey, setApiKey] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('studypilot.ai_api_key') || plan.aiApiKey || '';
    }
    return '';
  });

  // Yesterday's topics detection
  const yesterdayTopics = getYesterdayTopics(plan);
  const tToday = today();
  const examDays = Math.max(1, daysBetween(tToday, plan.exam.date));

  // Chat Agent State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'init_1',
      role: 'assistant',
      content: `Hello! I'm your **StudyPilot AI Copilot**.\n\nYou have **${examDays} days until ${plan.exam.name}** (${plan.exam.date}). To tailor a realistic daily study roadmap and spaced mock tests that you can actually stick to, I need to know:\n\n**What is your maximum sitting capacity for study in one stretch?**\n*(e.g., 30 mins, 45 mins, 60 mins, or 90 mins?)*`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Generated schedule preview state
  const [generatedSchedule, setGeneratedSchedule] = useState<AISchedulePlan | null>(null);
  const [isPlanningLoading, setIsPlanningLoading] = useState(false);

  // Mock Test State
  const [activeTest, setActiveTest] = useState<MockTest | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isGeneratingTest, setIsGeneratingTest] = useState(false);
  const [isSubmittingTest, setIsSubmittingTest] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(plan.subjects[0]?.id || '');
  const [selectedTopicName, setSelectedTopicName] = useState<string>('');
  const [testQuestionCount, setTestQuestionCount] = useState<number>(5);
  const [testTimeRemaining, setTestTimeRemaining] = useState<number>(300); // 5 mins
  const [isTestActive, setIsTestActive] = useState(false);
  const timerRef = useRef<any>(null);

  // Tests History
  const [pastTests, setPastTests] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Topic Importance & High-Yield Analysis State
  const [importanceData, setImportanceData] = useState<TopicImportanceAnalysis | null>(null);
  const [isLoadingImportance, setIsLoadingImportance] = useState(false);
  const [mockTestPriorityFilter, setMockTestPriorityFilter] = useState<'all' | 'very_important' | 'important'>('all');

  // CBT Question Palette & Results Review State
  const [testPaletteFilter, setTestPaletteFilter] = useState<'all' | 'unanswered' | 'answered'>('all');
  const [showQuestionPalette, setShowQuestionPalette] = useState<boolean>(true);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'incorrect' | 'correct'>('all');

  // Auto-scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Test countdown timer
  useEffect(() => {
    if (isTestActive && testTimeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTestTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleSubmitActiveTest(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [isTestActive, testTimeRemaining]);

  // Auto-load importance analysis
  useEffect(() => {
    if (!importanceData && !isLoadingImportance) {
      handleExtractImportance();
    }
  }, []);

  // Handle initial topic for test if passed from another view
  useEffect(() => {
    if (initialTopicForTest) {
      setActiveTab('mocktest');
      setSelectedTopicName(initialTopicForTest);
      handleGenerateMockTest([{ name: initialTopicForTest }]);
    }
  }, [initialTopicForTest]);

  // Load history if authenticated and tab opened
  useEffect(() => {
    if (activeTab === 'history' && token) {
      setIsLoadingHistory(true);
      api.getMockTestsHistory(token)
        .then(res => setPastTests(res.tests || []))
        .catch(() => {})
        .finally(() => setIsLoadingHistory(false));
    }
  }, [activeTab, token]);

  // Save API key
  const handleSaveApiKey = async (key: string) => {
    setApiKey(key);
    if (typeof window !== 'undefined') {
      localStorage.setItem('studypilot.ai_api_key', key);
    }
    if (token) {
      try {
        await api.saveAiKey(key, token);
      } catch (e) {}
    }
    showToast('AI API Key saved and synced successfully');
  };

  // Preset capacity clicks
  const handleSelectCapacity = async (mins: number) => {
    setSittingCapacity(mins);
    const userMsg: ChatMessage = {
      id: Math.random().toString(36).slice(2, 9),
      role: 'user',
      content: `My maximum sitting capacity is ${mins} minutes per session.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages(prev => [...prev, userMsg]);
    setIsChatLoading(true);

    try {
      const res = await api.chatWithAI({
        message: `My maximum sitting capacity is ${mins} minutes. Please plan my syllabus schedule accordingly.`,
        history: chatMessages.map(m => ({ role: m.role, content: m.content })),
        syllabus: plan.subjects,
        exam_name: plan.exam.name,
        exam_date: plan.exam.date,
        yesterday_topics: yesterdayTopics,
        current_sitting_capacity: mins,
        api_key: apiKey
      }, token || undefined);

      const botMsg: ChatMessage = {
        id: Math.random().toString(36).slice(2, 9),
        role: 'assistant',
        content: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages(prev => [...prev, botMsg]);

      // Automatically generate schedule proposal
      handleGenerateSchedule(mins);
    } catch (e: any) {
      showToast(e.message || 'Chat error');
    } finally {
      setIsChatLoading(false);
    }
  };

  // Send custom message in chat
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || isChatLoading) return;

    const userText = inputMessage.trim();
    setInputMessage('');
    const userMsg: ChatMessage = {
      id: Math.random().toString(36).slice(2, 9),
      role: 'user',
      content: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages(prev => [...prev, userMsg]);
    setIsChatLoading(true);

    try {
      const res = await api.chatWithAI({
        message: userText,
        history: chatMessages.map(m => ({ role: m.role, content: m.content })),
        syllabus: plan.subjects,
        exam_name: plan.exam.name,
        exam_date: plan.exam.date,
        yesterday_topics: yesterdayTopics,
        current_sitting_capacity: sittingCapacity,
        api_key: apiKey
      }, token || undefined);

      if (res.detected_sitting_capacity) {
        setSittingCapacity(res.detected_sitting_capacity);
      }

      const botMsg: ChatMessage = {
        id: Math.random().toString(36).slice(2, 9),
        role: 'assistant',
        content: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      showToast(err.message || 'Failed to chat with AI');
    } finally {
      setIsChatLoading(false);
    }
  };

  // Generate Schedule Plan
  const handleGenerateSchedule = async (customCapacity?: number) => {
    const cap = customCapacity || sittingCapacity;
    setIsPlanningLoading(true);
    try {
      const res = await api.planSchedule({
        syllabus: plan.subjects,
        exam_name: plan.exam.name,
        exam_date: plan.exam.date,
        sitting_capacity_mins: cap,
        daily_goal_mins: dailyGoalMins,
        yesterday_topics: yesterdayTopics,
        api_key: apiKey
      }, token || undefined);

      setGeneratedSchedule(res);
      showToast(`Generated study plan tailored to ${cap}-min sitting blocks!`);
    } catch (err: any) {
      showToast(err.message || 'Failed to generate schedule');
    } finally {
      setIsPlanningLoading(false);
    }
  };

  // Apply Generated Schedule to StudyPilot Planner
  const handleApplySchedule = () => {
    if (!generatedSchedule || !generatedSchedule.tasks) return;
    onApplyPlanTasks(generatedSchedule.tasks, generatedSchedule.sitting_capacity_mins);
    showToast(`Applied ${generatedSchedule.tasks.length} smart tasks to your planner!`);
    onNavigateToView('planner');
  };

  // Extract Important & Very Important Topics
  const handleExtractImportance = async () => {
    setIsLoadingImportance(true);
    try {
      const res = await api.extractImportantTopics({
        syllabus: plan.subjects,
        exam_name: plan.exam.name,
        exam_date: plan.exam.date,
        api_key: apiKey
      }, token || undefined);
      setImportanceData(res);
    } catch (err: any) {
      // Fallback is also handled gracefully by backend
    } finally {
      setIsLoadingImportance(false);
    }
  };

  // Generate Mock Test
  const handleGenerateMockTest = async (
    overrideTopics?: Array<{ name: string }>,
    importanceFilterOverride?: string,
    countOverride?: number,
    extractMaximumOverride?: boolean
  ) => {
    setIsGeneratingTest(true);
    setTestResult(null);
    setUserAnswers({});
    setCurrentQuestionIdx(0);

    const impFilter = importanceFilterOverride || (mockTestPriorityFilter !== 'all' ? mockTestPriorityFilter : undefined);
    const questionsCount = countOverride || testQuestionCount;
    const isExtractMax = Boolean(extractMaximumOverride || (questionsCount >= 50));

    if (countOverride) {
      setTestQuestionCount(countOverride);
    }

    let topicsToTest = overrideTopics;
    if (!topicsToTest) {
      if (selectedTopicName) {
        topicsToTest = [{ name: selectedTopicName }];
      } else if (impFilter === 'very_important' && importanceData && importanceData.very_important_topics.length > 0) {
        topicsToTest = importanceData.very_important_topics.map(t => ({ name: t.topicName }));
      } else if (yesterdayTopics.length > 0) {
        topicsToTest = yesterdayTopics;
      } else {
        topicsToTest = [{ name: 'Rotational motion' }, { name: 'Reaction mechanisms' }];
      }
    }

    const subj = plan.subjects.find(s => s.id === selectedSubjectId);
    const subjName = subj ? subj.name : 'Syllabus Review';

    try {
      const res: MockTest = await api.generateMockTest({
        topics: topicsToTest,
        subject_name: subjName,
        num_questions: questionsCount,
        difficulty: 'medium',
        importance_filter: impFilter,
        extract_maximum: isExtractMax,
        api_key: apiKey
      }, token || undefined);

      setActiveTest(res);
      setTestTimeRemaining(res.time_limit_mins * 60);
      setIsTestActive(true);
      setActiveTab('mocktest');
      showToast(`Mock test generated with ${res.questions.length} questions!`);
    } catch (err: any) {
      showToast(err.message || 'Could not generate test');
    } finally {
      setIsGeneratingTest(false);
    }
  };

  // Submit Active Test
  const handleSubmitActiveTest = async (isAutoSubmit = false) => {
    if (!activeTest || isSubmittingTest) return;
    const answeredCount = Object.keys(userAnswers).length;
    const total = activeTest.questions.length;

    if (!isAutoSubmit && answeredCount < total) {
      const confirmSubmit = window.confirm(
        `You have answered ${answeredCount} of ${total} questions. ${total - answeredCount} questions remain unanswered. Submit paper now?`
      );
      if (!confirmSubmit) return;
    }

    setIsSubmittingTest(true);
    clearInterval(timerRef.current);
    setIsTestActive(false);

    try {
      const res: TestResult = await api.submitMockTest({
        test_id: activeTest.test_id,
        title: activeTest.title,
        subject: activeTest.subject,
        topics: activeTest.topics,
        questions: activeTest.questions,
        user_answers: userAnswers,
        time_taken_seconds: (activeTest.time_limit_mins * 60) - testTimeRemaining
      }, token || undefined);

      setTestResult(res);

      // Auto-update topic progress based on score!
      if (res.adjustments && res.adjustments.topic_names) {
        res.adjustments.topic_names.forEach(name => {
          onUpdateTopicStage(name, res.passed);
        });
      }

      showToast(`Test completed! Score: ${res.score}/${res.total} (${res.percentage}%)`);
    } catch (err: any) {
      showToast(err.message || 'Failed to submit test');
    } finally {
      setIsSubmittingTest(false);
    }
  };

  const currentSubject = plan.subjects.find(s => s.id === selectedSubjectId) || plan.subjects[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Page Header */}
      <div className="pagehead">
        <div>
          <p className="eyebrow">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <Icon name="sparkles" size={14} /> AI Engine & Intelligent Study Pilot
            </span>
          </p>
          <h1>AI Study Copilot & Mock Tests</h1>
          <p className="lede">
            Adaptive scheduling aligned with your maximum sitting capacity, plus automated next-day recall tests for covered topics.
          </p>
        </div>

        <div className="actions">
          <button
            className={`btn ${activeTab === 'agent' ? 'primary' : ''}`}
            onClick={() => setActiveTab('agent')}
          >
            <Icon name="robot" size={15} /> AI Agent & Planner
          </button>
          <button
            className={`btn ${activeTab === 'importance' ? 'primary' : ''}`}
            onClick={() => {
              setActiveTab('importance');
              if (!importanceData) handleExtractImportance();
            }}
          >
            🔥 High-Yield Topics
          </button>
          <button
            className={`btn ${activeTab === 'mocktest' ? 'primary' : ''}`}
            onClick={() => setActiveTab('mocktest')}
          >
            <Icon name="test" size={15} /> Mock Test Arena
          </button>
        </div>
      </div>

      {/* Yesterday's Recall Highlight Card (The Core SOW / User Requirement) */}
      {yesterdayTopics.length > 0 && !isTestActive && (
        <section className="card" style={{
          background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)',
          borderLeft: '4px solid var(--accent)',
          boxShadow: 'var(--shadow-lg)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ maxWidth: '650px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span className="pill good" style={{ fontWeight: 700 }}>Next-Day Recall Paper Ready</span>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>• 24h Spaced Retrieval Practice</span>
              </div>
              <h2 style={{ fontSize: '19px', marginBottom: '6px' }}>
                Topics Covered Yesterday: {yesterdayTopics.map(t => t.name).join(', ')}
              </h2>
              <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: '1.5' }}>
                Cognitive science demonstrates that taking a quick mock test the day after studying a topic locks it into long-term memory. Take this 5-minute recall paper to evaluate your retention and auto-advance your exam schedule!
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                className="btn primary"
                disabled={isGeneratingTest}
                onClick={() => {
                  setActiveTab('mocktest');
                  handleGenerateMockTest(yesterdayTopics);
                }}
              >
                <Icon name="play" size={14} /> Start Yesterday&apos;s Recall Test
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Sub-Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--line)', paddingBottom: '12px', flexWrap: 'wrap' }}>
        <button
          className={`tbtn ${activeTab === 'agent' ? 'chiptimer' : ''}`}
          onClick={() => setActiveTab('agent')}
        >
          <Icon name="robot" size={16} /> 1. AI Study Agent & Plan
        </button>
        <button
          className={`tbtn ${activeTab === 'importance' ? 'chiptimer' : ''}`}
          onClick={() => {
            setActiveTab('importance');
            if (!importanceData) handleExtractImportance();
          }}
          style={activeTab === 'importance' ? { borderColor: '#D04F73', color: '#D04F73' } : {}}
        >
          🔥 2. Important Topics (High-Yield)
        </button>
        <button
          className={`tbtn ${activeTab === 'mocktest' ? 'chiptimer' : ''}`}
          onClick={() => setActiveTab('mocktest')}
        >
          <Icon name="test" size={16} /> 3. Mock Test Paper
        </button>
        <button
          className={`tbtn ${activeTab === 'history' ? 'chiptimer' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <Icon name="insights" size={16} /> 4. Test History
        </button>
        <button
          className={`tbtn ${activeTab === 'settings' ? 'chiptimer' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <Icon name="gear" size={16} /> AI Engine Config
        </button>
      </div>

      {/* TAB 1: AI Study Agent & Schedule Planner */}
      {activeTab === 'agent' && (
        <div className="todaygrid" style={{ gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)' }}>
          {/* Left Column: Interactive Chat Assistant */}
          <div className="stack">
            <section className="card" style={{ display: 'flex', flexDirection: 'column', height: '620px' }}>
              <div className="cardhead" style={{ borderBottom: '1px solid var(--line)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    display: 'grid',
                    placeItems: 'center'
                  }}>
                    <Icon name="brain" size={18} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '16px' }}>StudyPilot Agent</h2>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      Adaptive planner for {plan.exam.name} ({examDays} days left)
                    </span>
                  </div>
                </div>

                <span className="pill good">
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }}></span>
                  {apiKey ? 'Gemini Live' : 'Smart Heuristic'}
                </span>
              </div>

              {/* Chat Message Stream */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px 0',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                {chatMessages.map(msg => (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '88%',
                      background: msg.role === 'user' ? 'var(--accent)' : 'var(--surface2)',
                      color: msg.role === 'user' ? 'var(--accent-ink)' : 'var(--ink)',
                      borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      padding: '12px 16px',
                      fontSize: '14px',
                      lineHeight: '1.55',
                      boxShadow: 'var(--shadow)'
                    }}
                  >
                    <div style={{ whiteSpace: 'pre-wrap' }}>
                      {msg.content}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      marginTop: '4px',
                      opacity: 0.7,
                      textAlign: msg.role === 'user' ? 'right' : 'left'
                    }}>
                      {msg.timestamp}
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div style={{
                    alignSelf: 'flex-start',
                    background: 'var(--surface2)',
                    borderRadius: '16px 16px 16px 4px',
                    padding: '10px 14px',
                    fontSize: '13px',
                    color: 'var(--muted)'
                  }}>
                    Thinking and analyzing syllabus...
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Sitting Capacity Quick Suggestion Buttons */}
              <div style={{
                borderTop: '1px solid var(--line)',
                padding: '12px 0 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>
                  QUICK SITTING CAPACITY PRESETS:
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { label: '30m Pomodoro', val: 30 },
                    { label: '45m Balanced', val: 45 },
                    { label: '60m Deep Work', val: 60 },
                    { label: '90m Intensive', val: 90 }
                  ].map(item => (
                    <button
                      key={item.val}
                      className={`btn sm ${sittingCapacity === item.val ? 'primary' : ''}`}
                      onClick={() => handleSelectCapacity(item.val)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Input Form */}
              <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px', paddingTop: '8px' }}>
                <input
                  type="text"
                  placeholder="Ask a question or specify your study capacity..."
                  value={inputMessage}
                  onChange={e => setInputMessage(e.target.value)}
                  style={{
                    flex: 1,
                    height: '42px',
                    padding: '0 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--line)',
                    background: 'var(--surface)',
                    color: 'var(--ink)',
                    fontSize: '14px'
                  }}
                />
                <button
                  type="submit"
                  className="btn primary"
                  disabled={!inputMessage.trim() || isChatLoading}
                  style={{ height: '42px', padding: '0 16px' }}
                >
                  <Icon name="send" size={15} /> Send
                </button>
              </form>
            </section>
          </div>

          {/* Right Column: AI Schedule Planner & Preview */}
          <div className="stack">
            <section className="card">
              <div className="cardhead">
                <h2>Schedule Settings</h2>
                <span className="pill warn">{examDays} Days to Exam</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>Sitting Capacity (per session):</label>
                    <span className="mono" style={{ fontWeight: 700, color: 'var(--accent)' }}>
                      {sittingCapacity} minutes
                    </span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={120}
                    step={5}
                    value={sittingCapacity}
                    onChange={e => setSittingCapacity(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)' }}>
                    <span>20m (Micro-focus)</span>
                    <span>45m (Optimal)</span>
                    <span>120m (Marathon)</span>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>Daily Study Target:</label>
                    <span className="mono" style={{ fontWeight: 700, color: 'var(--good)' }}>
                      {fmtMins(dailyGoalMins)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={60}
                    max={360}
                    step={15}
                    value={dailyGoalMins}
                    onChange={e => setDailyGoalMins(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                    Yields approx <b>{Math.round(dailyGoalMins / sittingCapacity)} sessions</b> of {sittingCapacity} mins each day.
                  </div>
                </div>

                <button
                  className="btn primary"
                  disabled={isPlanningLoading}
                  onClick={() => handleGenerateSchedule()}
                  style={{ marginTop: '8px' }}
                >
                  <Icon name="sparkles" size={15} />
                  {isPlanningLoading ? 'Generating Plan...' : 'Generate AI Study Schedule'}
                </button>
              </div>
            </section>

            {/* Generated Schedule Preview */}
            {generatedSchedule && (
              <section className="card" style={{ borderLeft: '4px solid var(--good)' }}>
                <div className="cardhead">
                  <h2>Generated Plan Preview</h2>
                  <span className="pill good">{generatedSchedule.tasks.length} tasks</span>
                </div>

                <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>
                  {generatedSchedule.summary}
                </p>

                <div style={{
                  maxHeight: '260px',
                  overflowY: 'auto',
                  border: '1px solid var(--line)',
                  borderRadius: '10px',
                  padding: '8px'
                }}>
                  {generatedSchedule.tasks.slice(0, 10).map((t, idx) => {
                    const subj = plan.subjects.find(s => s.id === t.subjectId);
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          borderBottom: '1px solid var(--line)',
                          fontSize: '13px'
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {t.title}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', gap: '8px' }}>
                            <span>{t.date}</span>
                            <span>•</span>
                            <span style={{ color: subj?.color || 'var(--ink)' }}>{subj?.name || 'General'}</span>
                          </div>
                        </div>
                        <span className="mono" style={{ fontSize: '12px', fontWeight: 600 }}>
                          {t.mins}m
                        </span>
                      </div>
                    );
                  })}
                  {generatedSchedule.tasks.length > 10 && (
                    <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--muted)', padding: '6px' }}>
                      + {generatedSchedule.tasks.length - 10} more scheduled tasks leading to {plan.exam.date}
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '14px', display: 'flex', gap: '10px' }}>
                  <button
                    className="btn primary"
                    onClick={handleApplySchedule}
                    style={{ flex: 1 }}
                  >
                    <Icon name="check" size={14} /> Apply to My Study Planner
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>
      )}

      {/* TAB: High-Yield & Important Topics Extraction */}
      {activeTab === 'importance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Header Card */}
          <section className="card" style={{
            background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)',
            borderLeft: '4px solid #D04F73',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ maxWidth: '680px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span className="pill crit" style={{ fontWeight: 700 }}>🔥 Exam Weightage & High-Yield Analysis</span>
                  <span style={{ fontSize: '13px', color: 'var(--muted)' }}>• Target: {plan.exam.name} ({examDays} days left)</span>
                </div>
                <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>
                  Extracted High-Yield Syllabus Topics
                </h2>
                <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: '1.5' }}>
                  {importanceData?.summary || 'Extracting the highest weightage topics across your syllabus. Prioritizing Very Important topics allows you to secure 60%+ of exam marks with focused study.'}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  className="btn"
                  disabled={isLoadingImportance || isGeneratingTest}
                  onClick={handleExtractImportance}
                >
                  <Icon name="sparkles" size={14} />
                  {isLoadingImportance ? 'Analyzing Syllabus...' : 'Refresh Extraction'}
                </button>
                {importanceData && importanceData.very_important_topics.length > 0 && (
                  <button
                    className="btn primary"
                    style={{ background: '#D04F73', color: '#fff', borderColor: '#D04F73' }}
                    onClick={() => {
                      handleGenerateMockTest(importanceData.very_important_topics.map(t => ({ name: t.topicName })), 'very_important');
                    }}
                  >
                    <Icon name="test" size={14} /> Test Very Important Topics
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Very Important Topics Grid */}
          <section className="card">
            <div className="cardhead" style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>🔥</span>
                <div>
                  <h2 style={{ fontSize: '17px' }}>Very Important Topics (High Yield)</h2>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    Command the highest exam weightage; guaranteed multi-concept questions
                  </span>
                </div>
              </div>
              <span className="pill crit" style={{ fontWeight: 700 }}>
                {importanceData?.very_important_topics.length || 0} topics
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
              {(importanceData?.very_important_topics || []).map((t, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    background: 'var(--surface2)',
                    border: '1px solid var(--line)',
                    borderTop: '3px solid #D04F73',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <span className="pill crit" style={{ fontSize: '11px', fontWeight: 700 }}>
                        🔥 Very Important
                      </span>
                      <span className="pill" style={{ fontSize: '11px', fontWeight: 600 }}>
                        {t.weightage}
                      </span>
                    </div>

                    <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--ink)', marginBottom: '4px' }}>
                      {t.topicName}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600, marginBottom: '8px' }}>
                      {t.subjectName}
                    </div>

                    <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.45', marginBottom: '10px' }}>
                      {t.reason}
                    </p>

                    {t.key_focus_areas && t.key_focus_areas.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {t.key_focus_areas.map((kf, kfIdx) => (
                          <span
                            key={kfIdx}
                            style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: 'var(--surface)',
                              border: '1px solid var(--line)',
                              color: 'var(--muted)'
                            }}
                          >
                            {kf}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    <button
                      className="btn sm primary"
                      onClick={() => handleGenerateMockTest([{ name: t.topicName }], undefined, 50, true)}
                      style={{ flex: 1, background: '#D04F73', borderColor: '#D04F73', fontWeight: 700 }}
                      title="Extracts maximum 50 questions for exhaustive topic mastery"
                    >
                      ⚡ Extract Max (50 Qs)
                    </button>
                    <button
                      className="btn sm"
                      onClick={() => handleGenerateMockTest([{ name: t.topicName }], undefined, 10)}
                      style={{ flex: 1 }}
                    >
                      <Icon name="test" size={13} /> Quick Test (10)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Important Topics Grid */}
          <section className="card">
            <div className="cardhead" style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>⭐</span>
                <div>
                  <h2 style={{ fontSize: '17px' }}>Important Topics (Core Syllabus)</h2>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    Core exam topics; reliable scoring opportunities
                  </span>
                </div>
              </div>
              <span className="pill warn" style={{ fontWeight: 700 }}>
                {importanceData?.important_topics.length || 0} topics
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
              {(importanceData?.important_topics || []).map((t, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    background: 'var(--surface2)',
                    border: '1px solid var(--line)',
                    borderTop: '3px solid var(--amber)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <span className="pill warn" style={{ fontSize: '11px', fontWeight: 700 }}>
                        ⭐ Important
                      </span>
                      <span className="pill" style={{ fontSize: '11px', fontWeight: 600 }}>
                        {t.weightage}
                      </span>
                    </div>

                    <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--ink)', marginBottom: '4px' }}>
                      {t.topicName}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600, marginBottom: '8px' }}>
                      {t.subjectName}
                    </div>

                    <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.45' }}>
                      {t.reason}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    <button
                      className="btn sm primary"
                      onClick={() => handleGenerateMockTest([{ name: t.topicName }], undefined, 50, true)}
                      style={{ flex: 1, fontWeight: 700 }}
                      title="Extracts maximum 50 questions for exhaustive topic mastery"
                    >
                      ⚡ Extract Max (50 Qs)
                    </button>
                    <button
                      className="btn sm"
                      onClick={() => handleGenerateMockTest([{ name: t.topicName }], undefined, 10)}
                      style={{ flex: 1 }}
                    >
                      <Icon name="test" size={13} /> Quick Test (10)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: Mock Test Arena */}
      {activeTab === 'mocktest' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Active Test Taking View */}
          {activeTest && isTestActive && !testResult && (
            <section className="card" style={{ maxWidth: '920px', margin: '0 auto', width: '100%' }}>
              {/* Test Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid var(--line)',
                paddingBottom: '16px',
                marginBottom: '16px'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span className="pill warn">{activeTest.subject || 'Syllabus'}</span>
                    {activeTest.questions.length >= 25 && (
                      <span className="pill crit" style={{ fontWeight: 700 }}>
                        ⚡ Exhaustive Question Bank
                      </span>
                    )}
                  </div>
                  <h2 style={{ fontSize: '20px' }}>{activeTest.title}</h2>
                  <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                    Question {currentQuestionIdx + 1} of {activeTest.questions.length}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Time Remaining</div>
                  <div className="mono" style={{
                    fontSize: '22px',
                    fontWeight: 700,
                    color: testTimeRemaining < 60 ? 'var(--crit)' : 'var(--accent)'
                  }}>
                    {Math.floor(testTimeRemaining / 60)}:{String(testTimeRemaining % 60).padStart(2, '0')}
                  </div>
                </div>
              </div>

              {/* CBT Progress & Question Palette Bar */}
              {(() => {
                const total = activeTest.questions.length;
                const answeredCount = Object.keys(userAnswers).length;
                const unansweredCount = total - answeredCount;
                const pctAnswered = Math.round((answeredCount / total) * 100);

                return (
                  <div style={{ marginBottom: '20px' }}>
                    {/* Live Progress Bar */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '12px',
                      color: 'var(--muted)',
                      marginBottom: '6px'
                    }}>
                      <span>
                        <b style={{ color: 'var(--good)' }}>{answeredCount}</b> Answered • <b style={{ color: 'var(--ink)' }}>{unansweredCount}</b> Remaining
                      </span>
                      <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{pctAnswered}% Completed</span>
                    </div>

                    <div style={{
                      height: '6px',
                      background: 'var(--line)',
                      borderRadius: '3px',
                      overflow: 'hidden',
                      marginBottom: '12px'
                    }}>
                      <div style={{
                        width: `${pctAnswered}%`,
                        height: '100%',
                        background: 'var(--good)',
                        transition: 'width 0.25s ease'
                      }} />
                    </div>

                    {/* Palette Accordion Header */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'var(--surface2)',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      marginBottom: showQuestionPalette ? '10px' : '0'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>📋 Question Palette ({total} Questions)</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            type="button"
                            className={`btn sm ${testPaletteFilter === 'all' ? 'primary' : ''}`}
                            style={{ fontSize: '11px', padding: '2px 8px', height: '24px' }}
                            onClick={() => setTestPaletteFilter('all')}
                          >
                            All ({total})
                          </button>
                          <button
                            type="button"
                            className={`btn sm ${testPaletteFilter === 'unanswered' ? 'primary' : ''}`}
                            style={{ fontSize: '11px', padding: '2px 8px', height: '24px' }}
                            onClick={() => setTestPaletteFilter('unanswered')}
                          >
                            Unanswered ({unansweredCount})
                          </button>
                          <button
                            type="button"
                            className={`btn sm ${testPaletteFilter === 'answered' ? 'primary' : ''}`}
                            style={{ fontSize: '11px', padding: '2px 8px', height: '24px' }}
                            onClick={() => setTestPaletteFilter('answered')}
                          >
                            Answered ({answeredCount})
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn sm"
                        style={{ fontSize: '11px', height: '24px', padding: '0 8px' }}
                        onClick={() => setShowQuestionPalette(prev => !prev)}
                      >
                        {showQuestionPalette ? 'Hide Grid ▲' : 'Show Grid ▼'}
                      </button>
                    </div>

                    {/* Responsive CBT Question Matrix */}
                    {showQuestionPalette && (
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '6px',
                        maxHeight: '140px',
                        overflowY: 'auto',
                        padding: '10px',
                        borderRadius: '8px',
                        background: 'var(--surface)',
                        border: '1px solid var(--line)'
                      }}>
                        {activeTest.questions.map((_, idx) => {
                          const isAnswered = userAnswers[String(idx)] !== undefined;
                          const isCurrent = idx === currentQuestionIdx;

                          if (testPaletteFilter === 'answered' && !isAnswered) return null;
                          if (testPaletteFilter === 'unanswered' && isAnswered) return null;

                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setCurrentQuestionIdx(idx)}
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 700,
                                display: 'grid',
                                placeItems: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                border: isCurrent ? '2px solid var(--accent)' : '1px solid var(--line)',
                                background: isCurrent
                                  ? 'var(--accent)'
                                  : isAnswered
                                    ? 'var(--good)'
                                    : 'var(--surface2)',
                                color: isCurrent || isAnswered ? '#fff' : 'var(--ink)',
                                boxShadow: isCurrent ? '0 0 0 2px var(--accent-soft)' : 'none'
                              }}
                              title={`Question ${idx + 1}: ${isAnswered ? 'Answered' : 'Unanswered'}`}
                            >
                              {idx + 1}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Question Body */}
              {(() => {
                const q = activeTest.questions[currentQuestionIdx];
                const selectedOption = userAnswers[String(currentQuestionIdx)];
                const total = activeTest.questions.length;
                const answeredCount = Object.keys(userAnswers).length;

                const jumpToNextUnanswered = () => {
                  for (let i = currentQuestionIdx + 1; i < total; i++) {
                    if (userAnswers[String(i)] === undefined) {
                      setCurrentQuestionIdx(i);
                      return;
                    }
                  }
                  for (let i = 0; i < currentQuestionIdx; i++) {
                    if (userAnswers[String(i)] === undefined) {
                      setCurrentQuestionIdx(i);
                      return;
                    }
                  }
                  showToast('All questions in this test have been answered!');
                };

                const clearCurrentChoice = () => {
                  setUserAnswers(prev => {
                    const next = { ...prev };
                    delete next[String(currentQuestionIdx)];
                    return next;
                  });
                };

                return (
                  <div>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: 600,
                      lineHeight: '1.6',
                      marginBottom: '24px',
                      color: 'var(--ink)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ color: 'var(--accent)', fontWeight: 700 }}>Q{currentQuestionIdx + 1}.</span>
                        {q.importance === 'very_important' && (
                          <span className="pill crit" style={{ fontSize: '11px', fontWeight: 700 }}>
                            🔥 Very Important Topic (High Yield)
                          </span>
                        )}
                        {q.importance === 'important' && (
                          <span className="pill warn" style={{ fontSize: '11px', fontWeight: 700 }}>
                            ⭐ Core Exam Topic
                          </span>
                        )}
                        {q.weightage && (
                          <span className="pill" style={{ fontSize: '11px' }}>
                            {q.weightage}
                          </span>
                        )}
                      </div>
                      {q.question}
                    </div>

                    {/* Options */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
                      {q.options.map((opt, optIdx) => {
                        const isSelected = selectedOption === optIdx;
                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => setUserAnswers(prev => ({ ...prev, [String(currentQuestionIdx)]: optIdx }))}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '14px',
                              padding: '14px 18px',
                              borderRadius: '12px',
                              border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--line)'}`,
                              background: isSelected ? 'var(--accent-soft)' : 'var(--surface)',
                              color: 'var(--ink)',
                              textAlign: 'left',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <span style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--muted)'}`,
                              background: isSelected ? 'var(--accent)' : 'transparent',
                              color: isSelected ? 'var(--accent-ink)' : 'var(--muted)',
                              display: 'grid',
                              placeItems: 'center',
                              fontWeight: 700,
                              fontSize: '12px'
                            }}>
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <span style={{ fontSize: '15px', flex: 1 }}>{opt}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Navigation Buttons */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: '1px solid var(--line)',
                      paddingTop: '18px',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn"
                          disabled={currentQuestionIdx === 0}
                          onClick={() => setCurrentQuestionIdx(prev => Math.max(0, prev - 1))}
                        >
                          ← Previous
                        </button>
                        {selectedOption !== undefined && (
                          <button
                            className="btn sm"
                            type="button"
                            onClick={clearCurrentChoice}
                            title="Clear answer for this question"
                          >
                            Clear Choice
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                          className="btn sm"
                          type="button"
                          onClick={jumpToNextUnanswered}
                          title="Jump to the next unanswered question"
                        >
                          ⏩ Next Unanswered
                        </button>

                        {currentQuestionIdx < total - 1 && (
                          <button
                            className="btn"
                            onClick={() => setCurrentQuestionIdx(prev => prev + 1)}
                          >
                            Next Question →
                          </button>
                        )}

                        <button
                          className="btn primary"
                          disabled={isSubmittingTest}
                          onClick={() => handleSubmitActiveTest(false)}
                          style={{
                            background: currentQuestionIdx === total - 1 ? 'var(--good)' : 'var(--accent)',
                            borderColor: currentQuestionIdx === total - 1 ? 'var(--good)' : 'var(--accent)',
                            color: '#fff'
                          }}
                          title={`Submit paper (${answeredCount} of ${total} answered)`}
                        >
                          <Icon name="check" size={14} /> Submit Paper ({answeredCount}/{total})
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </section>
          )}

          {/* Test Results View */}
          {testResult && (
            <section className="card" style={{ maxWidth: '850px', margin: '0 auto', width: '100%' }}>
              <div style={{
                textAlign: 'center',
                padding: '20px 0 30px',
                borderBottom: '1px solid var(--line)'
              }}>
                <span className={`pill ${testResult.passed ? 'good' : 'crit'}`} style={{ fontSize: '13px', padding: '6px 14px' }}>
                  {testResult.passed ? 'Test Passed • Mastery Confirmed' : 'Needs Reinforcement Review'}
                </span>
                <h2 style={{ fontSize: '28px', margin: '14px 0 6px' }}>
                  Score: {testResult.score} / {testResult.total} ({testResult.percentage}%)
                </h2>
                <p style={{ color: 'var(--muted)', maxWidth: '500px', margin: '0 auto', fontSize: '14px' }}>
                  {testResult.adjustments?.recommended_message}
                </p>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '20px' }}>
                  <button
                    className="btn primary"
                    onClick={() => {
                      showToast('Syllabus schedule updated based on test diagnostics!');
                      onNavigateToView('today');
                    }}
                  >
                    View Updated Schedule on Today
                  </button>
                  <button
                    className="btn"
                    onClick={() => {
                      setTestResult(null);
                      setActiveTest(null);
                    }}
                  >
                    Take Another Test
                  </button>
                </div>
              </div>

              {/* Detailed Question Review & Explanations with Filter */}
              <div style={{ marginTop: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                  <h3 style={{ fontSize: '17px', margin: 0 }}>Diagnostic Review & Explanations</h3>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className={`btn sm ${reviewFilter === 'all' ? 'primary' : ''}`}
                      onClick={() => setReviewFilter('all')}
                    >
                      All ({testResult.total})
                    </button>
                    <button
                      type="button"
                      className={`btn sm ${reviewFilter === 'incorrect' ? 'primary' : ''}`}
                      onClick={() => setReviewFilter('incorrect')}
                    >
                      ❌ Incorrect ({testResult.total - testResult.score})
                    </button>
                    <button
                      type="button"
                      className={`btn sm ${reviewFilter === 'correct' ? 'primary' : ''}`}
                      onClick={() => setReviewFilter('correct')}
                    >
                      ✓ Correct ({testResult.score})
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {testResult.breakdown
                    .filter(item => {
                      if (reviewFilter === 'incorrect') return !item.is_correct;
                      if (reviewFilter === 'correct') return item.is_correct;
                      return true;
                    })
                    .map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '16px',
                          borderRadius: '12px',
                          background: 'var(--surface2)',
                          borderLeft: `4px solid ${item.is_correct ? 'var(--good)' : 'var(--crit)'}`
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: item.is_correct ? 'var(--good)' : 'var(--crit)' }}>
                            {item.is_correct ? '✓ Correct' : '✗ Incorrect'}
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Topic: {item.topic}</span>
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px' }}>
                          {item.question}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.5' }}>
                          <b>Explanation:</b> {item.explanation}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </section>
          )}

          {/* Test Generator Configuration (When no test is currently active) */}
          {!isTestActive && !testResult && (
            <div className="todaygrid">
              <section className="card">
                <div className="cardhead">
                  <h2>Create Mock Test Paper</h2>
                  <span className="pill good">Syllabus-Aligned</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Extract Maximum Questions Highlight Card */}
                  <div style={{
                    padding: '16px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, rgba(208, 79, 115, 0.12), rgba(100, 116, 241, 0.12))',
                    border: '1.5px solid var(--accent)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '14px', color: 'var(--accent)' }}>
                        <span>⚡</span>
                        <span>Extract Maximum Questions (Exhaustive Bank)</span>
                      </div>
                      <span className="pill crit" style={{ fontSize: '11px', fontWeight: 700 }}>
                        Maximum Depth
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0, lineHeight: '1.45' }}>
                      Extracts all possible conceptual questions (definitions, formulas, derivations, numerical scaling, assertion-reason, and exam traps) across the selected syllabus topics.
                    </p>
                    <button
                      type="button"
                      className="btn primary"
                      disabled={isGeneratingTest}
                      onClick={() => {
                        setTestQuestionCount(50);
                        handleGenerateMockTest(undefined, undefined, 50, true);
                      }}
                      style={{ height: '42px', fontWeight: 700 }}
                    >
                      ⚡ Extract Maximum Questions (50-Question Paper)
                    </button>
                  </div>

                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                      Choose Subject:
                    </label>
                    <select
                      value={selectedSubjectId}
                      onChange={e => {
                        setSelectedSubjectId(e.target.value);
                        setSelectedTopicName('');
                      }}
                      style={{ width: '100%', height: '40px', borderRadius: '10px', padding: '0 12px' }}
                    >
                      {plan.subjects.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.topics.length} topics)</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                      Topic Priority Focus:
                    </label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className={`btn sm ${mockTestPriorityFilter === 'all' ? 'primary' : ''}`}
                        onClick={() => setMockTestPriorityFilter('all')}
                      >
                        All Syllabus Topics
                      </button>
                      <button
                        type="button"
                        className={`btn sm ${mockTestPriorityFilter === 'very_important' ? 'primary' : ''}`}
                        onClick={() => setMockTestPriorityFilter('very_important')}
                        style={mockTestPriorityFilter === 'very_important' ? { background: '#D04F73', borderColor: '#D04F73' } : {}}
                      >
                        🔥 Very Important Only (High-Yield)
                      </button>
                      <button
                        type="button"
                        className={`btn sm ${mockTestPriorityFilter === 'important' ? 'primary' : ''}`}
                        onClick={() => setMockTestPriorityFilter('important')}
                      >
                        ⭐ Core Important
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                      Target Specific Topic (or all):
                    </label>
                    <select
                      value={selectedTopicName}
                      onChange={e => setSelectedTopicName(e.target.value)}
                      style={{ width: '100%', height: '40px', borderRadius: '10px', padding: '0 12px' }}
                    >
                      <option value="">Full Subject Syllabus (Mixed Topics)</option>
                      {currentSubject?.topics.map(tp => (
                        <option key={tp.id} value={tp.name}>{tp.name} (Stage {tp.stage}/5)</option>
                      ))}
                    </select>
                  </div>

                  {/* Question Count Selector & Presets */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 600 }}>
                        Number of Questions to Extract:
                      </label>
                      <span className="pill" style={{ fontWeight: 700, fontSize: '12px' }}>
                        {testQuestionCount} Questions
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                      {[
                        { count: 5, label: '5 (Quick Drill)' },
                        { count: 15, label: '15 (Standard)' },
                        { count: 30, label: '30 (Exam Paper)' },
                        { count: 50, label: '50 (Mega Mock)' },
                        { count: 100, label: '100 (Exhaustive Bank)' }
                      ].map(item => (
                        <button
                          key={item.count}
                          type="button"
                          className={`btn sm ${testQuestionCount === item.count ? 'primary' : ''}`}
                          onClick={() => setTestQuestionCount(item.count)}
                          style={{ flex: '1 1 120px' }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="range"
                        min={5}
                        max={100}
                        step={5}
                        value={testQuestionCount}
                        onChange={e => setTestQuestionCount(Number(e.target.value))}
                        style={{ flex: 1 }}
                      />
                    </div>
                  </div>

                  <button
                    className="btn primary"
                    disabled={isGeneratingTest}
                    onClick={() => handleGenerateMockTest(undefined, undefined, testQuestionCount, testQuestionCount >= 50)}
                    style={{ height: '44px', marginTop: '10px' }}
                  >
                    <Icon name="test" size={16} />
                    {isGeneratingTest ? 'Generating Test Paper...' : `Generate & Start Mock Test (${testQuestionCount} Qs)`}
                  </button>
                </div>
              </section>

              {/* Quick Recall Presets */}
              <div className="stack">
                <section className="card">
                  <div className="cardhead">
                    <h2>Rapid Test Presets</h2>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {importanceData && importanceData.very_important_topics.length > 0 && (
                      <div style={{
                        padding: '12px',
                        borderRadius: '10px',
                        background: 'var(--surface2)',
                        border: '1px solid #D04F73'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '14px', color: '#D04F73' }}>
                          <span>🔥</span> High-Yield Simulator
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)', margin: '4px 0 8px' }}>
                          Tests exclusively Very Important topics ({importanceData.very_important_topics.slice(0, 3).map(t => t.topicName).join(', ')}...)
                        </div>
                        <button
                          className="btn sm"
                          style={{ background: '#D04F73', color: '#fff', borderColor: '#D04F73' }}
                          onClick={() => handleGenerateMockTest(importanceData.very_important_topics.map(t => ({ name: t.topicName })), 'very_important')}
                        >
                          Start High-Yield Test
                        </button>
                      </div>
                    )}

                    {yesterdayTopics.length > 0 && (
                      <div style={{
                        padding: '12px',
                        borderRadius: '10px',
                        background: 'var(--surface2)',
                        border: '1px solid var(--line)'
                      }}>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>Yesterday&apos;s Recall Drill</div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)', margin: '4px 0 8px' }}>
                          5 questions on {yesterdayTopics.map(t => t.name).join(', ')}
                        </div>
                        <button
                          className="btn primary sm"
                          onClick={() => handleGenerateMockTest(yesterdayTopics)}
                        >
                          Launch 5-Min Drill
                        </button>
                      </div>
                    )}

                    <div style={{
                      padding: '12px',
                      borderRadius: '10px',
                      background: 'var(--surface2)',
                      border: '1px solid var(--line)'
                    }}>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>Pre-Exam Full Simulator</div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', margin: '4px 0 8px' }}>
                        10 questions covering all active syllabus subjects
                      </div>
                      <button
                        className="btn sm"
                        onClick={() => handleGenerateMockTest([
                          { name: 'Rotational motion' },
                          { name: 'Reaction mechanisms' },
                          { name: 'Limits and continuity' },
                          { name: 'Cell cycle' }
                        ])}
                      >
                        Start Simulator (10 Qs)
                      </button>
                    </div>

                    <div style={{
                      padding: '12px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, rgba(208, 79, 115, 0.08), rgba(99, 102, 241, 0.08))',
                      border: '1.5px solid var(--accent)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '14px', color: 'var(--accent)' }}>
                        <span>⚡</span> Exhaustive Exam Bank (100 Qs)
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', margin: '4px 0 8px' }}>
                        Maximum question extraction covering every topic across all syllabus subjects
                      </div>
                      <button
                        className="btn sm primary"
                        style={{ width: '100%', fontWeight: 700 }}
                        onClick={() => handleGenerateMockTest(
                          plan.subjects.flatMap(s => s.topics.map(t => ({ name: t.name }))),
                          undefined,
                          100,
                          true
                        )}
                      >
                        ⚡ Launch 100-Question Mega Test
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Past Tests History */}
      {activeTab === 'history' && (
        <section className="card">
          <div className="cardhead">
            <h2>Mock Tests Taken</h2>
            <span className="pill">{pastTests.length} recorded</span>
          </div>

          {isLoadingHistory ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>
              Loading test records...
            </div>
          ) : pastTests.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pastTests.map(t => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px',
                    borderRadius: '10px',
                    background: 'var(--surface2)',
                    border: '1px solid var(--line)'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '15px' }}>{t.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                      {t.subject} • Completed on {new Date(t.completed_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span className={`pill ${t.percentage >= 70 ? 'good' : 'warn'}`} style={{ fontWeight: 700 }}>
                      {t.score}/{t.total_questions} ({t.percentage}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">
              No mock tests completed yet. Launch your first test above to track diagnostic scores!
            </div>
          )}
        </section>
      )}

      {/* TAB 4: AI Settings & API Key */}
      {activeTab === 'settings' && (
        <section className="card" style={{ maxWidth: '650px' }}>
          <div className="cardhead">
            <h2>AI API Configuration</h2>
            <span className="pill good">Zero Setup Required</span>
          </div>

          <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '16px' }}>
            StudyPilot includes a built-in intelligent academic engine that runs out of the box. You can also provide your own <b>Google Gemini API Key</b> or <b>OpenAI API Key</b> to enable dynamic LLM synthesis.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Google Gemini or OpenAI API Key (Optional):
              </label>
              <input
                type="password"
                placeholder="AIzaSy... or sk-..."
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '10px', border: '1px solid var(--line)' }}
              />
              <span style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
                Your key is stored locally in your browser and used securely for plan generation and question synthesis.
              </span>
            </div>

            <button
              className="btn primary"
              onClick={() => handleSaveApiKey(apiKey)}
              style={{ width: 'fit-content' }}
            >
              Save Configuration
            </button>
          </div>
        </section>
      )}
    </div>
  );
};
