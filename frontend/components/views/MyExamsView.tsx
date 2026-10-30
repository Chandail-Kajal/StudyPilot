'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Exam, SyllabusPreviewResponse } from '@/types';
import { api } from '@/lib/api';
import { Icon } from '../Icons';

interface MyExamsViewProps {
  token: string | null;
  activeExam: Exam | null;
  onSelectExam: (exam: Exam) => void;
  onNavigate: (view: string) => void;
  showToast: (msg: string) => void;
  onPreviewExtracted?: (preview: SyllabusPreviewResponse, examId: string, fileName: string, fileFormat: string) => void;
}

export const MyExamsView: React.FC<MyExamsViewProps> = ({
  token,
  activeExam,
  onSelectExam,
  onNavigate,
  showToast,
  onPreviewExtracted
}) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state
  const [examName, setExamName] = useState('');
  const [examCategory, setExamCategory] = useState('competitive');
  const [educationLevel, setEducationLevel] = useState('competitive');
  const [examDate, setExamDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });

  // Syllabus file state
  const [syllabusFile, setSyllabusFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [creating, setCreating] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');

  const loadExams = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api.getExams(token);
      setExams(res.exams || []);
    } catch (e: any) {
      showToast(e.message || 'Failed to load exams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExams();
  }, [token]);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const validateAndSetFile = (f: File) => {
    const ext = f.name.toLowerCase().split('.').pop() || '';
    const allowed = ['pdf', 'xlsx', 'xls', 'csv', 'docx', 'doc', 'txt'];
    if (!allowed.includes(ext)) {
      showToast('Please upload a PDF (.pdf), Excel (.xlsx/.xls), or CSV (.csv) file.');
      return;
    }
    if (f.size > 30 * 1024 * 1024) {
      showToast('File size exceeds 30MB limit.');
      return;
    }
    setSyllabusFile(f);
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !examName.trim()) return;
    setCreating(true);
    setProcessingStatus('Creating examination profile...');

    try {
      if (syllabusFile) {
        setProcessingStatus('AI analyzing syllabus document...');
        const formData = new FormData();
        formData.append('exam_name', examName.trim());
        if (examDate) formData.append('exam_date', examDate);
        formData.append('exam_category', examCategory);
        formData.append('education_level', educationLevel);
        formData.append('file', syllabusFile);

        const res = await api.createExamWithSyllabus(token, formData);
        onSelectExam(res.exam);

        if (res.preview && onPreviewExtracted) {
          showToast(`Exam created! AI extracted ${res.preview.summary?.total_rows || 0} syllabus topics.`);
          onPreviewExtracted(res.preview, res.exam.id, res.file_name || syllabusFile.name, res.file_format || 'pdf');
          setShowAddModal(false);
          setExamName('');
          setSyllabusFile(null);
          onNavigate('import_preview');
          return;
        } else {
          showToast(res.message || 'Exam created successfully!');
        }
      } else {
        const res = await api.createExam(token, {
          exam_name: examName.trim(),
          exam_category: examCategory,
          education_level: educationLevel,
          exam_date: examDate || undefined
        });
        showToast(res.message || 'Exam created successfully!');
        if (res.exam) onSelectExam(res.exam);
      }

      setShowAddModal(false);
      setExamName('');
      setSyllabusFile(null);
      loadExams();
    } catch (e: any) {
      showToast(e.message || 'Failed to create exam');
    } finally {
      setCreating(false);
      setProcessingStatus('');
    }
  };

  const handleDeleteExam = async (examId: string, name: string) => {
    if (!token) return;
    if (!window.confirm(`Are you sure you want to delete '${name}' and all associated syllabus and mock test records?`)) return;
    try {
      await api.deleteExam(token, examId);
      showToast(`Exam '${name}' deleted.`);
      loadExams();
    } catch (e: any) {
      showToast(e.message || 'Failed to delete exam');
    }
  };

  const handleSetActive = async (exam: Exam) => {
    if (!token) return;
    try {
      await api.updateExam(token, exam.id, { status: 'active' });
      onSelectExam({ ...exam, status: 'active' });
      showToast(`'${exam.exam_name}' is now your active examination.`);
      loadExams();
    } catch (e: any) {
      showToast(e.message || 'Failed to activate exam');
    }
  };

  return (
    <div className="view-container" style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800 }}>My Examinations</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '14px' }}>
            Manage multiple examination goals, curriculum uploads, and target dates.
          </p>
        </div>

        <button
          className="btn primary"
          onClick={() => {
            setExamName('');
            setSyllabusFile(null);
            setShowAddModal(true);
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Icon name="plus" size={16} /> Create Examination
        </button>
      </div>

      {/* Exam Cards Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <div className="spinner" style={{ width: '28px', height: '28px', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--muted)', margin: 0 }}>Loading your examinations...</p>
        </div>
      ) : exams.length === 0 ? (
        <div className="card text-center" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '42px', marginBottom: '12px' }}>🎯</div>
          <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 800 }}>No Target Examinations Yet</h3>
          <p style={{ color: 'var(--muted)', maxWidth: '440px', margin: '0 auto 20px', fontSize: '14px' }}>
            Create an examination goal and upload your syllabus to automatically structure your study timetable.
          </p>
          <button className="btn primary" onClick={() => setShowAddModal(true)}>
            <Icon name="plus" size={16} /> Create First Examination
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '18px'
          }}
        >
          {exams.map(exam => {
            const isActive = activeExam?.id === exam.id;
            const daysLeft = exam.exam_date
              ? Math.max(0, Math.ceil((new Date(exam.exam_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
              : null;

            return (
              <div
                key={exam.id}
                className="card"
                style={{
                  padding: '22px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border: isActive ? '2px solid var(--accent)' : '1px solid var(--border)',
                  position: 'relative'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: isActive ? 'var(--accent-soft)' : 'var(--surface2)',
                        color: isActive ? 'var(--accent)' : 'var(--muted)'
                      }}
                    >
                      {isActive ? 'Active Goal' : (exam.exam_category || 'Examination')}
                    </span>

                    {daysLeft !== null && (
                      <span style={{ fontSize: '12px', fontWeight: 700, color: daysLeft <= 14 ? 'var(--danger)' : 'var(--muted)' }}>
                        {daysLeft} days left
                      </span>
                    )}
                  </div>

                  <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 800, color: 'var(--text)' }}>
                    {exam.exam_name}
                  </h3>

                  <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: '16px' }}>
                    📅 Target Date: {exam.exam_date || 'Flexible schedule'}
                  </div>

                  {/* Readiness Progress Bar */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--muted)' }}>Readiness Score</span>
                      <span style={{ fontWeight: 700, color: 'var(--good)' }}>{exam.readiness_percent || 0}%</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${exam.readiness_percent || 0}%`,
                          height: '100%',
                          background: 'var(--good)',
                          borderRadius: '3px'
                        }}
                      />
                    </div>
                  </div>

                  {/* Stats Pill Strip */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                    <span className="badge" style={{ fontSize: '11px', background: 'var(--surface2)' }}>
                      {exam.subjects_count || 0} Subjects
                    </span>
                    <span className="badge" style={{ fontSize: '11px', background: 'var(--surface2)' }}>
                      {exam.topics_count || 0} Topics
                    </span>
                    <span className="badge" style={{ fontSize: '11px', background: 'var(--surface2)' }}>
                      {exam.mastered_count || 0} Mastered
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '14px', marginTop: '8px' }}>
                  {!isActive && (
                    <button
                      className="btn sm"
                      onClick={() => handleSetActive(exam)}
                      style={{ flex: 1, fontSize: '12px' }}
                    >
                      Make Active
                    </button>
                  )}

                  <button
                    className={`btn sm ${isActive ? 'primary' : 'secondary'}`}
                    onClick={() => {
                      onSelectExam(exam);
                      onNavigate('exam_details');
                    }}
                    style={{ flex: 1, fontSize: '12px' }}
                  >
                    View Details &rarr;
                  </button>

                  <button
                    className="btn sm"
                    onClick={() => {
                      onSelectExam(exam);
                      onNavigate('upload_syllabus');
                    }}
                    title="Upload or Replace Syllabus"
                    style={{ padding: '6px 10px' }}
                  >
                    <Icon name="upload" size={14} />
                  </button>

                  <button
                    className="btn sm danger"
                    onClick={() => handleDeleteExam(exam.id, exam.exam_name)}
                    title="Delete Exam"
                    style={{ padding: '6px 10px' }}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Simplified Create Examination & Upload Syllabus Modal */}
      {showAddModal && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget && !creating) setShowAddModal(false); }}>
          <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: '520px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>🎯</span>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>Create Target Examination</h2>
              </div>
              <button className="linkbtn" disabled={creating} onClick={() => setShowAddModal(false)}>
                <Icon name="x" size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateExam}>
              {/* 1. Examination Name */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
                  Examination Name *
                </label>
                <input
                  required
                  autoFocus
                  placeholder="e.g. UGC NET Computer Science, Class 12 Boards, UPSC Prelims"
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* 2. Target Date & Category Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '5px' }}>
                    Target Exam Date
                  </label>
                  <input
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      fontSize: '13px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '5px' }}>
                    Category (Optional)
                  </label>
                  <select
                    value={examCategory}
                    onChange={(e) => setExamCategory(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      fontSize: '13px'
                    }}
                  >
                    <option value="competitive">Competitive Exam</option>
                    <option value="academic">School / College Board</option>
                    <option value="recruitment">Government Recruitment</option>
                    <option value="certification">Professional Certification</option>
                    <option value="custom">Self-Paced Learning</option>
                  </select>
                </div>
              </div>

              {/* 3. Syllabus Upload (Optional) */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
                  Upload Syllabus (Optional)
                </label>
                <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--muted)' }}>
                  Upload your curriculum in <strong>PDF, Excel, or CSV</strong>. StudyPilot AI will automatically organize chapters and topics into your timetable.
                </p>

                {!syllabusFile ? (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: `2px dashed ${isDragging ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: '12px',
                      padding: '20px',
                      textAlign: 'center',
                      background: isDragging ? 'var(--accent-soft)' : 'var(--surface2)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.xlsx,.xls,.csv,.docx,.doc,.txt"
                      onChange={(e) => e.target.files?.[0] && validateAndSetFile(e.target.files[0])}
                      style={{ display: 'none' }}
                    />
                    <div style={{ fontSize: '24px', marginBottom: '4px' }}>📄</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                      Click to choose file or drag & drop here
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                      PDF, Excel (.xlsx/.xls), CSV (Up to 30MB)
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'var(--surface2)',
                      border: '1px solid var(--accent)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>📄</span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                        {syllabusFile.name}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        ({Math.round(syllabusFile.size / 1024)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSyllabusFile(null)}
                      style={{ background: 'none', border: 0, color: 'var(--danger)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {creating ? (
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                  <div className="spinner" style={{ width: '24px', height: '24px', margin: '0 auto 8px' }} />
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--accent)' }}>
                    {processingStatus || 'Saving examination...'}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="button" className="btn secondary" onClick={() => setShowAddModal(false)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn primary"
                    style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {syllabusFile ? (
                      <>
                        <Icon name="sparkles" size={15} />
                        <span>Create & Analyze Syllabus &rarr;</span>
                      </>
                    ) : (
                      <span>Create Examination</span>
                    )}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
