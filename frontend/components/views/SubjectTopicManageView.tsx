'use client';

import React, { useState, useEffect } from 'react';
import { Exam, HierarchySubject } from '@/types';
import { api } from '@/lib/api';
import { Icon } from '../Icons';

interface SubjectTopicManageViewProps {
  token: string | null;
  activeExam: Exam | null;
  onNavigate: (view: string) => void;
  showToast: (msg: string) => void;
  onOpenTopicStudio?: (topicId: string) => void;
}

export const SubjectTopicManageView: React.FC<SubjectTopicManageViewProps> = ({
  token,
  activeExam,
  onNavigate,
  showToast,
  onOpenTopicStudio
}) => {
  const [hierarchy, setHierarchy] = useState<HierarchySubject[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal / Add state
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubjName, setNewSubjName] = useState('');
  const [newSubjDesc, setNewSubjDesc] = useState('');
  const [newSubjColor, setNewSubjColor] = useState('#3E7BE0');

  const [selectedSubjectIdForTopic, setSelectedSubjectIdForTopic] = useState<string | null>(null);
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicDiff, setNewTopicDiff] = useState('medium');
  const [newTopicMins, setNewTopicMins] = useState(45);
  const [newTopicPrio, setNewTopicPrio] = useState('medium');

  const loadHierarchy = async () => {
    if (!token || !activeExam) return;
    setLoading(true);
    try {
      const res = await api.getSyllabusHierarchy(token, activeExam.id);
      setHierarchy(res.subjects || []);
    } catch (e: any) {
      showToast(e.message || 'Failed to load syllabus hierarchy');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHierarchy();
  }, [token, activeExam]);

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeExam || !newSubjName.trim()) return;
    try {
      await api.createSubject(token, {
        exam_id: activeExam.id,
        subject_name: newSubjName.trim(),
        description: newSubjDesc.trim() || undefined,
        color: newSubjColor
      });
      showToast('Subject created successfully.');
      setNewSubjName('');
      setNewSubjDesc('');
      setShowAddSubject(false);
      loadHierarchy();
    } catch (e: any) {
      showToast(e.message || 'Failed to create subject');
    }
  };

  const handleDeleteSubject = async (subjId: string, name: string) => {
    if (!token) return;
    if (!window.confirm(`Delete subject '${name}' and all its units and topics?`)) return;
    try {
      await api.deleteSubject(token, subjId);
      showToast('Subject deleted.');
      loadHierarchy();
    } catch (e: any) {
      showToast(e.message || 'Failed to delete subject');
    }
  };

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedSubjectIdForTopic || !newTopicName.trim()) return;
    try {
      await api.createTopic(token, {
        subject_id: selectedSubjectIdForTopic,
        topic_name: newTopicName.trim(),
        difficulty: newTopicDiff,
        estimated_minutes: newTopicMins,
        importance: newTopicPrio
      });
      showToast('Topic added to subject.');
      setNewTopicName('');
      setSelectedSubjectIdForTopic(null);
      loadHierarchy();
    } catch (e: any) {
      showToast(e.message || 'Failed to add topic');
    }
  };

  const handleDeleteTopic = async (topicId: string, name: string) => {
    if (!token) return;
    if (!window.confirm(`Delete topic '${name}'?`)) return;
    try {
      await api.deleteTopic(token, topicId);
      showToast('Topic deleted.');
      loadHierarchy();
    } catch (e: any) {
      showToast(e.message || 'Failed to delete topic');
    }
  };

  if (!activeExam) {
    return (
      <div className="view-container" style={{ padding: '40px 24px', maxWidth: '800px', margin: '40px auto', textAlign: 'center' }}>
        <div className="card" style={{ padding: '48px 32px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📚</div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 10px' }}>No Active Examination Selected</h2>
          <p style={{ color: 'var(--muted)', fontSize: '14px', maxWidth: '480px', margin: '0 auto 24px' }}>
            Please select or configure your target examination to manage subjects, units, chapters, and topics.
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--muted)', marginBottom: '4px' }}>
            <button className="linkbtn" onClick={() => onNavigate('exam_details')}>
              &larr; Exam Details
            </button>
            <span>/</span>
            <span>Hierarchy Manager</span>
          </div>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800 }}>
            Subject and Topic Management
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '14px' }}>
            {activeExam ? `Exam: ${activeExam.exam_name}` : 'Select an exam to organize topics'} &middot; Manage units, chapters, and topics hierarchy.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn primary" onClick={() => setShowAddSubject(true)}>
            <Icon name="plus" size={14} /> Add Subject
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
          Loading curriculum tree...
        </div>
      ) : hierarchy.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <Icon name="layers" size={48} />
          <h3 style={{ marginTop: '16px' }}>No Subjects Found</h3>
          <p style={{ color: 'var(--muted)', maxWidth: '440px', margin: '8px auto 20px' }}>
            Add a subject manually or upload a syllabus file to automatically build the structure.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button className="btn primary" onClick={() => setShowAddSubject(true)}>
              <Icon name="plus" size={14} /> Add Subject
            </button>
            <button className="btn" onClick={() => onNavigate('upload_syllabus')}>
              <Icon name="upload" size={14} /> Upload Syllabus
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {hierarchy.map(subject => {
            const allTopics = subject.units.flatMap(u => u.chapters.flatMap(c => c.topics));

            return (
              <div
                key={subject.id}
                className="card"
                style={{
                  padding: '24px',
                  borderLeft: `6px solid ${subject.color || '#3E7BE0'}`
                }}
              >
                {/* Subject Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>
                      {subject.subject_name}
                    </h2>
                    {subject.description && (
                      <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--muted)' }}>
                        {subject.description}
                      </p>
                    )}
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>
                      {subject.units.length} Units &middot; {allTopics.length} Topics
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn sm primary"
                      onClick={() => setSelectedSubjectIdForTopic(subject.id)}
                    >
                      <Icon name="plus" size={13} /> Add Topic
                    </button>
                    <button
                      className="btn sm danger iconly"
                      onClick={() => handleDeleteSubject(subject.id, subject.subject_name)}
                      title="Delete Subject"
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                </div>

                {/* Units & Chapters Tree */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
                  {subject.units.map(unit => (
                    <div
                      key={unit.id}
                      style={{
                        background: 'var(--bg)',
                        borderRadius: '8px',
                        padding: '16px',
                        border: '1px solid var(--border)'
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: 'var(--accent)' }}>📁</span>
                        <span>{unit.unit_name}</span>
                      </div>

                      {unit.chapters.map(chapter => (
                        <div key={chapter.id} style={{ marginLeft: '16px', marginBottom: '12px' }}>
                          <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>
                            📖 {chapter.chapter_name}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginLeft: '12px' }}>
                            {chapter.topics.map(t => (
                              <div
                                key={t.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '8px 12px',
                                  borderRadius: '6px',
                                  background: 'var(--surface)',
                                  border: '1px solid var(--border)',
                                  fontSize: '13px'
                                }}
                              >
                                <div>
                                  <span style={{ fontWeight: 600 }}>{t.topic_name}</span>
                                  {t.subtopic_name && (
                                    <span style={{ color: 'var(--muted)', fontSize: '12px' }}> &middot; {t.subtopic_name}</span>
                                  )}
                                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                                    Diff: <span style={{ textTransform: 'capitalize' }}>{t.difficulty || 'medium'}</span> &middot; {t.estimated_minutes || 45} mins &middot; Stage {t.stage || 0}/5
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <button
                                    className="btn sm primary"
                                    onClick={() => {
                                      if (onOpenTopicStudio) {
                                        onOpenTopicStudio(t.id);
                                      } else {
                                        onNavigate('ai_learning_studio');
                                      }
                                    }}
                                    style={{ fontSize: '11px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    <Icon name="sparkles" size={11} /> Learn in Studio
                                  </button>
                                  <span
                                    className={`pill ${t.stage && t.stage >= 5 ? 'good' : ''}`}
                                    style={{ fontSize: '10px' }}
                                  >
                                    {t.progress_status || 'not_started'}
                                  </span>
                                  <button
                                    className="btn sm iconly"
                                    onClick={() => handleDeleteTopic(t.id, t.topic_name)}
                                    title="Delete Topic"
                                    style={{ padding: '4px' }}
                                  >
                                    <Icon name="x" size={12} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Subject Modal */}
      {showAddSubject && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowAddSubject(false); }}>
          <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: '480px' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '20px' }}>Add New Subject</h2>
            <form className="form" onSubmit={handleCreateSubject}>
              <label className="f">
                Subject Name
                <input
                  required
                  placeholder="e.g. Operating Systems, Calculus, Reasoning"
                  value={newSubjName}
                  onChange={(e) => setNewSubjName(e.target.value)}
                  autoFocus
                />
              </label>

              <label className="f">
                Description (optional)
                <input
                  placeholder="Brief curriculum scope description"
                  value={newSubjDesc}
                  onChange={(e) => setNewSubjDesc(e.target.value)}
                />
              </label>

              <div className="formactions" style={{ marginTop: '20px' }}>
                <button type="button" className="btn" onClick={() => setShowAddSubject(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn primary">
                  Create Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Topic Modal */}
      {selectedSubjectIdForTopic && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setSelectedSubjectIdForTopic(null); }}>
          <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: '480px' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '20px' }}>Add Topic to Subject</h2>
            <form className="form" onSubmit={handleCreateTopic}>
              <label className="f">
                Topic Name
                <input
                  required
                  placeholder="e.g. Virtual Memory & Demand Paging"
                  value={newTopicName}
                  onChange={(e) => setNewTopicName(e.target.value)}
                  autoFocus
                />
              </label>

              <div className="row3">
                <label className="f">
                  Difficulty
                  <select value={newTopicDiff} onChange={(e) => setNewTopicDiff(e.target.value)}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </label>

                <label className="f">
                  Est. Minutes
                  <input
                    type="number"
                    step="15"
                    value={newTopicMins}
                    onChange={(e) => setNewTopicMins(Number(e.target.value) || 45)}
                  />
                </label>

                <label className="f">
                  Priority
                  <select value={newTopicPrio} onChange={(e) => setNewTopicPrio(e.target.value)}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="very_high">Critical</option>
                  </select>
                </label>
              </div>

              <div className="formactions" style={{ marginTop: '20px' }}>
                <button type="button" className="btn" onClick={() => setSelectedSubjectIdForTopic(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn primary">
                  Add Topic
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
