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
    try {
      await api.toggleStudyTask(token, taskId);
      setScheduledTasks(prev => prev.filter(t => t.id !== taskId));
      showToast('Task marked as completed!');
    } catch (e: any) {
      showToast(e.message || 'Failed to update task');
    }
  };

  const daysUntilExam = activeExam?.exam_date
    ? Math.max(0, Math.ceil((new Date(activeExam.exam_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

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
    <div className="view-container" style={{ padding: '8px 0 32px 0', width: '100%' }}>
      {/* Hero Welcome & Active Exam Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '28px',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800 }}>
            Welcome back, {user ? user.name.split(' ')[0] : 'Scholar'}!
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '14px' }}>
            {activeExam ? `Active Goal: ${activeExam.exam_name}` : 'Select or upload an examination syllabus to get started'}
          </p>
        </div>

        {/* Exam Quick Selector Dropdown */}
        {allExams.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 600 }}>Active Exam:</span>
            <select
              value={activeExam?.id || ''}
              onChange={(e) => {
                const found = allExams.find(ex => ex.id === e.target.value);
                if (found) onSelectExam(found);
              }}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontWeight: 600,
                fontSize: '14px'
              }}
            >
              {allExams.map(ex => (
                <option key={ex.id} value={ex.id}>
                  {ex.exam_name} ({ex.exam_category})
                </option>
              ))}
            </select>
            <button
              className="btn sm primary"
              onClick={() => onNavigate('exams')}
              title="Manage all examinations"
            >
              <Icon name="layers" size={14} /> My Exams
            </button>
          </div>
        )}
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

      {/* KPI Cards Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '32px'
        }}
      >
        {/* Readiness Index */}
        <div className="card" style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
              Exam Readiness Index
            </span>
            <span style={{ color: 'var(--good)' }}>
              <Icon name="award" size={18} />
            </span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--text)' }}>
            {stats ? `${stats.readiness_percent}%` : `${activeExam?.readiness_percent || 0}%`}
          </div>
          <div style={{ marginTop: '8px', width: '100%', height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${stats ? stats.readiness_percent : (activeExam?.readiness_percent || 0)}%`,
                height: '100%',
                background: 'var(--good)',
                borderRadius: '3px'
              }}
            />
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
            Based on active topic spaced retention
          </div>
        </div>

        {/* Days Remaining */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
              Countdown to Exam
            </span>
            <span style={{ color: 'var(--accent)' }}>
              <Icon name="calendar" size={18} />
            </span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--text)' }}>
            {daysUntilExam !== null ? `${daysUntilExam} Days` : 'Not Set'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '14px' }}>
            Target Date: {activeExam?.exam_date || 'Flexible'}
          </div>
        </div>

        {/* Topics Breakdown */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
              Mastered Topics
            </span>
            <span style={{ color: '#1FA095' }}>
              <Icon name="check" size={18} />
            </span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--text)' }}>
            {stats ? stats.distribution.mastered : (activeExam?.mastered_count || 0)}{' '}
            <span style={{ fontSize: '18px', color: 'var(--muted)', fontWeight: 500 }}>
              / {stats ? stats.total_topics : (activeExam?.topics_count || 0)}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '14px' }}>
            {stats ? stats.distribution.reviewing : (activeExam?.in_progress_count || 0)} reviewing &middot; {stats ? stats.distribution.learning : 0} learning
          </div>
        </div>

        {/* Daily Focus Goal */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
              Daily Study Target
            </span>
            <span style={{ color: 'var(--amber)' }}>
              <Icon name="focus" size={18} />
            </span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--text)' }}>
            {user?.goal_mins || 180} <span style={{ fontSize: '18px', color: 'var(--muted)', fontWeight: 500 }}>mins</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '14px' }}>
            Sitting capacity: {user?.sitting_capacity_mins || 45} mins per session
          </div>
        </div>
      </div>

      {/* Quick Action Navigation Grid */}
      <div style={{ marginBottom: '32px' }}>
      {/* Examination Preparation Hub & Quick Actions */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px' }}>Examination Preparation Hub</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '14px'
          }}
        >
          <button
            className="card interactive"
            onClick={() => onNavigate('timetable')}
            style={{
              padding: '18px',
              textAlign: 'left',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              background: 'linear-gradient(135deg, var(--surface), rgba(10, 108, 158, 0.05))'
            }}
          >
            <div style={{ color: 'var(--accent)', marginBottom: '8px' }}>
              <Icon name="clock" size={24} />
            </div>
            <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--ink)' }}>Daily & Weekly Timetable</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
              View time-slotted study sessions, mark complete & reschedule
            </div>
          </button>

          <button
            className="card interactive"
            onClick={() => onNavigate('ai_classes')}
            style={{
              padding: '18px',
              textAlign: 'left',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              background: 'linear-gradient(135deg, var(--surface), rgba(10, 108, 158, 0.08))'
            }}
          >
            <div style={{ color: 'var(--accent)', marginBottom: '8px' }}>
              <Icon name="sparkles" size={24} />
            </div>
            <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--ink)' }}>AI Scheduled Classes</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
              Interactive lessons with in-class AI tutor, diagrams & checks
            </div>
          </button>

          <button
            className="card interactive"
            onClick={() => onNavigate('practice')}
            style={{
              padding: '18px',
              textAlign: 'left',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              background: 'linear-gradient(135deg, var(--surface), rgba(27, 133, 83, 0.06))'
            }}
          >
            <div style={{ color: 'var(--good)', marginBottom: '8px' }}>
              <Icon name="check-circle" size={24} />
            </div>
            <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--ink)' }}>Topic Practice & Assessments</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
              Adaptive MCQ & numerical drills with instant solutions
            </div>
          </button>

          <button
            className="card interactive"
            onClick={() => onNavigate('manage_syllabus')}
            style={{
              padding: '18px',
              textAlign: 'left',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              background: 'var(--surface)'
            }}
          >
            <div style={{ color: 'var(--accent)', marginBottom: '8px' }}>
              <Icon name="layers" size={24} />
            </div>
            <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--ink)' }}>Subjects & Syllabus</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
              Hierarchical curriculum breakdown & document upload
            </div>
          </button>

          <button
            className="card interactive"
            onClick={() => onNavigate('mock_tests')}
            style={{
              padding: '18px',
              textAlign: 'left',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              background: 'linear-gradient(135deg, var(--surface), rgba(194, 59, 48, 0.06))'
            }}
          >
            <div style={{ color: 'var(--crit)', marginBottom: '8px' }}>
              <Icon name="test" size={24} />
            </div>
            <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--ink)' }}>CBT Mock Examinations</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
              Timed CBT tests, question palette & instant grading
            </div>
          </button>

          <button
            className="card interactive"
            onClick={() => onNavigate('pyp_library')}
            style={{
              padding: '18px',
              textAlign: 'left',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              background: 'var(--surface)'
            }}
          >
            <div style={{ color: 'var(--amber)', marginBottom: '8px' }}>
              <Icon name="file-text" size={24} />
            </div>
            <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--ink)' }}>Previous-Year & Predicted Papers</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
              Recurrence trends & AI predicted practice papers
            </div>
          </button>

          <button
            className="card interactive"
            onClick={() => onNavigate('planner')}
            style={{
              padding: '18px',
              textAlign: 'left',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              background: 'linear-gradient(135deg, var(--surface), rgba(168, 107, 0, 0.06))'
            }}
          >
            <div style={{ color: 'var(--amber)', marginBottom: '8px' }}>
              <Icon name="calendar" size={24} />
            </div>
            <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--ink)' }}>AI Study Planner & Recovery</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
              Workload distribution & adaptive recovery replanner
            </div>
          </button>

          <button
            className="card interactive"
            onClick={() => onNavigate('analytics')}
            style={{
              padding: '18px',
              textAlign: 'left',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              background: 'var(--surface)'
            }}
          >
            <div style={{ color: '#7C62D9', marginBottom: '8px' }}>
              <Icon name="bar-chart" size={24} />
            </div>
            <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--ink)' }}>Progress & Analytics</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
              Syllabus coverage %, accuracy & AI recommendations
            </div>
          </button>
        </div>
      </div>
      </div>

      {/* Main Two Columns: Tasks and Spaced Revision Due */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {/* Scheduled Tasks for Today */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
              Upcoming Study Tasks
            </h3>
            <button className="linkbtn" onClick={() => onNavigate('planner')} style={{ fontSize: '13px' }}>
              Open Planner &rarr;
            </button>
          </div>

          {scheduledTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--muted)' }}>
              <Icon name="check" size={32} />
              <p style={{ marginTop: '12px', fontSize: '14px' }}>All caught up! No pending study tasks scheduled.</p>
              <button className="btn sm primary" onClick={() => onNavigate('planner')} style={{ marginTop: '8px' }}>
                Schedule Topics
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {scheduledTasks.map(t => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="checkbox"
                      checked={t.done}
                      onChange={() => handleToggleTask(t.id)}
                      style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                    />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>{t.title}</div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                        {t.mins} mins &middot; Priority: <span style={{ textTransform: 'capitalize' }}>{t.prio}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    className="btn sm"
                    onClick={() => onNavigate('focus')}
                    title="Start timer for this task"
                    style={{ fontSize: '12px' }}
                  >
                    <Icon name="play" size={12} /> Focus
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Spaced Revision Due Alerts */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
              Spaced Revision Queue
            </h3>
            <button className="linkbtn" onClick={() => onNavigate('smart_revision')} style={{ fontSize: '13px' }}>
              View Queue &rarr;
            </button>
          </div>

          {dueTopics.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--muted)' }}>
              <Icon name="award" size={32} />
              <p style={{ marginTop: '12px', fontSize: '14px' }}>Your retention ladder is fresh. No revisions due today!</p>
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
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{top.topic_name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      <span style={{ color: top.subject_color || 'var(--accent)', fontWeight: 600 }}>
                        {top.subject_name}
                      </span>
                      {' '}&middot; Stage {top.stage}/5 &middot; Due: {top.next_revision_date}
                    </div>
                  </div>
                  <button
                    className="btn sm primary"
                    onClick={() => onNavigate('smart_revision')}
                    style={{ fontSize: '12px' }}
                  >
                    Revise
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
