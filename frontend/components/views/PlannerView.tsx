'use client';

import React, { useState, useEffect } from 'react';
import { StudyPlan, Task } from '@/types';
import { addDays, fmtShort, fmtWd, parse, weekStartOf, today, fmtMins } from '@/lib/seed';
import { Icon } from '../Icons';

interface PlannerViewProps {
  plan: StudyPlan;
  weekStart: string;
  subjectFilter: string;
  onFilterChange: (subjectId: string) => void;
  onWeekChange: (newStart: string) => void;
  onAddTask: (date: string) => void;
  onEditTask: (task: Task) => void;
  onToggleTask: (taskId: string) => void;
  onMoveTask: (taskId: string, newDate: string) => void;
  onOpenTouchMove: (task: Task) => void;
  onOpenAIPlanner?: () => void;
}

export const PlannerView: React.FC<PlannerViewProps> = ({
  plan,
  weekStart,
  subjectFilter,
  onFilterChange,
  onWeekChange,
  onAddTask,
  onEditTask,
  onToggleTask,
  onMoveTask,
  onOpenTouchMove,
  onOpenAIPlanner
}) => {
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  const t = today();
  const currentWeekStart = weekStartOf(t);
  const isThisWeek = weekStart === currentWeekStart;

  const days = [0, 1, 2, 3, 4, 5, 6].map(i => addDays(weekStart, i));
  const inWeek = plan.tasks.filter(x => x.date >= days[0] && x.date <= days[6]);
  const planned = inWeek.reduce((a, x) => a + x.mins, 0);
  const completed = inWeek.filter(x => x.done).length;

  // Track which day cards are opened row-wise
  const [openDays, setOpenDays] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    days.forEach(d => {
      const hasTasks = plan.tasks.some(x => x.date === d);
      // Default: Today and days with tasks are open
      if (d === t || hasTasks) {
        initial[d] = true;
      }
    });
    return initial;
  });

  // Keep openDays aligned if weekStart changes
  useEffect(() => {
    setOpenDays(prev => {
      const updated = { ...prev };
      days.forEach(d => {
        if (updated[d] === undefined) {
          const hasTasks = plan.tasks.some(x => x.date === d);
          if (d === t || hasTasks) {
            updated[d] = true;
          }
        }
      });
      return updated;
    });
  }, [weekStart]);

  const toggleDay = (date: string) => {
    setOpenDays(prev => ({
      ...prev,
      [date]: !prev[date]
    }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    days.forEach(d => { all[d] = true; });
    setOpenDays(all);
  };

  const collapseAll = () => {
    setOpenDays({});
  };

  const getSubj = (id: string) =>
    plan.subjects.find(s => s.id === id) || { id: '', name: 'General', color: '#7A8899', topics: [] };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggingTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', taskId);
    } catch (err) {}
  };

  const handleDragOver = (e: React.DragEvent, date: string) => {
    e.preventDefault();
    setDragOverDate(date);
  };

  const handleDragLeave = () => {
    setDragOverDate(null);
  };

  const handleDrop = (e: React.DragEvent, date: string) => {
    e.preventDefault();
    const taskId = draggingTaskId || e.dataTransfer.getData('text/plain');
    if (taskId) {
      onMoveTask(taskId, date);
      // Ensure target day is opened so the student sees the dropped task
      setOpenDays(prev => ({ ...prev, [date]: true }));
    }
    setDraggingTaskId(null);
    setDragOverDate(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header */}
      <div className="pagehead">
        <div>
          <p className="eyebrow">Weekly planner</p>
          <h1>{fmtShort(days[0])} to {fmtShort(days[6])}</h1>
          <p className="lede">Day cards are organized row-wise. Click any day row to expand and view or manage tasks.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div className="weeknav">
            <button
              className="tbtn iconly"
              onClick={() => onWeekChange(addDays(weekStart, -7))}
              aria-label="Previous week"
            >
              <Icon name="left" />
            </button>
            <button
              className="tbtn"
              onClick={() => onWeekChange(currentWeekStart)}
              disabled={isThisWeek}
              style={{ opacity: isThisWeek ? 0.6 : 1 }}
            >
              This week
            </button>
            <button
              className="tbtn iconly"
              onClick={() => onWeekChange(addDays(weekStart, 7))}
              aria-label="Next week"
            >
              <Icon name="right" />
            </button>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {onOpenAIPlanner && (
              <button className="btn primary sm" onClick={onOpenAIPlanner} title="Plan study schedule with AI">
                <Icon name="sparkles" size={13} /> AI Plan Schedule
              </button>
            )}
            <button className="btn sm" onClick={expandAll} title="Expand all day cards">
              Expand all
            </button>
            <button className="btn sm" onClick={collapseAll} title="Collapse all day cards">
              Collapse all
            </button>
          </div>
        </div>
      </div>

      {/* Week Totals */}
      <div className="weeksum">
        <span><b>{inWeek.length}</b> tasks</span>
        <span><b>{fmtMins(planned)}</b> planned</span>
        <span><b>{completed}</b> completed</span>
      </div>

      {/* Subject Filter Chips */}
      <div className="chips" role="group" aria-label="Filter tasks by subject">
        <button
          className="chip"
          aria-pressed={subjectFilter === 'all'}
          onClick={() => onFilterChange('all')}
        >
          All subjects
        </button>
        {plan.subjects.map(s => (
          <button
            key={s.id}
            className="chip"
            aria-pressed={subjectFilter === s.id}
            onClick={() => onFilterChange(s.id)}
          >
            <i className="dot" style={{ background: s.color }}></i>
            {s.name}
          </button>
        ))}
      </div>

      {/* 7 Days Row-Wise with Expandable Content */}
      <div className="week">
        {days.map(d => {
          const list = plan.tasks
            .filter(x => x.date === d && (subjectFilter === 'all' || x.subjectId === subjectFilter))
            .sort((a, b) => Number(a.done) - Number(b.done) || a.title.localeCompare(b.title));
          const load = list.filter(x => !x.done).reduce((a, x) => a + x.mins, 0);
          const doneCount = list.filter(x => x.done).length;
          const isToday = d === t;
          const isOpen = Boolean(openDays[d]);
          const isOver = dragOverDate === d;

          const dateObj = parse(d);
          const dateLong = dateObj.toLocaleDateString('en-IN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
          });

          // Unique subject colors for preview dots
          const subjectIds = Array.from(new Set(list.map(x => x.subjectId)));
          const daySubjects = subjectIds.map(id => getSubj(id));

          return (
            <div
              key={d}
              className={`day-card ${isToday ? 'today' : ''} ${isOpen ? 'open' : ''}`}
            >
              {/* Day Row Header: Click to Open / Close */}
              <div
                className="day-header"
                onClick={() => toggleDay(d)}
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleDay(d);
                  }
                }}
              >
                <div className="day-header-left">
                  <div className="day-date-badge">
                    <span className="wd">{fmtWd(d)}</span>
                    <span className="dn num">{dateObj.getDate()}</span>
                  </div>

                  <div className="day-info">
                    <div className="day-info-top">
                      <span className="day-name">{dateLong}</span>
                      {isToday && <span className="pill accent">Today</span>}
                      <span className={`pill ${load ? 'warn' : list.length ? 'good' : ''}`}>
                        {load ? `${fmtMins(load)} to do` : list.length ? 'All done' : 'Free'}
                      </span>
                    </div>

                    <div className="day-info-meta">
                      <span><b>{list.length}</b> {list.length === 1 ? 'task' : 'tasks'}</span>
                      {doneCount > 0 && <span>&middot; {doneCount} completed</span>}
                      {daySubjects.length > 0 && (
                        <div className="day-dots-preview">
                          <span>&middot;</span>
                          {daySubjects.map(s => (
                            <i
                              key={s.id}
                              className="dot"
                              style={{ background: s.color }}
                              title={s.name}
                            ></i>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="day-header-right">
                  <button
                    type="button"
                    className="btn sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddTask(d);
                    }}
                    title="Add task to this day"
                  >
                    <Icon name="plus" size={13} /> Add task
                  </button>

                  <span className="toggle-arrow-btn">
                    <span>{isOpen ? 'Close' : 'Open'}</span>
                    <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={14} />
                  </span>
                </div>
              </div>

              {/* Day Body: Visible on Open */}
              {isOpen && (
                <div className="day-body">
                  <div
                    className={`daytasks ${isOver ? 'over' : ''}`}
                    onDragOver={(e) => handleDragOver(e, d)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, d)}
                  >
                    {list.length > 0 ? (
                      list.map(task => {
                        const s = getSubj(task.subjectId);
                        const isDragging = draggingTaskId === task.id;

                        return (
                          <div
                            key={task.id}
                            className={`tcard ${task.done ? 'done' : ''} ${isDragging ? 'dragging' : ''}`}
                            draggable
                            onDragStart={(e) => handleDragStart(e, task.id)}
                            onDragEnd={() => setDraggingTaskId(null)}
                          >
                            <button
                              className="check"
                              role="checkbox"
                              aria-checked={task.done}
                              aria-label={`Mark done: ${task.title}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleTask(task.id);
                              }}
                            >
                              <Icon name="check" size={14} />
                            </button>

                            <button
                              className="ttl"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditTask(task);
                              }}
                            >
                              {task.title}
                            </button>

                            <button
                              className="iconbtn"
                              style={{ width: '28px', height: '28px' }}
                              title="Touch move / Reschedule day"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenTouchMove(task);
                              }}
                            >
                              <Icon name="move" size={14} />
                            </button>

                            <div className="meta">
                              <span>
                                <i className="dot" style={{ background: s.color }}></i>
                                {s.name}
                              </span>
                              <span className="mono">{fmtMins(task.mins)}</span>
                              {task.prio === 'high' && <span className="pill crit">High</span>}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="empty" style={{ gridColumn: '1 / -1', padding: '16px' }}>
                        No tasks planned for {fmtWd(d)}. Click below to add one.
                      </div>
                    )}

                    <button
                      type="button"
                      className="addslot"
                      onClick={() => onAddTask(d)}
                    >
                      <Icon name="plus" size={15} /> Add task for {fmtWd(d)}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
