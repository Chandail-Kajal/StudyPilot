'use client';

import React, { useState, useEffect } from 'react';
import { Exam } from '@/types';
import { api } from '@/lib/api';
import { Icon } from '../Icons';

interface PreviousYearPapersViewProps {
  token: string | null;
  activeExam: Exam | null;
  onNavigate: (view: string) => void;
  showToast: (msg: string) => void;
  onLaunchPaperTest?: (paper: any, mode: 'timed' | 'practice') => void;
}

export const PreviousYearPapersView: React.FC<PreviousYearPapersViewProps> = ({
  token,
  activeExam,
  onNavigate,
  showToast,
  onLaunchPaperTest
}) => {
  const [papers, setPapers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<any | null>(null);
  const [viewDetailModal, setViewDetailModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedVerification, setSelectedVerification] = useState<string>('all');

  // Upload PYP Modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadYear, setUploadYear] = useState<number>(2023);
  const [uploadSubject, setUploadSubject] = useState('');
  const [uploadSource, setUploadSource] = useState('Official Examination Board');
  const [uploadPaperType, setUploadPaperType] = useState('official');
  const [uploadDuration, setUploadDuration] = useState<number>(120);
  const [uploadQuestionsCount, setUploadQuestionsCount] = useState<number>(25);

  const loadPapers = async () => {
    if (!token || !activeExam) return;
    setLoading(true);
    try {
      const filters: any = {};
      if (selectedYear !== 'all') filters.year = parseInt(selectedYear);
      if (selectedType !== 'all') filters.paper_type = selectedType;
      if (selectedVerification !== 'all') filters.verification_status = selectedVerification;

      const res = await api.getPreviousYearPapers(token, activeExam.id, filters);
      setPapers(res.papers || []);
    } catch (e: any) {
      showToast(e.message || 'Failed to load previous-year papers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPapers();
  }, [token, activeExam, selectedYear, selectedType, selectedVerification]);

  const handleOpenDetail = async (paperId: string) => {
    if (!token) return;
    setDetailLoading(true);
    setViewDetailModal(true);
    try {
      const res = await api.getPreviousYearPaperDetail(token, paperId);
      setSelectedPaper(res.paper);
    } catch (e: any) {
      showToast(e.message || 'Failed to load paper questions');
      setViewDetailModal(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreatePaper = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeExam || !uploadTitle.trim()) return;

    try {
      await api.createPreviousYearPaper(token, {
        exam_id: activeExam.id,
        title: uploadTitle.trim(),
        year: uploadYear,
        subject: uploadSubject.trim() || 'All Subjects',
        paper_type: uploadPaperType,
        duration_minutes: uploadDuration,
        total_questions: uploadQuestionsCount,
        source: uploadSource.trim(),
        verification_status: 'verified'
      });
      showToast(`Paper '${uploadTitle}' registered in library.`);
      setShowUploadModal(false);
      setUploadTitle('');
      loadPapers();
    } catch (e: any) {
      showToast(e.message || 'Failed to add paper');
    }
  };

  if (!activeExam) {
    return (
      <div className="view-container" style={{ padding: '40px', textAlign: 'center' }}>
        <div className="card" style={{ maxWidth: '500px', margin: '40px auto', padding: '36px' }}>
          <Icon name="award" size={40} />
          <h2 style={{ marginTop: '16px' }}>Select an Examination</h2>
          <p style={{ color: 'var(--muted)', margin: '12px 0 20px' }}>
            Please select an active examination to browse its verified previous-year papers.
          </p>
          <button className="btn primary" onClick={() => onNavigate('exams')}>
            Go to My Exams
          </button>
        </div>
      </div>
    );
  }

  const filteredPapers = papers.filter(p => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.paper_name?.toLowerCase().includes(q) ||
      p.title?.toLowerCase().includes(q) ||
      String(p.year).includes(q) ||
      p.source?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="view-container" style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--muted)', marginBottom: '4px' }}>
            <button className="linkbtn" onClick={() => onNavigate('dashboard')}>
              Dashboard
            </button>
            <span>/</span>
            <span>Previous-Year Papers Library</span>
          </div>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800 }}>
            Previous-Year Papers (PYP) Library
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '14px' }}>
            Exam: <strong>{activeExam.exam_name}</strong> &middot; Verified historical examination papers with answer keys and topic frequency tracking.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn" onClick={() => onNavigate('exam_trends')}>
            <Icon name="bar-chart" size={14} /> AI Trend Analyzer &rarr;
          </button>
          <button className="btn primary" onClick={() => setShowUploadModal(true)}>
            <Icon name="upload" size={14} /> Add / Upload Paper
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
        <div style={{ flex: '1 1 240px' }}>
          <input
            type="text"
            placeholder="Search papers by name, year, or source..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', borderRadius: '8px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '13px' }}
          >
            <option value="all">All Years</option>
            <option value="2024">2024</option>
            <option value="2023">2023</option>
            <option value="2022">2022</option>
            <option value="2021">2021</option>
            <option value="2020">2020</option>
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '13px' }}
          >
            <option value="all">All Paper Types</option>
            <option value="official">Official Verified Papers</option>
            <option value="sample">Official Sample Papers</option>
            <option value="practice">Community Practice Papers</option>
          </select>

          <select
            value={selectedVerification}
            onChange={(e) => setSelectedVerification(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '13px' }}
          >
            <option value="all">All Verification</option>
            <option value="verified">Verified Official</option>
            <option value="community">Community Contributed</option>
          </select>
        </div>
      </div>

      {/* Papers Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
          Loading previous-year question papers...
        </div>
      ) : filteredPapers.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <Icon name="file-text" size={48} />
          <h3 style={{ marginTop: '16px' }}>No Previous-Year Papers Found</h3>
          <p style={{ color: 'var(--muted)', maxWidth: '480px', margin: '8px auto 20px' }}>
            Add official past papers for <strong>{activeExam.exam_name}</strong> to unlock AI frequency analysis and trend predictions.
          </p>
          <button className="btn primary" onClick={() => setShowUploadModal(true)}>
            <Icon name="upload" size={14} /> Add First Paper
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
          {filteredPapers.map(paper => (
            <div
              key={paper.id}
              className="card"
              style={{
                padding: '22px',
                borderRadius: '14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'transform 0.2s ease'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <span className="badge" style={{ fontSize: '12px', fontWeight: 700, background: 'rgba(62, 123, 224, 0.15)', color: 'var(--primary)' }}>
                    {paper.year} Examination
                  </span>
                  <span
                    className={`pill ${paper.verification_status === 'verified' ? 'good' : ''}`}
                    style={{ fontSize: '10.5px' }}
                  >
                    {paper.verification_status === 'verified' ? '✓ Verified Official' : 'Community Practice'}
                  </span>
                </div>

                <h3 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: 700, color: 'var(--text)' }}>
                  {paper.title || paper.paper_name}
                </h3>

                <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: '14px' }}>
                  Source: <strong>{paper.source}</strong> &middot; {paper.subject_name || 'All Subjects'}
                </div>

                <div style={{ display: 'flex', gap: '14px', fontSize: '12px', color: 'var(--muted)', padding: '10px', background: 'var(--bg)', borderRadius: '8px', marginBottom: '16px' }}>
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>{paper.question_count || paper.total_questions || 50}</span> Questions
                  </div>
                  <div>&middot;</div>
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>{paper.duration_minutes || 120}</span> Mins
                  </div>
                  <div>&middot;</div>
                  <div>
                    Max Marks: <span style={{ fontWeight: 600, color: 'var(--text)' }}>{paper.total_marks || 100}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                <button
                  className="btn sm"
                  style={{ flex: 1 }}
                  onClick={() => handleOpenDetail(paper.id)}
                >
                  <Icon name="eye" size={14} /> Review Questions
                </button>
                <button
                  className="btn sm primary"
                  style={{ flex: 1 }}
                  onClick={() => {
                    handleOpenDetail(paper.id);
                  }}
                >
                  <Icon name="play" size={14} /> Attempt Paper
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review Questions / Attempt Modal */}
      {viewDetailModal && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setViewDetailModal(false); }}>
          <div className="modal" style={{ maxWidth: '820px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px' }}>
                  {selectedPaper?.title || selectedPaper?.paper_name || 'Paper Details'}
                </h2>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                  Year {selectedPaper?.year} &middot; {selectedPaper?.questions?.length || 0} Questions Loaded
                </div>
              </div>
              <button className="linkbtn" onClick={() => setViewDetailModal(false)}><Icon name="x" size={18} /></button>
            </div>

            {detailLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
                Loading paper questions and answer keys...
              </div>
            ) : selectedPaper?.questions?.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)' }}>
                No questions extracted yet for this paper.
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '6px' }}>
                {selectedPaper?.questions?.map((q: any, i: number) => (
                  <div key={q.id || i} style={{ background: 'var(--bg)', borderRadius: '10px', padding: '16px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span className="badge" style={{ fontSize: '11px' }}>Question {q.question_number || i + 1}</span>
                      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{q.topic_name || 'General'}</span>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '12px' }}>
                      {q.question_text}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                      {q.options?.map((opt: string, optIdx: number) => (
                        <div
                          key={optIdx}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            background: opt === q.correct_answer ? 'rgba(46, 204, 113, 0.12)' : 'var(--surface)',
                            border: opt === q.correct_answer ? '1px solid #2ecc71' : '1px solid var(--border)',
                            fontSize: '13px'
                          }}
                        >
                          <span style={{ fontWeight: 600, marginRight: '8px' }}>
                            {String.fromCharCode(65 + optIdx)}.
                          </span>
                          {opt}
                          {opt === q.correct_answer && (
                            <span style={{ float: 'right', color: '#27ae60', fontWeight: 700, fontSize: '11px' }}>
                              ✓ Answer Key
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    {q.explanation && (
                      <div style={{ fontSize: '12px', color: 'var(--muted)', background: 'var(--surface)', padding: '8px 12px', borderRadius: '6px' }}>
                        <strong>Explanation:</strong> {q.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <button className="btn" onClick={() => setViewDetailModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Paper Modal */}
      {showUploadModal && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowUploadModal(false); }}>
          <div className="modal" style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '20px' }}>Register Previous-Year Paper</h2>
              <button className="linkbtn" onClick={() => setShowUploadModal(false)}><Icon name="x" size={18} /></button>
            </div>

            <form onSubmit={handleCreatePaper} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                Paper Title
                <input
                  required
                  placeholder="e.g. UGC NET Dec 2023 Paper II Computer Science"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                  Examination Year
                  <input
                    type="number"
                    required
                    min={2000}
                    max={2030}
                    value={uploadYear}
                    onChange={(e) => setUploadYear(parseInt(e.target.value))}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                  Paper Type
                  <select
                    value={uploadPaperType}
                    onChange={(e) => setUploadPaperType(e.target.value)}
                    style={{ padding: '8px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  >
                    <option value="official">Official Exam Paper</option>
                    <option value="sample">Official Sample Paper</option>
                    <option value="practice">Model Practice Paper</option>
                  </select>
                </label>
              </div>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                Official Source / Examination Board
                <input
                  required
                  placeholder="e.g. National Testing Agency (NTA), UPSC, SSC"
                  value={uploadSource}
                  onChange={(e) => setUploadSource(e.target.value)}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                  Duration (Minutes)
                  <input
                    type="number"
                    value={uploadDuration}
                    onChange={(e) => setUploadDuration(parseInt(e.target.value))}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                  Total Questions
                  <input
                    type="number"
                    value={uploadQuestionsCount}
                    onChange={(e) => setUploadQuestionsCount(parseInt(e.target.value))}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn" onClick={() => setShowUploadModal(false)}>Cancel</button>
                <button type="submit" className="btn primary">Add to Library</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

