'use client';

import React, { useState, useRef } from 'react';
import { Exam, SyllabusPreviewResponse } from '@/types';
import { api } from '@/lib/api';
import { Icon } from '../Icons';

interface UploadSyllabusViewProps {
  token: string | null;
  activeExam: Exam | null;
  allExams: Exam[];
  onSelectExam: (exam: Exam) => void;
  onPreviewExtracted: (preview: SyllabusPreviewResponse, examId: string, fileName: string, fileFormat: string) => void;
  onNavigate: (view: string) => void;
  showToast: (msg: string) => void;
}

export const UploadSyllabusView: React.FC<UploadSyllabusViewProps> = ({
  token,
  activeExam,
  allExams,
  onSelectExam,
  onPreviewExtracted,
  onNavigate,
  showToast
}) => {
  // If exams exist, default to activeExam.id or allExams[0].id. Otherwise '__new__'
  const defaultExamId = activeExam?.id || (allExams.length > 0 ? allExams[0].id : '__new__');
  const [selectedExamId, setSelectedExamId] = useState<string>(defaultExamId);

  // New exam fields (used when selectedExamId === '__new__')
  const [newExamName, setNewExamName] = useState('');
  const [newExamDate, setNewExamDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [newExamCategory, setNewExamCategory] = useState('competitive');

  // File state
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Optional manual text paste fallback
  const [showPasteMode, setShowPasteMode] = useState(false);
  const [manualText, setManualText] = useState('');

  const isCreatingNewExam = selectedExamId === '__new__' || allExams.length === 0;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const validateAndSetFile = (f: File) => {
    setErrorMsg(null);
    const ext = f.name.toLowerCase().split('.').pop() || '';
    const allowed = ['pdf', 'xlsx', 'xls', 'csv', 'docx', 'doc', 'png', 'jpg', 'jpeg', 'webp', 'txt'];
    if (!allowed.includes(ext)) {
      setErrorMsg('Unsupported format. Please upload a PDF (.pdf), Excel (.xlsx/.xls), or CSV (.csv) file.');
      return;
    }
    if (f.size > 30 * 1024 * 1024) {
      setErrorMsg('File size exceeds 30MB limit.');
      return;
    }
    setFile(f);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleProcessSyllabus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setErrorMsg('Please sign in to upload and analyze your syllabus.');
      return;
    }

    if (!file && (!showPasteMode || !manualText.trim())) {
      setErrorMsg('Please select a syllabus document (PDF, Excel, or CSV) to upload.');
      return;
    }

    if (isCreatingNewExam && !newExamName.trim()) {
      setErrorMsg('Please enter an Examination Name.');
      return;
    }

    setUploading(true);
    setErrorMsg(null);
    setProcessingStep('Initializing examination...');

    try {
      let targetExamId = selectedExamId;
      let targetExamName = activeExam?.exam_name || 'My Target Exam';

      // Step 1: If creating a new exam, create it first
      if (isCreatingNewExam) {
        setProcessingStep('Creating examination profile...');
        const examRes = await api.createExam(token, {
          exam_name: newExamName.trim(),
          exam_category: newExamCategory,
          exam_date: newExamDate || undefined
        });
        targetExamId = examRes.exam.id;
        targetExamName = examRes.exam.exam_name;
        onSelectExam(examRes.exam);
      } else {
        const found = allExams.find(ex => ex.id === selectedExamId);
        if (found) {
          targetExamName = found.exam_name;
          onSelectExam(found);
        }
      }

      setProcessingStep('AI reading and extracting syllabus content...');

      let previewRes;
      let filename = 'syllabus';
      let fileFormat = 'pdf';

      if (showPasteMode && manualText.trim() && !file) {
        previewRes = await api.pasteSyllabusPreview(token, {
          raw_text: manualText.trim(),
          exam_id: targetExamId,
          scope: 'complete'
        });
        filename = 'manual_syllabus.txt';
        fileFormat = 'txt';
      } else if (file) {
        setProcessingStep('AI structuring subjects, units, chapters & learning objectives...');
        previewRes = await api.uploadSyllabusPreview(token, file, {
          exam_id: targetExamId,
          exam_name: targetExamName,
          scope: 'complete'
        });
        filename = file.name;
        fileFormat = file.name.toLowerCase().split('.').pop() || 'pdf';
      }

      setProcessingStep('Finalizing curriculum preview...');
      showToast(`AI extracted ${previewRes?.summary?.total_rows || 0} syllabus topics!`);

      // Hand off to review preview
      onPreviewExtracted(previewRes, targetExamId, filename, fileFormat);
      onNavigate('import_preview');
    } catch (err: any) {
      setErrorMsg(err.message || 'Syllabus analysis failed. Please verify the document format.');
    } finally {
      setUploading(false);
      setProcessingStep('');
    }
  };

  return (
    <div className="view-container" style={{ padding: '24px', maxWidth: '860px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '26px' }}>📄</span>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800 }}>Upload Examination Syllabus</h1>
        </div>
        <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: '14.5px', lineHeight: 1.5 }}>
          Upload your syllabus document in <b>PDF, Excel (.xlsx/.xls), or CSV</b> format. StudyPilot AI automatically extracts subjects, units, chapters, and topics to generate your personalized study timetable.
        </p>
      </div>

      <form onSubmit={handleProcessSyllabus} className="card" style={{ padding: '32px' }}>
        {errorMsg && (
          <div className="alert-banner error" style={{ marginBottom: '20px' }}>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. Target Examination */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontWeight: 700, fontSize: '14px', marginBottom: '8px' }}>
            Target Examination
          </label>

          {allExams.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: '14px',
                  fontWeight: 600
                }}
              >
                {allExams.map(ex => (
                  <option key={ex.id} value={ex.id}>
                    {ex.exam_name} ({ex.exam_category || 'Exam'})
                  </option>
                ))}
                <option value="__new__">+ Create New Examination...</option>
              </select>

              {/* If user selected "+ Create New Examination...", show the basic fields directly */}
              {isCreatingNewExam && (
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '12px',
                    marginTop: '4px'
                  }}
                >
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '5px' }}>
                      New Examination Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. UGC NET Computer Science, Class 12 CBSE"
                      value={newExamName}
                      onChange={(e) => setNewExamName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--text)',
                        fontSize: '13.5px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '5px' }}>
                      Target Exam Date
                    </label>
                    <input
                      type="date"
                      value={newExamDate}
                      onChange={(e) => setNewExamDate(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--text)',
                        fontSize: '13.5px'
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Student has 0 exams: Show simple basic fields directly */
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '14px'
              }}
            >
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '5px' }}>
                  Examination Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. UGC NET Computer Science, SSC CGL, Class 12 Boards"
                  value={newExamName}
                  onChange={(e) => setNewExamName(e.target.value)}
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

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '5px' }}>
                  Target Exam Date
                </label>
                <input
                  type="date"
                  value={newExamDate}
                  onChange={(e) => setNewExamDate(e.target.value)}
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
            </div>
          )}
        </div>

        {/* 2. Syllabus Document Upload Zone */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontWeight: 700, fontSize: '14px', marginBottom: '8px' }}>
            Syllabus Document File
          </label>

          {!file ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragging ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: '16px',
                padding: '36px 20px',
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
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />

              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--surface)', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                📁
              </div>

              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
                Drag & drop your syllabus document here, or <span style={{ color: 'var(--accent)', textDecoration: 'underline' }}>browse</span>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
                Supported formats: <strong>PDF, Excel (.xlsx, .xls), CSV</strong> (Up to 30MB)
              </p>
            </div>
          ) : (
            /* Selected File Badge */
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderRadius: '12px',
                background: 'var(--surface2)',
                border: '1px solid var(--accent)',
                boxShadow: '0 2px 10px rgba(62, 123, 224, 0.08)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '24px' }}>
                  {file.name.endsWith('.pdf') ? '📕' : file.name.endsWith('.csv') ? '📊' : '📗'}
                </span>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
                    {file.name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                    {formatFileSize(file.size)} &middot; Ready for AI analysis
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setFile(null)}
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  color: 'var(--danger)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Remove File
              </button>
            </div>
          )}

          {/* Optional fallback: Paste text instead */}
          <div style={{ marginTop: '12px' }}>
            <button
              type="button"
              className="linkbtn"
              onClick={() => setShowPasteMode(!showPasteMode)}
              style={{ fontSize: '12.5px', color: 'var(--muted)' }}
            >
              {showPasteMode ? '— Hide text paste option' : '+ Or paste syllabus text directly'}
            </button>

            {showPasteMode && (
              <textarea
                rows={5}
                placeholder="Paste curriculum topics, chapters, or units here..."
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: '13px',
                  marginTop: '8px',
                  fontFamily: 'monospace'
                }}
              />
            )}
          </div>
        </div>

        {/* Action Button & Processing Progress */}
        <div>
          {uploading ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div className="spinner" style={{ width: '28px', height: '28px', margin: '0 auto 10px' }} />
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent)' }}>
                {processingStep || 'Processing syllabus...'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                Analyzing curriculum hierarchy, subjects, units, and learning goals.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                className="btn secondary"
                onClick={() => onNavigate('dashboard')}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn primary"
                disabled={uploading || (!file && (!showPasteMode || !manualText.trim()))}
                style={{
                  padding: '12px 24px',
                  fontSize: '14.5px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Icon name="sparkles" size={16} />
                <span>AI Analyze & Review Syllabus &rarr;</span>
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};
