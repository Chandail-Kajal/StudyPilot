'use client';

import React, { useState, useEffect } from 'react';
import { Exam } from '@/types';
import { api } from '@/lib/api';
import { Icon } from '../Icons';

interface StudyPlannerViewProps {
  token: string | null;
  activeExam: Exam | null;
  onNavigate: (view: string) => void;
  showToast: (msg: string) => void;
  onStartFocusSession?: (mins: number, subjectName?: string) => void;
  onOpenTopicStudio?: (topicId: string) => void;
}

interface PlanTask {
  id: string;
  topic_id: string;
  topic_name: string;
  title?: string;
  subject_name: string;
  scheduled_date: string;
  estimated_minutes: number;
  priority?: string;
  activity_type?: string;
  status: 'pending' | 'completed' | string;
  completed_at?: string | null;
}

interface PlanData {
  plan_id?: string;
  plan_name: string;
  start_date: string;
  end_date?: string;
  daily_study_minutes: number;
  tasks: PlanTask[];
}

export const StudyPlannerView: React.FC<StudyPlannerViewProps> = ({
  token,
  activeExam,
  onNavigate,
  showToast,
  onStartFocusSession,
  onOpenTopicStudio
}) => {
  const [loading, setLoading] = useState(false);
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [selectedDateFilter, setSelectedDateFilter] = useState<'today' | 'upcoming' | 'all' | 'completed'>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null);

  // Adaptive Plan Generator state
  const [showAdaptiveModal, setShowAdaptiveModal] = useState(false);
  const [genDailyHours, setGenDailyHours] = useState(3.0);
  const [genBufferDays, setGenBufferDays] = useState(4);
  const [genLearningPace, setGenLearningPace] = useState('moderate');
  const [genAvailableDays, setGenAvailableDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  const fetchPlan = async () => {
    if (!token || !activeExam) return;
    setLoading(true);
    try {
      const res = await api.getStudyPlan(token, activeExam.id);
      if (res.plan) {
        setPlanData({
          plan_id: res.plan.id,
          plan_name: res.plan.plan_name,
          start_date: res.plan.start_date,
          end_date: res.plan.end_date,
          daily_study_minutes: res.plan.daily_study_minutes,
          tasks: res.tasks || []
        });
      } else {
        setPlanData(null);
      }
    } catch (e: any) {
      showToast(e.message || 'Failed to load study plan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlan();
  }, [token, activeExam]);

  const handleToggleTask = async (taskId: string) => {
    if (!token) return;
    setTogglingTaskId(taskId);
    try {
      const res = await api.toggleStudyTask(token, taskId);
      setPlanData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          tasks: prev.tasks.map(t => t.id === taskId ? { ...t, status: res.status } : t)
        };
      });
      showToast(res.status === 'completed' ? '🎉 Task marked completed! Keep the momentum going.' : 'Task reopened.');
    } catch (e: any) {
      showToast(e.message || 'Failed to update task');
    } finally {
      setTogglingTaskId(null);
    }
  };

  const handleGenerateAdaptivePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeExam) return;
    setGeneratingPlan(true);
    try {
      const res = await api.createAdaptivePlan(token, {
        exam_id: activeExam.id,
        daily_study_hours: genDailyHours,
        available_days: genAvailableDays,
        learning_pace: genLearningPace,
        buffer_days: genBufferDays
      });
      showToast(res.message || 'Adaptive personalized timetable generated!');
      setShowAdaptiveModal(false);
      fetchPlan();
    } catch (e: any) {
      showToast(e.message || 'Failed to generate timetable. Ensure syllabus topics exist.');
    } finally {
      setGeneratingPlan(false);
    }
  };

  const tasks = planData?.tasks || [];
  const subjects = Array.from(new Set(tasks.map(t => t.subject_name).filter(Boolean)));

  const filteredTasks = tasks.filter(task => {
    if (subjectFilter !== 'all' && task.subject_name !== subjectFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTopic = task.topic_name.toLowerCase().includes(q);
      const matchSubj = task.subject_name.toLowerCase().includes(q);
      if (!matchTopic && !matchSubj) return false;
    }
    if (selectedDateFilter === 'today') return task.scheduled_date === todayStr;
    if (selectedDateFilter === 'upcoming') return task.scheduled_date >= todayStr && task.status !== 'completed';
    if (selectedDateFilter === 'completed') return task.status === 'completed';
    return true;
  });

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const todayTasks = tasks.filter(t => t.scheduled_date === todayStr);
  const todayCompleted = todayTasks.filter(t => t.status === 'completed').length;
  const todayMins = todayTasks.reduce((acc, t) => acc + (t.estimated_minutes || 0), 0);
  const remainingMins = tasks.filter(t => t.status !== 'completed').reduce((acc, t) => acc + (t.estimated_minutes || 0), 0);

  // Days until exam
  const examDateObj = activeExam?.exam_date ? new Date(activeExam.exam_date + 'T00:00:00') : null;
  const todayObj = new Date();
  todayObj.setHours(0, 0, 0, 0);
  const daysUntilExam = examDateObj ? Math.ceil((examDateObj.getTime() - todayObj.getTime()) / (1000 * 60 * 60 * 24)) : null;

  // Group tasks by scheduled_date
  const groupedTasks: Record<string, PlanTask[]> = {};
  filteredTasks.forEach(t => {
    const d = t.scheduled_date || 'Unscheduled';
    if (!groupedTasks[d]) groupedTasks[d] = [];
    groupedTasks[d].push(t);
  });
  const sortedDates = Object.keys(groupedTasks).sort();

  // Helper for dynamic subject pill colors
  const getSubjectColor = (name: string) => {
    const hash = (name || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const palettes = [
      { bg: 'rgba(56, 189, 248, 0.12)', text: '#38BDF8', border: 'rgba(56, 189, 248, 0.35)' }, // Sky
      { bg: 'rgba(168, 85, 247, 0.12)', text: '#C084FC', border: 'rgba(168, 85, 247, 0.35)' }, // Violet
      { bg: 'rgba(52, 211, 153, 0.12)', text: '#34D399', border: 'rgba(52, 211, 153, 0.35)' }, // Mint
      { bg: 'rgba(251, 146, 60, 0.12)', text: '#FB923C', border: 'rgba(251, 146, 60, 0.35)' }, // Orange
      { bg: 'rgba(244, 63, 94, 0.12)', text: '#FB7185', border: 'rgba(244, 63, 94, 0.35)' },   // Rose
      { bg: 'rgba(250, 204, 21, 0.12)', text: '#FACC15', border: 'rgba(250, 204, 21, 0.35)' }  // Amber
    ];
    return palettes[hash % palettes.length];
  };

  // Helper for activity type badge
  const getActivityBadge = (type?: string) => {
    switch (type?.toLowerCase()) {
      case 'class':
      case 'lesson':
        return { label: '🎓 AI Lesson', bg: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', border: 'rgba(56, 189, 248, 0.3)' };
      case 'practice':
      case 'drill':
        return { label: '✍️ Practice Drill', bg: 'rgba(76, 201, 138, 0.15)', color: '#4CC98A', border: 'rgba(76, 201, 138, 0.3)' };
      case 'test':
      case 'mock':
        return { label: '🧪 Mock Test', bg: 'rgba(192, 132, 252, 0.15)', color: '#C084FC', border: 'rgba(192, 132, 252, 0.3)' };
      case 'revision':
        return { label: '🔄 Smart Revision', bg: 'rgba(251, 191, 36, 0.15)', color: '#FBBF24', border: 'rgba(251, 191, 36, 0.3)' };
      default:
        return { label: '📖 Topic Study', bg: 'rgba(148, 163, 184, 0.12)', color: '#94A3B8', border: 'rgba(148, 163, 184, 0.25)' };
    }
  };

  if (!activeExam) {
    return (
      <div className="card text-center p-12" style={{ maxWidth: '600px', margin: '40px auto' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.15)', color: '#6366F1', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
          <Icon name="calendar" size={32} />
        </div>
        <h3 className="text-xl font-bold mb-2">No Active Examination Selected</h3>
        <p className="text-muted mb-6">Select or activate a target examination to generate and track its personalized study planner.</p>
        <button onClick={() => onNavigate('exams')} className="btn primary" style={{ margin: '0 auto' }}>
          <Icon name="award" size={16} /> View My Examinations
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '8px 4px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 1. Hero Header Banner with Clean Slate & Sky Blue Theme */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(20, 30, 48, 0.95) 0%, rgba(36, 59, 85, 0.95) 100%)',
          borderRadius: '20px',
          padding: '28px 32px',
          border: '1px solid rgba(84, 194, 240, 0.25)',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.35)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Ambient Glow */}
        <div
          style={{
            position: 'absolute',
            top: '-50px',
            right: '-50px',
            width: '240px',
            height: '240px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(56, 189, 248, 0.18) 0%, transparent 70%)',
            pointerEvents: 'none'
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px', position: 'relative', zIndex: 1 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  background: 'rgba(56, 189, 248, 0.18)',
                  color: '#38BDF8',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  padding: '3px 10px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em'
                }}
              >
                {activeExam.exam_category || 'Target Exam'}
              </span>

              {daysUntilExam !== null && (
                <span
                  style={{
                    background: daysUntilExam <= 14 ? 'rgba(244, 63, 94, 0.18)' : 'rgba(251, 191, 36, 0.18)',
                    color: daysUntilExam <= 14 ? '#FB7185' : '#FBBF24',
                    border: `1px solid ${daysUntilExam <= 14 ? 'rgba(244, 63, 94, 0.4)' : 'rgba(251, 191, 36, 0.4)'}`,
                    padding: '3px 10px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Icon name="clock" size={12} />
                  {daysUntilExam > 0 ? `${daysUntilExam} Days Remaining` : daysUntilExam === 0 ? 'Exam Day Today!' : 'Exam Concluded'}
                </span>
              )}

              <span style={{ fontSize: '12px', color: '#92A3B5' }}>
                Daily Target: <strong style={{ color: '#E8EEF4' }}>{planData?.daily_study_minutes || 120} mins</strong>
              </span>
            </div>

            <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 6px 0', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#38BDF8' }}>✦</span>
              Personalized Study Planner: {activeExam.exam_name}
            </h1>
            <p style={{ fontSize: '14px', color: '#94A3B8', maxWidth: '640px', margin: 0, lineHeight: 1.5 }}>
              AI-calibrated date-wise roadmap balancing concept mastery, practice exercises, and mock revision days before your exam.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowAdaptiveModal(true)}
              className="btn primary"
              style={{
                background: 'linear-gradient(135deg, #0284C7 0%, #38BDF8 100%)',
                color: '#FFFFFF',
                border: 'none',
                fontWeight: 700,
                fontSize: '13px',
                padding: '10px 18px',
                borderRadius: '10px',
                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Icon name="sparkles" size={15} />
              Generate Adaptive Plan
            </button>

            <button
              onClick={() => onNavigate('smart_recovery')}
              className="btn"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#E2E8F0',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                fontSize: '13px',
                padding: '10px 16px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Icon name="refresh" size={14} />
              Recovery Planner
            </button>

            <button
              onClick={fetchPlan}
              disabled={loading}
              className="btn"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#E2E8F0',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                fontSize: '13px',
                padding: '10px',
                borderRadius: '10px'
              }}
              title="Refresh Plan Data"
            >
              <Icon name="refresh" size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Sleek KPI Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        
        {/* Card 1: Completion Rate */}
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: '16px',
            border: '1px solid var(--line)',
            padding: '20px',
            boxShadow: 'var(--shadow)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', fontWeight: 700, marginBottom: '6px' }}>
            Overall Syllabus Completion
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '32px', fontWeight: 800, color: '#38BDF8', letterSpacing: '-0.02em' }}>{progressPct}%</span>
            <span style={{ fontSize: '13px', color: 'var(--muted)' }}>({completedTasks} of {totalTasks} topics)</span>
          </div>
          {/* Dual Gradient Progress Bar */}
          <div style={{ width: '100%', height: '8px', background: 'var(--surface2)', borderRadius: '999px', marginTop: '14px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${progressPct}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #38BDF8 0%, #6366F1 50%, #10B981 100%)',
                borderRadius: '999px',
                transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            />
          </div>
        </div>

        {/* Card 2: Today's Focus Load */}
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: '16px',
            border: todayTasks.length > 0 ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid var(--line)',
            padding: '20px',
            boxShadow: 'var(--shadow)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#38BDF8', fontWeight: 700 }}>
              Today's Scheduled Target
            </span>
            <span style={{ fontSize: '11px', background: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
              {todayCompleted}/{todayTasks.length} Done
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '32px', fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
              {todayMins} <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--muted)' }}>mins</span>
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Icon name="check" size={14} style={{ color: '#10B981' }} />
            <span>{todayTasks.length - todayCompleted} tasks remaining for today</span>
          </div>
        </div>

        {/* Card 3: Remaining Effort */}
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: '16px',
            border: '1px solid var(--line)',
            padding: '20px',
            boxShadow: 'var(--shadow)'
          }}
        >
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', fontWeight: 700, marginBottom: '6px' }}>
            Estimated Total Effort Left
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '32px', fontWeight: 800, color: '#C084FC', letterSpacing: '-0.02em' }}>
              {Math.round(remainingMins / 60 * 10) / 10} <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--muted)' }}>hrs</span>
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
            Distributed across {totalTasks - completedTasks} pending syllabus sessions
          </div>
        </div>

        {/* Card 4: Daily Pace & Countdown */}
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: '16px',
            border: '1px solid var(--line)',
            padding: '20px',
            boxShadow: 'var(--shadow)'
          }}
        >
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', fontWeight: 700, marginBottom: '6px' }}>
            Target Daily Pace
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '32px', fontWeight: 800, color: '#FBBF24', letterSpacing: '-0.02em' }}>
              {daysUntilExam && daysUntilExam > 0 ? (Math.round((remainingMins / 60 / daysUntilExam) * 10) / 10) : (planData?.daily_study_minutes ? (planData.daily_study_minutes / 60).toFixed(1) : '2.0')}
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--muted)' }}> hrs/day</span>
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
            {daysUntilExam && daysUntilExam > 0 ? `Required to finish in ${daysUntilExam} days` : 'Optimal study pace'}
          </div>
        </div>

      </div>

      {/* 3. Filter, Search & View Controls Bar */}
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: '16px',
          border: '1px solid var(--line)',
          padding: '16px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          boxShadow: 'var(--shadow)'
        }}
      >
        {/* Date Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingBottom: '2px' }}>
          {[
            { id: 'all', label: `All Tasks (${totalTasks})` },
            { id: 'today', label: `Today's Focus (${todayTasks.length})` },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'completed', label: `Completed (${completedTasks})` }
          ].map(f => {
            const isActive = selectedDateFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setSelectedDateFilter(f.id as any)}
                style={{
                  padding: '7px 16px',
                  borderRadius: '999px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  border: '1px solid',
                  borderColor: isActive ? '#38BDF8' : 'var(--line)',
                  background: isActive ? 'rgba(56, 189, 248, 0.15)' : 'var(--surface2)',
                  color: isActive ? '#38BDF8' : 'var(--muted)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Search & Subject Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', minWidth: '180px' }}>
            <input
              type="text"
              placeholder="Search topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 12px 7px 32px',
                fontSize: '12.5px',
                borderRadius: '8px',
                background: 'var(--surface2)',
                border: '1px solid var(--line)',
                color: 'var(--ink)',
                outline: 'none'
              }}
            />
            <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }}>
              <Icon name="search" size={13} />
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
              >
                <Icon name="x" size={12} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>Subject:</span>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              style={{
                padding: '7px 12px',
                fontSize: '12.5px',
                borderRadius: '8px',
                background: 'var(--surface2)',
                border: '1px solid var(--line)',
                color: 'var(--ink)',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Subjects ({subjects.length})</option>
              {subjects.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4. Task Schedule Listing */}
      {loading ? (
        <div className="card text-center p-12" style={{ color: 'var(--muted)' }}>
          <Icon name="refresh" size={32} className="animate-spin mx-auto mb-3" style={{ color: '#38BDF8' }} />
          <h4 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)' }}>Loading personalized timetable...</h4>
          <p style={{ fontSize: '13px' }}>Organizing daily curriculum sessions and study sitting intervals.</p>
        </div>
      ) : sortedDates.length === 0 ? (
        <div className="card text-center p-12" style={{ background: 'var(--surface)' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(56, 189, 248, 0.1)', color: '#38BDF8', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
            <Icon name="calendar" size={28} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>No Sessions Match Your Current Filter</h3>
          <p style={{ fontSize: '13px', color: 'var(--muted)', maxWidth: '420px', margin: '0 auto 16px' }}>
            {tasks.length === 0
              ? 'Click "Generate Adaptive Plan" above to create an automated daily study timetable based on your syllabus!'
              : 'Try selecting "All Tasks" or clearing your search query to view your scheduled timetable.'}
          </p>
          {tasks.length === 0 ? (
            <button onClick={() => setShowAdaptiveModal(true)} className="btn primary" style={{ margin: '0 auto' }}>
              <Icon name="sparkles" size={15} /> Generate Adaptive Study Plan
            </button>
          ) : (
            <button onClick={() => { setSelectedDateFilter('all'); setSubjectFilter('all'); setSearchQuery(''); }} className="btn" style={{ margin: '0 auto' }}>
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {sortedDates.map(date => {
            const isToday = date === todayStr;
            const dateTasks = groupedTasks[date];
            const dateTotalMins = dateTasks.reduce((acc, t) => acc + (t.estimated_minutes || 0), 0);
            const dateCompleted = dateTasks.filter(t => t.status === 'completed').length;
            const allDone = dateCompleted === dateTasks.length;

            return (
              <div
                key={date}
                style={{
                  background: isToday
                    ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.05) 0%, rgba(99, 102, 241, 0.04) 100%)'
                    : 'var(--surface)',
                  borderRadius: '16px',
                  border: isToday
                    ? '1.5px solid rgba(56, 189, 248, 0.45)'
                    : '1px solid var(--line)',
                  padding: '20px',
                  boxShadow: isToday
                    ? '0 8px 28px rgba(56, 189, 248, 0.12)'
                    : 'var(--shadow)'
                }}
              >
                {/* Date Header Strip */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: '12px', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        padding: '4px 12px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        background: isToday ? '#38BDF8' : 'var(--surface2)',
                        color: isToday ? '#0C131B' : 'var(--ink)'
                      }}
                    >
                      {isToday ? '⭐ TODAY' : date}
                    </span>

                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)' }}>
                      {new Date(date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                    </span>

                    {allDone && (
                      <span style={{ fontSize: '11px', background: 'rgba(76, 201, 138, 0.15)', color: '#4CC98A', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                        ✓ All Done
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--muted)' }}>
                    <span>
                      <strong style={{ color: 'var(--ink)' }}>{dateCompleted}/{dateTasks.length}</strong> Completed
                    </span>
                    <span>•</span>
                    <span>
                      <strong style={{ color: 'var(--ink)' }}>{dateTotalMins}</strong> Mins Planned
                    </span>
                  </div>
                </div>

                {/* Tasks in this Date */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {dateTasks.map(task => {
                    const isDone = task.status === 'completed';
                    const isToggling = togglingTaskId === task.id;
                    const subjStyle = getSubjectColor(task.subject_name);
                    const actBadge = getActivityBadge(task.activity_type);

                    return (
                      <div
                        key={task.id}
                        style={{
                          background: isDone ? 'var(--surface2)' : 'var(--surface)',
                          borderRadius: '12px',
                          border: '1px solid var(--line)',
                          padding: '14px 18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '14px',
                          opacity: isDone ? 0.72 : 1,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {/* Left: Checkbox + Topic Details */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: '1 1 320px', minWidth: 0 }}>
                          {/* Custom Checkbox */}
                          <button
                            onClick={() => handleToggleTask(task.id)}
                            disabled={isToggling}
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '6px',
                              border: isDone ? '2px solid #10B981' : '2px solid var(--line)',
                              background: isDone ? '#10B981' : 'transparent',
                              color: '#FFFFFF',
                              display: 'grid',
                              placeItems: 'center',
                              cursor: 'pointer',
                              flexShrink: 0,
                              transition: 'all 0.15s ease'
                            }}
                            title={isDone ? 'Mark task as pending' : 'Mark task completed'}
                          >
                            {isDone && <Icon name="check" size={14} style={{ strokeWidth: 3 }} />}
                          </button>

                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '3px' }}>
                              <span
                                style={{
                                  fontSize: '15px',
                                  fontWeight: 700,
                                  color: isDone ? 'var(--muted)' : 'var(--ink)',
                                  textDecoration: isDone ? 'line-through' : 'none'
                                }}
                              >
                                {task.topic_name}
                              </span>

                              {/* Subject Badge */}
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  background: subjStyle.bg,
                                  color: subjStyle.text,
                                  border: `1px solid ${subjStyle.border}`
                                }}
                              >
                                {task.subject_name}
                              </span>

                              {/* Activity Badge */}
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  background: actBadge.bg,
                                  color: actBadge.color,
                                  border: `1px solid ${actBadge.border}`
                                }}
                              >
                                {actBadge.label}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--muted)' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Icon name="clock" size={13} />
                                {task.estimated_minutes || 45} mins
                              </span>
                              {task.completed_at && (
                                <span style={{ color: '#10B981' }}>
                                  ✓ Completed {new Date(task.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Quick Action Buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          {onOpenTopicStudio && (
                            <button
                              onClick={() => onOpenTopicStudio(task.topic_id)}
                              className="btn sm"
                              style={{
                                background: 'rgba(56, 189, 248, 0.1)',
                                color: '#38BDF8',
                                border: '1px solid rgba(56, 189, 248, 0.35)',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                padding: '5px 12px',
                                borderRadius: '8px'
                              }}
                              title="Open in Interactive AI Learning Studio"
                            >
                              <Icon name="sparkles" size={13} />
                              Open Studio
                            </button>
                          )}

                          {onStartFocusSession && !isDone && (
                            <button
                              onClick={() => onStartFocusSession(task.estimated_minutes || 45, task.subject_name)}
                              className="btn sm"
                              style={{
                                background: 'var(--surface2)',
                                color: 'var(--ink)',
                                border: '1px solid var(--line)',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                padding: '5px 12px',
                                borderRadius: '8px'
                              }}
                              title="Launch Pomodoro Focus Timer for this session"
                            >
                              <Icon name="clock" size={13} style={{ color: '#38BDF8' }} />
                              Focus
                            </button>
                          )}

                          <button
                            onClick={() => handleToggleTask(task.id)}
                            disabled={isToggling}
                            className="btn sm"
                            style={{
                              background: isDone ? 'transparent' : 'rgba(16, 185, 129, 0.12)',
                              color: isDone ? 'var(--muted)' : '#10B981',
                              border: isDone ? '1px solid var(--line)' : '1px solid rgba(16, 185, 129, 0.35)',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              padding: '5px 12px',
                              borderRadius: '8px'
                            }}
                          >
                            {isToggling ? '...' : isDone ? 'Reopen' : 'Done'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Adaptive Plan Generation Modal */}
      {showAdaptiveModal && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowAdaptiveModal(false); }}>
          <div className="modal" style={{ maxWidth: '540px', borderRadius: '18px', padding: '28px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', display: 'grid', placeItems: 'center' }}>
                  <Icon name="sparkles" size={18} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 800 }}>Generate Adaptive Study Plan</h2>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Calibrated for {activeExam.exam_name}</div>
                </div>
              </div>
              <button className="linkbtn" onClick={() => setShowAdaptiveModal(false)}><Icon name="x" size={18} /></button>
            </div>

            <form onSubmit={handleGenerateAdaptivePlan} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
                StudyPilot AI analyzes your complete syllabus hierarchy, topic difficulty, and exam date to formulate an optimized date-wise daily study timetable.
              </p>

              {/* Daily Capacity Slider */}
              <div style={{ background: 'var(--surface2)', padding: '16px', borderRadius: '12px', border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700 }}>
                    Daily Available Study Time:
                  </label>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#38BDF8' }}>
                    {genDailyHours} hrs ({Math.round(genDailyHours * 60)} mins)
                  </span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="8.0"
                  step="0.5"
                  value={genDailyHours}
                  onChange={(e) => setGenDailyHours(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#38BDF8', height: '6px' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)', marginTop: '6px' }}>
                  <span>1 hr (Light)</span>
                  <span>3.5 hrs (Recommended)</span>
                  <span>8 hrs (Intensive)</span>
                </div>
              </div>

              {/* Pace & Buffer Days */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 700 }}>Learning Pace</label>
                  <select
                    value={genLearningPace}
                    onChange={(e) => setGenLearningPace(e.target.value)}
                    style={{ padding: '9px 12px', borderRadius: '8px', background: 'var(--surface2)', border: '1px solid var(--line)', color: 'var(--ink)', fontSize: '13px' }}
                  >
                    <option value="moderate">Moderate & Balanced</option>
                    <option value="accelerated">Accelerated (Fast-Track)</option>
                    <option value="relaxed">Comprehensive & Relaxed</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 700 }}>Revision Buffer Days</label>
                  <input
                    type="number"
                    min={1}
                    max={14}
                    value={genBufferDays}
                    onChange={(e) => setGenBufferDays(parseInt(e.target.value))}
                    style={{ padding: '9px 12px', borderRadius: '8px', background: 'var(--surface2)', border: '1px solid var(--line)', color: 'var(--ink)', fontSize: '13px' }}
                  />
                </div>
              </div>

              {/* Available Days Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '8px' }}>
                  Weekly Study Days
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                    const isSelected = genAvailableDays.includes(day);
                    return (
                      <button
                        type="button"
                        key={day}
                        onClick={() => {
                          if (isSelected) {
                            if (genAvailableDays.length > 1) {
                              setGenAvailableDays(genAvailableDays.filter(d => d !== day));
                            }
                          } else {
                            setGenAvailableDays([...genAvailableDays, day]);
                          }
                        }}
                        style={{
                          padding: '7px 14px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 700,
                          border: isSelected ? '1px solid #38BDF8' : '1px solid var(--line)',
                          background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'var(--surface2)',
                          color: isSelected ? '#38BDF8' : 'var(--muted)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button type="button" className="btn" onClick={() => setShowAdaptiveModal(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generatingPlan}
                  className="btn primary"
                  style={{
                    background: 'linear-gradient(135deg, #0284C7 0%, #38BDF8 100%)',
                    color: '#FFFFFF',
                    border: 'none',
                    fontWeight: 700
                  }}
                >
                  {generatingPlan ? (
                    <>
                      <Icon name="refresh" size={14} className="animate-spin" />
                      Generating Timetable...
                    </>
                  ) : (
                    'Generate Timetable'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
