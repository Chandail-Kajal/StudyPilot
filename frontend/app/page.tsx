'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  StudyPlan,
  Task,
  Subject,
  User,
  UserStats,
  Exam,
  SyllabusPreviewResponse,
  CBTTestSubmitResponse
} from '@/types';
import {
  seedPlan,
  today,
  addDays,
  weekStartOf,
  INTERVALS,
  PLAN_KEY,
  THEME_KEY,
  getYesterdayTopics
} from '@/lib/seed';
import {
  getStoredPlan,
  setStoredPlan,
  getStoredAuth,
  setStoredAuth,
  clearStoredAuth,
  api
} from '@/lib/api';
import { Icon } from '@/components/Icons';

// View Imports
import { DashboardView } from '@/components/views/DashboardView';
import { MyExamsView } from '@/components/views/MyExamsView';
import { ExamDetailsView } from '@/components/views/ExamDetailsView';
import { UploadSyllabusView } from '@/components/views/UploadSyllabusView';
import { SyllabusPreviewView } from '@/components/views/SyllabusPreviewView';
import { SubjectTopicManageView } from '@/components/views/SubjectTopicManageView';
import { TopicProgressView } from '@/components/views/TopicProgressView';
import { StudyPlannerView } from '@/components/views/StudyPlannerView';
import { SmartRevisionView } from '@/components/views/SmartRevisionView';
import { MockTestConfigView } from '@/components/views/MockTestConfigView';
import { TestTakingView } from '@/components/views/TestTakingView';
import { TestResultsView } from '@/components/views/TestResultsView';
import { TestHistoryView } from '@/components/views/TestHistoryView';
import { PerformanceAnalyticsView } from '@/components/views/PerformanceAnalyticsView';
import { FocusView } from '@/components/views/FocusView';
import { AccountView } from '@/components/views/AccountView';
import { AIAgentView } from '@/components/views/AIAgentView';
import { TodayView } from '@/components/views/TodayView';
import { PlannerView } from '@/components/views/PlannerView';
import { SubjectsView } from '@/components/views/SubjectsView';
import { InsightsView } from '@/components/views/InsightsView';

// Upgraded AI Learning, Recovery, PYP & Examination Intelligence Views
import { AILearningStudioView } from '@/components/views/AILearningStudioView';
import { SmartRecoveryPlannerView } from '@/components/views/SmartRecoveryPlannerView';
import { PreviousYearPapersView } from '@/components/views/PreviousYearPapersView';
import { ExamTrendAnalyzerView } from '@/components/views/ExamTrendAnalyzerView';
import { AIPredictedPaperView } from '@/components/views/AIPredictedPaperView';
import { FlashcardsRevisionView } from '@/components/views/FlashcardsRevisionView';
import { LoginPageView } from '@/components/views/LoginPageView';

// Dedicated Timetable, Scheduled AI Classes & Topic Practice Modules
import { TimetableScheduleView } from '@/components/views/TimetableScheduleView';
import { AIClassesScheduleView } from '@/components/views/AIClassesScheduleView';
import { PracticeView } from '@/components/views/PracticeView';

import {
  AuthModal,
  TaskModal,
  TouchMoveModal,
  SubjectModal,
  SettingsModal
} from '@/components/Modals';

interface ToastItem {
  id: string;
  msg: string;
}

export type ActiveView =
  | 'dashboard'
  | 'exams'
  | 'exam_details'
  | 'upload_syllabus'
  | 'import_preview'
  | 'manage_syllabus'
  | 'topic_progress'
  | 'planner'
  | 'timetable'
  | 'ai_classes'
  | 'practice'
  | 'smart_revision'
  | 'mock_config'
  | 'test_taking'
  | 'test_results'
  | 'test_history'
  | 'analytics'
  | 'focus'
  | 'account'
  | 'ai'
  | 'today'
  | 'subjects'
  | 'insights'
  | 'ai_learning_studio'
  | 'smart_recovery'
  | 'pyp_library'
  | 'exam_trends'
  | 'predicted_papers'
  | 'flashcards';

export default function StudyPilotApp() {
  // Navigation State
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [weekStart, setWeekStart] = useState<string>(weekStartOf(today()));
  const [subjectFilter, setSubjectFilter] = useState<string>('all');

  // Study Plan Data (Local & Sync)
  const [plan, setPlan] = useState<StudyPlan>(seedPlan);

  // Relational Database State
  const [allExams, setAllExams] = useState<Exam[]>([]);
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [previewState, setPreviewState] = useState<{
    data: SyllabusPreviewResponse;
    examId: string;
    fileName: string;
    fileFormat: string;
  } | null>(null);
  const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<CBTTestSubmitResponse | null>(null);

  // Authentication & Cloud Sync
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'local' | 'error'>('local');
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);

  // Timer state
  const [timerMode, setTimerMode] = useState<'focus' | 'short' | 'long'>('focus');
  const [timerTotal, setTimerTotal] = useState<number>(25 * 60);
  const [timerRemaining, setTimerRemaining] = useState<number>(25 * 60);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [timerCycles, setTimerCycles] = useState<number>(0);
  const [timerTaskId, setTimerTaskId] = useState<string>('');
  const [timerSubjectId, setTimerSubjectId] = useState<string>('');
  const timerEndAtRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Modals
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [resetTokenPrefill, setResetTokenPrefill] = useState<string>('');
  const [resetEmailPrefill, setResetEmailPrefill] = useState<string>('');
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskModalDefaultDate, setTaskModalDefaultDate] = useState<string>(today());
  const [touchMoveModalOpen, setTouchMoveModalOpen] = useState(false);
  const [touchMoveTask, setTouchMoveTask] = useState<Task | null>(null);
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Theme & Toast
  const [isDark, setIsDark] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [selectedTopicForTest, setSelectedTopicForTest] = useState<string | null>(null);
  const [activeStudioTopicId, setActiveStudioTopicId] = useState<string | null>(null);
  const [activePracticeTopicId, setActivePracticeTopicId] = useState<string | null>(null);

  const handleOpenTopicStudio = (topicId: string) => {
    setActiveStudioTopicId(topicId);
    navigateTo('ai_learning_studio');
  };

  const handleOpenPractice = (topicId: string) => {
    setActivePracticeTopicId(topicId);
    navigateTo('practice');
  };

  // Toast Helper
  const showToast = (msg: string) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts(prev => [...prev, { id, msg }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 2800);
  };

  // Sound chime
  const playChime = () => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      [660, 880].forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = f;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.22);
        gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + i * 0.22 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.22 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.22);
        osc.stop(ctx.currentTime + i * 0.22 + 0.45);
      });
    } catch (e) {}
  };

  // Navigation Switcher (strictly guards private user dashboard and learning data)
  const navigateTo = (view: string) => {
    if (!token && !['login', 'register', 'forgot'].includes(view)) {
      setAuthInitialMode('login');
      setAuthModalOpen(true);
      showToast('Please sign in to access your personal dashboard and study records.');
      return;
    }
    setActiveView(view as ActiveView);
    try {
      window.history.replaceState(null, '', '#' + view);
    } catch (e) {}
    window.scrollTo(0, 0);
  };

  // Fetch Exams for Current User
  const fetchExams = async (userToken?: string) => {
    const t = userToken || token;
    if (!t) return;
    try {
      const res = await api.getExams(t);
      const list: Exam[] = res.exams || [];
      setAllExams(list);
      if (list.length > 0) {
        setActiveExam(prev => {
          if (prev) {
            const match = list.find(e => e.id === prev.id);
            if (match) return match;
          }
          const active = list.find(e => e.status === 'active');
          return active || list[0];
        });
      } else {
        setActiveExam(null);
      }
    } catch (e) {
      console.error('Failed to fetch exams:', e);
    }
  };

  const handleSelectExam = (exam: Exam) => {
    setActiveExam(exam);
    fetchExams();
  };

  // Switch / Quick Login to Demo Accounts
  const handleQuickLogin = async (email: string) => {
    try {
      const res = await api.login({ email, password: 'Password123!' });
      setToken(res.token);
      setUser(res.user);
      setStoredAuth(res.token, res.user);
      setSyncStatus('synced');
      showToast(`Switched account to ${res.user.name}`);
      await fetchExams(res.token);
      navigateTo('dashboard');
    } catch (e: any) {
      showToast(e.message || 'Demo login failed');
    }
  };

  // Local storage plan persistence
  const persistPlan = (newPlan: StudyPlan) => {
    setPlan(newPlan);
    setStoredPlan(newPlan);

    if (token) {
      setSyncStatus('syncing');
      api.saveSyncPlan(token, newPlan)
        .then(res => {
          setSyncStatus('synced');
          setLastSyncedTime(res.updated_at);
        })
        .catch(() => {
          setSyncStatus('error');
        });
    }
  };

  // Initialize on mount
  useEffect(() => {
    // Theme load
    try {
      const savedTheme = localStorage.getItem(THEME_KEY);
      if (savedTheme === 'dark' || (!savedTheme && typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        setIsDark(true);
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        setIsDark(false);
        document.documentElement.setAttribute('data-theme', 'light');
      }
    } catch (e) {}

    // Detect Password Reset Token in URL (e.g. from reset email link)
    const checkResetUrl = () => {
      try {
        const fullHash = window.location.hash || '';
        const fullSearch = window.location.search || '';
        let rToken = '';
        let rEmail = '';

        if (fullHash.includes('reset-password') || fullHash.includes('token=')) {
          const qIdx = fullHash.indexOf('?');
          if (qIdx !== -1) {
            const params = new URLSearchParams(fullHash.substring(qIdx + 1));
            rToken = params.get('token') || '';
            rEmail = params.get('email') || '';
          }
        }
        if (!rToken && fullSearch) {
          const params = new URLSearchParams(fullSearch);
          rToken = params.get('token') || params.get('reset_token') || '';
          rEmail = params.get('email') || '';
        }

        if (rToken) {
          setResetTokenPrefill(rToken);
          if (rEmail) setResetEmailPrefill(rEmail);
          setAuthInitialMode('forgot');
          setAuthModalOpen(true);
        }
      } catch (e) {}
    };
    checkResetUrl();

    // Hash route load
    const hash = window.location.hash.split('?')[0].slice(1);
    const validViews = [
      'dashboard', 'exams', 'exam_details', 'upload_syllabus', 'import_preview',
      'manage_syllabus', 'topic_progress', 'planner', 'smart_revision',
      'mock_config', 'test_taking', 'test_results', 'test_history', 'analytics',
      'focus', 'account', 'ai', 'today', 'subjects', 'insights',
      'ai_learning_studio', 'smart_recovery', 'pyp_library', 'exam_trends', 'predicted_papers', 'flashcards'
    ];
    if (validViews.includes(hash)) {
      setActiveView(hash as ActiveView);
    }

    const onHashChange = () => {
      checkResetUrl();
      const h = window.location.hash.split('?')[0].slice(1);
      if (validViews.includes(h)) {
        setActiveView(h as ActiveView);
      }
    };
    window.addEventListener('hashchange', onHashChange);

    // Load stored plan or seed
    const localPlan = getStoredPlan() || seedPlan();
    setPlan(localPlan);
    setTimerTotal(localPlan.settings.focus * 60);
    setTimerRemaining(localPlan.settings.focus * 60);

    // Authentication session verification:
    // Only load user dashboard and exams if a valid session token exists.
    // Unauthenticated visitors do NOT auto-login, ensuring strict user privacy.
    const storedAuth = getStoredAuth();
    if (storedAuth && storedAuth.token) {
      setToken(storedAuth.token);
      setUser(storedAuth.user);
      fetchExams(storedAuth.token);
      api.getMe(storedAuth.token)
        .then(res => {
          setUser(res.user);
          setUserStats(res.stats);
          return api.getSyncPlan(storedAuth.token);
        })
        .then(syncRes => {
          if (syncRes && syncRes.plan) {
            setPlan(syncRes.plan);
            setStoredPlan(syncRes.plan);
            setLastSyncedTime(syncRes.updated_at);
            setSyncStatus('synced');
          }
        })
        .catch(() => {
          // Token expired or invalid
          clearStoredAuth();
          setToken(null);
          setUser(null);
          setSyncStatus('local');
        });
    } else {
      setToken(null);
      setUser(null);
      setAllExams([]);
      setActiveExam(null);
    }

    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Update timer durations if plan settings change
  useEffect(() => {
    if (!timerRunning) {
      const secs = (plan.settings[timerMode] || 25) * 60;
      setTimerTotal(secs);
      setTimerRemaining(secs);
    }
  }, [plan.settings, timerMode, timerRunning]);

  // Timer Tick Interval
  useEffect(() => {
    let interval: any = null;
    if (timerRunning) {
      interval = setInterval(() => {
        const rem = Math.max(0, Math.ceil((timerEndAtRef.current - Date.now()) / 1000));
        setTimerRemaining(rem);

        if (rem <= 0) {
          clearInterval(interval);
          setTimerRunning(false);

          playChime();
          if (timerMode === 'focus') {
            const focusMins = plan.settings.focus;
            logCompletedSession(focusMins);
            const nextCycles = timerCycles + 1;
            setTimerCycles(nextCycles);
            const nextMode = nextCycles % 4 === 0 ? 'long' : 'short';
            setTimerMode(nextMode);
            const nextSecs = plan.settings[nextMode] * 60;
            setTimerTotal(nextSecs);
            setTimerRemaining(nextSecs);
            showToast(`Focus session completed! Logged ${focusMins} mins.`);
          } else {
            setTimerMode('focus');
            const focusSecs = plan.settings.focus * 60;
            setTimerTotal(focusSecs);
            setTimerRemaining(focusSecs);
            showToast('Break finished! Ready for next focus session.');
          }
        }
      }, 250);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerRunning, timerMode, timerCycles, plan.settings]);

  // Theme Toggle
  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    const themeStr = next ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', themeStr);
    try {
      localStorage.setItem(THEME_KEY, themeStr);
    } catch (e) {}
  };

  // Timer Controls
  const toggleTimer = () => {
    if (timerRunning) {
      const rem = Math.max(0, Math.ceil((timerEndAtRef.current - Date.now()) / 1000));
      setTimerRemaining(rem);
      setTimerRunning(false);
    } else {
      timerEndAtRef.current = Date.now() + timerRemaining * 1000;
      setTimerRunning(true);
      try {
        if (!audioCtxRef.current) {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          audioCtxRef.current = new AudioCtx();
        }
      } catch (e) {}
    }
  };

  const resetTimer = () => {
    setTimerRunning(false);
    const secs = plan.settings[timerMode] * 60;
    setTimerTotal(secs);
    setTimerRemaining(secs);
  };

  const logCompletedSession = (mins: number) => {
    if (mins < 1) return;
    const sid = timerTaskId
      ? (plan.tasks.find(t => t.id === timerTaskId)?.subjectId || timerSubjectId)
      : timerSubjectId;

    const newSession = {
      id: Math.random().toString(36).slice(2, 9),
      date: today(),
      mins,
      subjectId: sid,
      at: Date.now()
    };

    const newPlan = {
      ...plan,
      sessions: [...plan.sessions, newSession]
    };
    persistPlan(newPlan);
  };

  const handleLogTimerManual = () => {
    const elapsed = timerTotal - timerRemaining;
    const mins = Math.floor(elapsed / 60);
    setTimerRunning(false);
    logCompletedSession(mins);
    setTimerMode('focus');
    const secs = plan.settings.focus * 60;
    setTimerTotal(secs);
    setTimerRemaining(secs);
    showToast(`Logged ${mins} min session.`);
  };

  const handleSkipTimerDemo = () => {
    if (!timerRunning) {
      timerEndAtRef.current = Date.now() + 1500;
      setTimerRunning(true);
    } else {
      timerEndAtRef.current = Date.now() + 1200;
    }
  };

  // Task Handlers (Legacy plan)
  const handleToggleTask = (taskId: string) => {
    const newTasks = plan.tasks.map(t =>
      t.id === taskId ? { ...t, done: !t.done } : t
    );
    const toggled = newTasks.find(t => t.id === taskId);
    persistPlan({ ...plan, tasks: newTasks });
    if (toggled?.done) {
      showToast('Task marked complete. Great job!');
    }
  };

  const handleSaveTask = (taskData: Omit<Task, 'id' | 'done'>, taskId?: string) => {
    if (taskId) {
      const newTasks = plan.tasks.map(t =>
        t.id === taskId ? { ...t, ...taskData } : t
      );
      persistPlan({ ...plan, tasks: newTasks });
      showToast('Task updated');
    } else {
      const newTask: Task = {
        id: Math.random().toString(36).slice(2, 9),
        done: false,
        ...taskData
      };
      persistPlan({ ...plan, tasks: [...plan.tasks, newTask] });
      showToast('Task added');
    }
  };

  const handleDeleteTask = (taskId: string) => {
    const newTasks = plan.tasks.filter(t => t.id !== taskId);
    if (timerTaskId === taskId) setTimerTaskId('');
    persistPlan({ ...plan, tasks: newTasks });
    showToast('Task deleted');
  };

  const handleQuickAdd = (title: string, subjectId: string) => {
    const newTask: Task = {
      id: Math.random().toString(36).slice(2, 9),
      title,
      subjectId,
      date: today(),
      mins: 30,
      prio: 'med',
      done: false
    };
    persistPlan({ ...plan, tasks: [...plan.tasks, newTask] });
    showToast('Task added for today');
  };

  const handleMoveTask = (taskId: string, newDate: string) => {
    const newTasks = plan.tasks.map(t =>
      t.id === taskId ? { ...t, date: newDate } : t
    );
    persistPlan({ ...plan, tasks: newTasks });
    showToast(`Task rescheduled to ${newDate}`);
  };

  const handleReviewTopic = (subjectId: string, topicId: string) => {
    const newSubjects = plan.subjects.map(s => {
      if (s.id !== subjectId) return s;
      const newTopics = s.topics.map(tp => {
        if (tp.id !== topicId) return tp;
        const nextStage = Math.min(5, tp.stage + 1);
        const intervalDays = INTERVALS[Math.min(nextStage, 5) - 1];
        return {
          ...tp,
          stage: nextStage,
          next: addDays(today(), intervalDays)
        };
      });
      return { ...s, topics: newTopics };
    });

    persistPlan({ ...plan, subjects: newSubjects });
    showToast('Topic reviewed and moved up the spaced revision ladder!');
  };

  const handleAddSubject = (name: string, color: string) => {
    const newSubject: Subject = {
      id: Math.random().toString(36).slice(2, 9),
      name,
      color,
      topics: []
    };
    persistPlan({ ...plan, subjects: [...plan.subjects, newSubject] });
    showToast(`${name} added to subjects`);
  };

  const handleDeleteSubject = (subjectId: string) => {
    const newSubjects = plan.subjects.filter(s => s.id !== subjectId);
    persistPlan({ ...plan, subjects: newSubjects });
    showToast('Subject removed');
  };

  const handleAddTopic = (subjectId: string, name: string) => {
    const newSubjects = plan.subjects.map(s => {
      if (s.id !== subjectId) return s;
      const newTopic = {
        id: Math.random().toString(36).slice(2, 9),
        name,
        stage: 0,
        next: today()
      };
      return { ...s, topics: [...s.topics, newTopic] };
    });
    persistPlan({ ...plan, subjects: newSubjects });
    showToast(`${name} added to topic list`);
  };

  const handleDeleteTopic = (subjectId: string, topicId: string) => {
    const newSubjects = plan.subjects.map(s => {
      if (s.id !== subjectId) return s;
      return { ...s, topics: s.topics.filter(t => t.id !== topicId) };
    });
    persistPlan({ ...plan, subjects: newSubjects });
    showToast('Topic deleted');
  };

  const handleApplyAITasks = (newTasks: Task[], sittingCapacity?: number) => {
    const updated = [...plan.tasks, ...newTasks];
    persistPlan({
      ...plan,
      tasks: updated,
      ...(sittingCapacity ? { sittingCapacityMins: sittingCapacity } : {})
    });
    showToast(`Applied ${newTasks.length} scheduled tasks to your study planner`);
  };

  const handleUpdateTopicStageFromTest = (topicName: string, passed: boolean) => {
    let found = false;
    const updatedSubjects = plan.subjects.map(subj => {
      const topicIndex = subj.topics.findIndex(t => t.name.toLowerCase().includes(topicName.toLowerCase()) || topicName.toLowerCase().includes(t.name.toLowerCase()));
      if (topicIndex !== -1) {
        found = true;
        const topic = subj.topics[topicIndex];
        const newStage = passed ? Math.min(5, topic.stage + 1) : Math.max(0, topic.stage - 1);
        const intervalDays = INTERVALS[Math.min(newStage, 5) - 1] || 1;
        const newNext = addDays(today(), intervalDays);

        const updatedTopics = [...subj.topics];
        updatedTopics[topicIndex] = { ...topic, stage: newStage, next: newNext };
        return { ...subj, topics: updatedTopics };
      }
      return subj;
    });

    const updatedTasks = [...plan.tasks];
    if (!passed) {
      const tomorrow = addDays(today(), 1);
      const subj = plan.subjects.find(s => s.topics.some(t => t.name.toLowerCase().includes(topicName.toLowerCase())));
      updatedTasks.unshift({
        id: Math.random().toString(36).slice(2, 9),
        title: `Reinforcement drill: ${topicName}`,
        subjectId: subj ? subj.id : (plan.subjects[0]?.id || 'phy'),
        date: tomorrow,
        mins: plan.sittingCapacityMins || 30,
        prio: 'high',
        done: false
      });
    }

    persistPlan({
      ...plan,
      subjects: updatedSubjects,
      tasks: updatedTasks
    });
  };

  const handleSaveSettings = (exam: { name: string; date: string }, goalMins: number, settings: { focus: number; short: number; long: number }) => {
    const updatedPlan = {
      ...plan,
      exam,
      goalMins,
      settings
    };
    persistPlan(updatedPlan);
    showToast('Settings saved');
  };

  const handleResetData = () => {
    const freshPlan = seedPlan();
    persistPlan(freshPlan);
    setTimerRunning(false);
    setTimerCycles(0);
    setTimerTaskId('');
    if (freshPlan.subjects.length > 0) {
      setTimerSubjectId(freshPlan.subjects[0].id);
    }
    showToast('Sample prototype data restored');
  };

  // Auth Handlers
  const handleLogin = async (credentials: { email: string; password: string }) => {
    const res = await api.login(credentials);
    setToken(res.token);
    setUser(res.user);
    setStoredAuth(res.token, res.user);
    if (res.plan) {
      setPlan(res.plan);
      setStoredPlan(res.plan);
    }
    setSyncStatus('synced');
    showToast(res.message || `Welcome back, ${res.user.name}!`);
    await fetchExams(res.token);
    navigateTo('dashboard');
  };

  const handleRegister = async (data: any) => {
    const res = await api.register(data);
    setToken(res.token);
    setUser(res.user);
    setStoredAuth(res.token, res.user);
    if (res.plan) {
      setPlan(res.plan);
      setStoredPlan(res.plan);
    }
    setSyncStatus('synced');
    showToast(res.message || 'Account created successfully!');
    await fetchExams(res.token);
    navigateTo('dashboard');
  };

  const handleForgotPassword = async (email: string) => {
    const res = await api.forgotPassword(email);
    showToast(res.message || 'Password reset link sent to your registered email.');
    return res;
  };

  const handleResetPassword = async (tokenStr: string, newPassword: string) => {
    await api.resetPassword(tokenStr, newPassword);
    showToast('Password reset successfully. You can now sign in with your new password.');
    setResetTokenPrefill('');
    setResetEmailPrefill('');
    if (typeof window !== 'undefined') {
      try {
        window.history.replaceState(null, '', window.location.pathname);
      } catch (e) {}
    }
  };

  const handleSignOut = () => {
    if (token) {
      api.logout(token).catch(() => {});
    }
    clearStoredAuth();
    setToken(null);
    setUser(null);
    setUserStats(null);
    setAllExams([]);
    setActiveExam(null);
    setPlan(seedPlan());
    setSyncStatus('local');
    setActiveView('dashboard');
    showToast('Signed out successfully');
  };

  const handleSyncNow = async () => {
    if (!token) return;
    setSyncStatus('syncing');
    try {
      const res = await api.saveSyncPlan(token, plan);
      setLastSyncedTime(res.updated_at);
      setSyncStatus('synced');
      showToast('All changes successfully synced to the cloud!');
    } catch (err: any) {
      setSyncStatus('error');
      showToast(err.message || 'Sync failed. Please check connection.');
    }
  };

  const handleImportPrototype = async () => {
    if (!token) return;
    try {
      const res = await api.importPrototypePlan(token, plan);
      if (res.plan) {
        setPlan(res.plan);
        setStoredPlan(res.plan);
      }
      setSyncStatus('synced');
      setLastSyncedTime(res.updated_at);
      showToast(res.message || 'Prototype data imported successfully!');
    } catch (err: any) {
      showToast(err.message || 'Import failed.');
    }
  };

  const handleExportData = () => {
    const exportObject = {
      application: 'StudyPilot',
      export_date: new Date().toISOString(),
      student: user
        ? { name: user.name, email: user.email, exam: user.exam_name }
        : { status: 'Guest Student' },
      study_plan: plan
    };

    const blob = new Blob([JSON.stringify(exportObject, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `studypilot-plan-${today()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Study plan JSON downloaded');
  };

  const handleExportCSV = () => {
    const rows = [['Session ID', 'Date', 'Subject', 'Minutes', 'Timestamp']];
    plan.sessions.forEach(s => {
      const subj = plan.subjects.find(sub => sub.id === s.subjectId);
      rows.push([
        s.id,
        s.date,
        subj ? subj.name : 'General',
        String(s.mins),
        new Date(s.at).toISOString()
      ]);
    });

    const csvContent = rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `studypilot-study-log-${today()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Study log CSV downloaded');
  };

  const handleUpdateProfile = async (updates: Partial<User>) => {
    if (!token) return;
    const res = await api.updateProfile(token, updates);
    setUser(res.user);
    showToast('Account preferences updated');
  };

  const handleChangePassword = async (current: string, next: string) => {
    if (!token) return;
    await api.changePassword(token, {
      current_password: current,
      new_password: next
    });
    showToast('Password changed successfully');
  };

  const padNum = (n: number) => String(n).padStart(2, '0');
  const timerMMSS = `${padNum(Math.floor(timerRemaining / 60))}:${padNum(timerRemaining % 60)}`;

  const getInitials = (name?: string) => {
    if (!name) return 'SP';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  // Without login, do not show sidebar and dashboard! Show dedicated interactive Login page.
  if (!token || !user) {
    return (
      <LoginPageView
        onLogin={handleLogin}
        onRegister={handleRegister}
        onForgotPassword={handleForgotPassword}
        onResetPassword={handleResetPassword}
        prefillToken={resetTokenPrefill}
        prefillEmail={resetEmailPrefill}
        isDark={isDark}
        toggleTheme={toggleTheme}
        toasts={toasts}
      />
    );
  }

  return (
    <div className="app-container">
      {/* Navigation Sidebar */}
      <aside className="side-nav" aria-label="Main Navigation">
        {/* Brand */}
        <div className="brand" onClick={() => navigateTo('dashboard')} style={{ cursor: 'pointer' }}>
          <span className="mark" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 11.2 21 3l-4.6 18-4.2-7.1z" />
            </svg>
          </span>
          <span>StudyPilot AI</span>
        </div>

        {/* Active Exam Mini-Card */}
        {user && activeExam ? (
          <div className="p-3 mx-1 my-2 rounded-xl bg-slate-900/60 border border-slate-800 text-left">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Active Exam</span>
              <button
                onClick={() => navigateTo('exams')}
                className="text-[10px] text-muted hover:text-white transition-colors"
                title="Change Exam"
              >
                Switch
              </button>
            </div>
            <div className="text-xs font-bold text-slate-100 truncate">{activeExam.exam_name}</div>
            <div className="text-[11px] text-muted capitalize mt-0.5">{activeExam.exam_category}</div>
          </div>
        ) : user ? (
          <div className="p-2.5 mx-1 my-2 rounded-xl bg-slate-900/40 border border-dashed border-slate-800 text-center">
            <button onClick={() => navigateTo('exams')} className="text-xs text-primary font-semibold hover:underline">
              + Select / Add Exam
            </button>
          </div>
        ) : (
          <div className="p-2.5 mx-1 my-2 rounded-xl bg-slate-900/40 border border-dashed border-slate-800 text-center">
            <button
              onClick={() => {
                setAuthInitialMode('login');
                setAuthModalOpen(true);
              }}
              className="text-xs text-primary font-semibold hover:underline flex items-center justify-center gap-1.5 w-full"
            >
              <span>🔒</span>
              <span>Sign In to Access</span>
            </button>
          </div>
        )}

        {/* Navigation Categories */}
        <div className="flex-1 overflow-y-auto space-y-3 py-2">
          {/* 1. Dashboard */}
          <div>
            <button
              className="navbtn"
              aria-current={activeView === 'dashboard' ? 'page' : undefined}
              onClick={() => navigateTo('dashboard')}
            >
              <Icon name="home" size={18} />
              <span>Dashboard</span>
            </button>

            {/* 2. My Examinations */}
            <button
              className="navbtn"
              aria-current={activeView === 'exams' || activeView === 'exam_details' ? 'page' : undefined}
              onClick={() => navigateTo('exams')}
            >
              <Icon name="award" size={18} />
              <span>My Examinations</span>
              {allExams.length > 0 && (
                <span className="badge badge-outline text-[10px] ml-auto">{allExams.length}</span>
              )}
            </button>

            {/* 3. Study Planner */}
            <button
              className="navbtn"
              aria-current={activeView === 'planner' || activeView === 'smart_recovery' ? 'page' : undefined}
              onClick={() => navigateTo('planner')}
            >
              <Icon name="calendar" size={18} />
              <span>Study Planner</span>
            </button>

            {/* 4. Timetable */}
            <button
              className="navbtn"
              aria-current={activeView === 'timetable' ? 'page' : undefined}
              onClick={() => navigateTo('timetable')}
            >
              <Icon name="clock" size={18} />
              <span className="font-semibold">Timetable</span>
              <span className="badge badge-primary text-[10px] ml-auto">Daily/Weekly</span>
            </button>

            {/* 5. AI Classes */}
            <button
              className="navbtn"
              aria-current={activeView === 'ai_classes' || activeView === 'ai_learning_studio' ? 'page' : undefined}
              onClick={() => navigateTo('ai_classes')}
            >
              <Icon name="sparkles" size={18} />
              <span className="font-semibold">AI Classes</span>
              <span className="badge badge-primary text-[10px] ml-auto">Live Studio</span>
            </button>

            {/* 6. Subjects & Syllabus */}
            <button
              className="navbtn"
              aria-current={activeView === 'manage_syllabus' || activeView === 'upload_syllabus' || activeView === 'import_preview' || activeView === 'topic_progress' ? 'page' : undefined}
              onClick={() => navigateTo('manage_syllabus')}
            >
              <Icon name="layers" size={18} />
              <span>Subjects & Syllabus</span>
              {previewState && (
                <span className="badge badge-warning text-[10px] ml-auto">Pending</span>
              )}
            </button>

            {/* 7. Practice & Assessments */}
            <button
              className="navbtn"
              aria-current={activeView === 'practice' || activeView === 'flashcards' ? 'page' : undefined}
              onClick={() => navigateTo('practice')}
            >
              <Icon name="check-circle" size={18} />
              <span>Practice & Assessments</span>
            </button>

            {/* 8. Mock Tests */}
            <button
              className="navbtn"
              aria-current={activeView === 'mock_config' || activeView === 'test_taking' || activeView === 'test_results' || activeView === 'test_history' ? 'page' : undefined}
              onClick={() => navigateTo('mock_config')}
            >
              <Icon name="play" size={18} />
              <span>Mock Tests</span>
              <span className="badge badge-outline text-[10px] ml-auto">CBT</span>
            </button>

            {/* 9. Previous-Year Papers */}
            <button
              className="navbtn"
              aria-current={activeView === 'pyp_library' || activeView === 'exam_trends' || activeView === 'predicted_papers' ? 'page' : undefined}
              onClick={() => navigateTo('pyp_library')}
            >
              <Icon name="file-text" size={18} />
              <span>Previous-Year Papers</span>
            </button>

            {/* 10. Progress & Analytics */}
            <button
              className="navbtn"
              aria-current={activeView === 'analytics' ? 'page' : undefined}
              onClick={() => navigateTo('analytics')}
            >
              <Icon name="bar-chart" size={18} />
              <span>Progress & Analytics</span>
            </button>

            {/* 11. AI Study Assistant */}
            <button
              className="navbtn"
              aria-current={activeView === 'ai' ? 'page' : undefined}
              onClick={() => navigateTo('ai')}
            >
              <Icon name="sparkles" size={18} />
              <span>AI Study Assistant</span>
            </button>

            {/* 12. Profile & Settings */}
            <button
              className="navbtn"
              aria-current={activeView === 'account' ? 'page' : undefined}
              onClick={() => navigateTo('account')}
            >
              <Icon name="user" size={18} />
              <span>Profile & Settings</span>
            </button>
          </div>
        </div>

        {/* Cloud Sync Status */}
        <div className="cloud-status-badge mt-auto">
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: syncStatus === 'synced' ? 'var(--good)' : syncStatus === 'syncing' ? 'var(--amber)' : 'var(--muted)'
            }}
          />
          <span>{syncStatus === 'synced' ? 'Database Connected' : syncStatus === 'syncing' ? 'Syncing...' : 'Local'}</span>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Top Header Bar */}
        <header className="top-bar">
          <div className="mbrand">
            <span className="mark" aria-hidden="true" style={{ width: '28px', height: '28px', borderRadius: '8px' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 11.2 21 3l-4.6 18-4.2-7.1z" />
              </svg>
            </span>
            StudyPilot
          </div>

          {/* Running Live Focus Timer Chip */}
          {timerRunning && activeView !== 'focus' && (
            <button
              className="tbtn chiptimer"
              onClick={() => navigateTo('focus')}
              aria-label="Active focus session"
            >
              <Icon name="play" size={13} />
              <span>{timerMode === 'focus' ? 'Focus ' : 'Break '}{timerMMSS}</span>
            </button>
          )}

          {/* Active Exam Selector in Header */}
          {allExams.length > 0 && (
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs text-muted font-medium">Exam:</span>
              <select
                value={activeExam?.id || ''}
                onChange={(e) => {
                  const selected = allExams.find(ex => ex.id === e.target.value);
                  if (selected) setActiveExam(selected);
                }}
                className="text-xs font-semibold bg-slate-900 border border-slate-700 rounded-lg py-1 px-2.5 text-slate-200"
              >
                {allExams.map(ex => (
                  <option key={ex.id} value={ex.id}>
                    {ex.exam_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Theme switcher */}
          <button
            className="tbtn iconly"
            onClick={toggleTheme}
            aria-label="Toggle dark/light theme"
          >
            <Icon name={isDark ? 'sun' : 'moon'} size={18} />
          </button>

          {/* Settings modal trigger */}
          <button
            className="tbtn iconly"
            onClick={() => setSettingsModalOpen(true)}
            aria-label="Open settings"
          >
            <Icon name="gear" size={18} />
          </button>

          {/* Auth / My Account Button */}
          {user ? (
            <button
              className="user-pill-btn"
              onClick={() => navigateTo('account')}
              title={`Account: ${user.name} (${user.email})`}
            >
              <div className="user-avatar-circle">
                {getInitials(user.name)}
              </div>
              <span style={{ maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.name.split(' ')[0]}
              </span>
            </button>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setAuthInitialMode('login');
                setAuthModalOpen(true);
              }}
            >
              <Icon name="user" size={14} /> Sign In
            </button>
          )}
        </header>

        {/* Dynamic Views: Authenticated User Workspace */}
        {activeView === 'dashboard' && (
              <DashboardView
                user={user}
                token={token}
                activeExam={activeExam}
                allExams={allExams}
                onSelectExam={handleSelectExam}
                onNavigate={navigateTo}
                showToast={showToast}
                onQuickLogin={handleQuickLogin}
                onOpenTopicInStudio={handleOpenTopicStudio}
                onPreviewExtracted={(data, examId, fileName, fileFormat) => {
                  setPreviewState({ data, examId, fileName, fileFormat });
                  navigateTo('import_preview');
                }}
              />
            )}

        {activeView === 'exams' && (
          <MyExamsView
            token={token}
            activeExam={activeExam}
            onSelectExam={handleSelectExam}
            onNavigate={navigateTo}
            showToast={showToast}
            onPreviewExtracted={(data, examId, fileName, fileFormat) => {
              setPreviewState({ data, examId, fileName, fileFormat });
              navigateTo('import_preview');
            }}
          />
        )}

        {activeView === 'exam_details' && (
          <ExamDetailsView
            token={token}
            exam={activeExam}
            onNavigate={navigateTo}
            showToast={showToast}
          />
        )}

        {activeView === 'upload_syllabus' && (
          <UploadSyllabusView
            token={token}
            activeExam={activeExam}
            allExams={allExams}
            onSelectExam={handleSelectExam}
            onPreviewExtracted={(data, examId, fileName, fileFormat) => {
              setPreviewState({ data, examId, fileName, fileFormat });
              navigateTo('import_preview');
            }}
            onNavigate={navigateTo}
            showToast={showToast}
          />
        )}

        {activeView === 'import_preview' && (
          <SyllabusPreviewView
            token={token}
            previewData={previewState?.data || null}
            examId={previewState?.examId || activeExam?.id || ''}
            fileName={previewState?.fileName || 'syllabus'}
            fileFormat={previewState?.fileFormat || 'csv'}
            onImportConfirmed={(newPlan?: any) => {
              setPreviewState(null);
              fetchExams();
              if (newPlan) {
                setPlan(newPlan);
                setStoredPlan(newPlan);
              } else if (token) {
                api.getSyncPlan(token).then(syncRes => {
                  if (syncRes && syncRes.plan) {
                    setPlan(syncRes.plan);
                    setStoredPlan(syncRes.plan);
                  }
                }).catch(() => {});
              }
              navigateTo('planner');
            }}
            onNavigate={navigateTo}
            showToast={showToast}
          />
        )}

        {activeView === 'manage_syllabus' && (
          <SubjectTopicManageView
            token={token}
            activeExam={activeExam}
            onNavigate={navigateTo}
            showToast={showToast}
            onOpenTopicStudio={handleOpenTopicStudio}
          />
        )}

        {activeView === 'topic_progress' && (
          <TopicProgressView
            token={token}
            activeExam={activeExam}
            onNavigate={navigateTo}
            showToast={showToast}
            onOpenTopicStudio={handleOpenTopicStudio}
          />
        )}

        {activeView === 'ai_learning_studio' && (
          <AILearningStudioView
            token={token}
            activeExam={activeExam}
            topicId={activeStudioTopicId}
            onNavigate={navigateTo}
            showToast={showToast}
            onOpenPracticeForTopic={(topicId) => {
              setActiveStudioTopicId(topicId);
            }}
          />
        )}

        {activeView === 'flashcards' && (
          <FlashcardsRevisionView
            token={token}
            activeExam={activeExam}
            onNavigate={navigateTo}
            showToast={showToast}
            onOpenTopicInStudio={handleOpenTopicStudio}
          />
        )}

        {activeView === 'planner' && (
          <StudyPlannerView
            token={token}
            activeExam={activeExam}
            onNavigate={navigateTo}
            showToast={showToast}
            onStartFocusSession={(mins, subjectName) => {
              setTimerMode('focus');
              setTimerTotal(mins * 60);
              setTimerRemaining(mins * 60);
              navigateTo('focus');
            }}
            onOpenTopicStudio={handleOpenTopicStudio}
          />
        )}

        {activeView === 'timetable' && (
          <TimetableScheduleView
            token={token}
            activeExam={activeExam}
            onNavigate={navigateTo}
            showToast={showToast}
            onOpenTopicStudio={handleOpenTopicStudio}
            onLaunchPractice={handleOpenPractice}
            onLaunchTest={(testId) => {
              if (testId) setActiveTestId(testId);
              navigateTo('mock_config');
            }}
          />
        )}

        {activeView === 'ai_classes' && (
          <AIClassesScheduleView
            token={token}
            activeExam={activeExam}
            onNavigate={navigateTo}
            showToast={showToast}
            onOpenClassInStudio={handleOpenTopicStudio}
          />
        )}

        {activeView === 'practice' && (
          <PracticeView
            token={token}
            activeExam={activeExam}
            initialTopicId={activePracticeTopicId}
            onNavigate={navigateTo}
            showToast={showToast}
            onOpenTopicInStudio={handleOpenTopicStudio}
          />
        )}

        {activeView === 'smart_recovery' && (
          <SmartRecoveryPlannerView
            token={token}
            activeExam={activeExam}
            onNavigate={navigateTo}
            showToast={showToast}
          />
        )}

        {activeView === 'pyp_library' && (
          <PreviousYearPapersView
            token={token}
            activeExam={activeExam}
            onNavigate={navigateTo}
            showToast={showToast}
            onLaunchPaperTest={(paper, mode) => {
              showToast(`Launching ${paper.title} (${mode} mode)`);
            }}
          />
        )}

        {activeView === 'exam_trends' && (
          <ExamTrendAnalyzerView
            token={token}
            activeExam={activeExam}
            onNavigate={navigateTo}
            showToast={showToast}
            onOpenTopicInStudio={handleOpenTopicStudio}
          />
        )}

        {activeView === 'predicted_papers' && (
          <AIPredictedPaperView
            token={token}
            activeExam={activeExam}
            onNavigate={navigateTo}
            showToast={showToast}
          />
        )}

        {activeView === 'smart_revision' && (
          <SmartRevisionView
            token={token}
            activeExam={activeExam}
            onNavigate={navigateTo}
            showToast={showToast}
          />
        )}

        {activeView === 'mock_config' && (
          <MockTestConfigView
            token={token}
            activeExam={activeExam}
            onLaunchTest={(testId) => {
              setActiveTestId(testId);
              navigateTo('test_taking');
            }}
            onNavigate={navigateTo}
            showToast={showToast}
          />
        )}

        {activeView === 'test_taking' && (
          <TestTakingView
            token={token}
            testId={activeTestId || ''}
            onFinishTest={(result) => {
              setTestResult(result);
              navigateTo('test_results');
            }}
            onExit={() => navigateTo('mock_config')}
            showToast={showToast}
          />
        )}

        {activeView === 'test_results' && (
          <TestResultsView
            result={testResult}
            activeExam={activeExam}
            onNavigate={navigateTo}
            onRetakeTest={() => navigateTo('mock_config')}
          />
        )}

        {activeView === 'test_history' && (
          <TestHistoryView
            token={token}
            activeExam={activeExam}
            onNavigate={navigateTo}
            showToast={showToast}
            onSelectAttemptReview={(result) => {
              setTestResult(result);
              navigateTo('test_results');
            }}
          />
        )}

        {activeView === 'analytics' && (
          <PerformanceAnalyticsView
            token={token}
            activeExam={activeExam}
            onNavigate={navigateTo}
            showToast={showToast}
          />
        )}

        {activeView === 'focus' && (
          <FocusView
            plan={plan}
            timerMode={timerMode}
            timerRemaining={timerRemaining}
            timerTotal={timerTotal}
            timerRunning={timerRunning}
            timerCycles={timerCycles}
            timerTaskId={timerTaskId}
            timerSubjectId={timerSubjectId}
            onSetMode={(mode) => {
              if (!timerRunning) {
                setTimerMode(mode);
                const secs = plan.settings[mode] * 60;
                setTimerTotal(secs);
                setTimerRemaining(secs);
              }
            }}
            onToggleTimer={toggleTimer}
            onResetTimer={resetTimer}
            onLogTimer={handleLogTimerManual}
            onSkipTimerDemo={handleSkipTimerDemo}
            onSelectTask={(taskId) => {
              setTimerTaskId(taskId);
              const task = plan.tasks.find(t => t.id === taskId);
              if (task && task.subjectId) {
                setTimerSubjectId(task.subjectId);
              }
            }}
            onSelectSubject={setTimerSubjectId}
          />
        )}

        {activeView === 'account' && (
          <AccountView
            user={user}
            stats={userStats}
            plan={plan}
            isAuthenticated={Boolean(user)}
            syncStatus={syncStatus}
            lastSyncedTime={lastSyncedTime}
            onSyncNow={handleSyncNow}
            onImportPrototype={handleImportPrototype}
            onExportData={handleExportData}
            onExportCSV={handleExportCSV}
            onUpdateProfile={handleUpdateProfile}
            onChangePassword={handleChangePassword}
            onSignOut={handleSignOut}
            onOpenAuth={() => {
              setAuthInitialMode('login');
              setAuthModalOpen(true);
            }}
            onResetData={handleResetData}
          />
        )}

        {activeView === 'ai' && (
          <AIAgentView
            plan={plan}
            token={token}
            onApplyPlanTasks={handleApplyAITasks}
            onUpdateTopicStage={handleUpdateTopicStageFromTest}
            onNavigateToView={(view) => navigateTo(view as any)}
            showToast={showToast}
            initialTopicForTest={selectedTopicForTest}
          />
        )}

        {activeView === 'today' && (
          <TodayView
            plan={plan}
            isAuthenticated={Boolean(user)}
            onAddTask={(date) => {
              setEditingTask(null);
              setTaskModalDefaultDate(date);
              setTaskModalOpen(true);
            }}
            onEditTask={(task) => {
              setEditingTask(task);
              setTaskModalOpen(true);
            }}
            onToggleTask={handleToggleTask}
            onQuickAdd={handleQuickAdd}
            onStartFocusOnTask={(task) => {
              setTimerTaskId(task.id);
              setTimerSubjectId(task.subjectId);
              if (!timerRunning && timerMode !== 'focus') {
                setTimerMode('focus');
              }
              navigateTo('focus');
            }}
            onStartGeneralFocus={() => navigateTo('focus')}
            onReviewTopic={handleReviewTopic}
            onOpenSettings={() => setSettingsModalOpen(true)}
            onOpenAuth={() => {
              setAuthInitialMode('register');
              setAuthModalOpen(true);
            }}
            onOpenTouchMove={(task) => {
              setTouchMoveTask(task);
              setTouchMoveModalOpen(true);
            }}
            onNavigateToView={(view) => navigateTo(view as any)}
          />
        )}

        {activeView === 'subjects' && (
          <SubjectsView
            plan={plan}
            onNewSubject={() => setSubjectModalOpen(true)}
            onDeleteSubject={handleDeleteSubject}
            onAddTopic={handleAddTopic}
            onDeleteTopic={handleDeleteTopic}
            onReviewTopic={handleReviewTopic}
            onStartTopicTest={(topicName) => {
              setSelectedTopicForTest(topicName);
              navigateTo('ai');
            }}
          />
        )}

        {activeView === 'insights' && (
          <InsightsView plan={plan} />
        )}
      </main>

      {/* Global Modals */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authInitialMode}
        prefillToken={resetTokenPrefill}
        prefillEmail={resetEmailPrefill}
        onClose={() => setAuthModalOpen(false)}
        onLogin={handleLogin}
        onRegister={handleRegister}
        onForgotPassword={handleForgotPassword}
        onResetPassword={handleResetPassword}
        hasLocalPlan={plan.tasks.length > 0}
      />

      <TaskModal
        isOpen={taskModalOpen}
        task={editingTask}
        defaultDate={taskModalDefaultDate}
        subjects={plan.subjects}
        defaultSubjectId={subjectFilter !== 'all' ? subjectFilter : undefined}
        onClose={() => setTaskModalOpen(false)}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
      />

      <TouchMoveModal
        isOpen={touchMoveModalOpen}
        task={touchMoveTask}
        weekStart={weekStart}
        onClose={() => setTouchMoveModalOpen(false)}
        onMove={handleMoveTask}
      />

      <SubjectModal
        isOpen={subjectModalOpen}
        onClose={() => setSubjectModalOpen(false)}
        onSave={handleAddSubject}
      />

      <SettingsModal
        isOpen={settingsModalOpen}
        exam={plan.exam}
        goalMins={plan.goalMins}
        settings={plan.settings}
        onClose={() => setSettingsModalOpen(false)}
        onSave={handleSaveSettings}
        onResetData={handleResetData}
      />

      {/* Toast Notification Container */}
      <div id="toasts" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className="toast">
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
