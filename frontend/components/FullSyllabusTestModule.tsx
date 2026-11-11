/* eslint-disable react-hooks/immutability */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { StudyPlan, Subject, MockTest, TestResult, MockQuestion, TestBreakdownItem, SyllabusParseResult } from '@/types';
import { today, fmtMins } from '@/lib/seed';
import { api } from '@/lib/api';
import { Icon } from './Icons';

interface FullSyllabusTestModuleProps {
  plan: StudyPlan;
  token?: string | null;
  onUpdatePlan: (plan: StudyPlan) => void;
  onNavigateToView: (view: string) => void;
  showToast: (msg: string) => void;
  onStartFocusSession?: (mins: number, subjectId?: string) => void;
}

export const FullSyllabusTestModule: React.FC<FullSyllabusTestModuleProps> = ({
  plan,
  token,
  onUpdatePlan,
  onNavigateToView,
  showToast,
  onStartFocusSession
}) => {
  // User Profile / Role State
  const [userRole, setUserRole] = useState<'student' | 'competitive_exam' | 'professional'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('studypilot.role');
      if (saved === 'student' || saved === 'competitive_exam' || saved === 'professional') return saved;
    }
    return plan.role || 'competitive_exam';
  });

  // Selected Subject Paper ('all' = full syllabus combined paper, or specific subject name)
  const [selectedSubjectPaper, setSelectedSubjectPaper] = useState<string>('all');

  // Test configuration
  const [durationMins, setDurationMins] = useState<60 | 180>(60);
  const [difficulty, setDifficulty] = useState<'easy' | 'moderate' | 'difficult'>('moderate');
  const [selectedTestNum, setSelectedTestNum] = useState<number>(1);
  const [isGeneratingTest, setIsGeneratingTest] = useState(false);
  const [isSubmittingTest, setIsSubmittingTest] = useState(false);

  // Active Test Execution State
  const [activeTest, setActiveTest] = useState<MockTest | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({});
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);
  const [testTimeRemaining, setTestTimeRemaining] = useState<number>(3600); // in seconds
  const [isTestActive, setIsTestActive] = useState<boolean>(false);
  const [subjectFilterTab, setSubjectFilterTab] = useState<string>('all');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'incorrect' | 'correct' | 'review'>('all');
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [showExitModal, setShowExitModal] = useState<boolean>(false);
  const timerRef = useRef<any>(null);

  // Syllabus Completion Override state (allows marking all complete or using actual topic stages)
  const [forceCompleteSyllabus, setForceCompleteSyllabus] = useState<boolean>(false);

  // Syllabus Upload Modal in Planner
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isParsingUpload, setIsParsingUpload] = useState(false);
  const [parsedUploadResult, setParsedUploadResult] = useState<SyllabusParseResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Past Full Syllabus Tests History (local + cloud synced)
  const [testHistory, setTestHistory] = useState<TestResult[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('studypilot.full_syllabus_tests_history');
        if (stored) return JSON.parse(stored);
      } catch (e) {}
    }
    return [];
  });

  // Role Change Handler
  const handleRoleChange = async (newRole: 'student' | 'competitive_exam' | 'professional') => {
    setUserRole(newRole);
    if (typeof window !== 'undefined') {
      localStorage.setItem('studypilot.role', newRole);
    }
    const updated = { ...plan, role: newRole };
    onUpdatePlan(updated);
    if (token) {
      try {
        await api.updateProfile(token, { role: newRole } as any);
      } catch (e) {}
    }
    const roleLabel = newRole === 'competitive_exam'
      ? 'Competitive Exam Prep (+4 / -1 negative marking)'
      : newRole === 'student'
      ? 'Student Mode (Standard 1 Mark, no negative marking)'
      : 'Professional Certification Mode';
    showToast(`Role switched to: ${roleLabel}`);
  };

  // Calculate Syllabus Completion Metrics
  const totalTopics = plan.subjects.reduce((acc, s) => acc + s.topics.length, 0);
  const masteredTopics = plan.subjects.reduce(
    (acc, s) => acc + s.topics.filter(t => t.stage >= 3).length,
    0
  );
  const actualCompletionPct = totalTopics > 0 ? Math.round((masteredTopics / totalTopics) * 100) : 0;
  const isSyllabusFullyCompleted = forceCompleteSyllabus || actualCompletionPct >= 100;
  const effectiveCompletionPct = forceCompleteSyllabus ? 100 : actualCompletionPct;

  // Focus Time Statistics
  const tToday = today();
  const todayFocusMins = plan.sessions
    .filter(s => s.date === tToday)
    .reduce((acc, s) => acc + s.mins, 0);
  const totalFocusMins = plan.sessions.reduce((acc, s) => acc + s.mins, 0);
  const totalFocusHours = (totalFocusMins / 60).toFixed(1);

  // Countdown Timer for CBT Exam Mode
  useEffect(() => {
    if (isTestActive && testTimeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTestTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleSubmitTest(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [isTestActive, testTimeRemaining]);

  // Save history to localStorage
  const saveTestResult = (result: TestResult) => {
    setTestHistory(prev => {
      const updated = [result, ...prev.filter(r => r.test_id !== result.test_id)];
      try {
        localStorage.setItem('studypilot.full_syllabus_tests_history', JSON.stringify(updated.slice(0, 30)));
      } catch (e) {}
      return updated;
    });
  };

  // Generate Examination Paper (Subject-Wise or Full Syllabus)
  const handleStartFullSyllabusTest = async () => {
    if (plan.subjects.length === 0) {
      showToast('Please upload your syllabus (PDF, Excel, or CSV) before generating tests.');
      setIsUploadModalOpen(true);
      return;
    }

    setIsGeneratingTest(true);
    setTestResult(null);
    setUserAnswers({});
    setMarkedForReview({});
    setCurrentQuestionIdx(0);
    setSubjectFilterTab('all');

    const numQs = durationMins === 180 ? 75 : 30;

    try {
      const test = await api.generateFullSyllabusTest({
        syllabus: plan.subjects,
        duration_mins: durationMins,
        difficulty: difficulty,
        test_number: selectedTestNum,
        num_questions: numQs,
        subject_name: selectedSubjectPaper !== 'all' ? selectedSubjectPaper : undefined,
        role: userRole
      }, token || undefined);

      setActiveTest(test);
      setTestTimeRemaining(durationMins * 60);
      setIsTestActive(true);
      showToast(`⚡ Generated ${test.title} (${test.questions.length} Questions)!`);
    } catch (err: any) {
      showToast(err.message || 'Failed to generate test. Check connection.');
    } finally {
      setIsGeneratingTest(false);
    }
  };

  // Execute Test Evaluation with Role-Specific Marking Scheme
  const executeTestEvaluation = async () => {
    if (!activeTest || isSubmittingTest) return;

    setShowSubmitModal(false);
    setIsSubmittingTest(true);
    clearInterval(timerRef.current);
    setIsTestActive(false);

    const totalQuestions = activeTest.questions.length;
    let correctCount = 0;
    let incorrectCount = 0;
    let unattemptedCount = 0;
    const breakdown: TestBreakdownItem[] = [];
    const subjectMap: Record<string, { correct: number; total: number; percentage: number }> = {};

    activeTest.questions.forEach((q, idx) => {
      const sName = q.subject || 'General';
      if (!subjectMap[sName]) {
        subjectMap[sName] = { correct: 0, total: 0, percentage: 0 };
      }
      subjectMap[sName].total += 1;

      const userChoice = userAnswers[String(idx)];
      if (userChoice === undefined) {
        unattemptedCount += 1;
      }
      const isCorrect = userChoice !== undefined && Number(userChoice) === Number(q.correct_answer);
      if (isCorrect) {
        correctCount += 1;
        subjectMap[sName].correct += 1;
      } else if (userChoice !== undefined) {
        incorrectCount += 1;
      }

      breakdown.push({
        question_index: idx,
        topic: q.topic || 'General Topic',
        subject: sName,
        question: q.question,
        user_choice: userChoice !== undefined ? Number(userChoice) : null,
        correct_answer: q.correct_answer,
        is_correct: isCorrect,
        explanation: q.explanation || 'Refer to fundamental principles.'
      });
    });

    Object.keys(subjectMap).forEach(k => {
      const s = subjectMap[k];
      s.percentage = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
    });

    const isCompetitive = (activeTest.role || userRole) === 'competitive_exam';
    const markingScheme = activeTest.marking_scheme || (isCompetitive
      ? { correct: 4, incorrect: -1, type: 'competitive', label: '+4 for Correct, -1 for Incorrect (Competitive Marking)' }
      : { correct: 1, incorrect: 0, type: 'standard', label: '1 Mark per Question (No Negative Marking)' });

    let rawScore = 0;
    let maxMarks = totalQuestions;
    let negativeDeduction = 0;
    let pct = 0;

    if (isCompetitive) {
      maxMarks = totalQuestions * 4;
      negativeDeduction = incorrectCount * 1;
      rawScore = (correctCount * 4) - negativeDeduction;
      pct = maxMarks > 0 ? Math.max(0, Math.round((rawScore / maxMarks) * 100)) : 0;
    } else {
      rawScore = correctCount;
      maxMarks = totalQuestions;
      negativeDeduction = 0;
      pct = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    }

    const passed = pct >= 65;
    const timeSpentSecs = (durationMins * 60) - testTimeRemaining;

    const evaluatedResult: TestResult = {
      success: true,
      test_id: activeTest.test_id,
      score: correctCount,
      total: totalQuestions,
      raw_score: rawScore,
      max_marks: maxMarks,
      negative_deduction: negativeDeduction,
      percentage: pct,
      passed,
      duration_mins: durationMins,
      difficulty,
      test_number: selectedTestNum,
      role: isCompetitive ? 'competitive_exam' : 'student',
      subject_filter: selectedSubjectPaper,
      marking_scheme: markingScheme,
      time_taken_seconds: timeSpentSecs,
      subject_scores: subjectMap,
      breakdown,
      adjustments: {
        passed,
        score: correctCount,
        total: totalQuestions,
        percentage: pct,
        topic_names: activeTest.topics || [],
        action: passed ? 'advance_stage' : 'reinforce_drill',
        recommended_message: passed
          ? `Outstanding work! You scored ${rawScore}/${maxMarks} (${pct}%). Your syllabus mastery is solid.`
          : `You scored ${rawScore}/${maxMarks} (${pct}%). Targeted focus sprint recommended for lower-scoring areas.`
      }
    };

    setTestResult(evaluatedResult);
    saveTestResult(evaluatedResult);

    // Also persist to server if user is signed in
    if (token) {
      api.submitMockTest({
        test_id: activeTest.test_id,
        title: activeTest.title,
        subject: selectedSubjectPaper !== 'all' ? selectedSubjectPaper : 'Full Syllabus',
        topics: activeTest.topics,
        questions: activeTest.questions,
        user_answers: userAnswers,
        time_taken_seconds: timeSpentSecs
      }, token).catch(() => {});
    }

    setIsSubmittingTest(false);
    const markMsg = isCompetitive
      ? `Marks: ${rawScore}/${maxMarks} (${pct}%) with -${negativeDeduction} penalty`
      : `Score: ${correctCount}/${totalQuestions} (${pct}%)`;
    showToast(`Test submitted! ${markMsg}`);
  };

  // Submit Test Handler
  const handleSubmitTest = (isAutoSubmit = false) => {
    if (isAutoSubmit) {
      executeTestEvaluation();
    } else {
      setShowSubmitModal(true);
    }
  };

  // Upload Syllabus File Handler
  const handleUploadSyllabusFile = async (file: File) => {
    setUploadError(null);
    setUploadFile(file);
    setIsParsingUpload(true);
    try {
      const res = await api.parseAndPlanSyllabus(file, {
        exam_name: plan.exam.name,
        exam_date: plan.exam.date,
        daily_goal_mins: plan.goalMins
      }, token || undefined);

      setParsedUploadResult(res);
      showToast(`Parsed: ${res.subjects_count} subjects, ${res.topics_count} topics extracted!`);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to parse syllabus file. Please ensure valid PDF or Excel format.');
    } finally {
      setIsParsingUpload(false);
    }
  };

  const handleApplyParsedSyllabus = () => {
    if (!parsedUploadResult) return;
    onUpdatePlan(parsedUploadResult.plan);
    setIsUploadModalOpen(false);
    setParsedUploadResult(null);
    setUploadFile(null);
    showToast('🎉 New syllabus study plan applied successfully!');
  };

  // Format seconds to mm:ss or hh:mm:ss
  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Filter questions by subject in CBT test mode
  const currentQuestions = activeTest ? activeTest.questions : [];
  const subjectList = activeTest
    ? Array.from(new Set(activeTest.questions.map(q => q.subject || 'General')))
    : plan.subjects.map(s => s.name);

  const filteredQuestionIndices = currentQuestions
    .map((q, idx) => ({ q, idx }))
    .filter(({ q }) => subjectFilterTab === 'all' || (q.subject || 'General') === subjectFilterTab)
    .map(({ idx }) => idx);

  const activeQuestion: MockQuestion | undefined = activeTest?.questions[currentQuestionIdx];

  // Weak subject detection for focus recommendation
  const weakSubjects = testResult && testResult.subject_scores
    ? Object.entries(testResult.subject_scores)
        .filter(([_, data]) => data.percentage < 70)
        .sort((a, b) => a[1].percentage - b[1].percentage)
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Module Hero Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)',
          border: '1px solid var(--line)',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: 'var(--shadow)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)'
                }}
              >
                <Icon name="today" size={18} />
              </span>
              <p className="eyebrow" style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)' }}>
                Exam Simulation & Readiness Hub
              </p>
            </div>
            <h2 style={{ fontSize: '24px', margin: '4px 0 6px 0', letterSpacing: '-0.02em' }}>
              Focus Time & Complete Syllabus Tests
            </h2>
            <p className="lede" style={{ margin: 0, maxWidth: '640px', fontSize: '14px', color: 'var(--muted)' }}>
              Master your curriculum with focused study sprints and full-length exam papers (60-minute rapid drills and 3-hour comprehensive tests) across Easy, Moderate, and Difficult tiers.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn"
              onClick={() => setIsUploadModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>📄</span>
              <span>Upload / Update Syllabus</span>
            </button>
            <button
              className="btn"
              onClick={() => onNavigateToView('focus')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Icon name="focus" size={16} />
              <span>Deep Focus Mode</span>
            </button>
          </div>
        </div>

        {/* User Role Selection Pill Bar */}
        <div
          style={{
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)' }}>
              Current Role:
            </span>
            <div style={{ display: 'flex', gap: '6px', background: 'var(--surface)', padding: '3px', borderRadius: '10px', border: '1px solid var(--line)' }}>
              <button
                type="button"
                className={`btn sm ${userRole === 'student' ? 'primary' : ''}`}
                onClick={() => handleRoleChange('student')}
                style={{ borderRadius: '8px', padding: '5px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <span>🎓</span>
                <span>Student (School / College)</span>
              </button>
              <button
                type="button"
                className={`btn sm ${userRole === 'competitive_exam' ? 'primary' : ''}`}
                onClick={() => handleRoleChange('competitive_exam')}
                style={{ borderRadius: '8px', padding: '5px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <span>🏆</span>
                <span>Competitive Exam Prep</span>
              </button>
              <button
                type="button"
                className={`btn sm ${userRole === 'professional' ? 'primary' : ''}`}
                onClick={() => handleRoleChange('professional')}
                style={{ borderRadius: '8px', padding: '5px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <span>💼</span>
                <span>Professional</span>
              </button>
            </div>
          </div>

          <span
            style={{
              fontSize: '11px',
              padding: '4px 10px',
              borderRadius: '12px',
              fontWeight: 600,
              background: userRole === 'competitive_exam' ? 'var(--amber-soft)' : 'var(--good-soft)',
              color: userRole === 'competitive_exam' ? 'var(--amber)' : 'var(--good)',
              border: `1px solid ${userRole === 'competitive_exam' ? 'var(--amber)' : 'var(--good)'}33`
            }}
          >
            {userRole === 'competitive_exam'
              ? '⚡ +4 Correct / -1 Incorrect Negative Marking Active'
              : '📘 Standard 1 Mark (No Negative Deduction)'}
          </span>
        </div>

        {/* Status Metrics Strip */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '14px',
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid var(--line)'
          }}
        >
          {/* Syllabus Progress Gauge */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
                Syllabus Topics
              </span>
              <span
                style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontWeight: 600,
                  background: isSyllabusFullyCompleted ? 'var(--good-soft)' : 'var(--amber-soft)',
                  color: isSyllabusFullyCompleted ? 'var(--good)' : 'var(--amber)'
                }}
              >
                {plan.subjects.length === 0 ? 'No Syllabus Uploaded' : isSyllabusFullyCompleted ? '✓ Tests Unlocked' : `${effectiveCompletionPct}% Done`}
              </span>
            </div>

            <div style={{ height: '8px', background: 'var(--line)', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${plan.subjects.length === 0 ? 0 : effectiveCompletionPct}%`,
                  background: isSyllabusFullyCompleted ? 'var(--good)' : 'var(--accent)',
                  transition: 'width 0.4s ease'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--muted)' }}>
              <span>{masteredTopics} of {totalTopics} topics mastered</span>
              {totalTopics > 0 && (
                <button
                  type="button"
                  className="linkbtn"
                  style={{ fontSize: '11px', textDecoration: 'underline' }}
                  onClick={() => setForceCompleteSyllabus(!forceCompleteSyllabus)}
                >
                  {forceCompleteSyllabus ? 'Reset to actual progress' : 'Mark all completed'}
                </button>
              )}
            </div>
          </div>

          {/* Focus Time Today */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
              Today&apos;s Focus Time
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ink)' }}>{todayFocusMins}</span>
              <span style={{ fontSize: '13px', color: 'var(--muted)' }}>mins / {plan.goalMins}m goal</span>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Total logged: {totalFocusHours}h deep work
            </span>
          </div>

          {/* Exam Countdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
              Target Exam
            </span>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)' }}>
              {plan.exam.name}
            </div>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
              📅 {plan.exam.date}
            </span>
          </div>
        </div>
      </div>

      {/* When NO Syllabus Uploaded Yet -> Display Clean Zero Dummy Data Prompt Card */}
      {!isTestActive && plan.subjects.length === 0 && (
        <div
          className="card"
          style={{
            padding: '36px 28px',
            textAlign: 'center',
            background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)',
            border: '2px dashed var(--accent)',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            boxShadow: 'var(--shadow)'
          }}
        >
          <span style={{ fontSize: '48px' }}>📂</span>
          <div style={{ maxWidth: '580px' }}>
            <h3 style={{ fontSize: '22px', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
              Upload Your Syllabus to Unlock Exam Papers
            </h3>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)', lineHeight: '1.5' }}>
              StudyPilot generates exam questions and study plans strictly from your real subjects and curriculum — no dummy data shown. Upload your syllabus in PDF, Excel (.xlsx, .xls), or CSV format to begin.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '6px' }}>
            <button
              className="btn primary"
              onClick={() => setIsUploadModalOpen(true)}
              style={{ height: '48px', padding: '0 26px', fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <span>📄</span>
              <span>Upload Syllabus File (PDF, Excel, CSV)</span>
            </button>
          </div>

          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center', fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
            <span>✓ Multi-subject Excel & CSV sheets supported</span>
            <span>✓ Instant subject & chapter breakdown</span>
            <span>✓ Separate papers per subject or combined test</span>
          </div>
        </div>
      )}

      {/* Main Full Syllabus Test Config & Dashboard (Shown when user has uploaded syllabus subjects) */}
      {!isTestActive && plan.subjects.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ marginBottom: '18px' }}>
              <h3 style={{ fontSize: '18px', margin: 0, marginBottom: '4px' }}>
                Examination Paper Configuration
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
                Generate subject-wise drill papers or full syllabus grand exams across Easy, Moderate, and Difficult tiers.
              </p>
            </div>

            {/* Subject-Wise Paper Selector */}
            <div style={{ marginBottom: '22px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                1. Select Paper Scope (Subject-Wise or Full Syllabus)
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setSelectedSubjectPaper('all')}
                  style={{
                    padding: '9px 14px',
                    borderRadius: '10px',
                    border: `2px solid ${selectedSubjectPaper === 'all' ? 'var(--accent)' : 'var(--line)'}`,
                    background: selectedSubjectPaper === 'all' ? 'var(--accent-soft)' : 'var(--surface2)',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>📚</span>
                  <span>All Subjects Combined Grand Paper</span>
                  <span className="chip" style={{ fontSize: '10px' }}>{plan.subjects.length} Subjects</span>
                </button>

                {plan.subjects.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedSubjectPaper(s.name)}
                    style={{
                      padding: '9px 14px',
                      borderRadius: '10px',
                      border: `2px solid ${selectedSubjectPaper === s.name ? s.color : 'var(--line)'}`,
                      background: selectedSubjectPaper === s.name ? `${s.color}22` : 'var(--surface2)',
                      color: selectedSubjectPaper === s.name ? s.color : 'var(--ink)',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color }} />
                    <span>{s.name} Paper</span>
                    <span style={{ fontSize: '11px', opacity: 0.8 }}>({s.topics.length} topics)</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Test Duration Selector (60-Minute vs 3-Hour) */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                2. Select Exam Duration
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                {/* 60-Minute Rapid Test */}
                <div
                  onClick={() => setDurationMins(60)}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    border: `2px solid ${durationMins === 60 ? 'var(--accent)' : 'var(--line)'}`,
                    background: durationMins === 60 ? 'var(--accent-soft)' : 'var(--surface2)',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px'
                  }}
                >
                  <span style={{ fontSize: '26px' }}>⚡</span>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <span style={{ fontSize: '16px', fontWeight: 700 }}>60-Minute Rapid Test</span>
                      <span className="chip" style={{ fontSize: '11px', background: 'var(--surface)', fontWeight: 600 }}>30 Questions</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)', lineHeight: '1.4' }}>
                      Fast-paced test paper. Ideal for weekly revision, accuracy drills, and rapid recall testing.
                    </p>
                  </div>
                </div>

                {/* 3-Hour Grand Mock Exam */}
                <div
                  onClick={() => setDurationMins(180)}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    border: `2px solid ${durationMins === 180 ? 'var(--accent)' : 'var(--line)'}`,
                    background: durationMins === 180 ? 'var(--accent-soft)' : 'var(--surface2)',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px'
                  }}
                >
                  <span style={{ fontSize: '26px' }}>🏆</span>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <span style={{ fontSize: '16px', fontWeight: 700 }}>3-Hour Grand Mock Exam</span>
                      <span className="chip" style={{ fontSize: '11px', background: 'var(--surface)', fontWeight: 600 }}>75 Questions</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)', lineHeight: '1.4' }}>
                      Full 180-minute official exam simulation. Tests mental endurance, pacing, and multi-concept synthesis.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Difficulty Tier Selector (Easy, Moderate, Difficult) */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                3. Select Difficulty Level
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                {/* Easy */}
                <div
                  onClick={() => setDifficulty('easy')}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    border: `2px solid ${difficulty === 'easy' ? 'var(--good)' : 'var(--line)'}`,
                    background: difficulty === 'easy' ? 'var(--good-soft)' : 'var(--surface)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--good)' }} />
                    <span style={{ fontWeight: 700, fontSize: '14px' }}>Easy Tier</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted)' }}>
                    Core definitions, fundamental equations, unit conversions, and direct conceptual applications.
                  </p>
                </div>

                {/* Moderate */}
                <div
                  onClick={() => setDifficulty('moderate')}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    border: `2px solid ${difficulty === 'moderate' ? 'var(--amber)' : 'var(--line)'}`,
                    background: difficulty === 'moderate' ? 'var(--amber-soft)' : 'var(--surface)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--amber)' }} />
                    <span style={{ fontWeight: 700, fontSize: '14px' }}>Moderate Tier</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted)' }}>
                    Application-based problems, multi-step equations, graphical slopes/areas, standard competitive exam level.
                  </p>
                </div>

                {/* Difficult */}
                <div
                  onClick={() => setDifficulty('difficult')}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    border: `2px solid ${difficulty === 'difficult' ? 'var(--crit)' : 'var(--line)'}`,
                    background: difficulty === 'difficult' ? 'var(--crit-soft)' : 'var(--surface)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--crit)' }} />
                    <span style={{ fontWeight: 700, fontSize: '14px' }}>Difficult Tier</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted)' }}>
                    Advanced edge cases, assertion-reasons, multi-variable constraints, asymptotic limits, and tricky distractors.
                  </p>
                </div>
              </div>
            </div>

            {/* Test Paper Number Selector */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                4. Choose Test Paper Number
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[1, 2, 3, 4, 5, 6].map(num => {
                  const pastAttempt = testHistory.find(
                    h => h.test_number === num && h.duration_mins === durationMins
                  );
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setSelectedTestNum(num)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: `1.5px solid ${selectedTestNum === num ? 'var(--accent)' : 'var(--line)'}`,
                        background: selectedTestNum === num ? 'var(--accent)' : 'var(--surface2)',
                        color: selectedTestNum === num ? 'var(--accent-ink)' : 'var(--ink)',
                        fontWeight: 600,
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      <span>Paper #{num}</span>
                      {pastAttempt && (
                        <span
                          style={{
                            fontSize: '10px',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            background: selectedTestNum === num ? 'rgba(255,255,255,0.25)' : 'var(--surface)',
                            color: selectedTestNum === num ? '#fff' : pastAttempt.passed ? 'var(--good)' : 'var(--amber)'
                          }}
                        >
                          {pastAttempt.percentage}%
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <button
                className="btn primary"
                onClick={handleStartFullSyllabusTest}
                disabled={isGeneratingTest}
                style={{
                  height: '46px',
                  padding: '0 24px',
                  fontSize: '15px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {isGeneratingTest ? (
                  <>
                    <span className="spinner" style={{ width: '18px', height: '18px' }} />
                    <span>Preparing Examination Paper...</span>
                  </>
                ) : (
                  <>
                    <Icon name="play" size={16} />
                    <span>
                      Start {selectedSubjectPaper !== 'all' ? `${selectedSubjectPaper} Paper` : `${durationMins === 60 ? '60-Minute' : '3-Hour'} Exam`} #{selectedTestNum}
                    </span>
                  </>
                )}
              </button>

              <button
                className="btn"
                onClick={() => {
                  if (onStartFocusSession) {
                    onStartFocusSession(plan.settings.focus || 45);
                  } else {
                    onNavigateToView('focus');
                  }
                }}
                style={{ height: '46px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Icon name="focus" size={16} />
                <span>Warm Up with {plan.settings.focus || 45}m Focus Sprint</span>
              </button>
            </div>
          </div>

          {/* Test Result Scorecard (if just submitted) */}
          {testResult && (
            <div
              className="card"
              style={{
                padding: '24px',
                border: `2px solid ${testResult.passed ? 'var(--good)' : 'var(--amber)'}`,
                background: 'var(--surface)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 700,
                        background: testResult.passed ? 'var(--good-soft)' : 'var(--amber-soft)',
                        color: testResult.passed ? 'var(--good)' : 'var(--amber)'
                      }}
                    >
                      {testResult.passed ? '✓ PASSED & QUALIFIED' : '⚠ NEEDS REINFORCEMENT'}
                    </span>
                    <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                      Paper #{testResult.test_number || 1} • {testResult.subject_filter && testResult.subject_filter !== 'all' ? `${testResult.subject_filter} Paper` : 'Combined Full Paper'} • {testResult.duration_mins} Mins • {testResult.difficulty?.toUpperCase()}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '8px',
                        background: testResult.role === 'competitive_exam' ? 'var(--amber-soft)' : 'var(--accent-soft)',
                        color: testResult.role === 'competitive_exam' ? 'var(--amber)' : 'var(--accent)',
                        fontWeight: 600
                      }}
                    >
                      {testResult.role === 'competitive_exam' ? '⚡ Competitive (+4/-1)' : '📘 Student (Standard 1M)'}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '24px', margin: 0 }}>
                    {testResult.role === 'competitive_exam'
                      ? `Marks: ${testResult.raw_score !== undefined ? testResult.raw_score : testResult.score} / ${testResult.max_marks || (testResult.total * 4)} (${testResult.percentage}%)`
                      : `Score: ${testResult.score} / ${testResult.total} (${testResult.percentage}%)`}
                  </h3>
                  <div style={{
                    display: 'flex',
                    gap: '12px',
                    flexWrap: 'wrap',
                    marginTop: '8px',
                    padding: '8px 12px',
                    background: 'var(--surface2)',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}>
                    <span style={{ color: 'var(--good)', fontWeight: 600 }}>✓ Correct: {testResult.score} {testResult.role === 'competitive_exam' ? `(+${testResult.score * 4} marks)` : ''}</span>
                    <span style={{ color: 'var(--crit)', fontWeight: 600 }}>✗ Incorrect: {testResult.total - testResult.score - (testResult.breakdown.filter(b => b.user_choice === null).length)} {testResult.role === 'competitive_exam' ? `(-${testResult.negative_deduction || 0} penalty)` : ''}</span>
                    <span style={{ color: 'var(--muted)' }}>⚪ Unattempted: {testResult.breakdown.filter(b => b.user_choice === null).length}</span>
                    <span style={{ fontWeight: 600 }}>Time: {formatTime(testResult.time_taken_seconds || 0)}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn primary sm"
                    onClick={() => {
                      setSelectedTestNum(prev => prev + 1);
                      handleStartFullSyllabusTest();
                    }}
                  >
                    Retake Next Paper #{((testResult.test_number || 1) + 1)}
                  </button>
                  <button
                    className="btn sm"
                    onClick={() => setTestResult(null)}
                  >
                    Close Scorecard
                  </button>
                </div>
              </div>

              {/* Subject Breakdown Radar */}
              {testResult.subject_scores && (
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ fontSize: '14px', marginBottom: '10px', textTransform: 'uppercase', color: 'var(--muted)' }}>
                    Subject-Wise Performance Breakdown
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                    {Object.entries(testResult.subject_scores).map(([sName, data]) => {
                      const sPassed = data.percentage >= 65;
                      return (
                        <div
                          key={sName}
                          style={{
                            padding: '12px',
                            borderRadius: '8px',
                            background: 'var(--surface2)',
                            border: '1px solid var(--line)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 600, fontSize: '13px' }}>{sName}</span>
                            <span style={{ fontWeight: 700, fontSize: '13px', color: sPassed ? 'var(--good)' : 'var(--crit)' }}>
                              {data.percentage}%
                            </span>
                          </div>
                          <div style={{ height: '6px', background: 'var(--line)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div
                              style={{
                                height: '100%',
                                width: `${data.percentage}%`,
                                background: sPassed ? 'var(--good)' : 'var(--crit)'
                              }}
                            />
                          </div>
                          <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--muted)' }}>
                            {data.correct} of {data.total} correct
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Actionable Focus Prescription */}
              {weakSubjects.length > 0 && (
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    background: 'var(--amber-soft)',
                    border: '1px solid var(--amber)',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '20px' }}>🎯</span>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)' }}>
                        Recommended Focus Prescription
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                        Lower score detected in <strong>{weakSubjects[0][0]} ({weakSubjects[0][1].percentage}%)</strong>. Dedicate 45 minutes of focused study on this subject before your next mock test.
                      </div>
                    </div>
                  </div>

                  <button
                    className="btn primary sm"
                    onClick={() => {
                      const matchedSubj = plan.subjects.find(s => s.name.toLowerCase() === weakSubjects[0][0].toLowerCase());
                      if (onStartFocusSession) {
                        onStartFocusSession(45, matchedSubj?.id);
                      } else {
                        onNavigateToView('focus');
                      }
                    }}
                  >
                    Start 45m Focus Session Now
                  </button>
                </div>
              )}

              {/* Question Review Filter */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <h4 style={{ fontSize: '15px', margin: 0 }}>Detailed Question Analysis & Explanations</h4>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {(['all', 'incorrect', 'correct'] as const).map(f => (
                      <button
                        key={f}
                        className={`chip ${reviewFilter === f ? 'active' : ''}`}
                        onClick={() => setReviewFilter(f)}
                        style={{
                          textTransform: 'capitalize',
                          cursor: 'pointer',
                          background: reviewFilter === f ? 'var(--accent)' : 'var(--surface2)',
                          color: reviewFilter === f ? '#fff' : 'inherit'
                        }}
                      >
                        {f === 'all' ? `All (${testResult.breakdown.length})` : f}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
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
                          padding: '14px',
                          borderRadius: '8px',
                          background: 'var(--surface2)',
                          borderLeft: `4px solid ${item.is_correct ? 'var(--good)' : 'var(--crit)'}`
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)' }}>
                            Q{item.question_index + 1} • {item.subject} • {item.topic}
                          </span>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: item.is_correct ? 'var(--good)' : 'var(--crit)' }}>
                            {item.is_correct ? '✓ Correct' : '✗ Incorrect / Missed'}
                          </span>
                        </div>
                        <p style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600 }}>{item.question}</p>
                        <div style={{ fontSize: '12px', color: 'var(--muted)', background: 'var(--surface)', padding: '8px 10px', borderRadius: '6px' }}>
                          <strong>Explanation:</strong> {item.explanation}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Past Full Syllabus Tests Table */}
          {testHistory.length > 0 && (
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '16px', margin: 0 }}>Full Syllabus Test History ({testHistory.length})</h3>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Saved on device</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left', color: 'var(--muted)' }}>
                      <th style={{ padding: '8px 10px' }}>Test Paper</th>
                      <th style={{ padding: '8px 10px' }}>Duration</th>
                      <th style={{ padding: '8px 10px' }}>Difficulty</th>
                      <th style={{ padding: '8px 10px' }}>Score</th>
                      <th style={{ padding: '8px 10px' }}>Percentage</th>
                      <th style={{ padding: '8px 10px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testHistory.slice(0, 10).map((th, i) => (
                      <tr key={th.test_id || i} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '10px' }}>
                          <div style={{ fontWeight: 600 }}>Paper #{th.test_number || 1}</div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                            {th.subject_filter && th.subject_filter !== 'all' ? `${th.subject_filter} Paper` : 'Combined Grand Paper'}
                          </div>
                        </td>
                        <td style={{ padding: '10px' }}>{th.duration_mins || 60} Mins</td>
                        <td style={{ padding: '10px', textTransform: 'capitalize' }}>{th.difficulty || 'Moderate'}</td>
                        <td style={{ padding: '10px' }}>
                          {th.role === 'competitive_exam'
                            ? `${th.raw_score !== undefined ? th.raw_score : th.score} / ${th.max_marks || (th.total * 4)} marks`
                            : `${th.score} / ${th.total}`}
                        </td>
                        <td style={{ padding: '10px', fontWeight: 600 }}>{th.percentage}%</td>
                        <td style={{ padding: '10px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '10px',
                              fontWeight: 600,
                              background: th.passed ? 'var(--good-soft)' : 'var(--crit-soft)',
                              color: th.passed ? 'var(--good)' : 'var(--crit)'
                            }}
                          >
                            {th.passed ? 'Passed' : 'Reinforce'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CBT Active Full Syllabus Test Examination Interface */}
      {isTestActive && activeTest && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'var(--bg)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* CBT Header */}
          <header
            style={{
              height: '64px',
              padding: '0 24px',
              background: 'var(--surface)',
              borderBottom: '1px solid var(--line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: 'var(--shadow)'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>
                  {durationMins}-Minute Exam • {difficulty.toUpperCase()} TIER
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    fontWeight: 700,
                    background: (activeTest.role || userRole) === 'competitive_exam' ? 'var(--amber-soft)' : 'var(--accent-soft)',
                    color: (activeTest.role || userRole) === 'competitive_exam' ? 'var(--amber)' : 'var(--accent)'
                  }}
                >
                  {(activeTest.role || userRole) === 'competitive_exam' ? '+4 / -1 Marking' : 'Standard 1 Mark (No Negative)'}
                </span>
              </div>
              <h2 style={{ fontSize: '18px', margin: 0 }}>
                {activeTest.title}
              </h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Countdown Clock */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  background: testTimeRemaining < 300 ? 'var(--crit-soft)' : testTimeRemaining < 900 ? 'var(--amber-soft)' : 'var(--surface2)',
                  border: `1.5px solid ${testTimeRemaining < 300 ? 'var(--crit)' : testTimeRemaining < 900 ? 'var(--amber)' : 'var(--line)'}`
                }}
              >
                <Icon name="focus" size={16} />
                <span
                  style={{
                    fontFamily: 'var(--f-mono)',
                    fontSize: '18px',
                    fontWeight: 700,
                    color: testTimeRemaining < 300 ? 'var(--crit)' : 'var(--ink)'
                  }}
                >
                  {formatTime(testTimeRemaining)}
                </span>
              </div>

              <button
                className="btn primary"
                onClick={() => handleSubmitTest(false)}
                disabled={isSubmittingTest}
                style={{ height: '40px', fontWeight: 600 }}
              >
                {isSubmittingTest ? 'Submitting...' : 'Submit Examination Paper'}
              </button>
            </div>
          </header>

          {/* CBT Subject Navigation Tabs */}
          <div
            style={{
              padding: '8px 24px',
              background: 'var(--surface2)',
              borderBottom: '1px solid var(--line)',
              display: 'flex',
              gap: '8px',
              overflowX: 'auto'
            }}
          >
            <button
              className={`chip ${subjectFilterTab === 'all' ? 'active' : ''}`}
              onClick={() => setSubjectFilterTab('all')}
              style={{
                cursor: 'pointer',
                fontWeight: 600,
                background: subjectFilterTab === 'all' ? 'var(--accent)' : 'var(--surface)',
                color: subjectFilterTab === 'all' ? '#fff' : 'inherit'
              }}
            >
              All Sections ({activeTest.questions.length})
            </button>
            {subjectList.map(s => {
              const count = activeTest.questions.filter(q => (q.subject || 'General') === s).length;
              return (
                <button
                  key={s}
                  className={`chip ${subjectFilterTab === s ? 'active' : ''}`}
                  onClick={() => setSubjectFilterTab(s)}
                  style={{
                    cursor: 'pointer',
                    fontWeight: 600,
                    background: subjectFilterTab === s ? 'var(--accent)' : 'var(--surface)',
                    color: subjectFilterTab === s ? '#fff' : 'inherit'
                  }}
                >
                  {s} ({count})
                </button>
              );
            })}
          </div>

          {/* CBT Examination Body */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Question Workspace Area */}
            <main style={{ flex: 1, padding: '24px 32px', overflowY: 'auto' }}>
              {activeQuestion && (
                <div style={{ maxWidth: '820px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Meta Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="chip" style={{ fontWeight: 700, background: 'var(--surface2)' }}>
                        Question {currentQuestionIdx + 1} of {activeTest.questions.length}
                      </span>
                      <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                        Section: <strong>{activeQuestion.subject || 'General'}</strong> • {activeQuestion.topic}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => {
                        const key = String(currentQuestionIdx);
                        setMarkedForReview(prev => ({ ...prev, [key]: !prev[key] }));
                      }}
                      style={{
                        background: markedForReview[String(currentQuestionIdx)] ? 'var(--amber-soft)' : 'var(--surface)',
                        color: markedForReview[String(currentQuestionIdx)] ? 'var(--amber)' : 'inherit',
                        borderColor: markedForReview[String(currentQuestionIdx)] ? 'var(--amber)' : 'var(--line)'
                      }}
                    >
                      {markedForReview[String(currentQuestionIdx)] ? '★ Marked for Review' : '☆ Mark for Review'}
                    </button>
                  </div>

                  {/* Question Stem */}
                  <div
                    className="card"
                    style={{
                      padding: '24px',
                      fontSize: '17px',
                      lineHeight: '1.6',
                      fontWeight: 500,
                      background: 'var(--surface)'
                    }}
                  >
                    {activeQuestion.question}
                  </div>

                  {/* 4 Options Grid */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {activeQuestion.options.map((opt, optIdx) => {
                      const isSelected = userAnswers[String(currentQuestionIdx)] === optIdx;
                      return (
                        <div
                          key={optIdx}
                          onClick={() => {
                            setUserAnswers(prev => ({
                              ...prev,
                              [String(currentQuestionIdx)]: optIdx
                            }));
                          }}
                          style={{
                            padding: '14px 18px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '14px',
                            border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--line)'}`,
                            background: isSelected ? 'var(--accent-soft)' : 'var(--surface)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '50%',
                              border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--muted)'}`,
                              background: isSelected ? 'var(--accent)' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: isSelected ? '#fff' : 'inherit',
                              fontWeight: 700,
                              fontSize: '12px'
                            }}
                          >
                            {String.fromCharCode(65 + optIdx)}
                          </div>
                          <span style={{ fontSize: '15px' }}>{opt}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Navigation Controls */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                    <button
                      className="btn"
                      disabled={currentQuestionIdx === 0}
                      onClick={() => setCurrentQuestionIdx(prev => Math.max(0, prev - 1))}
                    >
                      ⬅ Previous
                    </button>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      {userAnswers[String(currentQuestionIdx)] !== undefined && (
                        <button
                          className="btn sm"
                          onClick={() => {
                            setUserAnswers(prev => {
                              const updated = { ...prev };
                              delete updated[String(currentQuestionIdx)];
                              return updated;
                            });
                          }}
                        >
                          Clear Selection
                        </button>
                      )}

                      <button
                        className="btn primary"
                        onClick={() => {
                          if (currentQuestionIdx < activeTest.questions.length - 1) {
                            setCurrentQuestionIdx(prev => prev + 1);
                          } else {
                            handleSubmitTest(false);
                          }
                        }}
                      >
                        {currentQuestionIdx < activeTest.questions.length - 1 ? 'Save & Next ➡' : 'Submit Paper'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </main>

            {/* CBT Question Palette Sidebar */}
            <aside
              style={{
                width: '320px',
                background: 'var(--surface)',
                borderLeft: '1px solid var(--line)',
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
                padding: '16px'
              }}
            >
              <div style={{ marginBottom: '14px' }}>
                <h4 style={{ fontSize: '14px', margin: '0 0 8px 0' }}>Question Palette</h4>
                {/* Status Legend */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11px', color: 'var(--muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--good)' }} />
                    <span>Answered ({Object.keys(userAnswers).length})</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--amber)' }} />
                    <span>Review ({Object.keys(markedForReview).length})</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--line)' }} />
                    <span>Unanswered ({activeTest.questions.length - Object.keys(userAnswers).length})</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '3px', border: '2px solid var(--accent)' }} />
                    <span>Current</span>
                  </div>
                </div>
              </div>

              {/* Number Buttons Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                {filteredQuestionIndices.map(idx => {
                  const isAnswered = userAnswers[String(idx)] !== undefined;
                  const isMarked = markedForReview[String(idx)];
                  const isCurrent = currentQuestionIdx === idx;

                  let bgColor = 'var(--surface2)';
                  let textColor = 'var(--ink)';

                  if (isMarked) {
                    bgColor = 'var(--amber)';
                    textColor = '#fff';
                  } else if (isAnswered) {
                    bgColor = 'var(--good)';
                    textColor = '#fff';
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentQuestionIdx(idx)}
                      style={{
                        height: '38px',
                        borderRadius: '6px',
                        border: isCurrent ? '2.5px solid var(--accent)' : '1px solid var(--line)',
                        background: bgColor,
                        color: textColor,
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
                <button
                  className="btn"
                  onClick={() => setShowExitModal(true)}
                  style={{ width: '100%', color: 'var(--crit)' }}
                >
                  Exit Exam
                </button>
              </div>
            </aside>
          </div>

          {/* Submit Confirmation Modal */}
          {showSubmitModal && (
            <div className="overlay" style={{ zIndex: 10001 }}>
              <div className="modal" style={{ maxWidth: '440px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <span style={{ fontSize: '22px' }}>🏁</span>
                  <h3 style={{ margin: 0, fontSize: '18px' }}>Confirm Exam Submission</h3>
                </div>

                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--muted)' }}>
                  Are you ready to submit your full syllabus examination paper? Review your progress summary below before finalizing.
                </p>

                <div
                  style={{
                    background: 'var(--surface2)',
                    borderRadius: '10px',
                    padding: '14px',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px',
                    marginBottom: '16px',
                    fontSize: '13px'
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--muted)', fontSize: '11px', display: 'block' }}>Total Questions</span>
                    <strong style={{ fontSize: '16px' }}>{activeTest.questions.length}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--muted)', fontSize: '11px', display: 'block' }}>Answered</span>
                    <strong style={{ fontSize: '16px', color: 'var(--good)' }}>{Object.keys(userAnswers).length}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--muted)', fontSize: '11px', display: 'block' }}>Unanswered</span>
                    <strong style={{ fontSize: '16px', color: activeTest.questions.length - Object.keys(userAnswers).length > 0 ? 'var(--crit)' : 'var(--ink)' }}>
                      {activeTest.questions.length - Object.keys(userAnswers).length}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--muted)', fontSize: '11px', display: 'block' }}>Marked for Review</span>
                    <strong style={{ fontSize: '16px', color: 'var(--amber)' }}>{Object.keys(markedForReview).length}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button className="btn" onClick={() => setShowSubmitModal(false)}>
                    Return to Exam
                  </button>
                  <button
                    className="btn primary"
                    onClick={() => executeTestEvaluation()}
                    disabled={isSubmittingTest}
                  >
                    {isSubmittingTest ? 'Evaluating...' : 'Yes, Submit Paper Now'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Exit Confirmation Modal */}
          {showExitModal && (
            <div className="overlay" style={{ zIndex: 10001 }}>
              <div className="modal" style={{ maxWidth: '400px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '20px' }}>⚠️</span>
                  <h3 style={{ margin: 0, fontSize: '17px' }}>Exit Examination?</h3>
                </div>
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--muted)' }}>
                  Are you sure you want to exit? Your answers and active time for this test session will be discarded.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button className="btn" onClick={() => setShowExitModal(false)}>
                    Keep Testing
                  </button>
                  <button
                    className="btn"
                    style={{ color: 'var(--crit)', borderColor: 'var(--crit)' }}
                    onClick={() => {
                      clearInterval(timerRef.current);
                      setIsTestActive(false);
                      setActiveTest(null);
                      setShowExitModal(false);
                    }}
                  >
                    Discard & Exit
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload Syllabus Modal in Planner */}
      {isUploadModalOpen && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setIsUploadModalOpen(false); }}>
          <div className="modal" style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>📄</span>
                <h3 style={{ margin: 0, fontSize: '18px' }}>Upload & Analyze Syllabus</h3>
              </div>
              <button className="iconbtn" onClick={() => setIsUploadModalOpen(false)}>
                <Icon name="x" size={16} />
              </button>
            </div>

            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--muted)' }}>
              Upload your syllabus in PDF, Excel (.xlsx/.xls), or CSV format. StudyPilot will extract your subjects, chapters, and topics to generate a fresh study roadmap.
            </p>

            <input
              ref={uploadInputRef}
              type="file"
              accept=".pdf,.xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleUploadSyllabusFile(e.target.files[0]);
                }
              }}
            />

            {!parsedUploadResult ? (
              <div
                onClick={() => uploadInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--line)',
                  borderRadius: '12px',
                  padding: '28px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: 'var(--surface2)',
                  marginBottom: '16px'
                }}
              >
                {isParsingUpload ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <div className="spinner" style={{ width: '28px', height: '28px' }} />
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent)' }}>
                      Analyzing curriculum file & scheduling daily tasks...
                    </span>
                  </div>
                ) : (
                  <div>
                    <span style={{ fontSize: '32px', display: 'block', marginBottom: '6px' }}>📁</span>
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>Click to select PDF or Excel syllabus</span>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                      Supports .pdf, .xlsx, .xls, .csv files
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  background: 'var(--surface2)',
                  border: '1px solid var(--line)',
                  marginBottom: '16px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>✅</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px' }}>{parsedUploadResult.filename}</div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                        {parsedUploadResult.subjects_count} subjects • {parsedUploadResult.topics_count} topics • {parsedUploadResult.tasks_count} tasks
                      </div>
                    </div>
                  </div>
                  <button
                    className="linkbtn"
                    onClick={() => {
                      setParsedUploadResult(null);
                      setUploadFile(null);
                    }}
                    style={{ fontSize: '12px', color: 'var(--crit)' }}
                  >
                    Change
                  </button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                  {parsedUploadResult.plan.subjects.map(s => (
                    <span
                      key={s.id}
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: `${s.color}22`,
                        color: s.color,
                        fontWeight: 600,
                        border: `1px solid ${s.color}44`
                      }}
                    >
                      {s.name} ({s.topics.length})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {uploadError && (
              <p style={{ color: 'var(--crit)', fontSize: '12px', margin: '0 0 12px 0' }}>
                {uploadError}
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn" onClick={() => setIsUploadModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn primary"
                disabled={!parsedUploadResult || isParsingUpload}
                onClick={handleApplyParsedSyllabus}
              >
                Apply Syllabus to Study Planner
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
