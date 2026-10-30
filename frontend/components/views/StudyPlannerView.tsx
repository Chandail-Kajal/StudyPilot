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
      showToast(res.status === 'completed' ? 'Task marked as completed!' : 'Task reopened');
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
    if (selectedDateFilter === 'today') return task.scheduled_date === todayStr;
    if (selectedDateFilter === 'upcoming') return task.scheduled_date >= todayStr && task.status !== 'completed';
    if (selectedDateFilter === 'completed') return task.status === 'completed';
    return true;
  });

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const todayTasks = tasks.filter(t => t.scheduled_date === todayStr);
  const todayMins = todayTasks.reduce((acc, t) => acc + (t.estimated_minutes || 0), 0);
  const remainingMins = tasks.filter(t => t.status !== 'completed').reduce((acc, t) => acc + (t.estimated_minutes || 0), 0);

  // Group tasks by scheduled_date
  const groupedTasks: Record<string, PlanTask[]> = {};
  filteredTasks.forEach(t => {
    const d = t.scheduled_date || 'Unscheduled';
    if (!groupedTasks[d]) groupedTasks[d] = [];
    groupedTasks[d].push(t);
  });
  const sortedDates = Object.keys(groupedTasks).sort();

  if (!activeExam) {
    return (
      <div className="card text-center p-12">
        <Icon name="calendar" className="w-12 h-12 text-muted mx-auto mb-3" />
        <h3 className="text-xl font-bold mb-2">No Active Exam Selected</h3>
        <p className="text-muted mb-4">Please select or activate an exam to view and manage its study planner.</p>
        <button onClick={() => onNavigate('exams')} className="btn btn-primary">
          View My Exams
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="badge badge-primary">{activeExam.exam_category}</span>
            <span className="text-xs text-muted">Daily Goal: {planData?.daily_study_minutes || 120} mins</span>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Icon name="calendar" className="text-primary w-6 h-6" />
            Study Planner: {activeExam.exam_name}
          </h1>
          <p className="text-sm text-muted">
            Track daily scheduled topics, study sitting capacity, and milestone progression.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowAdaptiveModal(true)} className="btn btn-primary flex items-center gap-1.5 text-xs">
            <Icon name="sparkles" className="w-3.5 h-3.5" />
            Generate Adaptive Plan
          </button>
          <button onClick={() => onNavigate('smart_recovery')} className="btn btn-outline flex items-center gap-1.5 text-xs">
            <Icon name="refresh" className="w-3.5 h-3.5" />
            Smart Recovery Planner
          </button>
          <button onClick={fetchPlan} className="btn btn-outline flex items-center gap-1.5 text-xs" disabled={loading}>
            <Icon name="refresh" className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-xs font-medium text-muted uppercase tracking-wider mb-1">Completion Rate</div>
          <div className="text-2xl font-bold text-primary">{progressPct}%</div>
          <div className="w-full bg-slate-800 rounded-full h-2 mt-2 overflow-hidden">
            <div className="bg-primary h-full transition-all duration-500" style={{ width: `${progressPct}%` }}></div>
          </div>
        </div>

        <div className="card p-4">
          <div className="text-xs font-medium text-muted uppercase tracking-wider mb-1">Tasks Completed</div>
          <div className="text-2xl font-bold text-success">{completedTasks} <span className="text-sm text-muted font-normal">/ {totalTasks}</span></div>
          <div className="text-xs text-muted mt-1">{totalTasks - completedTasks} remaining</div>
        </div>

        <div className="card p-4">
          <div className="text-xs font-medium text-muted uppercase tracking-wider mb-1">Today's Load</div>
          <div className="text-2xl font-bold text-warning">{todayTasks.length} <span className="text-sm text-muted font-normal">tasks</span></div>
          <div className="text-xs text-muted mt-1">{todayMins} mins estimated</div>
        </div>

        <div className="card p-4">
          <div className="text-xs font-medium text-muted uppercase tracking-wider mb-1">Total Effort Left</div>
          <div className="text-2xl font-bold text-info">{Math.round(remainingMins / 60 * 10) / 10} <span className="text-sm text-muted font-normal">hrs</span></div>
          <div className="text-xs text-muted mt-1">Across all planned units</div>
        </div>
      </div>

      {/* Filter and Date Bar */}
      <div className="card p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedDateFilter('all')}
            className={`btn btn-sm ${selectedDateFilter === 'all' ? 'btn-primary' : 'btn-outline'}`}
          >
            All Scheduled ({totalTasks})
          </button>
          <button
            onClick={() => setSelectedDateFilter('today')}
            className={`btn btn-sm ${selectedDateFilter === 'today' ? 'btn-primary' : 'btn-outline'}`}
          >
            Today ({todayTasks.length})
          </button>
          <button
            onClick={() => setSelectedDateFilter('upcoming')}
            className={`btn btn-sm ${selectedDateFilter === 'upcoming' ? 'btn-primary' : 'btn-outline'}`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setSelectedDateFilter('completed')}
            className={`btn btn-sm ${selectedDateFilter === 'completed' ? 'btn-primary' : 'btn-outline'}`}
          >
            Completed ({completedTasks})
          </button>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-muted flex items-center gap-1">
            <Icon name="filter" className="w-3.5 h-3.5" />
            Subject:
          </label>
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="input py-1 px-3 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white"
          >
            <option value="all">All Subjects</option>
            {subjects.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Task List / Schedule Table */}
      {loading ? (
        <div className="card p-12 text-center text-muted">
          <Icon name="refresh" className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
          Loading your study planner...
        </div>
      ) : sortedDates.length === 0 ? (
        <div className="card p-12 text-center">
          <Icon name="calendar" className="w-12 h-12 text-muted mx-auto mb-3" />
          <h3 className="text-lg font-bold mb-1">No tasks match your filter</h3>
          <p className="text-sm text-muted mb-4">
            Upload a syllabus or reset your filter to view scheduled study sessions.
          </p>
          <button onClick={() => { setSelectedDateFilter('all'); setSubjectFilter('all'); }} className="btn btn-outline">
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map(date => {
            const isToday = date === todayStr;
            const dateTasks = groupedTasks[date];
            const dateTotalMins = dateTasks.reduce((acc, t) => acc + (t.estimated_minutes || 0), 0);
            const dateCompleted = dateTasks.filter(t => t.status === 'completed').length;

            return (
              <div key={date} className={`card p-5 ${isToday ? 'border-primary/50 bg-primary/5' : ''}`}>
                {/* Date header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded text-xs font-semibold ${isToday ? 'bg-primary text-white' : 'bg-slate-800 text-slate-300'}`}>
                      {isToday ? 'TODAY' : date}
                    </span>
                    <span className="text-sm font-medium text-slate-300">
                      {new Date(date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <div className="text-xs text-muted flex items-center gap-3">
                    <span>{dateCompleted}/{dateTasks.length} Done</span>
                    <span>•</span>
                    <span>{dateTotalMins} Mins Planned</span>
                  </div>
                </div>

                {/* Task Items */}
                <div className="space-y-3">
                  {dateTasks.map(task => {
                    const isDone = task.status === 'completed';
                    const isToggling = togglingTaskId === task.id;

                    return (
                      <div
                        key={task.id}
                        className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-lg border transition-all ${
                          isDone
                            ? 'bg-slate-900/40 border-slate-800/80 opacity-70'
                            : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start gap-3 flex-1 min-w-0 mb-3 sm:mb-0">
                          <button
                            onClick={() => handleToggleTask(task.id)}
                            disabled={isToggling}
                            className={`w-6 h-6 rounded mt-0.5 flex items-center justify-center border transition-colors ${
                              isDone
                                ? 'bg-success border-success text-white'
                                : 'border-slate-600 hover:border-primary'
                            }`}
                            title={isDone ? 'Mark as pending' : 'Mark as completed'}
                          >
                            {isDone && <Icon name="check" className="w-3.5 h-3.5 stroke-[3]" />}
                          </button>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-base font-semibold ${isDone ? 'line-through text-muted' : 'text-slate-100'}`}>
                                {task.topic_name}
                              </span>
                              <span className="badge badge-outline text-xs text-info border-info/30">
                                {task.subject_name}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-xs text-muted mt-1">
                              <span className="flex items-center gap-1">
                                <Icon name="clock" className="w-3.5 h-3.5" />
                                {task.estimated_minutes || 45} mins
                              </span>
                              {task.completed_at && (
                                <span className="text-success">
                                  Completed at {new Date(task.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {onOpenTopicStudio && (
                            <button
                              onClick={() => onOpenTopicStudio(task.topic_id)}
                              className="btn btn-sm btn-outline text-xs flex items-center gap-1 border-primary/40 text-primary hover:bg-primary/20"
                              title="Learn this concept in Interactive AI Studio"
                            >
                              <Icon name="sparkles" className="w-3.5 h-3.5" />
                              Studio
                            </button>
                          )}
                          {onStartFocusSession && !isDone && (
                            <button
                              onClick={() => onStartFocusSession(task.estimated_minutes || 45, task.subject_name)}
                              className="btn btn-sm btn-outline text-xs flex items-center gap-1 border-primary/40 hover:bg-primary/20"
                              title="Start Pomodoro Focus Session on this topic"
                            >
                              <Icon name="clock" className="w-3.5 h-3.5 text-primary" />
                              Focus
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleTask(task.id)}
                            disabled={isToggling}
                            className={`btn btn-sm text-xs ${isDone ? 'btn-outline text-muted' : 'btn-success'}`}
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

      {/* Adaptive Plan Generation Modal */}
      {showAdaptiveModal && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowAdaptiveModal(false); }}>
          <div className="modal" style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '20px' }}>Generate Adaptive Study Plan</h2>
              <button className="linkbtn" onClick={() => setShowAdaptiveModal(false)}><Icon name="x" size={18} /></button>
            </div>

            <form onSubmit={handleGenerateAdaptivePlan} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>
                The StudyPilot AI planner coordinates complete syllabus coverage, concept studio learning, practice drills, and mock test buffer days.
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Daily Study Capacity: {genDailyHours} hrs ({Math.round(genDailyHours * 60)} mins)
                </label>
                <input
                  type="range"
                  min="1.0"
                  max="8.0"
                  step="0.5"
                  value={genDailyHours}
                  onChange={(e) => setGenDailyHours(parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                  <span>1 hr</span>
                  <span>4 hrs</span>
                  <span>8 hrs</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                  Learning Pace
                  <select
                    value={genLearningPace}
                    onChange={(e) => setGenLearningPace(e.target.value)}
                    style={{ padding: '8px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  >
                    <option value="moderate">Moderate & Balanced</option>
                    <option value="accelerated">Accelerated / Fast-Track</option>
                    <option value="relaxed">Comprehensive & Relaxed</option>
                  </select>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                  Revision Buffer Days
                  <input
                    type="number"
                    min={1}
                    max={14}
                    value={genBufferDays}
                    onChange={(e) => setGenBufferDays(parseInt(e.target.value))}
                  />
                </label>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Available Study Days
                </label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
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
                        className={`btn sm ${isSelected ? 'primary' : ''}`}
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" className="btn" onClick={() => setShowAdaptiveModal(false)}>Cancel</button>
                <button type="submit" className="btn primary" disabled={generatingPlan}>
                  {generatingPlan ? 'Calculating Timetable...' : 'Generate Personalized Timetable'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
