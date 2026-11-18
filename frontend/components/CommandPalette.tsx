'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Exam } from '@/types';
import { Icon } from './Icons';

export interface CommandItem {
  id: string;
  label: string;
  description: string;
  group: 'Navigation' | 'Quick Actions' | 'Switch Exam' | 'Appearance';
  icon: string;
  keywords?: string;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
  allExams: Exam[];
  activeExam: Exam | null;
  onSelectExam: (exam: Exam) => void;
  onStartQuickFocus: () => void;
  isDark: boolean;
  toggleTheme: () => void;
  accentTheme: string;
  onChangeAccent: (accent: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  onNavigate,
  allExams,
  activeExam,
  onSelectExam,
  onStartQuickFocus,
  isDark,
  toggleTheme,
  accentTheme,
  onChangeAccent
}) => {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items: CommandItem[] = useMemo(() => {
    const navItems: CommandItem[] = [
      { id: 'nav-dash', label: 'Dashboard', description: 'Executive study overview, readiness & today queue', group: 'Navigation', icon: 'home', keywords: 'home overview stats', action: () => onNavigate('dashboard') },
      { id: 'nav-exams', label: 'My Examinations', description: 'Create, switch, or manage target exams', group: 'Navigation', icon: 'award', keywords: 'goals targets exam', action: () => onNavigate('exams') },
      { id: 'nav-planner', label: 'Study Planner', description: 'Adaptive difficulty-weighted schedule & recovery', group: 'Navigation', icon: 'calendar', keywords: 'schedule tasks roadmap', action: () => onNavigate('planner') },
      { id: 'nav-timetable', label: 'Daily & Weekly Timetable', description: 'Time-slotted study blocks and daily schedule', group: 'Navigation', icon: 'clock', keywords: 'calendar hours daily', action: () => onNavigate('timetable') },
      { id: 'nav-ai-classes', label: 'AI Classes & Learning Studio', description: 'Interactive lessons, animated videos, diagrams & AI tutor', group: 'Navigation', icon: 'sparkles', keywords: 'video lesson studio avatar', action: () => onNavigate('ai_classes') },
      { id: 'nav-syllabus', label: 'Subjects & Syllabus', description: 'Browse curriculum hierarchy and upload new syllabus', group: 'Navigation', icon: 'layers', keywords: 'topics units pdf upload', action: () => onNavigate('manage_syllabus') },
      { id: 'nav-practice', label: 'Practice & Assessments', description: 'Topic MCQs, numerical drills & instant explanations', group: 'Navigation', icon: 'check-circle', keywords: 'quiz mcq questions', action: () => onNavigate('practice') },
      { id: 'nav-mock', label: 'CBT Mock Tests', description: 'Timed full-syllabus & subject computer-based exams', group: 'Navigation', icon: 'play', keywords: 'test cbt simulation', action: () => onNavigate('mock_config') },
      { id: 'nav-pyp', label: 'Previous-Year Papers & Trends', description: 'Analyze past exam papers and AI predicted tests', group: 'Navigation', icon: 'file-text', keywords: 'pyq past papers predicted', action: () => onNavigate('pyp_library') },
      { id: 'nav-revision', label: 'Spaced Revision Queue', description: 'Active recall ladder & flashcards due today', group: 'Navigation', icon: 'brain', keywords: 'spaced repetition flashcards', action: () => onNavigate('smart_revision') },
      { id: 'nav-analytics', label: 'Progress & Analytics', description: 'Readiness index, topic mastery & weak-area diagnostics', group: 'Navigation', icon: 'bar-chart', keywords: 'insights charts scores', action: () => onNavigate('analytics') },
      { id: 'nav-ai', label: 'AI Study Assistant', description: 'Ask doubts, generate summaries & study strategies', group: 'Navigation', icon: 'robot', keywords: 'chat tutor mentor', action: () => onNavigate('ai') },
      { id: 'nav-account', label: 'Profile & Settings', description: 'Daily study targets, preferences & account sync', group: 'Navigation', icon: 'user', keywords: 'settings profile password', action: () => onNavigate('account') },
    ];

    const quickActions: CommandItem[] = [
      { id: 'act-focus', label: 'Start 25-Minute Focus Session', description: 'Launch Pomodoro deep-work timer immediately', group: 'Quick Actions', icon: 'zap', shortcut: 'F', keywords: 'pomodoro timer study', action: onStartQuickFocus },
      { id: 'act-upload', label: 'Upload Syllabus Document', description: 'Extract hierarchy from PDF, DOCX, Excel, CSV or Image', group: 'Quick Actions', icon: 'upload', keywords: 'import syllabus ocr', action: () => onNavigate('upload_syllabus') },
      { id: 'act-recovery', label: 'Smart Recovery Planner', description: 'Auto-reschedule missed tasks intelligently', group: 'Quick Actions', icon: 'refresh', keywords: 'missed backlog catchup', action: () => onNavigate('smart_recovery') },
    ];

    const examActions: CommandItem[] = allExams.map((ex) => ({
      id: `exam-${ex.id}`,
      label: ex.exam_name,
      description: activeExam?.id === ex.id ? 'Currently active exam' : `Switch workspace to ${ex.exam_category} target`,
      group: 'Switch Exam',
      icon: 'target',
      keywords: `exam switch ${ex.exam_category}`,
      action: () => onSelectExam(ex)
    }));

    const appearanceActions: CommandItem[] = [
      { id: 'app-theme', label: isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode', description: 'Toggle between crisp daylight and obsidian dark interface', group: 'Appearance', icon: isDark ? 'sun' : 'moon', keywords: 'theme dark light mode', action: toggleTheme },
      ...(['indigo', 'emerald', 'ocean', 'violet', 'rose'] as const).map((acc) => ({
        id: `acc-${acc}`,
        label: `Accent Theme: ${acc.charAt(0).toUpperCase() + acc.slice(1)}`,
        description: accentTheme === acc ? 'Currently active accent color' : `Apply ${acc} professional palette across StudyPilot`,
        group: 'Appearance' as const,
        icon: 'palette',
        keywords: `color theme palette ${acc}`,
        action: () => onChangeAccent(acc)
      }))
    ];

    return [...quickActions, ...navItems, ...examActions, ...appearanceActions];
  }, [allExams, activeExam, isDark, accentTheme, onNavigate, onSelectExam, onStartQuickFocus, toggleTheme, onChangeAccent]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.label.toLowerCase().includes(q) ||
        it.description.toLowerCase().includes(q) ||
        it.group.toLowerCase().includes(q) ||
        (it.keywords && it.keywords.toLowerCase().includes(q))
    );
  }, [items, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((prev) => (filtered.length > 0 ? (prev + 1) % filtered.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((prev) => (filtered.length > 0 ? (prev - 1 + filtered.length) % filtered.length : 0));
      } else if (e.key === 'Enter' && filtered[selectedIdx]) {
        e.preventDefault();
        filtered[selectedIdx].action();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, filtered, selectedIdx, onClose]);

  if (!open) return null;

  // Group filtered items while preserving global index for keyboard navigation
  const groups: Array<{ name: string; entries: Array<{ item: CommandItem; index: number }> }> = [];
  const groupMap = new Map<string, Array<{ item: CommandItem; index: number }>>();
  filtered.forEach((item, index) => {
    if (!groupMap.has(item.group)) {
      const arr: Array<{ item: CommandItem; index: number }> = [];
      groupMap.set(item.group, arr);
      groups.push({ name: item.group, entries: arr });
    }
    groupMap.get(item.group)!.push({ item, index });
  });

  return (
    <div className="cmd-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Command Palette">
      <div className="cmd-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="cmd-input-wrap">
          <Icon name="search" size={18} style={{ color: 'var(--accent)' }} />
          <input
            ref={inputRef}
            className="cmd-input"
            type="text"
            placeholder="Jump to view, switch exam, start focus, or change theme..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="cmd-trigger-kbd">ESC</kbd>
        </div>

        <div className="cmd-list">
          {filtered.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: '13.5px' }}>
              No matching commands for &ldquo;{query}&rdquo;.
            </div>
          ) : (
            groups.map((grp) => (
              <div key={grp.name} style={{ marginBottom: '6px' }}>
                <div className="cmd-group-label">{grp.name}</div>
                {grp.entries.map(({ item, index }) => (
                  <button
                    key={item.id}
                    className={`cmd-item ${index === selectedIdx ? 'selected' : ''}`}
                    onMouseEnter={() => setSelectedIdx(index)}
                    onClick={() => {
                      item.action();
                      onClose();
                    }}
                  >
                    <span className="cmd-item-icon">
                      <Icon name={item.icon} size={15} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, lineHeight: 1.25 }}>
                        {item.label}
                      </span>
                      <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.description}
                      </span>
                    </span>
                    {item.shortcut && <kbd className="cmd-trigger-kbd">{item.shortcut}</kbd>}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        <div className="cmd-footer">
          <span>Use <strong>&uarr; &darr;</strong> to navigate &middot; <strong>Enter</strong> to execute</span>
          <span className="mono" style={{ opacity: 0.8 }}>StudyPilot Command</span>
        </div>
      </div>
    </div>
  );
};

