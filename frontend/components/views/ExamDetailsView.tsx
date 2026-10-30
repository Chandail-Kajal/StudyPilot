'use client';

import React, { useState, useEffect } from 'react';
import { Exam } from '@/types';
import { api } from '@/lib/api';
import { Icon } from '../Icons';

interface ExamDetailsViewProps {
  token: string | null;
  exam: Exam | null;
  onNavigate: (view: string) => void;
  showToast: (msg: string) => void;
}

export const ExamDetailsView: React.FC<ExamDetailsViewProps> = ({
  token,
  exam,
  onNavigate,
  showToast
}) => {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token || !exam) return;
    setLoading(true);
    api.getExamDetails(token, exam.id)
      .then(res => setDetails(res))
      .catch((e: any) => showToast(e.message || 'Failed to load exam details'))
      .finally(() => setLoading(false));
  }, [token, exam]);

  if (!exam) {
    return (
      <div className="view-container" style={{ padding: '40px', textAlign: 'center' }}>
        <h3>No Exam Selected</h3>
        <p style={{ color: 'var(--muted)' }}>Please select an exam from My Exams.</p>
        <button className="btn primary" onClick={() => onNavigate('exams')}>
          Go to My Exams
        </button>
      </div>
    );
  }

  const subjects = details?.subjects || [];
  const uploads = details?.uploads || [];
  const stats = details?.stats || {};

  return (
    <div className="view-container" style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Top Navigation breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '13px', color: 'var(--muted)' }}>
        <button className="linkbtn" onClick={() => onNavigate('exams')}>
          &larr; Back to My Exams
        </button>
        <span>/</span>
        <span style={{ color: 'var(--text)', fontWeight: 600 }}>{exam.exam_name}</span>
      </div>

      {/* Hero Header */}
      <div
        className="card"
        style={{
          padding: '28px',
          marginBottom: '28px',
          background: 'linear-gradient(135deg, rgba(62, 123, 224, 0.08), rgba(31, 160, 149, 0.08))',
          border: '1px solid var(--border)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
              <span className="pill" style={{ textTransform: 'uppercase', fontWeight: 700, fontSize: '11px', background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                {exam.exam_category}
              </span>
              <span className="pill" style={{ fontSize: '11px', fontWeight: 600, background: 'var(--surface)' }}>
                Target: {exam.target_score ? `${exam.target_score} pts` : 'Pass Grade'}
              </span>
            </div>

            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800 }}>
              {exam.exam_name}
            </h1>
            <p style={{ margin: '8px 0 0', color: 'var(--muted)', fontSize: '14px' }}>
              Exam Date: <b>{exam.exam_date || 'Flexible schedule'}</b>
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              className="btn primary"
              onClick={() => onNavigate('upload_syllabus')}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Icon name="upload" size={16} /> Upload Syllabus File
            </button>
            <button
              className="btn"
              onClick={() => onNavigate('manage_syllabus')}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Icon name="layers" size={16} /> Manage Hierarchy
            </button>
            <button
              className="btn"
              onClick={() => onNavigate('mock_config')}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Icon name="test" size={16} /> Start Mock Test
            </button>
          </div>
        </div>

        {/* Quick stat ribbon */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '16px',
            marginTop: '24px',
            borderTop: '1px solid var(--border)',
            paddingTop: '20px'
          }}
        >
          <div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Readiness Score
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--good)', marginTop: '4px' }}>
              {stats.readiness_percent || 0}%
            </div>
          </div>

          <div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Total Subjects
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>
              {stats.total_subjects || 0}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Syllabus Topics
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>
              {stats.total_topics || 0}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Topics Mastered
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#1FA095', marginTop: '4px' }}>
              {stats.mastered_topics || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Subjects Breakdown Section */}
      <div style={{ marginBottom: '36px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Curriculum Subjects</h2>
          <button className="linkbtn" onClick={() => onNavigate('manage_syllabus')}>
            Edit Hierarchy &rarr;
          </button>
        </div>

        {subjects.length === 0 ? (
          <div className="card" style={{ padding: '36px', textAlign: 'center', color: 'var(--muted)' }}>
            <p>No subjects have been added to this examination yet.</p>
            <button className="btn primary sm" onClick={() => onNavigate('upload_syllabus')} style={{ marginTop: '8px' }}>
              Upload Syllabus to Populate
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '16px'
            }}
          >
            {subjects.map((s: any) => {
              const pct = s.topic_count > 0 ? Math.round((s.mastered_count / s.topic_count) * 100) : 0;
              return (
                <div
                  key={s.id}
                  className="card"
                  style={{
                    padding: '20px',
                    borderLeft: `5px solid ${s.color || '#3E7BE0'}`
                  }}
                >
                  <h3 style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: 700 }}>
                    {s.subject_name}
                  </h3>
                  {s.description && (
                    <p style={{ margin: '0 0 14px', fontSize: '13px', color: 'var(--muted)' }}>
                      {s.description}
                    </p>
                  )}

                  <div style={{ marginTop: '12px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600 }}>
                    <span>Mastery: {pct}%</span>
                    <span>{s.mastered_count || 0} / {s.topic_count || 0} Topics</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: s.color || 'var(--accent)',
                        borderRadius: '3px'
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Syllabus Upload History Table */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Syllabus Upload History</h2>
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--muted)' }}>
              Preserved log of uploaded curriculum documents (.pdf, .xlsx, .xls, .csv).
            </p>
          </div>
          <button className="btn sm primary" onClick={() => onNavigate('upload_syllabus')}>
            <Icon name="upload" size={14} /> New Upload
          </button>
        </div>

        {uploads.length === 0 ? (
          <div className="card" style={{ padding: '28px', textAlign: 'center', color: 'var(--muted)' }}>
            No uploads logged yet for this examination.
          </div>
        ) : (
          <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 16px' }}>File Name</th>
                  <th style={{ padding: '12px 16px' }}>Format</th>
                  <th style={{ padding: '12px 16px' }}>Upload Status</th>
                  <th style={{ padding: '12px 16px' }}>Processing</th>
                  <th style={{ padding: '12px 16px' }}>Uploaded At</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((u: any) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Icon name="file-text" size={16} />
                        {u.file_name}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textTransform: 'uppercase', fontSize: '11px', fontWeight: 700 }}>
                      {u.file_format}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="pill good" style={{ fontSize: '11px', textTransform: 'capitalize' }}>
                        {u.upload_status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="pill" style={{ fontSize: '11px', background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                        {u.processing_status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--muted)' }}>
                      {new Date(u.uploaded_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
