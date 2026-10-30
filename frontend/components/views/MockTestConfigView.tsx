'use client';

import React, { useState, useEffect } from 'react';
import { Exam, CBTQuestion } from '@/types';
import { api } from '@/lib/api';
import { Icon } from '../Icons';

interface MockTestConfigViewProps {
  token: string | null;
  activeExam: Exam | null;
  onLaunchTest: (testId: string) => void;
  onNavigate: (view: string) => void;
  showToast: (msg: string) => void;
}

export const MockTestConfigView: React.FC<MockTestConfigViewProps> = ({
  token,
  activeExam,
  onLaunchTest,
  onNavigate,
  showToast
}) => {
  const [availableTests, setAvailableTests] = useState<any[]>([]);
  const [qbStats, setQbStats] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Configuration Form State
  const [testName, setTestName] = useState('Rapid Full Syllabus Drill');
  const [testType, setTestType] = useState('full_syllabus');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [durationMins, setDurationMins] = useState<number>(30);
  const [numQuestions, setNumQuestions] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<string>('medium');
  const [negativeMarking, setNegativeMarking] = useState<boolean>(true);
  const [generating, setGenerating] = useState(false);

  const loadTestData = async () => {
    if (!token || !activeExam) return;
    setLoading(true);
    try {
      const [testsRes, hierarchyRes] = await Promise.all([
        api.getAvailableTests(token, activeExam.id).catch(() => ({ tests: [], question_bank_summary: [] })),
        api.getSyllabusHierarchy(token, activeExam.id).catch(() => ({ subjects: [] }))
      ]);

      setAvailableTests(testsRes.tests || []);
      setQbStats(testsRes.question_bank_summary || []);
      setSubjects(hierarchyRes.subjects || []);
      if (hierarchyRes.subjects?.length > 0) {
        setSelectedSubjectId(hierarchyRes.subjects[0].id);
      }
    } catch (e: any) {
      showToast(e.message || 'Failed to load mock tests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTestData();
  }, [token, activeExam]);

  const handleCreateAndStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeExam) return;
    setGenerating(true);
    try {
      const res = await api.configureMockTest(token, {
        exam_id: activeExam.id,
        test_name: testName.trim(),
        test_type: testType,
        subject_id: testType === 'subject_wise' ? selectedSubjectId : undefined,
        duration_minutes: durationMins,
        num_questions: numQuestions,
        difficulty,
        negative_marking_enabled: negativeMarking
      });

      showToast('Mock test configured! Entering CBT exam room...');
      setShowConfigModal(false);
      onLaunchTest(res.test_id);
    } catch (e: any) {
      showToast(e.message || 'Failed to configure test');
    } finally {
      setGenerating(false);
    }
  };

  if (!activeExam) {
    return (
      <div className="view-container" style={{ padding: '40px 24px', maxWidth: '800px', margin: '40px auto', textAlign: 'center' }}>
        <div className="card" style={{ padding: '48px 32px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🧪</div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 10px' }}>No Active Examination Selected</h2>
          <p style={{ color: 'var(--muted)', fontSize: '14px', maxWidth: '480px', margin: '0 auto 24px' }}>
            Please select or configure your target examination to practice full-length CBT tests, sectional drills, and mock assessments.
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800 }}>Mock Test Configuration</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '14px' }}>
            {activeExam ? `Examination: ${activeExam.exam_name}` : 'Select an exam'} &middot; Full-length, subject-wise, sectional, and topic CBT drills.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn sm" onClick={() => onNavigate('test_history')}>
            <Icon name="test" size={14} /> Test History
          </button>
          <button className="btn primary" onClick={() => setShowConfigModal(true)}>
            <Icon name="plus" size={14} /> Configure New Test
          </button>
        </div>
      </div>

      {/* Test Categories Highlights */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '16px',
          marginBottom: '28px'
        }}
      >
        <div
          className="card interactive"
          onClick={() => {
            setTestType('full_syllabus');
            setTestName(`${activeExam?.exam_name || 'Grand'} Full Syllabus Grand Paper`);
            setDurationMins(60);
            setNumQuestions(15);
            setShowConfigModal(true);
          }}
          style={{ padding: '20px', cursor: 'pointer', border: '1px solid var(--border)' }}
        >
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>🏆</div>
          <h3 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: 800 }}>Full-Syllabus Grand Paper</h3>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
            Covers all curriculum subjects proportionally with negative marking and real exam countdown.
          </p>
          <span className="pill good" style={{ marginTop: '14px', display: 'inline-block', fontSize: '11px' }}>
            60-180 Mins &middot; High Yield
          </span>
        </div>

        <div
          className="card interactive"
          onClick={() => {
            setTestType('subject_wise');
            setTestName(`Subject Specialist Test`);
            setDurationMins(30);
            setNumQuestions(10);
            setShowConfigModal(true);
          }}
          style={{ padding: '20px', cursor: 'pointer', border: '1px solid var(--border)' }}
        >
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>📘</div>
          <h3 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: 800 }}>Subject Specialist Paper</h3>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
            Deep-dive into a specific subject module to evaluate conceptual mastery and formulas.
          </p>
          <span className="pill" style={{ marginTop: '14px', display: 'inline-block', fontSize: '11px', background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            30 Mins &middot; Targeted Drill
          </span>
        </div>

        <div
          className="card interactive"
          onClick={() => {
            setTestType('topic_wise');
            setTestName(`Rapid Topic Mastery Drill`);
            setDurationMins(15);
            setNumQuestions(5);
            setShowConfigModal(true);
          }}
          style={{ padding: '20px', cursor: 'pointer', border: '1px solid var(--border)' }}
        >
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚡</div>
          <h3 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: 800 }}>15-Min Topic Micro-Drill</h3>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
            Quick 5-question sprint on high-priority topics to cement instant retention.
          </p>
          <span className="pill" style={{ marginTop: '14px', display: 'inline-block', fontSize: '11px', background: 'rgba(217, 146, 17, 0.15)', color: '#D99211' }}>
            15 Mins &middot; Instant Recall
          </span>
        </div>

        <div
          className="card interactive"
          onClick={() => {
            setTestType('full_syllabus');
            setTestName(`${activeExam?.exam_name || 'All-India'} 3-Hour Grand Simulation`);
            setDurationMins(180);
            setNumQuestions(50);
            setShowConfigModal(true);
          }}
          style={{ padding: '20px', cursor: 'pointer', border: '1px solid var(--border)' }}
        >
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏱️</div>
          <h3 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: 800 }}>3-Hour Full Simulation</h3>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
            Full-length benchmark test mirroring real examination timing, stamina and negative marking.
          </p>
          <span className="pill good" style={{ marginTop: '14px', display: 'inline-block', fontSize: '11px' }}>
            180 Mins (3h) &middot; Real Exam Mode
          </span>
        </div>
      </div>

      {/* Available Configured Tests */}
      <div>
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Available Configured Mock Papers</h2>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
            Loading tests...
          </div>
        ) : availableTests.length === 0 ? (
          <div className="card" style={{ padding: '36px', textAlign: 'center', color: 'var(--muted)' }}>
            No mock tests configured yet for this examination. Click &quot;Configure New Test&quot; above to create one.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: '16px'
            }}
          >
            {availableTests.map(test => (
              <div
                key={test.id}
                className="card"
                style={{
                  padding: '22px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border: '1px solid var(--border)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <span
                      className="pill"
                      style={{
                        textTransform: 'uppercase',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: 'var(--accent-soft)',
                        color: 'var(--accent)'
                      }}
                    >
                      {test.test_type.replace('_', ' ')}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      ⏱️ {test.duration_minutes} Mins
                    </span>
                  </div>

                  <h3 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: 800 }}>
                    {test.test_name}
                  </h3>
                  {test.subject_name && (
                    <div style={{ fontSize: '13px', color: 'var(--accent)', fontWeight: 600, marginBottom: '4px' }}>
                      Subject: {test.subject_name}
                    </div>
                  )}

                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
                    <b>{test.total_questions}</b> Questions &middot; Total: <b>{test.total_marks}</b> Marks
                    {test.attempts_count > 0 && ` &middot; Attempted ${test.attempts_count}x (Best: ${test.best_score} pts)`}
                  </div>
                </div>

                <div style={{ marginTop: '18px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                  <button
                    className="btn primary"
                    onClick={() => onLaunchTest(test.id)}
                    style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontWeight: 700 }}
                  >
                    <Icon name="play" size={14} /> Start CBT Examination
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Configure Modal */}
      {showConfigModal && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowConfigModal(false); }}>
          <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>Configure Mock Test</h2>
              <button className="linkbtn" onClick={() => setShowConfigModal(false)}><Icon name="x" size={18} /></button>
            </div>

            <form className="form" onSubmit={handleCreateAndStart}>
              <label className="f">
                Test Title
                <input
                  required
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  placeholder="e.g. Grand Full Syllabus Benchmark"
                />
              </label>

              <label className="f">
                Test Scope & Type
                <select
                  value={testType}
                  onChange={(e) => setTestType(e.target.value)}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                >
                  <option value="full_syllabus">Full-Syllabus Grand Paper (All Subjects)</option>
                  <option value="subject_wise">Subject-wise Paper</option>
                  <option value="unit_wise">Unit-wise Paper</option>
                  <option value="topic_wise">Topic-wise Practice Drill</option>
                  <option value="monthly">Monthly Assessment Paper</option>
                </select>
              </label>

              {testType === 'subject_wise' && (
                <label className="f">
                  Target Subject
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                  >
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.subject_name}</option>
                    ))}
                  </select>
                </label>
              )}

              <div className="row3">
                <label className="f">
                  Duration (mins)
                  <select
                    value={durationMins}
                    onChange={(e) => setDurationMins(Number(e.target.value))}
                    style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                  >
                    <option value={15}>15 mins</option>
                    <option value={30}>30 mins</option>
                    <option value={60}>60 mins</option>
                    <option value={180}>180 mins (3h)</option>
                  </select>
                </label>

                <label className="f">
                  Questions
                  <select
                    value={numQuestions}
                    onChange={(e) => setNumQuestions(Number(e.target.value))}
                    style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                  >
                    <option value={5}>5 Qs</option>
                    <option value={10}>10 Qs</option>
                    <option value={15}>15 Qs</option>
                    <option value={25}>25 Qs</option>
                    <option value={50}>50 Qs</option>
                  </select>
                </label>

                <label className="f">
                  Difficulty
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </label>
              </div>

              <div style={{ margin: '14px 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={negativeMarking}
                    onChange={(e) => setNegativeMarking(e.target.checked)}
                  />
                  <span>Enforce Negative Marking (-0.25 marks penalty per wrong answer)</span>
                </label>
              </div>

              <div className="formactions" style={{ marginTop: '20px' }}>
                <button type="button" className="btn" onClick={() => setShowConfigModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={generating}>
                  {generating ? 'Generating Test...' : 'Start CBT Examination'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
