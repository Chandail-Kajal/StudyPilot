/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import { Exam, HierarchySubject } from '@/types';
import { api } from '@/lib/api';
import { Icon } from '../Icons';

interface FlashcardsRevisionViewProps {
  token: string | null;
  activeExam: Exam | null;
  onNavigate: (view: string) => void;
  showToast: (msg: string) => void;
  onOpenTopicInStudio?: (topicId: string) => void;
}

export const FlashcardsRevisionView: React.FC<FlashcardsRevisionViewProps> = ({
  token,
  activeExam,
  onNavigate,
  showToast,
  onOpenTopicInStudio
}) => {
  const [hierarchy, setHierarchy] = useState<HierarchySubject[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [dueRevisionOnly, setDueRevisionOnly] = useState<boolean>(false);

  // Active flashcard deck state
  const [deck, setDeck] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  const loadCurriculum = async () => {
    if (!token || !activeExam) return;
    setLoading(true);
    try {
      const res = await api.getSyllabusHierarchy(token, activeExam.id);
      setHierarchy(res.subjects || []);

      // Build flashcard deck from topics
      const cards: any[] = [];
      (res.subjects || []).forEach((subj: any) => {
        (subj.units || []).forEach((unit: any) => {
          (unit.chapters || []).forEach((ch: any) => {
            (ch.topics || []).forEach((t: any) => {
              cards.push({
                id: `card_${t.id}`,
                topic_id: t.id,
                topic_name: t.topic_name,
                subject_name: subj.subject_name,
                subject_id: subj.id,
                stage: t.stage || 0,
                status: t.progress_status || 'not_started',
                front: `Key Concept: What defines "${t.topic_name}" in ${subj.subject_name}?`,
                back: `Foundational behavioral principle and state transformations governing ${t.topic_name}. Review edge conditions and boundary invariants in AI Studio.`,
                tip: `Spaced Revision Stage: ${t.stage || 0}/5`
              });
            });
          });
        });
      });
      setDeck(cards);
    } catch (e: any) {
      showToast(e.message || 'Failed to load revision curriculum');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCurriculum();
  }, [token, activeExam]);

  if (!activeExam) {
    return (
      <div className="view-container" style={{ padding: '40px', textAlign: 'center' }}>
        <div className="card" style={{ maxWidth: '500px', margin: '40px auto', padding: '36px' }}>
          <Icon name="layers" size={40} />
          <h2 style={{ marginTop: '16px' }}>Select an Examination</h2>
          <p style={{ color: 'var(--muted)', margin: '12px 0 20px' }}>
            Please select an active examination to browse active recall flashcards and spaced revision cards.
          </p>
          <button className="btn primary" onClick={() => onNavigate('exams')}>
            Go to My Exams
          </button>
        </div>
      </div>
    );
  }

  const filteredCards = deck.filter(c => {
    if (selectedSubjectId !== 'all' && c.subject_id !== selectedSubjectId) return false;
    if (dueRevisionOnly && c.stage >= 5) return false;
    return true;
  });

  const currentCard = filteredCards[currentIndex];

  const handleNext = () => {
    if (currentIndex < filteredCards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
    }
  };

  const handleMarkMastered = () => {
    if (!token || !currentCard) return;
    api.updateTopicProgress(token, currentCard.topic_id, { stage: 5, completion_percentage: 100, status: 'mastered' })
      .then(() => {
        showToast(`Topic '${currentCard.topic_name}' marked mastered!`);
        setReviewedCount(prev => prev + 1);
        handleNext();
      })
      .catch(() => {});
  };

  return (
    <div className="view-container" style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--muted)', marginBottom: '4px' }}>
            <button className="linkbtn" onClick={() => onNavigate('dashboard')}>
              Dashboard
            </button>
            <span>/</span>
            <span>Flashcards and Revision</span>
          </div>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800 }}>
            Active Recall Flashcards & Spaced Revision
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '14px' }}>
            Exam: <strong>{activeExam.exam_name}</strong> &middot; Strengthen neural retention through spaced testing and rapid recall.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn" onClick={() => onNavigate('smart_revision')}>
            <Icon name="refresh" size={14} /> Spaced Revision Schedule &rarr;
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: '14px 20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Filter Subject:</span>
          <select
            value={selectedSubjectId}
            onChange={(e) => {
              setSelectedSubjectId(e.target.value);
              setCurrentIndex(0);
              setIsFlipped(false);
            }}
            style={{ padding: '6px 12px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '13px' }}
          >
            <option value="all">All Subjects ({deck.length} cards)</option>
            {hierarchy.map(s => (
              <option key={s.id} value={s.id}>{s.subject_name}</option>
            ))}
          </select>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', marginLeft: '10px' }}>
            <input
              type="checkbox"
              checked={dueRevisionOnly}
              onChange={(e) => {
                setDueRevisionOnly(e.target.checked);
                setCurrentIndex(0);
                setIsFlipped(false);
              }}
            />
            Due for Revision Only
          </label>
        </div>

        <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
          Reviewed this session: <strong style={{ color: 'var(--primary)' }}>{reviewedCount}</strong>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
          Loading active recall flashcards...
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          No cards match your filter.
        </div>
      ) : currentCard && (
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          {/* Card Meta */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span className="badge" style={{ fontSize: '12px' }}>
              {currentCard.subject_name}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
              Card {currentIndex + 1} of {filteredCards.length}
            </span>
          </div>

          {/* Interactive Flip Card */}
          <div
            onClick={() => setIsFlipped(!isFlipped)}
            style={{
              minHeight: '260px',
              borderRadius: '16px',
              background: isFlipped
                ? 'linear-gradient(135deg, var(--surface), rgba(62, 123, 224, 0.15))'
                : 'linear-gradient(135deg, var(--surface), var(--surface-hover))',
              border: isFlipped ? '2px solid var(--primary)' : '1px solid var(--border)',
              padding: '36px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 10px 28px rgba(0,0,0,0.1)'
            }}
          >
            <span className="pill" style={{ fontSize: '11px', marginBottom: '16px' }}>
              {isFlipped ? '💡 Concept Insight & Retention Rule' : '❓ Active Recall Prompt'}
            </span>

            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', lineHeight: '1.5' }}>
              {isFlipped ? currentCard.back : currentCard.front}
            </div>

            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '20px' }}>
              {currentCard.tip} &middot; Click to {isFlipped ? 'flip back' : 'reveal answer'}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
            <button
              className="btn sm"
              disabled={currentIndex === 0}
              onClick={handlePrev}
            >
              &larr; Previous Card
            </button>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn sm"
                onClick={() => {
                  if (onOpenTopicInStudio) {
                    onOpenTopicInStudio(currentCard.topic_id);
                  }
                }}
              >
                <Icon name="sparkles" size={13} /> Open Studio
              </button>
              <button
                className="btn sm good"
                onClick={handleMarkMastered}
              >
                ✓ Mark Mastered
              </button>
            </div>

            <button
              className="btn sm"
              disabled={currentIndex === filteredCards.length - 1}
              onClick={handleNext}
            >
              Next Card &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

