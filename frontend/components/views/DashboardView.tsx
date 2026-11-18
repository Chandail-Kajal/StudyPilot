'use client';

import React, { useState, useEffect } from 'react';
import { Exam, User, Task } from '@/types';
import { api } from '@/lib/api';
import { Icon } from '../Icons';

interface DashboardViewProps {
  user: User | null;
  token: string | null;
  activeExam: Exam | null;
  allExams: Exam[];
  onSelectExam: (exam: Exam) => void;
  onNavigate: (view: string) => void;
  showToast: (msg: string) => void;
  onQuickLogin?: (email: string) => void;
  onOpenTopicInStudio?: (topicId: string) => void;
  onPreviewExtracted?: (preview: any, examId: string, fileName: string, fileFormat: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  token,
  activeExam,
  allExams,
  onSelectExam,
  onNavigate,
  showToast,
  onQuickLogin,
  onOpenTopicInStudio,
  onPreviewExtracted
}) => {
  const [stats, setStats] = useState<any>(null);
  const [dueTopics, setDueTopics] = useState<any[]>([]);
  const [scheduledTasks, setScheduledTasks] = useState<Task[]>([]);
  const [recentAttempts, setRecentAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hubFilter, setHubFilter] = useState<'all' | 'plan' | 'learn' | 'test'>('all');
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);

  // Student Onboarding State
  const [obExamName, setObExamName] = useState('');
  const [obCategory, setObCategory] = useState('competitive');
  const [obEduLevel, setObEduLevel] = useState('competitive');
  const [obExamDate, setObExamDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [obSyllabusFile, setObSyllabusFile] = useState<File | null>(null);
  const [obCreating, setObCreating] = useState(false);
  const [obStatus, setObStatus] = useState('');
  const obFileRef = React.useRef<HTMLInputElement>(null);

  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !obExamName.trim()) return;
    setObCreating(true);
    setObStatus('Setting up examination goal...');

    try {
      if (obSyllabusFile) {
        setObStatus('AI analyzing curriculum and topics...');
        const formData = new FormData();
        formData.append('exam_name', obExamName.trim());
        if (obExamDate) formData.append('exam_date', obExamDate);
        formData.append('exam_category', obCategory);
        formData.append('education_level', obEduLevel);
        formData.append('file', obSyllabusFile);

        const res = await api.createExamWithSyllabus(token, formData);
        onSelectExam(res.exam);

        if (res.preview && onPreviewExtracted) {
          showToast(`Exam created! AI extracted ${res.preview.summary?.total_rows || 0} syllabus topics.`);
          onPreviewExtracted(res.preview, res.exam.id, res.file_name || obSyllabusFile.name, res.file_format || 'pdf');
          onNavigate('import_preview');
          return;
        } else {
          showToast(res.message || 'Onboarding complete! Examination profile activated.');
        }
      } else {
        const res = await api.createExam(token, {
          exam_name: obExamName.trim(),
          exam_category: obCategory,
          education_level: obEduLevel,
          exam_date: obExamDate || undefined,
          learning_preferences: {
            explanation_depth: 'balanced'
          }
        });
        showToast(res.message || 'Onboarding complete! Examination profile activated.');
        if (res.exam) onSelectExam(res.exam);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to complete onboarding');
    } finally {
      setObCreating(false);
      setObStatus('');
    }
  };

  useEffect(() => {
    if (!token || !activeExam) return;
    setLoading(true);

    Promise.all([
      api.getExamAnalytics(token, activeExam.id).catch(() => null),
      api.getDueRevisions(token, activeExam.id).catch(() => ({ due_topics: [] })),
      api.getStudyPlan(token, activeExam.id).catch(() => ({ tasks: [] })),
      api.getExamTestsHistory(token, activeExam.id).catch(() => ({ attempts: [] }))
    ]).then(([analyticsData, revisionData, planData, historyData]) => {
      if (analyticsData) setStats(analyticsData);
      if (revisionData?.due_topics) setDueTopics(revisionData.due_topics.slice(0, 5));
      if (planData?.tasks) setScheduledTasks(planData.tasks.filter((t: any) => t.status === 'pending').slice(0, 4));
      if (historyData?.attempts) setRecentAttempts(historyData.attempts.slice(0, 3));
      setLoading(false);
    });
  }, [token, activeExam]);

  const handleToggleTask = async (taskId: string) => {
    if (!token) return;
    setCompletingTaskId(taskId);
    try {
      await api.toggleStudyTask(token, taskId);
      setTimeout(() => {
        setScheduledTasks(prev => prev.filter(t => t.id !== taskId));
        setCompletingTaskId(null);
      }, 220);
      showToast('Task marked as completed!');
    } catch (e: any) {
      setCompletingTaskId(null);
      showToast(e.message || 'Failed to update task');
    }
  };

  const daysUntilExam = activeExam?.exam_date
    ? Math.max(0, Math.ceil((new Date(activeExam.exam_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (!user || !token) {
    return (
      <div className="view-container" style={{ padding: '40px 24px', maxWidth: '800px', margin: '40px auto', textAlign: 'center' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '20px', padding: '48px 32px', boxShadow: 'var(--shadow)' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', margin: '0 auto 20px' }}>
            🔒
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--ink)', marginBottom: '12px' }}>
            Private User Dashboard
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--muted)', maxWidth: '520px', margin: '0 auto 24px', lineHeight: 1.6 }}>
            Please sign in to view your personalized dashboard. Each student has a private workspace with their own syllabi, timetable, and practice records.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <button className="btn primary" onClick={() => onNavigate('account')} style={{ padding: '10px 24px', fontWeight: 700 }}>
              Sign In to Your Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="view-container" style={{ padding: '4px 0 36px 0', width: '100%' }}>
      {/* Executive Interactive Hero Banner */}
      <div className="hero-banner-pro">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', position: 'relative', zIndex: 1 }}>
          <div style={{ minWidth: 0, flex: '1 1 320px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <span className="badge badge-primary" style={{ padding: '4px 10px', fontSize: '11px' }}>
                <Icon name="sparkles" size={12} /> AI Study Command Center
              </span>
              {activeExam && (
                <span className="badge badge-outline" style={{ padding: '4px 10px', fontSize: '11px', textTransform: 'capitalize' }}>
                  {activeExam.exam_category} Target
                </span>
              )}
              {daysUntilExam !== null && (
                <span className={`badge ${daysUntilExam <= 14 ? 'badge-danger' : 'badge-success'}`} style={{ padding: '4px 10px', fontSize: '11px' }}>
                  {daysUntilExam} days left
                </span>
              )}
            </div>
            <h1 style={{ margin: 0, fontSize: 'clamp(24px, 3vw, 32px)', fontWeight: 800, color: 'var(--ink)', lineHeight: 1.15 }}>
              {getGreeting()}, {user ? user.name.split(' ')[0] : 'Scholar'}
            </h1>
            <p style={{ margin: '8px 0 0', color: 'var(--muted)', fontSize: '14.5px', maxWidth: '620px' }}>
              {activeExam
                ? `Focused on ${activeExam.exam_name}. ${dueTopics.length > 0 ? `${dueTopics.length} spaced revision${dueTopics.length > 1 ? 's' : ''} due today.` : 'Your revision queue is on track.'}`
                : 'Create your target examination or upload a syllabus to generate an adaptive AI study plan.'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              className="btn primary"
              onClick={() => onNavigate('ai_classes')}
              style={{ height: '42px', padding: '0 18px', fontWeight: 700 }}
            >
              <Icon name="sparkles" size={16} /> Launch AI Studio
            </button>
            <button
              className="btn"
              onClick={() => onNavigate('focus')}
              style={{ height: '42px', padding: '0 16px' }}
            >
              <Icon name="zap" size={15} style={{ color: 'var(--amber)' }} /> Focus Timer
            </button>
            <button
              className="btn"
              onClick={() => onNavigate('upload_syllabus')}
              style={{ height: '42px', padding: '0 16px' }}
            >
              <Icon name="upload" size={15} /> Upload Syllabus
            </button>
          </div>
        </div>
      </div>

      {/* Step 1: Student Onboarding Flow (shown when student has 0 active targets) */}
      {allExams.length === 0 && (
        <div
          className="card"
          style={{
            padding: '36px 32px',
            marginBottom: '32px',
            border: '2px solid var(--accent)',
            borderRadius: '16px',
            background: 'linear-gradient(180deg, var(--surface) 0%, var(--bg) 100%)',
            boxShadow: '0 8px 32px rgba(62, 123, 224, 0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
              🎯
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent)' }}>
                Step 1: Student Onboarding
              </div>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>Student Onboarding & Examination Setup</h2>
              <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '14px' }}>
                Configure your target education level, examination, subjects, and study availability to personalize your AI tutor and adaptive timetable.
              </p>
            </div>
          </div>

          <form onSubmit={handleCompleteOnboarding} className="form" style={{ maxWidth: '840px' }}>
            <div className="row2">
              <label className="f">
                Target Examination Name *
                <input
                  required
                  placeholder="e.g. UGC NET Computer Science, Class 12 Boards, UPSC Prelims"
                  value={obExamName}
                  onChange={(e) => setObExamName(e.target.value)}
                />
              </label>

              <label className="f">
                Target Exam Date
                <input
                  type="date"
                  value={obExamDate}
                  onChange={(e) => setObExamDate(e.target.value)}
                />
              </label>
            </div>

            <div className="row2">
              <label className="f">
                Category (Optional)
                <select
                  value={obCategory}
                  onChange={(e) => setObCategory(e.target.value)}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                >
                  <option value="competitive">Competitive Examination (NET, UPSC, GATE, NEET, JEE, Banking)</option>
                  <option value="academic">Academic Board Examination (Class 10 / 12, University)</option>
                  <option value="recruitment">Government Recruitment</option>
                  <option value="certification">Professional Certification</option>
                  <option value="custom">Self-Paced / Custom Goal</option>
                </select>
              </label>

              <label className="f">
                Upload Syllabus Document (Optional)
                <div style={{ marginTop: '4px' }}>
                  {!obSyllabusFile ? (
                    <div
                      onClick={() => obFileRef.current?.click()}
                      style={{
                        border: '2px dashed var(--border)',
                        borderRadius: '8px',
                        padding: '12px 14px',
                        background: 'var(--surface)',
                        cursor: 'pointer',
                        textAlign: 'center',
                        fontSize: '13px',
                        color: 'var(--muted)'
                      }}
                    >
                      <input
                        ref={obFileRef}
                        type="file"
                        accept=".pdf,.xlsx,.xls,.csv,.docx,.doc,.txt"
                        onChange={(e) => e.target.files?.[0] && setObSyllabusFile(e.target.files[0])}
                        style={{ display: 'none' }}
                      />
                      <span>📁 Browse PDF, Excel (.xlsx/.xls), or CSV</span>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: 'var(--surface)',
                        border: '1px solid var(--accent)'
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>📄 {obSyllabusFile.name}</span>
                      <button
                        type="button"
                        onClick={() => setObSyllabusFile(null)}
                        style={{ background: 'none', border: 0, color: 'var(--danger)', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </label>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="submit"
                className="btn primary"
                disabled={obCreating || !obExamName.trim()}
                style={{ padding: '12px 24px', fontSize: '14.5px', fontWeight: 700 }}
              >
                {obCreating ? (
                  <span>{obStatus || 'Configuring Study Agent...'}</span>
                ) : obSyllabusFile ? (
                  <span>Create & Analyze Syllabus with AI &rarr;</span>
                ) : (
                  <span>Create Examination & Start &rarr;</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Interactive Visual KPI Cards Row */}
      {(() => {
        const readinessPct = Math.min(100, Math.max(0, stats ? stats.readiness_percent : (activeExam?.readiness_percent || 0)));
        const masteredCount = stats ? stats.distribution.mastered : (activeExam?.mastered_count || 0);
        const reviewingCount = stats ? stats.distribution.reviewing : (activeExam?.in_progress_count || 0);
        const learningCount = stats ? stats.distribution.learning : 0;
        const totalTopics = Math.max(1, stats ? stats.total_topics : (activeExam?.topics_count || 0));
        const rawTotalTopics = stats ? stats.total_topics : (activeExam?.topics_count || 0);
        const ringRadius = 24;
        const ringCircumference = 2 * Math.PI * ringRadius;
        const ringOffset = ringCircumference * (1 - readinessPct / 100);

        const hubModules = [
          {
            id: 'ai_classes',
            category: 'learn' as const,
            title: 'AI Classes & Video Studio',
            desc: 'Interactive avatar lessons, animated visual diagrams, voice narration & checks',
            icon: 'sparkles',
            tintBg: 'var(--accent-soft)',
            tintColor: 'var(--accent)',
            badge: 'Live Studio'
          },
          {
            id: 'planner',
            category: 'plan' as const,
            title: 'AI Study Planner & Recovery',
            desc: 'Difficulty-weighted workload distribution, spaced milestones & auto-reschedule',
            icon: 'calendar',
            tintBg: 'var(--amber-soft)',
            tintColor: 'var(--amber)',
            badge: 'Adaptive'
          },
          {
            id: 'timetable',
            category: 'plan' as const,
            title: 'Daily & Weekly Timetable',
            desc: 'Time-slotted study blocks with instant completion & drag-and-drop control',
            icon: 'clock',
            tintBg: 'rgba(14, 165, 233, 0.12)',
            tintColor: '#0284C7',
            badge: 'Time-Blocked'
          },
          {
            id: 'manage_syllabus',
            category: 'learn' as const,
            title: 'Subjects & Syllabus',
            desc: 'Multi-format OCR upload, hierarchical unit breakdown & lesson decomposition',
            icon: 'layers',
            tintBg: 'rgba(124, 58, 237, 0.12)',
            tintColor: '#7C3AED',
            badge: `${rawTotalTopics} Topics`
          },
          {
            id: 'practice',
            category: 'test' as const,
            title: 'Practice & Assessments',
            desc: 'Adaptive topic MCQs, numerical drills, flashcards & step-by-step explanations',
            icon: 'check-circle',
            tintBg: 'var(--good-soft)',
            tintColor: 'var(--good)',
            badge: 'Drills'
          },
          {
            id: 'mock_config',
            category: 'test' as const,
            title: 'CBT Mock Examinations',
            desc: 'Timed exam-hall simulator with question palette, negative marking & grading',
            icon: 'test',
            tintBg: 'var(--crit-soft)',
            tintColor: 'var(--crit)',
            badge: 'Timed CBT'
          },
          {
            id: 'pyp_library',
            category: 'test' as const,
            title: 'Past Papers & AI Predictions',
            desc: 'Previous-year paper archive, topic recurrence trends & AI predicted sets',
            icon: 'file-text',
            tintBg: 'var(--amber-soft)',
            tintColor: 'var(--amber)',
            badge: 'PYP Trends'
          },
          {
            id: 'analytics',
            category: 'test' as const,
            title: 'Progress & Analytics',
            desc: 'Retention diagnostics, subject mastery heatmaps & AI strategy insights',
            icon: 'bar-chart',
            tintBg: 'rgba(99, 102, 241, 0.13)',
            tintColor: '#6366F1',
            badge: 'Insights'
          }
        ];

        const visibleModules = hubFilter === 'all' ? hubModules : hubModules.filter(m => m.category === hubFilter);

        return (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                gap: '16px',
                marginBottom: '28px'
              }}
            >
              {/* KPI 1: Exam Readiness Ring */}
              <div className="kpi-card-pro" onClick={() => onNavigate('analytics')} role="button" tabIndex={0}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Exam Readiness
                    </div>
                    <div className="mono" style={{ fontSize: '30px', fontWeight: 800, color: 'var(--ink)', marginTop: '6px', lineHeight: 1 }}>
                      {readinessPct}%
                    </div>
                  </div>
                  <svg width="60" height="60" viewBox="0 0 60 60" style={{ flexShrink: 0 }}>
                    <circle cx="30" cy="30" r={ringRadius} fill="none" stroke="var(--line)" strokeWidth="5.5" />
                    <circle
                      cx="30"
                      cy="30"
                      r={ringRadius}
                      fill="none"
                      stroke="var(--good)"
                      strokeWidth="5.5"
                      strokeLinecap="round"
                      strokeDasharray={ringCircumference}
                      strokeDashoffset={ringOffset}
                      transform="rotate(-90 30 30)"
                      style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.22, 1, 0.36, 1)' }}
                    />
                  </svg>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'var(--muted)', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--line)' }}>
                  <span>Spaced retention score</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Analytics &rarr;</span>
                </div>
              </div>

              {/* KPI 2: Countdown to Exam */}
              <div className="kpi-card-pro" onClick={() => onNavigate('planner')} role="button" tabIndex={0}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Exam Countdown
                  </span>
                  <span className="hub-icon-box" style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                    <Icon name="calendar" size={16} />
                  </span>
                </div>
                <div className="mono" style={{ fontSize: '30px', fontWeight: 800, color: 'var(--ink)', marginTop: '8px', lineHeight: 1.1 }}>
                  {daysUntilExam !== null ? `${daysUntilExam}` : '--'}{' '}
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--muted)', fontFamily: 'var(--f-body)' }}>
                    {daysUntilExam !== null ? 'days left' : 'Not set'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'var(--muted)', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--line)' }}>
                  <span>Target: {activeExam?.exam_date || 'Flexible'}</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Planner &rarr;</span>
                </div>
              </div>

              {/* KPI 3: Syllabus Mastery Breakdown */}
              <div className="kpi-card-pro" onClick={() => onNavigate('manage_syllabus')} role="button" tabIndex={0}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Syllabus Mastery
                  </span>
                  <span className="hub-icon-box" style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'var(--good-soft)', color: 'var(--good)' }}>
                    <Icon name="check-circle" size={16} />
                  </span>
                </div>
                <div className="mono" style={{ fontSize: '30px', fontWeight: 800, color: 'var(--ink)', marginTop: '8px', lineHeight: 1.1 }}>
                  {masteredCount}{' '}
                  <span style={{ fontSize: '15px', color: 'var(--muted)', fontWeight: 600 }}>/ {rawTotalTopics}</span>
                </div>
                <div style={{ display: 'flex', gap: '3px', height: '6px', borderRadius: '99px', overflow: 'hidden', background: 'var(--surface2)', marginTop: '12px' }}>
                  <div style={{ width: `${(masteredCount / totalTopics) * 100}%`, background: 'var(--good)', transition: 'width 0.4s ease' }} />
                  <div style={{ width: `${(reviewingCount / totalTopics) * 100}%`, background: 'var(--accent)', transition: 'width 0.4s ease' }} />
                  <div style={{ width: `${(learningCount / totalTopics) * 100}%`, background: 'var(--amber)', transition: 'width 0.4s ease' }} />
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
                  {reviewingCount} reviewing &middot; {learningCount} learning
                </div>
              </div>

              {/* KPI 4: Daily Focus Target */}
              <div className="kpi-card-pro" onClick={() => onNavigate('focus')} role="button" tabIndex={0}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Daily Study Goal
                  </span>
                  <span className="hub-icon-box" style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'var(--amber-soft)', color: 'var(--amber)' }}>
                    <Icon name="zap" size={16} />
                  </span>
                </div>
                <div className="mono" style={{ fontSize: '30px', fontWeight: 800, color: 'var(--ink)', marginTop: '8px', lineHeight: 1.1 }}>
                  {user?.goal_mins || 180}{' '}
                  <span style={{ fontSize: '14px', color: 'var(--muted)', fontWeight: 600, fontFamily: 'var(--f-body)' }}>mins/day</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'var(--muted)', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--line)' }}>
                  <span>{user?.sitting_capacity_mins || 45}m focus blocks</span>
                  <span style={{ color: 'var(--amber)', fontWeight: 600 }}>Start Timer &rarr;</span>
                </div>
              </div>
            </div>

            {/* Interactive Examination Preparation Hub with Category Filter */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '19px', fontWeight: 800, color: 'var(--ink)' }}>Preparation Workspace</h2>
                  <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>
                    Jump into AI lessons, schedules, adaptive drills, or timed CBT simulations
                  </p>
                </div>

                <div className="filter-tab-bar" role="tablist" aria-label="Filter preparation modules">
                  {[
                    { key: 'all', label: 'All Tools' },
                    { key: 'plan', label: 'Plan & Schedule' },
                    { key: 'learn', label: 'Learn with AI' },
                    { key: 'test', label: 'Test & Analyze' }
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      role="tab"
                      aria-selected={hubFilter === tab.key}
                      className={`filter-tab-btn ${hubFilter === tab.key ? 'active' : ''}`}
                      onClick={() => setHubFilter(tab.key as any)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: '14px'
                }}
              >
                {visibleModules.map((mod) => (
                  <button
                    key={mod.id}
                    className="hub-card-pro"
                    onClick={() => onNavigate(mod.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', width: '100%' }}>
                      <div className="hub-icon-box" style={{ background: mod.tintBg, color: mod.tintColor }}>
                        <Icon name={mod.icon} size={22} />
                      </div>
                      <span className="badge badge-outline" style={{ fontSize: '10.5px' }}>{mod.badge}</span>
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--ink)' }}>{mod.title}</div>
                        <span className="hub-arrow">
                          <Icon name="arrow-right" size={16} />
                        </span>
                      </div>
                      <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: '5px', lineHeight: 1.45 }}>
                        {mod.desc}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        );
      })()}

      {/* Main Two Interactive Columns: Upcoming Tasks & Spaced Revision Queue */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        {/* Scheduled Tasks for Today */}
        <div className="card" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="hub-icon-box" style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                <Icon name="calendar" size={16} />
              </span>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>
                  Upcoming Study Tasks
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  {scheduledTasks.length} pending in your active queue
                </div>
              </div>
            </div>
            <button className="btn btn-sm" onClick={() => onNavigate('planner')}>
              Planner &rarr;
            </button>
          </div>

          {scheduledTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--muted)', border: '1px dashed var(--line)', borderRadius: '14px', background: 'var(--surface2)' }}>
              <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', background: 'var(--good-soft)', color: 'var(--good)', marginBottom: '10px' }}>
                <Icon name="check" size={22} />
              </div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>All caught up!</p>
              <p style={{ fontSize: '12.5px', marginTop: '4px' }}>No pending study tasks scheduled right now.</p>
              <button className="btn btn-sm primary" onClick={() => onNavigate('planner')} style={{ marginTop: '12px' }}>
                Generate Study Plan
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {scheduledTasks.map(t => {
                const isCompleting = completingTaskId === t.id;
                return (
                  <div
                    key={t.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      background: 'var(--surface2)',
                      border: '1px solid var(--line)',
                      opacity: isCompleting ? 0.45 : 1,
                      transform: isCompleting ? 'scale(0.98)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <button
                        type="button"
                        className="check"
                        aria-checked={isCompleting || t.done ? 'true' : 'false'}
                        onClick={() => handleToggleTask(t.id)}
                        title="Mark task complete"
                        style={{ flexShrink: 0 }}
                      >
                        <Icon name="check" size={14} />
                      </button>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.title}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--muted)', marginTop: '3px' }}>
                          <span className="mono">{t.mins}m</span>
                          <span>&middot;</span>
                          <span
                            className={`badge ${t.prio === 'high' ? 'badge-danger' : t.prio === 'low' ? 'badge-outline' : 'badge-warning'}`}
                            style={{ fontSize: '10px', textTransform: 'capitalize' }}
                          >
                            {t.prio || 'medium'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      className="btn btn-sm"
                      onClick={() => onNavigate('focus')}
                      title="Start Pomodoro focus timer"
                      style={{ flexShrink: 0 }}
                    >
                      <Icon name="play" size={12} /> Focus
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Spaced Revision Due Queue */}
        <div className="card" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="hub-icon-box" style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'var(--good-soft)', color: 'var(--good)' }}>
                <Icon name="brain" size={16} />
              </span>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>
                  Spaced Revision Queue
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  Active memory retention ladder
                </div>
              </div>
            </div>
            <button className="btn btn-sm" onClick={() => onNavigate('smart_revision')}>
              Full Queue &rarr;
            </button>
          </div>

          {dueTopics.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--muted)', border: '1px dashed var(--line)', borderRadius: '14px', background: 'var(--surface2)' }}>
              <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--accent)', marginBottom: '10px' }}>
                <Icon name="award" size={22} />
              </div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>Retention ladder is fresh</p>
              <p style={{ fontSize: '12.5px', marginTop: '4px' }}>No spaced revisions are due today.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {dueTopics.map(top => (
                <div
                  key={top.topic_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    background: 'var(--surface2)',
                    border: '1px solid var(--line)'
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {top.topic_name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '11.5px', color: 'var(--muted)', marginTop: '4px' }}>
                      <span style={{ color: top.subject_color || 'var(--accent)', fontWeight: 700 }}>
                        {top.subject_name}
                      </span>
                      <span className="stage-dots" title={`Retention Stage ${top.stage} of 5`}>
                        {[1, 2, 3, 4, 5].map(step => (
                          <span key={step} className={`stage-dot ${step <= (top.stage || 0) ? 'filled' : ''}`} />
                        ))}
                      </span>
                      <span className="mono">{top.next_revision_date}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {onOpenTopicInStudio && (
                      <button
                        className="btn btn-sm"
                        onClick={() => onOpenTopicInStudio(top.topic_id)}
                        title="Open interactive AI Lesson & Video Studio"
                      >
                        <Icon name="sparkles" size={12} /> Studio
                      </button>
                    )}
                    <button
                      className="btn btn-sm primary"
                      onClick={() => onNavigate('smart_revision')}
                    >
                      Revise
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
