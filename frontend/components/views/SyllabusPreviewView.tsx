'use client';

import React, { useState } from 'react';
import { SyllabusPreviewResponse, SyllabusRowPreview } from '@/types';
import { api } from '@/lib/api';
import { Icon } from '../Icons';

interface SyllabusPreviewViewProps {
  token: string | null;
  previewData: SyllabusPreviewResponse | null;
  examId: string;
  fileName: string;
  fileFormat: string;
  onImportConfirmed: (plan?: any) => void;
  onNavigate: (view: string) => void;
  showToast: (msg: string) => void;
}

export const SyllabusPreviewView: React.FC<SyllabusPreviewViewProps> = ({
  token,
  previewData,
  examId,
  fileName,
  fileFormat,
  onImportConfirmed,
  onNavigate,
  showToast
}) => {
  const [rows, setRows] = useState<SyllabusRowPreview[]>(previewData?.rows || []);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [saving, setSaving] = useState(false);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<SyllabusRowPreview>>({});

  if (!previewData || rows.length === 0) {
    return (
      <div className="view-container" style={{ padding: '48px 24px', textAlign: 'center' }}>
        <Icon name="file-text" size={48} />
        <h3 style={{ marginTop: '16px' }}>No Syllabus Preview Available</h3>
        <p style={{ color: 'var(--muted)', maxWidth: '440px', margin: '8px auto 20px' }}>
          Please upload a syllabus file first to review and edit extracted topics.
        </p>
        <button className="btn primary" onClick={() => onNavigate('upload_syllabus')}>
          Upload Syllabus File
        </button>
      </div>
    );
  }

  // Calculate live summary
  const totalRows = rows.length;
  const validRows = rows.filter(r => r.status === 'valid').length;
  const duplicateRows = rows.filter(r => r.status === 'duplicate').length;
  const correctionRows = rows.filter(r => r.status === 'needs_correction').length;
  const uniqueSubjects = Array.from(new Set(rows.map(r => r.subject_name.trim()))).filter(Boolean);
  const uniqueUnits = Array.from(new Set(rows.map(r => `${r.subject_name}_${r.unit_name}`))).length;
  const uniqueChapters = Array.from(new Set(rows.map(r => `${r.subject_name}_${r.chapter_name}`))).length;

  // Filtered rows
  const filteredRows = rows.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (filterSubject !== 'all' && r.subject_name !== filterSubject) return false;
    return true;
  });

  const handleDeleteRow = (rowId: string) => {
    setRows(prev => prev.filter(r => r.id !== rowId));
    showToast('Row removed from import.');
  };

  const handleStartEdit = (row: SyllabusRowPreview) => {
    setEditingRowId(row.id);
    setEditFormData({ ...row });
  };

  const handleSaveEdit = (rowId: string) => {
    setRows(prev => prev.map(r => {
      if (r.id === rowId) {
        const updated = { ...r, ...editFormData };
        // Re-validate
        if (updated.topic_name && updated.topic_name.trim().length >= 2) {
          updated.status = 'valid';
          updated.status_message = 'Corrected by user';
        }
        return updated;
      }
      return r;
    }));
    setEditingRowId(null);
    showToast('Row updated.');
  };

  const handleAddRow = () => {
    const newId = `row_manual_${Date.now()}`;
    const newRow: SyllabusRowPreview = {
      id: newId,
      exam_name: rows[0]?.exam_name || 'Selected Exam',
      subject_name: uniqueSubjects[0] || 'General',
      unit_name: 'Unit 1',
      chapter_name: 'Core Chapter',
      topic_name: 'New Custom Topic',
      subtopic_name: '',
      difficulty: 'medium',
      estimated_minutes: 45,
      importance: 'medium',
      status: 'valid',
      status_message: 'Manually added'
    };
    setRows([newRow, ...rows]);
    setEditingRowId(newId);
    setEditFormData(newRow);
  };

  const handleConfirmImport = async () => {
    if (!token) {
      showToast('Authentication required.');
      return;
    }

    const rowsToImport = rows.filter(r => r.status !== 'needs_correction');
    if (rowsToImport.length === 0) {
      showToast('Please correct invalid rows before confirming import.');
      return;
    }

    setSaving(true);
    try {
      const res = await api.confirmSyllabusImport(token, {
        exam_id: examId,
        file_name: fileName,
        file_format: fileFormat,
        rows: rowsToImport
      });

      showToast(res.message || 'Syllabus analyzed by AI! Your personalized study plan is ready.');
      onImportConfirmed(res.plan);
      onNavigate('planner');
    } catch (e: any) {
      showToast(e.message || 'Failed to save syllabus to database');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="view-container" style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--muted)', marginBottom: '4px' }}>
            <button className="linkbtn" onClick={() => onNavigate('upload_syllabus')}>
              &larr; Back to Upload
            </button>
            <span>/</span>
            <span>Import Preview</span>
          </div>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800 }}>
            Syllabus Import Preview
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '14px' }}>
            Review, edit rows, resolve duplicates, and confirm curriculum. Our AI agent will immediately build your adaptive study plan.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn sm" onClick={handleAddRow}>
            <Icon name="plus" size={14} /> Add Row
          </button>
          <button
            className="btn primary"
            onClick={handleConfirmImport}
            disabled={saving || validRows === 0}
            style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Icon name="sparkles" size={15} />
            <span>{saving ? 'Analyzing & Building Study Plan...' : `Confirm & Generate Study Plan (${validRows + duplicateRows} Topics)`}</span>
          </button>
        </div>
      </div>

      {/* Import Summary KPI Banner */}
      <div
        className="card"
        style={{
          padding: '18px 24px',
          marginBottom: '20px',
          background: 'var(--surface)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '16px',
          border: '1px solid var(--border)'
        }}
      >
        <div>
          <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Rows</div>
          <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '2px' }}>{totalRows}</div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>Subjects</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent)', marginTop: '2px' }}>{uniqueSubjects.length}</div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>Units</div>
          <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '2px' }}>{uniqueUnits}</div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>Chapters</div>
          <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '2px' }}>{uniqueChapters}</div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--good)', textTransform: 'uppercase', fontWeight: 700 }}>Valid Rows</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--good)', marginTop: '2px' }}>{validRows}</div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--amber)', textTransform: 'uppercase', fontWeight: 700 }}>Duplicates</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--amber)', marginTop: '2px' }}>{duplicateRows}</div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--danger)', textTransform: 'uppercase', fontWeight: 700 }}>Needs Fix</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--danger)', marginTop: '2px' }}>{correctionRows}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 600 }}>Filter Status:</span>
          {['all', 'valid', 'duplicate', 'needs_correction'].map(st => (
            <button
              key={st}
              className={`btn sm ${filterStatus === st ? 'primary' : ''}`}
              onClick={() => setFilterStatus(st)}
              style={{ textTransform: 'capitalize', fontSize: '12px' }}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 600 }}>Subject:</span>
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: '13px'
            }}
          >
            <option value="all">All Subjects ({uniqueSubjects.length})</option>
            {uniqueSubjects.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Editable Preview Table */}
      <div className="card" style={{ padding: 0, overflowX: 'auto', border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontSize: '12px' }}>
              <th style={{ padding: '12px 14px' }}>Exam</th>
              <th style={{ padding: '12px 14px' }}>Subject</th>
              <th style={{ padding: '12px 14px' }}>Unit</th>
              <th style={{ padding: '12px 14px' }}>Chapter</th>
              <th style={{ padding: '12px 14px' }}>Topic</th>
              <th style={{ padding: '12px 14px' }}>Subtopic</th>
              <th style={{ padding: '12px 14px' }}>Difficulty</th>
              <th style={{ padding: '12px 14px' }}>Est. Time</th>
              <th style={{ padding: '12px 14px' }}>Status</th>
              <th style={{ padding: '12px 14px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map(row => {
              const isEditing = editingRowId === row.id;

              return (
                <tr
                  key={row.id}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    background:
                      row.status === 'needs_correction'
                        ? 'rgba(229, 83, 83, 0.05)'
                        : row.status === 'duplicate'
                        ? 'rgba(217, 146, 17, 0.05)'
                        : undefined
                  }}
                >
                  {/* Exam */}
                  <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', fontWeight: 600 }}>
                    {row.exam_name}
                  </td>

                  {/* Subject */}
                  <td style={{ padding: '12px 14px' }}>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editFormData.subject_name || ''}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, subject_name: e.target.value }))}
                        style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)', width: '110px' }}
                      />
                    ) : (
                      <span className="pill" style={{ fontSize: '11px', background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                        {row.subject_name}
                      </span>
                    )}
                  </td>

                  {/* Unit */}
                  <td style={{ padding: '12px 14px' }}>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editFormData.unit_name || ''}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, unit_name: e.target.value }))}
                        style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)', width: '100px' }}
                      />
                    ) : (
                      row.unit_name
                    )}
                  </td>

                  {/* Chapter */}
                  <td style={{ padding: '12px 14px' }}>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editFormData.chapter_name || ''}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, chapter_name: e.target.value }))}
                        style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)', width: '100px' }}
                      />
                    ) : (
                      row.chapter_name
                    )}
                  </td>

                  {/* Topic */}
                  <td style={{ padding: '12px 14px', fontWeight: 600, minWidth: '180px' }}>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editFormData.topic_name || ''}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, topic_name: e.target.value }))}
                        style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)', width: '100%' }}
                      />
                    ) : (
                      row.topic_name
                    )}
                  </td>

                  {/* Subtopic */}
                  <td style={{ padding: '12px 14px', color: 'var(--muted)' }}>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editFormData.subtopic_name || ''}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, subtopic_name: e.target.value }))}
                        style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)', width: '90px' }}
                      />
                    ) : (
                      row.subtopic_name || '—'
                    )}
                  </td>

                  {/* Difficulty */}
                  <td style={{ padding: '12px 14px' }}>
                    {isEditing ? (
                      <select
                        value={editFormData.difficulty || 'medium'}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, difficulty: e.target.value }))}
                        style={{ padding: '4px', borderRadius: '4px', border: '1px solid var(--border)' }}
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    ) : (
                      <span
                        className="pill"
                        style={{
                          fontSize: '11px',
                          textTransform: 'capitalize',
                          background:
                            row.difficulty === 'easy'
                              ? 'rgba(38, 180, 135, 0.15)'
                              : row.difficulty === 'hard'
                              ? 'rgba(229, 83, 83, 0.15)'
                              : 'rgba(217, 146, 17, 0.15)',
                          color:
                            row.difficulty === 'easy'
                              ? '#26B487'
                              : row.difficulty === 'hard'
                              ? '#E55353'
                              : '#D99211'
                        }}
                      >
                        {row.difficulty}
                      </span>
                    )}
                  </td>

                  {/* Estimated Study Time */}
                  <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                    {isEditing ? (
                      <input
                        type="number"
                        step="15"
                        value={editFormData.estimated_minutes || 45}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, estimated_minutes: Number(e.target.value) }))}
                        style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)', width: '60px' }}
                      />
                    ) : (
                      `${row.estimated_minutes} min`
                    )}
                  </td>

                  {/* Import Status */}
                  <td style={{ padding: '12px 14px' }}>
                    <span
                      className={`pill ${row.status === 'valid' ? 'good' : row.status === 'duplicate' ? '' : 'danger'}`}
                      style={{
                        fontSize: '11px',
                        textTransform: 'capitalize',
                        background:
                          row.status === 'duplicate' ? 'rgba(217, 146, 17, 0.15)' : undefined,
                        color:
                          row.status === 'duplicate' ? '#D99211' : undefined
                      }}
                      title={row.status_message}
                    >
                      {row.status.replace('_', ' ')}
                    </span>
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button className="btn sm primary" onClick={() => handleSaveEdit(row.id)}>
                          <Icon name="check" size={12} />
                        </button>
                        <button className="btn sm" onClick={() => setEditingRowId(null)}>
                          <Icon name="x" size={12} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button className="btn sm iconly" onClick={() => handleStartEdit(row)} title="Edit row">
                          <Icon name="edit" size={13} />
                        </button>
                        <button className="btn sm danger iconly" onClick={() => handleDeleteRow(row.id)} title="Delete row">
                          <Icon name="trash" size={13} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
