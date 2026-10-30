'use client';

import React, { useState, useEffect } from 'react';
import { Exam } from '@/types';
import { api } from '@/lib/api';
import { Icon } from '../Icons';

interface TimetableScheduleViewProps {
  token: string | null;
  activeExam: Exam | null;
  onNavigate: (view: string) => void;
  showToast: (msg: string) => void;
  onOpenTopicStudio?: (topicId: string) => void;
  onLaunchPractice?: (topicId: string) => void;
  onLaunchTest?: (testId?: string) => void;
}

interface TimetableTask {
  id: string;
  topic_id: string;
  topic_name: string;
  subject_name: string;
  subject_color?: string;
  unit_name?: string;
  scheduled_date: string;
  start_time?: string;
  end_time?: string;
  title?: string;
  estimated_minutes: number;
  priority?: string;
  activity_type?: string;
  status: 'pending' | 'completed' | string;
  missed?: number;
  completed_at?: string | null;
  notes?: string;
}

export const TimetableScheduleView: React.FC<TimetableScheduleViewProps> = ({
  token,
  activeExam,
  onNavigate,
  showToast,
  onOpenTopicStudio,
  onLaunchPractice,
  onLaunchTest
}) => {
  const [tasks, setTasks] = useState<TimetableTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Reschedule Modal state
  const [rescheduleTask, setRescheduleTask] = useState<TimetableTask | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newStartTime, setNewStartTime] = useState('09:00');
  const [newEndTime, setNewEndTime] = useState('09:45');
  const [rescheduling, setRescheduling] = useState(false);

  // Add Custom Session modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customDate, setCustomDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [customStartTime, setCustomStartTime] = useState('11:00');
  const [customEndTime, setCustomEndTime] = useState('11:45');
  const [customActivity, setCustomActivity] = useState('class');
  const [customMinutes, setCustomMinutes] = useState(45);
  const [addingCustom, setAddingCustom] = useState(false);

  const fetchTimetable = async () => {
    if (!token || !activeExam) return;
    setLoading(true);
    try {
      const res = await api.getStudyPlan(token, activeExam.id);
      setTasks(res.tasks || []);
    } catch (e: any) {
      showToast(e.message || 'Failed to load timetable');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimetable();
  }, [token, activeExam?.id]);

  const handleToggleTask = async (taskId: string) => {
    if (!token) return;
    try {
      const res = await api.toggleStudyTask(token, taskId);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: res.status } : t));
      showToast(res.status === 'completed' ? 'Session marked completed! Great work.' : 'Session marked pending.');
    } catch (e: any) {
      showToast(e.message || 'Failed to update session');
    }
  };

  const handleOpenReschedule = (task: TimetableTask) => {
    setRescheduleTask(task);
    setNewDate(task.scheduled_date);
    setNewStartTime(task.start_time || '09:00');
    setNewEndTime(task.end_time || '09:45');
  };

  const handleSaveReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !rescheduleTask) return;
    setRescheduling(true);
    try {
      await api.updateTaskDetails(token, rescheduleTask.id, {
        scheduled_date: newDate,
        start_time: newStartTime,
        end_time: newEndTime
      });
      showToast(`Session rescheduled to ${newDate} (${newStartTime} - ${newEndTime})`);
      setRescheduleTask(null);
      fetchTimetable();
    } catch (e: any) {
      showToast(e.message || 'Could not reschedule session');
    } finally {
      setRescheduling(false);
    }
  };

  const handleAddCustomSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeExam || !customTitle.trim()) return;
    setAddingCustom(true);
    try {
      await api.addCustomStudyTask(token, {
        exam_id: activeExam.id,
        title: customTitle.trim(),
        scheduled_date: customDate,
        start_time: customStartTime,
        end_time: customEndTime,
        activity_type: customActivity,
        estimated_minutes: customMinutes
      });
      showToast('Custom session added to timetable');
      setShowAddModal(false);
      setCustomTitle('');
      fetchTimetable();
    } catch (e: any) {
      showToast(e.message || 'Failed to add custom session');
    } finally {
      setAddingCustom(false);
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTasks = tasks.filter(t => t.scheduled_date === todayStr);
  const totalMinsToday = todayTasks.reduce((sum, t) => sum + (t.estimated_minutes || 45), 0);
  const completedMinsToday = todayTasks.filter(t => t.status === 'completed').reduce((sum, t) => sum + (t.estimated_minutes || 45), 0);
  const missedTasks = tasks.filter(t => t.missed === 1 && t.status !== 'completed');

  // Filter tasks for active view
  const filteredTasks = tasks.filter(t => {
    if (activityFilter !== 'all' && t.activity_type !== activityFilter) return false;
    if (statusFilter === 'pending' && t.status === 'completed') return false;
    if (statusFilter === 'completed' && t.status !== 'completed') return false;
    if (statusFilter === 'missed' && t.missed !== 1) return false;
    if (viewMode === 'daily') {
      return t.scheduled_date === selectedDate;
    }
    return true;
  });

  const getActivityBadge = (type?: string) => {
    switch (type) {
      case 'class':
      case 'ai_class':
      case 'learn_concept':
        return { label: 'Interactive AI Class', bg: 'rgba(10, 108, 158, 0.15)', color: 'var(--accent)', icon: 'sparkles' };
      case 'practice':
      case 'practice_questions':
        return { label: 'Topic Practice Drill', bg: 'rgba(27, 133, 83, 0.15)', color: 'var(--good)', icon: 'check-circle' };
      case 'revision':
        return { label: 'Spaced Revision', bg: 'rgba(168, 107, 0, 0.15)', color: 'var(--amber)', icon: 'refresh' };
      case 'mock_test':
        return { label: 'CBT Mock Exam', bg: 'rgba(194, 59, 48, 0.15)', color: 'var(--crit)', icon: 'test' };
      default:
        return { label: 'Study Session', bg: 'var(--surface2)', color: 'var(--muted)', icon: 'book' };
    }
  };

  // Helper for shifting daily date
  const shiftDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  // Generate 7 days for weekly view
  const getWeekDates = () => {
    const d = new Date(selectedDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(d.setDate(diff));
    const week = [];
    for (let i = 0; i < 7; i++) {
      const wDay = new Date(monday);
      wDay.setDate(monday.getDate() + i);
      week.push(wDay.toISOString().slice(0, 10));
    }
    return week;
  };

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  if (!activeExam) {
    return (
      <div className="view-container" style={{ padding: '40px 24px', maxWidth: '800px', margin: '40px auto', textAlign: 'center' }}>
        <div className="card" style={{ padding: '48px 32px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏱️</div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 10px' }}>No Active Examination Selected</h2>
          <p style={{ color: 'var(--muted)', fontSize: '14px', maxWidth: '480px', margin: '0 auto 24px' }}>
            Please select or configure your target examination to generate your personalized timetable and scheduled study sessions.
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
      {/* Top Header & Exam Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>⏱️</span>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>Timetable & Scheduled Sessions</h1>
          </div>
          <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: '14px' }}>
            {activeExam ? `Personalized daily & weekly schedule for ${activeExam.exam_name}. Zero overlaps, balanced sitting chunks.` : 'Target Examination Timetable'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            className="btn secondary"
            onClick={() => onNavigate('planner')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
          >
            <Icon name="calendar" size={15} /> AI Study Planner
          </button>
          <button
            className="btn primary"
            onClick={() => setShowAddModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
          >
            <Icon name="plus" size={15} /> Add Custom Session
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(10, 108, 158, 0.12)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="clock" size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Today's Target</div>
            <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '2px' }}>
              {Math.round(completedMinsToday / 60 * 10) / 10} / {Math.round(totalMinsToday / 60 * 10) / 10} hrs
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(27, 133, 83, 0.12)', color: 'var(--good)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check-circle" size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Today's Sessions</div>
            <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '2px' }}>
              {todayTasks.filter(t => t.status === 'completed').length} / {todayTasks.length} Done
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(168, 107, 0, 0.12)', color: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="refresh" size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Schedule</div>
            <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '2px' }}>
              {tasks.length} Sessions Planned
            </div>
          </div>
        </div>

        {missedTasks.length > 0 && (
          <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderColor: 'var(--amber)', background: 'var(--amber-soft)' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--amber)', fontWeight: 700, textTransform: 'uppercase' }}>Adaptive Alert</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)' }}>
                {missedTasks.length} Missed Sessions Detected
              </div>
            </div>
            <button
              className="btn sm"
              style={{ background: 'var(--amber)', color: '#fff', border: 0 }}
              onClick={() => onNavigate('smart_recovery')}
            >
              Smart Replan
            </button>
          </div>
        )}
      </div>

      {/* Controls Bar: View Modes & Date Navigation */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        {/* View Switcher */}
        <div style={{ display: 'flex', gap: '6px', background: 'var(--surface2)', padding: '4px', borderRadius: '10px' }}>
          <button
            className={`btn sm ${viewMode === 'daily' ? 'primary' : 'secondary'}`}
            style={{ padding: '6px 14px', fontSize: '13px' }}
            onClick={() => setViewMode('daily')}
          >
            Daily View
          </button>
          <button
            className={`btn sm ${viewMode === 'weekly' ? 'primary' : 'secondary'}`}
            style={{ padding: '6px 14px', fontSize: '13px' }}
            onClick={() => setViewMode('weekly')}
          >
            Weekly Grid
          </button>
          <button
            className={`btn sm ${viewMode === 'monthly' ? 'primary' : 'secondary'}`}
            style={{ padding: '6px 14px', fontSize: '13px' }}
            onClick={() => setViewMode('monthly')}
          >
            Full Timeline
          </button>
        </div>

        {/* Date Navigator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button className="iconbtn" onClick={() => shiftDate(viewMode === 'weekly' ? -7 : -1)} title="Previous">
            <Icon name="chevron-left" size={16} />
          </button>
          <span style={{ fontSize: '14px', fontWeight: 700, minWidth: '130px', textAlign: 'center' }}>
            {viewMode === 'daily'
              ? (selectedDate === todayStr ? `Today (${selectedDate})` : selectedDate)
              : `Week of ${getWeekDates()[0]}`}
          </span>
          <button className="iconbtn" onClick={() => shiftDate(viewMode === 'weekly' ? 7 : 1)} title="Next">
            <Icon name="chevron-right" size={16} />
          </button>
          {selectedDate !== todayStr && (
            <button className="btn sm secondary" onClick={() => setSelectedDate(todayStr)} style={{ fontSize: '12px' }}>
              Jump to Today
            </button>
          )}
        </div>

        {/* Filter dropdowns */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <select
            value={activityFilter}
            onChange={e => setActivityFilter(e.target.value)}
            style={{ height: '34px', fontSize: '13px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--surface)' }}
          >
            <option value="all">All Activities</option>
            <option value="class">AI Classes</option>
            <option value="practice">Topic Practice</option>
            <option value="revision">Spaced Revision</option>
            <option value="mock_test">Mock Exams</option>
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ height: '34px', fontSize: '13px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--surface)' }}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="missed">Missed</option>
          </select>
        </div>
      </div>

      {/* Main Timetable Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--muted)' }}>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>Loading your personalized timetable...</div>
        </div>
      ) : tasks.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '50px 20px', maxWidth: '600px', margin: '40px auto' }}>
          <div style={{ fontSize: '42px', marginBottom: '14px' }}>📅</div>
          <h2 style={{ fontSize: '20px', fontWeight: 800 }}>No Timetable Generated Yet</h2>
          <p style={{ color: 'var(--muted)', fontSize: '14px', margin: '10px 0 20px', lineHeight: 1.6 }}>
            StudyPilot automatically creates your date-wise and time-slotted study timetable once your syllabus is confirmed.
          </p>
          <button className="btn primary" onClick={() => onNavigate('planner')}>
            <Icon name="sparkles" size={16} /> Generate AI Study Plan & Timetable
          </button>
        </div>
      ) : viewMode === 'daily' ? (
        /* DAILY VIEW: Chronological Slots */
        <div>
          {filteredTasks.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>No study sessions scheduled for {selectedDate}.</div>
              <p style={{ fontSize: '13px', marginTop: '6px' }}>Take rest, revise previous flashcards, or add a custom study session above!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredTasks.map((t, idx) => {
                const badge = getActivityBadge(t.activity_type);
                const isCompleted = t.status === 'completed';
                const isMissed = t.missed === 1 && !isCompleted;

                return (
                  <div
                    key={t.id}
                    className="card"
                    style={{
                      padding: '16px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '14px',
                      borderLeft: `4px solid ${t.subject_color || badge.color}`,
                      opacity: isCompleted ? 0.75 : 1,
                      background: isCompleted ? 'var(--surface2)' : 'var(--surface)'
                    }}
                  >
                    {/* Time Slot & Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: '220px' }}>
                      <div style={{ textAlign: 'center', minWidth: '95px' }}>
                        <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--ink)' }}>
                          {t.start_time || '09:00'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                          to {t.end_time || '09:45'} ({t.estimated_minutes || 45}m)
                        </div>
                      </div>

                      <div>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: badge.bg,
                            color: badge.color
                          }}
                        >
                          <Icon name={badge.icon as any} size={12} />
                          {badge.label}
                        </span>
                        <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                          {t.subject_name} {t.unit_name ? `• ${t.unit_name}` : ''}
                        </div>
                      </div>
                    </div>

                    {/* Topic Title & Description */}
                    <div style={{ flex: '1 1 280px' }}>
                      <div style={{ fontSize: '15px', fontWeight: 700, textDecoration: isCompleted ? 'line-through' : 'none', color: isCompleted ? 'var(--muted)' : 'var(--ink)' }}>
                        {t.title || t.topic_name}
                      </div>
                      {t.notes && (
                        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '500px' }}>
                          {t.notes}
                        </div>
                      )}
                    </div>

                    {/* Actions & Completion */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {/* Contextual Action Button */}
                      {!isCompleted && (
                        t.activity_type === 'class' || t.activity_type === 'ai_class' || t.activity_type === 'learn_concept' ? (
                          <button
                            className="btn sm primary"
                            onClick={() => onOpenTopicStudio ? onOpenTopicStudio(t.topic_id) : onNavigate('ai_learning_studio')}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            <Icon name="sparkles" size={13} /> Attend Class
                          </button>
                        ) : t.activity_type === 'practice' || t.activity_type === 'practice_questions' ? (
                          <button
                            className="btn sm"
                            style={{ background: 'var(--good)', color: '#fff', border: 0, display: 'flex', alignItems: 'center', gap: '6px' }}
                            onClick={() => onLaunchPractice ? onLaunchPractice(t.topic_id) : onNavigate('practice')}
                          >
                            <Icon name="play" size={13} /> Practice
                          </button>
                        ) : t.activity_type === 'mock_test' ? (
                          <button
                            className="btn sm danger"
                            onClick={() => onLaunchTest ? onLaunchTest() : onNavigate('mock_config')}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            <Icon name="test" size={13} /> Start Mock
                          </button>
                        ) : (
                          <button
                            className="btn sm secondary"
                            onClick={() => onOpenTopicStudio ? onOpenTopicStudio(t.topic_id) : onNavigate('ai_learning_studio')}
                          >
                            Study
                          </button>
                        )
                      )}

                      {/* Checkbox Complete */}
                      <button
                        className={`btn sm ${isCompleted ? 'secondary' : 'secondary'}`}
                        onClick={() => handleToggleTask(t.id)}
                        title={isCompleted ? 'Mark Pending' : 'Mark Completed'}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
                      >
                        <Icon name={isCompleted ? 'check' : 'circle'} size={14} />
                        {isCompleted ? 'Done' : 'Complete'}
                      </button>

                      {/* Reschedule Button */}
                      <button
                        className="iconbtn"
                        onClick={() => handleOpenReschedule(t)}
                        title="Reschedule session"
                      >
                        <Icon name="calendar" size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : viewMode === 'weekly' ? (
        /* WEEKLY VIEW: 7 Day Grid */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px', overflowX: 'auto', minWidth: '950px' }}>
          {getWeekDates().map((wDate, idx) => {
            const dayTasks = tasks.filter(t => t.scheduled_date === wDate);
            const isToday = wDate === todayStr;

            return (
              <div
                key={wDate}
                className="card"
                style={{
                  padding: '12px',
                  minHeight: '400px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  background: isToday ? 'rgba(10, 108, 158, 0.04)' : 'var(--surface)',
                  borderColor: isToday ? 'var(--accent)' : 'var(--line)'
                }}
              >
                {/* Day Header */}
                <div style={{ textAlign: 'center', borderBottom: '1px solid var(--line)', paddingBottom: '8px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: isToday ? 'var(--accent)' : 'var(--muted)', textTransform: 'uppercase' }}>
                    {weekDays[idx]}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 800, marginTop: '2px', color: isToday ? 'var(--accent)' : 'var(--ink)' }}>
                    {wDate.slice(8, 10)}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
                    {dayTasks.length} sessions
                  </div>
                </div>

                {/* Day Task Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
                  {dayTasks.map(t => {
                    const badge = getActivityBadge(t.activity_type);
                    const isDone = t.status === 'completed';

                    return (
                      <div
                        key={t.id}
                        onClick={() => {
                          setSelectedDate(wDate);
                          setViewMode('daily');
                        }}
                        style={{
                          padding: '8px',
                          borderRadius: '8px',
                          background: isDone ? 'var(--surface2)' : 'var(--surface)',
                          border: `1px solid ${isDone ? 'var(--line)' : badge.color}`,
                          borderLeftWidth: '3px',
                          cursor: 'pointer',
                          opacity: isDone ? 0.7 : 1
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '10px', fontWeight: 800, color: badge.color }}>
                            {t.start_time || '09:00'}
                          </span>
                          {isDone && <span style={{ fontSize: '10px', color: 'var(--good)' }}>✓</span>}
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: 700, marginTop: '3px', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.title || t.topic_name}
                        </div>
                        <div style={{ fontSize: '9px', color: 'var(--muted)', marginTop: '2px' }}>
                          {t.subject_name}
                        </div>
                      </div>
                    );
                  })}
                  {dayTasks.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '11px', marginTop: '40px' }}>
                      Rest day
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* FULL TIMELINE / MONTHLY VIEW */
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '16px' }}>Preparation Roadmap & Upcoming Milestones</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {Array.from(new Set(tasks.map(t => t.scheduled_date))).sort().slice(0, 30).map(dateStr => {
              const dTasks = tasks.filter(t => t.scheduled_date === dateStr);
              const isToday = dateStr === todayStr;

              return (
                <div
                  key={dateStr}
                  style={{
                    display: 'flex',
                    gap: '16px',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    background: isToday ? 'rgba(10, 108, 158, 0.08)' : 'var(--surface2)',
                    alignItems: 'center',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ minWidth: '110px', fontWeight: 800, fontSize: '13px', color: isToday ? 'var(--accent)' : 'var(--ink)' }}>
                    {isToday ? `Today (${dateStr})` : dateStr}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
                    {dTasks.map(t => {
                      const badge = getActivityBadge(t.activity_type);
                      return (
                        <span
                          key={t.id}
                          onClick={() => { setSelectedDate(dateStr); setViewMode('daily'); }}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            background: badge.bg,
                            color: badge.color,
                            border: '1px solid transparent'
                          }}
                        >
                          {t.start_time ? `${t.start_time}: ` : ''}{t.title || t.topic_name} {t.status === 'completed' ? '✓' : ''}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleTask && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setRescheduleTask(null); }}>
          <div className="modal" style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Reschedule Session</h3>
              <button className="iconbtn" onClick={() => setRescheduleTask(null)}><Icon name="x" size={16} /></button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>
              Moving <b>{rescheduleTask.title || rescheduleTask.topic_name}</b> ({rescheduleTask.subject_name})
            </p>

            <form className="form" onSubmit={handleSaveReschedule}>
              <label className="f">
                New Scheduled Date
                <input
                  type="date"
                  required
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label className="f">
                  Start Time
                  <input
                    type="time"
                    required
                    value={newStartTime}
                    onChange={e => setNewStartTime(e.target.value)}
                  />
                </label>
                <label className="f">
                  End Time
                  <input
                    type="time"
                    required
                    value={newEndTime}
                    onChange={e => setNewEndTime(e.target.value)}
                  />
                </label>
              </div>

              <div className="formactions" style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn secondary" onClick={() => setRescheduleTask(null)}>Cancel</button>
                <button type="submit" className="btn primary" disabled={rescheduling}>
                  {rescheduling ? 'Saving...' : 'Confirm Reschedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Custom Session Modal */}
      {showAddModal && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}>
          <div className="modal" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Add Custom Session</h3>
              <button className="iconbtn" onClick={() => setShowAddModal(false)}><Icon name="x" size={16} /></button>
            </div>

            <form className="form" onSubmit={handleAddCustomSession}>
              <label className="f">
                Session Title
                <input
                  type="text"
                  required
                  placeholder="e.g. Special Problem Solving on Thermodynamics"
                  value={customTitle}
                  onChange={e => setCustomTitle(e.target.value)}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label className="f">
                  Activity Type
                  <select value={customActivity} onChange={e => setCustomActivity(e.target.value)}>
                    <option value="class">AI Interactive Class</option>
                    <option value="practice">Topic Practice Drill</option>
                    <option value="revision">Spaced Revision</option>
                    <option value="mock_test">CBT Mock Assessment</option>
                  </select>
                </label>
                <label className="f">
                  Duration (Mins)
                  <input
                    type="number"
                    min={15}
                    max={180}
                    value={customMinutes}
                    onChange={e => setCustomMinutes(parseInt(e.target.value, 10) || 45)}
                  />
                </label>
              </div>

              <label className="f">
                Date
                <input
                  type="date"
                  required
                  value={customDate}
                  onChange={e => setCustomDate(e.target.value)}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label className="f">
                  Start Time
                  <input
                    type="time"
                    required
                    value={customStartTime}
                    onChange={e => setCustomStartTime(e.target.value)}
                  />
                </label>
                <label className="f">
                  End Time
                  <input
                    type="time"
                    required
                    value={customEndTime}
                    onChange={e => setCustomEndTime(e.target.value)}
                  />
                </label>
              </div>

              <div className="formactions" style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn primary" disabled={addingCustom}>
                  {addingCustom ? 'Adding...' : 'Add to Timetable'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
