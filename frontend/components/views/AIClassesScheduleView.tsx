'use client';

import React, { useState, useEffect } from 'react';
import { Exam } from '@/types';
import { api } from '@/lib/api';
import { Icon } from '../Icons';

interface AIClassesScheduleViewProps {
  token: string | null;
  activeExam: Exam | null;
  onNavigate: (view: string) => void;
  showToast: (msg: string) => void;
  onOpenClassInStudio: (topicId: string) => void;
}

interface ScheduledClass {
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

export const AIClassesScheduleView: React.FC<AIClassesScheduleViewProps> = ({
  token,
  activeExam,
  onNavigate,
  showToast,
  onOpenClassInStudio
}) => {
  const [classes, setClasses] = useState<ScheduledClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterTab, setFilterTab] = useState<'today' | 'upcoming' | 'completed' | 'all'>('today');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchClasses = async () => {
    if (!token || !activeExam) return;
    setLoading(true);
    try {
      const res = await api.getStudyPlan(token, activeExam.id);
      const allTasks: ScheduledClass[] = res.tasks || [];
      // Filter sessions that are classes or concept learning
      const classSessions = allTasks.filter(t => 
        t.activity_type === 'class' || 
        t.activity_type === 'ai_class' || 
        t.activity_type === 'learn_concept' || 
        !t.activity_type
      );
      setClasses(classSessions);
    } catch (e: any) {
      showToast(e.message || 'Failed to load scheduled classes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, [token, activeExam?.id]);

  const handleToggleClassDone = async (classId: string, currentStatus: string) => {
    if (!token) return;
    try {
      const res = await api.toggleStudyTask(token, classId);
      setClasses(prev => prev.map(c => c.id === classId ? { ...c, status: res.status } : c));
      showToast(res.status === 'completed' ? 'Class marked completed!' : 'Class marked pending.');
    } catch (e: any) {
      showToast(e.message || 'Failed to update class status');
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayClasses = classes.filter(c => c.scheduled_date === todayStr);
  const upcomingClasses = classes.filter(c => c.scheduled_date > todayStr && c.status !== 'completed');
  const completedClasses = classes.filter(c => c.status === 'completed');

  const displayedClasses = classes.filter(c => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match = (c.topic_name || '').toLowerCase().includes(q) ||
                    (c.subject_name || '').toLowerCase().includes(q) ||
                    (c.unit_name || '').toLowerCase().includes(q) ||
                    (c.title || '').toLowerCase().includes(q);
      if (!match) return false;
    }

    if (filterTab === 'today') return c.scheduled_date === todayStr;
    if (filterTab === 'upcoming') return c.scheduled_date >= todayStr && c.status !== 'completed';
    if (filterTab === 'completed') return c.status === 'completed';
    return true;
  });

  if (!activeExam) {
    return (
      <div className="view-container" style={{ padding: '40px 24px', maxWidth: '800px', margin: '40px auto', textAlign: 'center' }}>
        <div className="card" style={{ padding: '48px 32px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎓</div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 10px' }}>No Active Examination Selected</h2>
          <p style={{ color: 'var(--muted)', fontSize: '14px', maxWidth: '480px', margin: '0 auto 24px' }}>
            Please select or configure your target examination to access scheduled AI interactive classes.
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
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>🎓</span>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>AI Scheduled Interactive Classes</h1>
          </div>
          <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: '14px' }}>
            {activeExam ? `Personalized lecture schedule for ${activeExam.exam_name}. Every class opens into an interactive AI teaching studio with examples, diagrams, formulas, and continuous tutor support.` : 'AI Scheduled Classes'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="btn secondary"
            onClick={() => onNavigate('timetable')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
          >
            <Icon name="clock" size={15} /> View Full Timetable
          </button>
          <button
            className="btn primary"
            onClick={() => onNavigate('planner')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
          >
            <Icon name="sparkles" size={15} /> Plan & Schedule Classes
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(10, 108, 158, 0.12)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="play" size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Today's Classes</div>
            <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '2px' }}>
              {todayClasses.length} Scheduled
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(27, 133, 83, 0.12)', color: 'var(--good)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check-circle" size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Completed Classes</div>
            <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '2px' }}>
              {completedClasses.length} Completed
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(168, 107, 0, 0.12)', color: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="calendar" size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Upcoming Lectures</div>
            <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '2px' }}>
              {upcomingClasses.length} In Queue
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(90, 106, 125, 0.12)', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="sparkles" size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Teaching Engine</div>
            <div style={{ fontSize: '14px', fontWeight: 800, marginTop: '4px', color: 'var(--ink)' }}>
              Dual Heuristic + LLM
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="card" style={{ padding: '12px 18px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '6px', background: 'var(--surface2)', padding: '4px', borderRadius: '10px' }}>
          <button
            className={`btn sm ${filterTab === 'today' ? 'primary' : 'secondary'}`}
            style={{ fontSize: '13px', padding: '6px 14px' }}
            onClick={() => setFilterTab('today')}
          >
            Today ({todayClasses.length})
          </button>
          <button
            className={`btn sm ${filterTab === 'upcoming' ? 'primary' : 'secondary'}`}
            style={{ fontSize: '13px', padding: '6px 14px' }}
            onClick={() => setFilterTab('upcoming')}
          >
            Upcoming ({upcomingClasses.length})
          </button>
          <button
            className={`btn sm ${filterTab === 'completed' ? 'primary' : 'secondary'}`}
            style={{ fontSize: '13px', padding: '6px 14px' }}
            onClick={() => setFilterTab('completed')}
          >
            Completed ({completedClasses.length})
          </button>
          <button
            className={`btn sm ${filterTab === 'all' ? 'primary' : 'secondary'}`}
            style={{ fontSize: '13px', padding: '6px 14px' }}
            onClick={() => setFilterTab('all')}
          >
            All Classes ({classes.length})
          </button>
        </div>

        <div style={{ minWidth: '240px' }}>
          <input
            type="text"
            placeholder="Search classes by topic, subject or unit..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', height: '36px', fontSize: '13px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--surface)' }}
          />
        </div>
      </div>

      {/* Class List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--muted)' }}>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>Loading scheduled AI classes...</div>
        </div>
      ) : classes.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '50px 20px', maxWidth: '600px', margin: '40px auto' }}>
          <div style={{ fontSize: '42px', marginBottom: '14px' }}>🎓</div>
          <h2 style={{ fontSize: '20px', fontWeight: 800 }}>No AI Classes Scheduled Yet</h2>
          <p style={{ color: 'var(--muted)', fontSize: '14px', margin: '10px 0 20px', lineHeight: 1.6 }}>
            Once you confirm your syllabus, StudyPilot automatically schedules interactive classes across your entire preparation calendar.
          </p>
          <button className="btn primary" onClick={() => onNavigate('planner')}>
            <Icon name="sparkles" size={16} /> Auto-Generate Schedule & Classes
          </button>
        </div>
      ) : displayedClasses.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
          <div style={{ fontSize: '15px', fontWeight: 600 }}>No classes found matching this filter.</div>
          <p style={{ fontSize: '13px', marginTop: '6px' }}>Switch tabs or clear your search query to see scheduled classes.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
          {displayedClasses.map(c => {
            const isDone = c.status === 'completed';
            const isToday = c.scheduled_date === todayStr;

            return (
              <div
                key={c.id}
                className="card"
                style={{
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderTop: `4px solid ${c.subject_color || 'var(--accent)'}`,
                  opacity: isDone ? 0.8 : 1,
                  background: isDone ? 'var(--surface2)' : 'var(--surface)'
                }}
              >
                <div>
                  {/* Top Bar: Subject & Date badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: 'rgba(10, 108, 158, 0.1)',
                        color: 'var(--accent)'
                      }}
                    >
                      {c.subject_name}
                    </span>

                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: isToday ? 'var(--accent)' : 'var(--muted)',
                        backgroundColor: isToday ? 'rgba(10, 108, 158, 0.12)' : 'var(--surface2)',
                        padding: '3px 8px',
                        borderRadius: '6px'
                      }}
                    >
                      {isToday ? `Today at ${c.start_time || '09:00'}` : `${c.scheduled_date} (${c.start_time || '09:00'})`}
                    </span>
                  </div>

                  {/* Title & Topic */}
                  <h3 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: 800, color: 'var(--ink)' }}>
                    {c.title || `AI Class: ${c.topic_name}`}
                  </h3>

                  {c.unit_name && (
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>
                      Unit: {c.unit_name}
                    </div>
                  )}

                  <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 16px', lineHeight: 1.5 }}>
                    {c.notes || `Interactive concept breakdown, step-by-step worked examples, visual explanations, and comprehension checks.`}
                  </p>

                  {/* Session Duration & Learning Objectives */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px', color: 'var(--muted)', marginBottom: '18px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Icon name="clock" size={13} /> {c.estimated_minutes || 45} mins
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Icon name="sparkles" size={13} /> Interactive Studio
                    </span>
                    {isDone ? (
                      <span style={{ color: 'var(--good)', fontWeight: 700 }}>✓ Completed</span>
                    ) : (
                      <span style={{ color: 'var(--amber)', fontWeight: 600 }}>● Pending</span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', borderTop: '1px solid var(--line)', paddingTop: '14px' }}>
                  <button
                    className="btn primary"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px' }}
                    onClick={() => onOpenClassInStudio(c.topic_id)}
                  >
                    <Icon name="sparkles" size={15} /> Attend AI Class
                  </button>

                  <button
                    className="btn secondary"
                    style={{ fontSize: '12px' }}
                    onClick={() => handleToggleClassDone(c.id, c.status)}
                    title={isDone ? 'Mark as Pending' : 'Mark as Completed'}
                  >
                    {isDone ? 'Done ✓' : 'Mark Done'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
