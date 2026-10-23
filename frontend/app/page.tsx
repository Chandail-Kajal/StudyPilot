'use client';

import React, { useState, useEffect, useRef } from 'react';
import { StudyPlan, Task, Subject, User, UserStats } from '@/types';
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
import { TodayView } from '@/components/views/TodayView';
import { PlannerView } from '@/components/views/PlannerView';
import { FocusView } from '@/components/views/FocusView';
import { SubjectsView } from '@/components/views/SubjectsView';
import { InsightsView } from '@/components/views/InsightsView';
import { AccountView } from '@/components/views/AccountView';
import { AIAgentView } from '@/components/views/AIAgentView';
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

export default function StudyPilotApp() {
  // Navigation
  const [activeView, setActiveView] = useState<'today' | 'planner' | 'focus' | 'subjects' | 'insights' | 'account' | 'ai'>('today');
  const [weekStart, setWeekStart] = useState<string>(weekStartOf(today()));
  const [subjectFilter, setSubjectFilter] = useState<string>('all');

  // Study Plan Data
  const [plan, setPlan] = useState<StudyPlan>(seedPlan);

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

  // Show toast helper
  const showToast = (msg: string) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts(prev => [...prev, { id, msg }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 2800);
  };

  // Play synthetic chime when timer completes
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

  // Save plan & sync with server if logged in
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

    // Hash route load
    const hash = window.location.hash.slice(1);
    if (['today', 'planner', 'focus', 'subjects', 'insights', 'account', 'ai'].includes(hash)) {
      setActiveView(hash as any);
    }

    const onHashChange = () => {
      const h = window.location.hash.slice(1);
      if (['today', 'planner', 'focus', 'subjects', 'insights', 'account', 'ai'].includes(h)) {
        setActiveView(h as any);
      }
    };
    window.addEventListener('hashchange', onHashChange);

    // Load stored plan or seed
    const localPlan = getStoredPlan() || seedPlan();
    setPlan(localPlan);
    setTimerTotal(localPlan.settings.focus * 60);
    setTimerRemaining(localPlan.settings.focus * 60);
    if (localPlan.subjects.length > 0) {
      setTimerSubjectId(localPlan.subjects[0].id);
    }

    // Check auth session
    const storedAuth = getStoredAuth();
    if (storedAuth && storedAuth.token) {
      setToken(storedAuth.token);
      setUser(storedAuth.user);
      setSyncStatus('syncing');

      // Refresh user profile & sync plan from server
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
          setSyncStatus('local');
        });
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

          // Session complete
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

  // Switch navigation view
  const navigateTo = (view: 'today' | 'planner' | 'focus' | 'subjects' | 'insights' | 'account' | 'ai') => {
    setActiveView(view);
    try {
      window.history.replaceState(null, '', '#' + view);
    } catch (e) {}
    window.scrollTo(0, 0);
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

  // Task Handlers
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

  // Spaced Repetition Topic Review
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

  // Subject Handlers
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
    showToast(`${name} added to syllabus`);
  };

  const handleDeleteTopic = (subjectId: string, topicId: string) => {
    const newSubjects = plan.subjects.map(s => {
      if (s.id !== subjectId) return s;
      return { ...s, topics: s.topics.filter(t => t.id !== topicId) };
    });
    persistPlan({ ...plan, subjects: newSubjects });
    showToast('Topic removed');
  };

  // AI Schedule Application & Test Adjustments
  const handleApplyAITasks = (newTasks: Task[], sittingCapacity?: number) => {
    const completedTasks = plan.tasks.filter(t => t.done);
    const updatedPlan: StudyPlan = {
      ...plan,
      sittingCapacityMins: sittingCapacity || plan.sittingCapacityMins || 45,
      tasks: [...completedTasks, ...newTasks]
    };
    persistPlan(updatedPlan);
    showToast(`Applied ${newTasks.length} AI-scheduled tasks to your planner!`);
  };

  const handleUpdateTopicStageFromTest = (topicName: string, advance: boolean) => {
    const updatedSubjects = plan.subjects.map(s => {
      const updatedTopics = s.topics.map(tp => {
        if (tp.name.toLowerCase() === topicName.toLowerCase() || topicName.toLowerCase().includes(tp.name.toLowerCase())) {
          const newStage = advance ? Math.min(5, tp.stage + 1) : Math.max(1, tp.stage - 1);
          const intervalDays = INTERVALS[Math.min(newStage, 5) - 1];
          return {
            ...tp,
            stage: newStage,
            next: addDays(today(), intervalDays)
          };
        }
        return tp;
      });
      return { ...s, topics: updatedTopics };
    });

    let updatedTasks = [...plan.tasks];
    if (!advance) {
      const tomorrow = addDays(today(), 1);
      const subj = plan.subjects.find(s => s.topics.some(tp => tp.name.toLowerCase() === topicName.toLowerCase()));
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

  // Settings & Reset
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

  // Authentication Handlers
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
  };

  const handleRegister = async (data: {
    name: string;
    email: string;
    password: string;
    exam_name?: string;
    exam_date?: string;
    goal_mins?: number;
    importCurrentPlan?: boolean;
  }) => {
    const payload: any = {
      name: data.name,
      email: data.email,
      password: data.password,
      exam_name: data.exam_name,
      exam_date: data.exam_date,
      goal_mins: data.goal_mins
    };

    if (data.importCurrentPlan) {
      payload.prototype_data = plan;
    }

    const res = await api.register(payload);
    setToken(res.token);
    setUser(res.user);
    setStoredAuth(res.token, res.user);

    if (res.plan) {
      setPlan(res.plan);
      setStoredPlan(res.plan);
    }
    setSyncStatus('synced');
    showToast(res.message || 'Account created successfully!');
  };

  const handleForgotPassword = async (email: string) => {
    const res = await api.forgotPassword(email);
    showToast('Password reset code generated');
    return res.reset_token;
  };

  const handleResetPassword = async (tokenStr: string, newPassword: string) => {
    await api.resetPassword(tokenStr, newPassword);
    showToast('Password reset successfully. You can now log in.');
  };

  const handleSignOut = () => {
    if (token) {
      api.logout(token).catch(() => {});
    }
    clearStoredAuth();
    setToken(null);
    setUser(null);
    setUserStats(null);
    setSyncStatus('local');
    showToast('Signed out successfully');
  };

  // Cloud Sync Manual Trigger
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

  // Prototype Data Import (Deliverable #3)
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

  // Data Export (Deliverable #6)
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
    const rows = [
      ['Session ID', 'Date', 'Subject', 'Minutes', 'Timestamp']
    ];
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
    if (!token) {
      // Local update
      const updatedPlan = {
        ...plan,
        exam: {
          name: updates.exam_name || plan.exam.name,
          date: updates.exam_date || plan.exam.date
        },
        goalMins: updates.goal_mins || plan.goalMins,
        settings: updates.settings || plan.settings
      };
      persistPlan(updatedPlan);
      showToast('Settings saved locally');
      return;
    }

    const res = await api.updateProfile(token, updates);
    setUser(res.user);
    if (updates.exam_name || updates.exam_date || updates.goal_mins || updates.settings) {
      setPlan(prev => ({
        ...prev,
        exam: {
          name: updates.exam_name || prev.exam.name,
          date: updates.exam_date || prev.exam.date
        },
        goalMins: updates.goal_mins || prev.goalMins,
        settings: updates.settings || prev.settings
      }));
    }
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

  // Nav Counts
  const todayRemainingTasks = plan.tasks.filter(t => t.date === today() && !t.done).length;
  const todayDueTopics = plan.subjects.reduce(
    (acc, s) => acc + s.topics.filter(t => t.next <= today()).length,
    0
  );

  const padNum = (n: number) => String(n).padStart(2, '0');
  const timerMMSS = `${padNum(Math.floor(timerRemaining / 60))}:${padNum(timerRemaining % 60)}`;

  const getInitials = (name?: string) => {
    if (!name) return 'SP';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  return (
    <div className="app-container">
      {/* Left Navigation Rail (Desktop) / Bottom Nav (Mobile) */}
      <aside className="side-nav" aria-label="Main Navigation">
        <div className="brand">
          <span className="mark" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 11.2 21 3l-4.6 18-4.2-7.1z" />
            </svg>
          </span>
          StudyPilot
        </div>

        <button
          className="navbtn"
          aria-current={activeView === 'today' ? 'page' : undefined}
          onClick={() => navigateTo('today')}
        >
          <Icon name="today" size={20} />
          <span>Today</span>
        </button>

        <button
          className="navbtn"
          aria-current={activeView === 'planner' ? 'page' : undefined}
          onClick={() => navigateTo('planner')}
        >
          <Icon name="planner" size={20} />
          <span>Planner</span>
        </button>

        <button
          className="navbtn"
          aria-current={activeView === 'focus' ? 'page' : undefined}
          onClick={() => navigateTo('focus')}
        >
          <Icon name="focus" size={20} />
          <span>Focus</span>
        </button>

        <button
          className="navbtn"
          aria-current={activeView === 'subjects' ? 'page' : undefined}
          onClick={() => navigateTo('subjects')}
        >
          <Icon name="subjects" size={20} />
          <span>Subjects</span>
        </button>

        <button
          className="navbtn"
          aria-current={activeView === 'insights' ? 'page' : undefined}
          onClick={() => navigateTo('insights')}
        >
          <Icon name="insights" size={20} />
          <span>Insights</span>
        </button>

        <button
          className="navbtn"
          aria-current={activeView === 'account' ? 'page' : undefined}
          onClick={() => navigateTo('account')}
        >
          <Icon name="user" size={20} />
          <span>My Account</span>
        </button>

        <button
          className="navbtn"
          aria-current={activeView === 'ai' ? 'page' : undefined}
          onClick={() => navigateTo('ai')}
          style={{
            background: activeView === 'ai' ? 'var(--accent-soft)' : undefined,
            color: activeView === 'ai' ? 'var(--accent)' : undefined,
            border: '1px solid var(--accent)',
            marginTop: '4px'
          }}
        >
          <Icon name="sparkles" size={20} />
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span>AI & Tests</span>
            {getYesterdayTopics(plan).length > 0 && (
              <span className="pill good" style={{ fontSize: '10px', padding: '2px 6px', fontWeight: 700 }}>
                Test Ready
              </span>
            )}
          </span>
        </button>

        <div className="navnote">
          <b>Today</b>
          {todayRemainingTasks} task{todayRemainingTasks === 1 ? '' : 's'} left
          <br />
          {todayDueTopics} revision{todayDueTopics === 1 ? '' : 's'} due
        </div>

        <div className="cloud-status-badge">
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: syncStatus === 'synced' ? 'var(--good)' : syncStatus === 'syncing' ? 'var(--amber)' : 'var(--muted)'
            }}
          ></span>
          <span>{syncStatus === 'synced' ? 'Cloud Synced' : syncStatus === 'syncing' ? 'Syncing...' : 'Local Browser'}</span>
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
              className="btn primary sm"
              onClick={() => {
                setAuthInitialMode('login');
                setAuthModalOpen(true);
              }}
            >
              <Icon name="user" size={14} /> Sign In
            </button>
          )}
        </header>

        {/* Dynamic Views */}
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

        {activeView === 'planner' && (
          <PlannerView
            plan={plan}
            weekStart={weekStart}
            subjectFilter={subjectFilter}
            onFilterChange={setSubjectFilter}
            onWeekChange={setWeekStart}
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
            onMoveTask={handleMoveTask}
            onOpenTouchMove={(task) => {
              setTouchMoveTask(task);
              setTouchMoveModalOpen(true);
            }}
            onOpenAIPlanner={() => navigateTo('ai')}
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
      </main>

      {/* Global Modals */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authInitialMode}
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
