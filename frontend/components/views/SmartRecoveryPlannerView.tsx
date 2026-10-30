'use client';

import React, { useState, useEffect } from 'react';
import { Exam } from '@/types';
import { api } from '@/lib/api';
import { Icon } from '../Icons';

interface SmartRecoveryPlannerViewProps {
  token: string | null;
  activeExam: Exam | null;
  onNavigate: (view: string) => void;
  showToast: (msg: string) => void;
}

export const SmartRecoveryPlannerView: React.FC<SmartRecoveryPlannerViewProps> = ({
  token,
  activeExam,
  onNavigate,
  showToast
}) => {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [applying, setApplying] = useState(false);
  const [dailyHoursAdjustment, setDailyHoursAdjustment] = useState<number>(3.5);
  const [showAdjustModal, setShowAdjustModal] = useState(false);

  const loadRecoveryAnalysis = async () => {
    if (!token || !activeExam) return;
    setLoading(true);
    try {
      const res = await api.analyzeSmartRecovery(token, activeExam.id);
      setAnalysis(res);
      if (res.proposal?.feasibility_analysis?.current_daily_capacity_hours) {
        setDailyHoursAdjustment(res.proposal.feasibility_analysis.current_daily_capacity_hours);
      }
    } catch (e: any) {
      showToast(e.message || 'Failed to analyze recovery status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecoveryAnalysis();
  }, [token, activeExam]);

  const handleApplyRecovery = async (mode: string = 'accept_proposal') => {
    if (!token || !analysis?.proposal?.recovery_id) return;
    setApplying(true);
    try {
      const res = await api.applySmartRecovery(token, analysis.proposal.recovery_id, {
        plan_id: analysis.proposal.plan_id,
        apply_mode: mode
      });
      showToast(res.message || 'Smart Recovery plan applied successfully!');
      onNavigate('planner');
    } catch (e: any) {
      showToast(e.message || 'Failed to apply recovery plan');
    } finally {
      setApplying(false);
    }
  };

  const handleAdjustHoursAndReplan = async () => {
    if (!token || !activeExam) return;
    try {
      await api.createAdaptivePlan(token, {
        exam_id: activeExam.id,
        daily_study_hours: dailyHoursAdjustment,
        available_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        buffer_days: 3
      });
      showToast(`Study capacity updated to ${dailyHoursAdjustment} hrs/day and timetable recalculated.`);
      setShowAdjustModal(false);
      loadRecoveryAnalysis();
    } catch (e: any) {
      showToast(e.message || 'Failed to adjust daily hours');
    }
  };

  if (!activeExam) {
    return (
      <div className="view-container" style={{ padding: '40px', textAlign: 'center' }}>
        <div className="card" style={{ maxWidth: '500px', margin: '40px auto', padding: '36px' }}>
          <Icon name="calendar" size={40} />
          <h2 style={{ marginTop: '16px' }}>Select an Examination</h2>
          <p style={{ color: 'var(--muted)', margin: '12px 0 20px' }}>
            Please select an active examination to analyze study schedule recovery.
          </p>
          <button className="btn primary" onClick={() => onNavigate('exams')}>
            Go to My Exams
          </button>
        </div>
      </div>
    );
  }

  const proposal = analysis?.proposal || {};
  const feasibility = proposal.feasibility_analysis || {};
  const rescheduledTasks = proposal.rescheduled_tasks || [];
  const missedCount = analysis?.missed_tasks_count || 0;

  return (
    <div className="view-container" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--muted)', marginBottom: '4px' }}>
          <button className="linkbtn" onClick={() => onNavigate('planner')}>
            &larr; Study Planner
          </button>
          <span>/</span>
          <span>Smart Recovery Planner</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800 }}>
              Smart Recovery Planner
            </h1>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '14px' }}>
              Adaptive reschedule engine: recovers missed study sessions realistically without restarting your plan.
            </p>
          </div>
          <button className="btn sm" onClick={loadRecoveryAnalysis} disabled={loading}>
            <Icon name="refresh" size={14} /> Re-analyze Status
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
          <Icon name="refresh" size={32} />
          <div style={{ marginTop: '12px', fontSize: '16px', fontWeight: 600 }}>Analyzing missed sessions & timetable feasibility...</div>
        </div>
      ) : missedCount === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
          <h2 style={{ margin: 0, fontSize: '22px' }}>You are completely on track!</h2>
          <p style={{ color: 'var(--muted)', maxWidth: '520px', margin: '12px auto 24px' }}>
            No overdue or missed study sessions were detected for <strong>{activeExam.exam_name}</strong>.
            Your current timetable is fully synced with your exam deadline.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button className="btn primary" onClick={() => onNavigate('planner')}>
              View Current Timetable
            </button>
            <button className="btn" onClick={() => onNavigate('manage_syllabus')}>
              Explore Topics in AI Studio
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Status Diagnostic Card */}
          <div
            className="card"
            style={{
              padding: '24px',
              borderLeft: feasibility.is_feasible ? '5px solid #2ecc71' : '5px solid #e74c3c',
              background: feasibility.is_feasible ? 'rgba(46, 204, 113, 0.04)' : 'rgba(231, 76, 60, 0.04)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px' }}>{feasibility.is_feasible ? '⚡' : '⚠️'}</span>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                    {feasibility.is_feasible ? 'Feasible Recovery Plan Calculated' : 'High Workload Warning — Recovery Requires Adjustment'}
                  </h3>
                  <span className={`pill ${feasibility.is_feasible ? 'good' : 'danger'}`} style={{ fontSize: '11px' }}>
                    {feasibility.is_feasible ? 'Feasible Recovery' : 'Overload Risk'}
                  </span>
                </div>
                <p style={{ margin: '10px 0 0', fontSize: '14px', lineHeight: '1.6', color: 'var(--text)' }}>
                  {feasibility.explanation || proposal.analysis_summary}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '16px', background: 'var(--surface)', padding: '12px 18px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#e74c3c' }}>{missedCount}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Missed Tasks</div>
                </div>
                <div style={{ width: '1px', background: 'var(--border)' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)' }}>{feasibility.days_remaining_to_exam || 0}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Days to Exam</div>
                </div>
                <div style={{ width: '1px', background: 'var(--border)' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#f39c12' }}>{feasibility.required_daily_hours || 0}h</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Required/Day</div>
                </div>
              </div>
            </div>

            {/* Recommendations / Trade-offs */}
            <div style={{ marginTop: '18px', borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>
                  💡 Smart Agent Recommendations:
                </div>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', lineHeight: '1.5' }}>
                  {feasibility.recommendations?.map((rec: string, i: number) => (
                    <li key={i} style={{ color: 'var(--text)' }}>{rec}</li>
                  ))}
                </ul>
              </div>

              {feasibility.trade_offs?.length > 0 && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#e67e22', marginBottom: '6px' }}>
                    ⚖️ Realistic Trade-Offs Considered:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', lineHeight: '1.5' }}>
                    {feasibility.trade_offs?.map((to: string, i: number) => (
                      <li key={i} style={{ color: 'var(--text)' }}>{to}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Action Options Chooser */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '16px', fontWeight: 700 }}>
              Choose How to Handle Missed Days:
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
              <div
                style={{
                  border: '2px solid var(--primary)',
                  borderRadius: '10px',
                  padding: '16px',
                  background: 'rgba(62, 123, 224, 0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--primary)', marginBottom: '4px' }}>
                    Option 1: Replan Automatically
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>
                    Accept the AI proposed redistribution. Missed high-priority tasks are scheduled into future sessions while protecting revision days.
                  </p>
                </div>
                <button
                  className="btn primary sm"
                  style={{ marginTop: '14px' }}
                  disabled={applying}
                  onClick={() => handleApplyRecovery('accept_proposal')}
                >
                  {applying ? 'Applying Changes...' : 'Accept Recovery Schedule'}
                </button>
              </div>

              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
                    Option 2: Adjust Daily Hours First
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>
                    If workload is tight, increase daily available hours slightly so all topics fit comfortably before the exam date.
                  </p>
                </div>
                <button
                  className="btn sm"
                  style={{ marginTop: '14px' }}
                  onClick={() => setShowAdjustModal(true)}
                >
                  Adjust Study Capacity
                </button>
              </div>

              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
                    Option 3: Keep Existing Plan
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>
                    Ignore missed tasks for now and continue following your current timetable as originally scheduled.
                  </p>
                </div>
                <button
                  className="btn sm"
                  style={{ marginTop: '14px' }}
                  onClick={() => onNavigate('planner')}
                >
                  Keep Existing Schedule
                </button>
              </div>
            </div>
          </div>

          {/* Proposed Rescheduled Tasks Comparison Table */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
                Proposed Rescheduling Breakdown ({rescheduledTasks.length} tasks)
              </h3>
              <span className="badge" style={{ fontSize: '11px' }}>
                Preserves completed records & history
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left', color: 'var(--muted)' }}>
                    <th style={{ padding: '10px' }}>Topic & Subject</th>
                    <th style={{ padding: '10px' }}>Original Date</th>
                    <th style={{ padding: '10px' }}>New Proposed Date</th>
                    <th style={{ padding: '10px' }}>Est. Duration</th>
                    <th style={{ padding: '10px' }}>Priority</th>
                    <th style={{ padding: '10px' }}>Redistribution Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {rescheduledTasks.map((t: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 10px', fontWeight: 600 }}>
                        <div>{t.topic_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 400 }}>{t.subject_name}</div>
                      </td>
                      <td style={{ padding: '12px 10px', color: '#e74c3c' }}>
                        <span style={{ textDecoration: 'line-through' }}>{t.old_date}</span>
                      </td>
                      <td style={{ padding: '12px 10px', color: '#2ecc71', fontWeight: 700 }}>
                        {t.new_date}
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        {t.estimated_minutes} mins
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <span className={`pill ${t.priority === 'high' ? 'danger' : 'primary'}`} style={{ fontSize: '10px' }}>
                          {t.priority}
                        </span>
                      </td>
                      <td style={{ padding: '12px 10px', color: 'var(--muted)', fontSize: '12px' }}>
                        {t.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Capacity Modal */}
      {showAdjustModal && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowAdjustModal(false); }}>
          <div className="modal" style={{ maxWidth: '440px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '18px' }}>Adjust Daily Study Capacity</h3>
            <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 16px' }}>
              Temporarily increasing your daily hours gives the AI agent room to reschedule missed topics without compressing revision buffer days.
            </p>
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>
                Daily Study Hours: {dailyHoursAdjustment} hrs ({Math.round(dailyHoursAdjustment * 60)} mins)
              </label>
              <input
                type="range"
                min="1.0"
                max="8.0"
                step="0.5"
                value={dailyHoursAdjustment}
                onChange={(e) => setDailyHoursAdjustment(parseFloat(e.target.value))}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                <span>1 hr</span>
                <span>4 hrs</span>
                <span>8 hrs</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn sm" onClick={() => setShowAdjustModal(false)}>Cancel</button>
              <button className="btn primary sm" onClick={handleAdjustHoursAndReplan}>
                Save & Recalculate Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

