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
import { CommandPalette } from '@/components/CommandPalette';

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

  // Theme, Accent, Shell & Toast
  const [isDark, setIsDark] = useState(false);
  const [accentTheme, setAccentTheme] = useState<string>('indigo');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);
  const [cmdOpen, setCmdOpen] = useState<boolean>(false);
  const [accentPopoverOpen, setAccentPopoverOpen] = useState<boolean>(false);
  const accentPopoverRef = useRef<HTMLDivElement>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [selectedTopicForTest, setSelectedTopicForTest] = useState<string | null>(null);
  const [activeStudioTopicId, setActiveStudioTopicId] = useState<string | null>(null);
  const [activePracticeTopicId, setActivePracticeTopicId] = useState<string | null>(null);

  // Restore saved Accent Theme & Sidebar preference
  useEffect(() => {
    try {
      const savedAccent = localStorage.getItem('studypilot_accent') || 'indigo';
      setAccentTheme(savedAccent);
      document.documentElement.setAttribute('data-accent', savedAccent);
      const savedCollapsed = localStorage.getItem('studypilot_sidebar_collapsed') === '1';
      setSidebarCollapsed(savedCollapsed);
    } catch {}
  }, []);

  const handleChangeAccent = (accent: string) => {
    setAccentTheme(accent);
    document.documentElement.setAttribute('data-accent', accent);
    try {
      localStorage.setItem('studypilot_accent', accent);
    } catch {}
    setAccentPopoverOpen(false);
  };

  const handleToggleSidebarCollapse = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('studypilot_sidebar_collapsed', next ? '1' : '0');
      } catch {}
      return next;
    });
  };

  // Global Keyboard Shortcuts (Ctrl+K / Cmd+K for Command Palette) & Popover Click-Outside
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
    };
    const onClickOutside = (e: MouseEvent) => {
      if (accentPopoverRef.current && !accentPopoverRef.current.contains(e.target as Node)) {
        setAccentPopoverOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, []);

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
    const normalizedView = view === 'mock_tests' ? 'mock_config' : view;
    setActiveView(normalizedView as ActiveView);
    setMobileNavOpen(false);
    try {
      window.history.replaceState(null, '', '#' + normalizedView);
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

  const VIEW_LABELS: Record<string, string> = {
    dashboard: 'Dashboard',
    exams: 'My Examinations',
    exam_details: 'Examination Details',
    upload_syllabus: 'Upload Syllabus',
    import_preview: 'Syllabus Preview',
    manage_syllabus: 'Subjects & Syllabus',
    topic_progress: 'Topic Progress',
    planner: 'Study Planner',
    timetable: 'Timetable',
    ai_classes: 'AI Classes',
    ai_learning_studio: 'AI Learning Studio',
    practice: 'Practice & Assessments',
    flashcards: 'Flashcards Revision',
    smart_revision: 'Spaced Revision',
    smart_recovery: 'Smart Recovery Planner',
    mock_config: 'CBT Mock Tests',
    test_taking: 'Active Mock Exam',
    test_results: 'Test Results',
    test_history: 'Test History',
    pyp_library: 'Previous-Year Papers',
    exam_trends: 'Exam Trend Analyzer',
    predicted_papers: 'AI Predicted Papers',
    analytics: 'Progress & Analytics',
    focus: 'Focus Timer',
    ai: 'AI Study Assistant',
    account: 'Profile & Settings',
    today: 'Today',
    subjects: 'Subjects',
    insights: 'Insights'
  };

  const ACCENT_OPTIONS = [
    { id: 'indigo', label: 'Royal Indigo', color: '#4F46E5' },
    { id: 'emerald', label: 'Forest Emerald', color: '#059669' },
    { id: 'ocean', label: 'Ocean Sky', color: '#0284C7' },
    { id: 'violet', label: 'Deep Violet', color: '#7C3AED' },
    { id: 'rose', label: 'Crimson Rose', color: '#E11D48' }
  ];

  const handleStartQuickFocus = () => {
    setTimerMode('focus');
    setTimerTotal(25 * 60);
    setTimerRemaining(25 * 60);
    navigateTo('focus');
    showToast('25-minute Focus Session ready!');
  };

  return (
    <div className={`app-container ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Mobile Sidebar Backdrop */}
      {mobileNavOpen && (
        <div
          className="mobile-drawer-backdrop"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Navigation Sidebar */}
      <aside className={`side-nav ${mobileNavOpen ? 'mobile-open' : ''}`} aria-label="Main Navigation">
        {/* Brand Header & Collapse Toggle */}
        <div className="side-header">
          <div className="brand-pro" onClick={() => navigateTo('dashboard')} title="StudyPilot AI Dashboard">
            <span className="mark" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 11.2 21 3l-4.6 18-4.2-7.1z" />
              </svg>
            </span>
            <div className="brand-text-wrap">
              <div className="brand-title">StudyPilot</div>
              <div className="brand-subtitle">AI Workspace</div>
            </div>
          </div>
          <button
            className="iconbtn desktop-collapse-btn"
            onClick={handleToggleSidebarCollapse}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Icon name="sidebar" size={16} />
          </button>
        </div>

        {/* Theme-Adaptive Active Exam Card */}
        {user && activeExam ? (
          <div className="sidebar-exam-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--accent)' }}>
                Active Goal
              </span>
              <button
                onClick={() => navigateTo('exams')}
                style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--muted)', background: 'none', border: 0, padding: 0 }}
                title="Switch Examination"
              >
                Switch &rarr;
              </button>
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeExam.exam_name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', gap: '8px' }}>
              <div style={{ flex: 1, height: '5px', borderRadius: '99px', background: 'var(--surface)', overflow: 'hidden', border: '1px solid var(--line)' }}>
                <div
                  style={{
                    width: `${Math.min(100, activeExam.readiness_percent || 0)}%`,
                    height: '100%',
                    borderRadius: '99px',
                    background: 'linear-gradient(90deg, var(--accent), var(--good))',
                    transition: 'width 0.4s ease'
                  }}
                />
              </div>
              <span className="mono" style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--ink)' }}>
                {activeExam.readiness_percent || 0}%
              </span>
            </div>
          </div>
        ) : user ? (
          <div className="sidebar-exam-card" style={{ textAlign: 'center', borderStyle: 'dashed' }}>
            <button onClick={() => navigateTo('exams')} style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 700, background: 'none', border: 0 }}>
              + Add Target Exam
            </button>
          </div>
        ) : null}

        {/* Grouped Navigation Categories */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px', padding: '2px 0 8px' }}>
          <div className="nav-section-title">Workspace</div>

          <button
            className="navbtn"
            aria-current={activeView === 'dashboard' ? 'page' : undefined}
            onClick={() => navigateTo('dashboard')}
            title="Dashboard"
          >
            <Icon name="home" size={18} />
            <span className="navbtn-label">Dashboard</span>
          </button>

          <button
            className="navbtn"
            aria-current={activeView === 'exams' || activeView === 'exam_details' ? 'page' : undefined}
            onClick={() => navigateTo('exams')}
            title="My Examinations"
          >
            <Icon name="award" size={18} />
            <span className="navbtn-label">My Examinations</span>
            {allExams.length > 0 && (
              <span className="badge badge-outline navbtn-badge" style={{ marginLeft: 'auto', fontSize: '10px' }}>{allExams.length}</span>
            )}
          </button>

          <button
            className="navbtn"
            aria-current={activeView === 'planner' || activeView === 'smart_recovery' ? 'page' : undefined}
            onClick={() => navigateTo('planner')}
            title="Study Planner"
          >
            <Icon name="calendar" size={18} />
            <span className="navbtn-label">Study Planner</span>
          </button>

          <button
            className="navbtn"
            aria-current={activeView === 'timetable' ? 'page' : undefined}
            onClick={() => navigateTo('timetable')}
            title="Timetable"
          >
            <Icon name="clock" size={18} />
            <span className="navbtn-label">Timetable</span>
            <span className="badge badge-primary navbtn-badge" style={{ marginLeft: 'auto', fontSize: '10px' }}>Schedule</span>
          </button>

          <div className="nav-section-title">AI Learning</div>

          <button
            className="navbtn"
            aria-current={activeView === 'ai_classes' || activeView === 'ai_learning_studio' ? 'page' : undefined}
            onClick={() => navigateTo('ai_classes')}
            title="AI Classes & Video Studio"
          >
            <Icon name="sparkles" size={18} />
            <span className="navbtn-label">AI Classes</span>
            <span className="badge badge-primary navbtn-badge" style={{ marginLeft: 'auto', fontSize: '10px' }}>Studio</span>
          </button>

          <button
            className="navbtn"
            aria-current={activeView === 'manage_syllabus' || activeView === 'upload_syllabus' || activeView === 'import_preview' || activeView === 'topic_progress' ? 'page' : undefined}
            onClick={() => navigateTo('manage_syllabus')}
            title="Subjects & Syllabus"
          >
            <Icon name="layers" size={18} />
            <span className="navbtn-label">Subjects & Syllabus</span>
            {previewState && (
              <span className="badge badge-warning navbtn-badge" style={{ marginLeft: 'auto', fontSize: '10px' }}>Pending</span>
            )}
          </button>

          <button
            className="navbtn"
            aria-current={activeView === 'practice' || activeView === 'flashcards' || activeView === 'smart_revision' ? 'page' : undefined}
            onClick={() => navigateTo('practice')}
            title="Practice & Assessments"
          >
            <Icon name="check-circle" size={18} />
            <span className="navbtn-label">Practice & Drills</span>
          </button>

          <button
            className="navbtn"
            aria-current={activeView === 'ai' ? 'page' : undefined}
            onClick={() => navigateTo('ai')}
            title="AI Study Assistant"
          >
            <Icon name="robot" size={18} />
            <span className="navbtn-label">AI Tutor Chat</span>
          </button>

          <div className="nav-section-title">Exam Mastery</div>

          <button
            className="navbtn"
            aria-current={activeView === 'mock_config' || activeView === 'test_taking' || activeView === 'test_results' || activeView === 'test_history' ? 'page' : undefined}
            onClick={() => navigateTo('mock_config')}
            title="CBT Mock Tests"
          >
            <Icon name="play" size={18} />
            <span className="navbtn-label">Mock Tests</span>
            <span className="badge badge-outline navbtn-badge" style={{ marginLeft: 'auto', fontSize: '10px' }}>CBT</span>
          </button>

          <button
            className="navbtn"
            aria-current={activeView === 'pyp_library' || activeView === 'exam_trends' || activeView === 'predicted_papers' ? 'page' : undefined}
            onClick={() => navigateTo('pyp_library')}
            title="Previous-Year Papers"
          >
            <Icon name="file-text" size={18} />
            <span className="navbtn-label">Past Papers & AI</span>
          </button>

          <button
            className="navbtn"
            aria-current={activeView === 'analytics' ? 'page' : undefined}
            onClick={() => navigateTo('analytics')}
            title="Progress & Analytics"
          >
            <Icon name="bar-chart" size={18} />
            <span className="navbtn-label">Analytics</span>
          </button>

          <div className="nav-section-title">System</div>

          <button
            className="navbtn"
            aria-current={activeView === 'account' ? 'page' : undefined}
            onClick={() => navigateTo('account')}
            title="Profile & Settings"
          >
            <Icon name="user" size={18} />
            <span className="navbtn-label">Profile & Settings</span>
          </button>
        </div>

        {/* Cloud Sync Status */}
        <div className="cloud-status-badge" style={{ marginTop: 'auto' }} title={syncStatus === 'synced' ? 'Database Connected' : syncStatus === 'syncing' ? 'Syncing...' : 'Local'}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              flexShrink: 0,
              boxShadow: syncStatus === 'synced' ? '0 0 8px var(--good)' : 'none',
              background: syncStatus === 'synced' ? 'var(--good)' : syncStatus === 'syncing' ? 'var(--amber)' : 'var(--muted)'
            }}
          />
          <span className="cloud-status-text">
            {syncStatus === 'synced' ? 'Live Sync Active' : syncStatus === 'syncing' ? 'Syncing...' : 'Local Workspace'}
          </span>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Glassmorphic Sticky Top Command Bar */}
        <header className="top-bar-pro">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <button
              className="tbtn iconly mobile-menu-btn"
              style={{ display: 'none', height: '38px', width: '38px' }}
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
            >
              <Icon name="menu" size={18} />
            </button>

            <div className="breadcrumb-pill">
              <span style={{ opacity: 0.7 }} className="hidden md:inline">StudyPilot</span>
              <span style={{ opacity: 0.4 }} className="hidden md:inline">/</span>
              <strong>{VIEW_LABELS[activeView] || 'Workspace'}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
            {/* Interactive Command Palette Trigger */}
            <button
              className="cmd-trigger"
              onClick={() => setCmdOpen(true)}
              title="Open Quick Command Palette (Ctrl + K)"
            >
              <Icon name="search" size={15} />
              <span className="cmd-trigger-label">Quick jump...</span>
              <kbd className="cmd-trigger-kbd">Ctrl K</kbd>
            </button>

            {/* Running Live Focus Timer Chip or Quick Focus Launcher */}
            {timerRunning && activeView !== 'focus' ? (
              <button
                className="tbtn chiptimer"
                style={{ height: '38px' }}
                onClick={() => navigateTo('focus')}
                aria-label="Active focus session"
              >
                <Icon name="play" size={13} />
                <span>{timerMode === 'focus' ? 'Focus ' : 'Break '}{timerMMSS}</span>
              </button>
            ) : activeView !== 'focus' ? (
              <button
                className="tbtn hidden lg:inline-flex"
                style={{ height: '38px', fontSize: '13px', padding: '0 12px' }}
                onClick={handleStartQuickFocus}
                title="Start a 25-minute deep-work Pomodoro session"
              >
                <Icon name="zap" size={15} style={{ color: 'var(--amber)' }} />
                <span>Focus</span>
              </button>
            ) : null}

            {/* Theme-Adaptive Active Exam Selector */}
            {allExams.length > 0 && (
              <select
                value={activeExam?.id || ''}
                onChange={(e) => {
                  const selected = allExams.find(ex => ex.id === e.target.value);
                  if (selected) setActiveExam(selected);
                }}
                aria-label="Switch active exam"
                className="exam-select-pro hidden sm:block"
              >
                {allExams.map(ex => (
                  <option key={ex.id} value={ex.id}>
                    {ex.exam_name}
                  </option>
                ))}
              </select>
            )}

            {/* Global Accent Palette Switcher */}
            <div ref={accentPopoverRef} style={{ position: 'relative' }}>
              <button
                className="tbtn iconly"
                style={{ height: '38px', width: '38px' }}
                onClick={() => setAccentPopoverOpen((o) => !o)}
                aria-label="Choose workspace accent color"
                title="Customize accent palette"
              >
                <Icon name="palette" size={17} style={{ color: 'var(--accent)' }} />
              </button>
              {accentPopoverOpen && (
                <div className="accent-popover">
                  <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted)', padding: '2px 8px 8px' }}>
                    Workspace Accent
                  </div>
                  {ACCENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      className={`accent-swatch-btn ${accentTheme === opt.id ? 'active' : ''}`}
                      onClick={() => handleChangeAccent(opt.id)}
                    >
                      <span
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          background: opt.color,
                          flexShrink: 0,
                          boxShadow: '0 0 0 2px var(--surface), 0 0 0 3px var(--line)'
                        }}
                      />
                      <span>{opt.label}</span>
                      {accentTheme === opt.id && (
                        <span style={{ marginLeft: 'auto' }}>
                          <Icon name="check" size={14} />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Dark/Light Theme Switcher */}
            <button
              className="tbtn iconly"
              style={{ height: '38px', width: '38px' }}
              onClick={toggleTheme}
              aria-label="Toggle dark/light theme"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              <Icon name={isDark ? 'sun' : 'moon'} size={17} />
            </button>

            {/* Settings Modal Trigger */}
            <button
              className="tbtn iconly hidden sm:inline-flex"
              style={{ height: '38px', width: '38px' }}
              onClick={() => setSettingsModalOpen(true)}
              aria-label="Open settings"
              title="Quick Settings"
            >
              <Icon name="gear" size={17} />
            </button>

            {/* User Profile Pill */}
            {user && (
              <button
                className="user-pill-btn"
                style={{ height: '38px', padding: '0 10px 0 7px' }}
                onClick={() => navigateTo('account')}
                title={`Account: ${user.name} (${user.email})`}
              >
                <div className="user-avatar-circle">
                  {getInitials(user.name)}
                </div>
                <span className="hidden md:inline" style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px' }}>
                  {user.name.split(' ')[0]}
                </span>
              </button>
            )}
          </div>
        </header>

        {/* Dynamic Views: Authenticated User Workspace with Smooth Entrance */}
        <div key={activeView} className="view-stage">
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
        </div>
      </main>

      {/* Interactive Command Palette (Ctrl + K) */}
      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        onNavigate={navigateTo}
        allExams={allExams}
        activeExam={activeExam}
        onSelectExam={(ex) => {
          handleSelectExam(ex);
          showToast(`Switched active exam to ${ex.exam_name}`);
        }}
        onStartQuickFocus={handleStartQuickFocus}
        isDark={isDark}
        toggleTheme={toggleTheme}
        accentTheme={accentTheme}
        onChangeAccent={(acc) => {
          handleChangeAccent(acc);
          showToast(`Workspace accent updated to ${acc}`);
        }}
      />

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
