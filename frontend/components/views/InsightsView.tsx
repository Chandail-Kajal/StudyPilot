'use client';

import React from 'react';
import { StudyPlan } from '@/types';
import { addDays, fmtMins, fmtShort, fmtWd, today, weekStartOf } from '@/lib/seed';

interface InsightsViewProps {
  plan: StudyPlan;
}

export const InsightsView: React.FC<InsightsViewProps> = ({ plan }) => {
  const t = today();
  const minsOn = (d: string) =>
    plan.sessions.filter(s => s.date === d).reduce((a, s) => a + s.mins, 0);

  // 7 days data
  const days: Array<{ date: string; mins: number; label: string; full: string; isToday: boolean }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(t, -i);
    days.push({
      date: d,
      mins: minsOn(d),
      label: fmtWd(d),
      full: fmtShort(d),
      isToday: i === 0
    });
  }

  const totalMins = days.reduce((a, d) => a + d.mins, 0);
  const bestDay = days.reduce((a, d) => (d.mins > a.mins ? d : a), days[0]);
  const hitGoalDays = days.filter(d => d.mins >= plan.goalMins).length;

  const currentWs = weekStartOf(t);
  const weekTasks = plan.tasks.filter(
    x => x.date >= currentWs && x.date <= addDays(currentWs, 6)
  );
  const weekDone = weekTasks.filter(x => x.done).length;

  // Streak
  let streak = 0;
  let checkD = t;
  if (minsOn(checkD) === 0) checkD = addDays(checkD, -1);
  while (minsOn(checkD) > 0 && streak < 400) {
    streak++;
    checkD = addDays(checkD, -1);
  }

  // Subject split over last 7 days
  const bySubj: { [subjectId: string]: number } = {};
  plan.sessions
    .filter(s => s.date >= days[0].date)
    .forEach(s => {
      bySubj[s.subjectId] = (bySubj[s.subjectId] || 0) + s.mins;
    });

  const subjectRows = Object.keys(bySubj)
    .map(k => ({ id: k, mins: bySubj[k] }))
    .sort((a, b) => b.mins - a.mins);
  const maxSubjectMins = subjectRows.length ? subjectRows[0].mins : 1;

  const getSubj = (id: string) =>
    plan.subjects.find(s => s.id === id) || { id: '', name: 'General', color: '#7A8899', topics: [] };

  // SVG Chart Geometry
  const W = 640;
  const H = 250;
  const L = 44;
  const R = 10;
  const T = 24;
  const B = 30;
  const goal = plan.goalMins || 180;
  const maxV = Math.max(goal, 60, ...days.map(d => d.mins));
  const step = maxV > 360 ? 120 : 60;
  const topY = Math.ceil((maxV * 1.1) / step) * step;
  const iw = W - L - R;
  const ih = H - T - B;
  const bw = iw / days.length;
  const getY = (v: number) => T + ih - (v / (topY || 1)) * ih;

  const gridLines = [];
  for (let v = 0; v <= topY; v += step) {
    gridLines.push({ val: v, y: getY(v) });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="pagehead">
        <div>
          <p className="eyebrow">Insights &amp; Analytics</p>
          <h1>Your last 7 days</h1>
          <p className="lede">
            You reached your daily goal on {hitGoalDays} of the last 7 days.
          </p>
        </div>
      </div>

      {/* KPI 4-Stat Strip */}
      <div className="strip">
        <div>
          <div className="k">Studied</div>
          <div className="v num">{fmtMins(totalMins)}</div>
          <div className="d">last 7 days</div>
        </div>
        <div>
          <div className="k">Daily average</div>
          <div className="v num">{fmtMins(Math.round(totalMins / 7))}</div>
          <div className="d">goal {fmtMins(goal)}</div>
        </div>
        <div>
          <div className="k">Best day</div>
          <div className="v num">{fmtMins(bestDay.mins)}</div>
          <div className="d">{bestDay.mins ? bestDay.full : 'no sessions yet'}</div>
        </div>
        <div>
          <div className="k">Tasks this week</div>
          <div className="v num">{weekDone}/{weekTasks.length}</div>
          <div className="d">{streak}-day streak</div>
        </div>
      </div>

      <div className="insgrid">
        {/* 7-Day Chart */}
        <section className="card">
          <div className="cardhead">
            <h2>Study time per day</h2>7
          </div>
          <div className="chartbox">
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Study minutes per day for the last 7 days">
              {gridLines.map(line => (
                <g key={line.val}>
                  <line
                    x1={L}
                    x2={W - R}
                    y1={line.y}
                    y2={line.y}
                    stroke="var(--line)"
                    strokeWidth="1"
                  />
                  <text className="ax" x={L - 8} y={line.y + 4} textAnchor="end">
                    {line.val / 60}h
                  </text>
                </g>
              ))}

              {days.map((d, i) => {
                const x = L + i * bw + bw * 0.2;
                const w = bw * 0.6;
                const yy = getY(d.mins);
                const h = T + ih - yy;

                return (
                  <g key={d.date}>
                    {d.mins > 0 && (
                      <>
                        <rect
                          x={x}
                          y={yy}
                          width={w}
                          height={h}
                          rx="6"
                          fill="var(--accent)"
                          opacity={d.isToday ? 1 : 0.6}
                        >
                          <title>{`${d.full}: ${fmtMins(d.mins)}`}</title>
                        </rect>
                        <text
                          className="ax"
                          x={x + w / 2}
                          y={yy - 6}
                          textAnchor="middle"
                        >
                          {(d.mins / 60).toFixed(1)}h
                        </text>
                      </>
                    )}
                    <text
                      className={d.isToday ? 'axb' : 'ax'}
                      x={x + w / 2}
                      y={H - 9}
                      textAnchor="middle"
                    >
                      {d.label}
                    </text>
                  </g>
                );
              })}

              {/* Daily Goal Target Line */}
              <line
                x1={L}
                x2={W - R}
                y1={getY(goal)}
                y2={getY(goal)}
                stroke="var(--amber)"
                strokeWidth="2"
                strokeDasharray="6 5"
              />
            </svg>
          </div>

          <div className="legend">
            <span>
              <i></i> Study time
            </span>
            <span>
              <i className="goal"></i> Daily goal ({fmtMins(goal)})
            </span>
          </div>
        </section>

        {/* Breakdown by Subject */}
        <section className="card">
          <div className="cardhead">
            <h2>By subject</h2>
          </div>
          {subjectRows.length > 0 ? (
            <div>
              {subjectRows.map(r => {
                const s = getSubj(r.id);
                const pct = Math.round((r.mins / maxSubjectMins) * 100);
                return (
                  <div key={r.id} className="splitrow">
                    <span className="nm">
                      <i className="dot" style={{ background: s.color }}></i>
                      {s.name}
                    </span>
                    <div className="bar">
                      <i style={{ width: `${pct}%`, background: s.color }}></i>
                    </div>
                    <span className="val">{fmtMins(r.mins)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty">Log your study sessions to see your subject breakdown.</div>
          )}
          <p className="hint" style={{ marginTop: '14px' }}>
            Share of study time across subjects over the last 7 days.
          </p>
        </section>
      </div>
    </div>
  );
};
