'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api, getUser, getPermissions, normalizeRole } from '../../lib/auth';
import { canUsePermission } from '../../lib/nav';
import { formatDate, todayISO, v } from '../../lib/format';
import { useCompanyFilter } from '../../lib/useCompanyFilter';
import { getInstantEmployees, loadEmployeesFast } from '../../lib/employeeCache';
import { fetchPerformanceGoalsDirect, fetchPerformanceReviewsDirect } from '../../lib/dbDirect';

const BOX_CONFIG = {
  high_high: { title: 'Superstar / Top Talent', subtitle: 'High Perf · High Pot', color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: '#10b981' },
  med_high: { title: 'Growth Potential / Future Leader', subtitle: 'Med Perf · High Pot', color: '#06b6d4', bg: 'rgba(6,182,212,0.12)', border: '#06b6d4' },
  low_high: { title: 'Enigma / Rough Diamond', subtitle: 'Low Perf · High Pot', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', border: '#8b5cf6' },
  high_med: { title: 'High Performer / Star Contributor', subtitle: 'High Perf · Med Pot', color: '#14b8a6', bg: 'rgba(20,184,166,0.12)', border: '#2dd4bf' },
  med_med: { title: 'Core Performer / Key Contributor', subtitle: 'Med Perf · Med Pot', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', border: '#60a5fa' },
  low_med: { title: 'Dilemma / Inconsistent', subtitle: 'Low Perf · Med Pot', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: '#f59e0b' },
  high_low: { title: 'Trusted Professional / Specialist', subtitle: 'High Perf · Low Pot', color: '#6366f1', bg: 'rgba(99,102,241,0.12)', border: '#818cf8' },
  med_low: { title: 'Effective / Solid Professional', subtitle: 'Med Perf · Low Pot', color: '#64748b', bg: 'rgba(100,116,139,0.12)', border: '#94a3b8' },
  low_low: { title: 'Risk / Underperformer', subtitle: 'Low Perf · Low Pot', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: '#ef4444' },
};

export default function PerformancePage() {
  const role = normalizeRole(getUser());
  const permissions = getPermissions(getUser());
  const canManage = canUsePermission(role, permissions, 'performance.view');
  const { filteredEmpIds } = useCompanyFilter();

  const [activeTab, setActiveTab] = useState('goals'); // 'goals', 'reviews', 'templates', '360', 'nine_box'
  const [goals, setGoals] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('gocs_cached_perf_goals');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return [];
  });
  const [reviews, setReviews] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('gocs_cached_perf_reviews');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return [];
  });
  const [templates, setTemplates] = useState([]);
  const [peerNominations, setPeerNominations] = useState([]);
  const [nineBoxData, setNineBoxData] = useState(null);
  const [employees, setEmployees] = useState(() => getInstantEmployees());

  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Expanded parent goals accordion
  const [expandedGoals, setExpandedGoals] = useState(new Set());

  // Modals & UI forms
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showNominationModal, setShowNominationModal] = useState(false);
  const [showRemindersModal, setShowRemindersModal] = useState(false);
  const [selectedBoxDrillDown, setSelectedBoxDrillDown] = useState(null);
  const [viewingPeerFeedback, setViewingPeerFeedback] = useState(null);

  // Forms
  const [goalForm, setGoalForm] = useState({
    employeeId: '',
    parentGoalId: '',
    title: '',
    kpi: '',
    targetValue: '',
    targetMetric: '',
    currentMetric: '',
    weightage: 100,
    progressPct: 0,
    dueDate: '',
    periodLabel: 'H2 2026',
    fileRef: '',
  });

  const [reviewForm, setReviewForm] = useState({
    employeeId: '',
    reviewerName: '',
    reviewType: 'annual',
    templateId: '',
    rating: '4.0',
    potentialRating: '3.5',
    summary: '',
    reviewDate: todayISO(),
    answers: {},
    fileRef: '',
    employeeType: 'full_time',
  });
  const [employeeTypeFilter, setEmployeeTypeFilter] = useState('all');

  const [templateForm, setTemplateForm] = useState({
    title: '',
    description: '',
    reviewType: 'annual',
    targetEmployeeType: 'all',
    sections: [
      {
        title: 'Core Competencies',
        weight: 50,
        questions: [
          { id: 'q1', label: 'Technical Execution & Quality', description: 'Delivers high quality outputs with minimal rework', scale: 5 },
          { id: 'q2', label: 'Problem Solving & Initiative', description: 'Proactive and creative in resolving challenges', scale: 5 }
        ]
      },
      {
        title: 'Culture & Collaboration',
        weight: 50,
        questions: [
          { id: 'q3', label: 'Teamwork & Communication', description: 'Collaborates effectively across cross-functional teams', scale: 5 }
        ]
      }
    ]
  });

  const [nominationForm, setNominationForm] = useState({
    reviewId: '',
    nomineeId: '',
    reviewerId: '',
    isAnonymous: true,
  });

  const [reminderForm, setReminderForm] = useState({
    reviewType: 'annual',
    stage: 'Self-Evaluation & Sign-Off',
    dueDate: '2026-11-30',
  });

  // Load everything
  const load = useCallback(() => {
    setError('');
    loadEmployeesFast(setEmployees);

    // Fast Neon direct fetch
    fetchPerformanceGoalsDirect()
      .then((directGoals) => {
        if (Array.isArray(directGoals) && directGoals.length > 0) {
          setGoals(directGoals);
          try { localStorage.setItem('gocs_cached_perf_goals', JSON.stringify(directGoals)); } catch {}
        }
      })
      .catch(() => {});

    fetchPerformanceReviewsDirect()
      .then((directReviews) => {
        if (Array.isArray(directReviews) && directReviews.length > 0) {
          setReviews(directReviews);
          try { localStorage.setItem('gocs_cached_perf_reviews', JSON.stringify(directReviews)); } catch {}
        }
      })
      .catch(() => {});

    // Primary API fetches
    Promise.allSettled([
      api('/performance/goals'),
      api('/performance/reviews'),
      api('/performance/templates'),
      api('/performance/peer-nominations'),
      api('/performance/analytics/nine-box')
    ]).then(([gRes, rRes, tRes, pRes, nbRes]) => {
      if (gRes.status === 'fulfilled' && Array.isArray(gRes.value)) {
        setGoals(gRes.value);
        try { localStorage.setItem('gocs_cached_perf_goals', JSON.stringify(gRes.value)); } catch {}
      }
      if (rRes.status === 'fulfilled' && Array.isArray(rRes.value)) {
        setReviews(rRes.value);
        try { localStorage.setItem('gocs_cached_perf_reviews', JSON.stringify(rRes.value)); } catch {}
      }
      if (tRes.status === 'fulfilled' && Array.isArray(tRes.value)) {
        setTemplates(tRes.value);
      }
      if (pRes.status === 'fulfilled' && Array.isArray(pRes.value)) {
        setPeerNominations(pRes.value);
      }
      if (nbRes.status === 'fulfilled' && nbRes.value) {
        setNineBoxData(nbRes.value);
      }
    }).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Hierarchical Goals organization
  const { parentGoals, subGoalsMap } = useMemo(() => {
    const filtered = goals.filter(g => !filteredEmpIds || filteredEmpIds.has(String(v(g, 'employeeId', 'employee_id') || '')));
    const parents = [];
    const childrenMap = {};

    filtered.forEach(g => {
      const pid = v(g, 'parentGoalId', 'parent_goal_id');
      if (pid) {
        if (!childrenMap[pid]) childrenMap[pid] = [];
        childrenMap[pid].push(g);
      } else {
        parents.push(g);
      }
    });

    return { parentGoals: parents, subGoalsMap: childrenMap };
  }, [goals, filteredEmpIds]);

  const toggleExpand = (id) => {
    setExpandedGoals(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Task 5.2: File Upload Helper
  async function handleFileUpload(file, onSuccess) {
    if (!file) return;
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/performance/upload-attachment', {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed');
      }
      const data = await res.json();
      onSuccess(data.fileUrl || data.url);
      setMsg(`File "${file.name}" uploaded successfully.`);
    } catch (e) {
      setError(e.message || 'Failed to upload attachment');
    }
  }

  // Actions
  async function saveGoal(e) {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      await api('/performance/goals', {
        method: 'POST',
        body: JSON.stringify({
          ...goalForm,
          employeeId: Number(goalForm.employeeId),
          parentGoalId: goalForm.parentGoalId ? Number(goalForm.parentGoalId) : null,
          weightage: Number(goalForm.weightage) || 100,
          progressPct: Number(goalForm.progressPct) || 0,
          fileRef: goalForm.fileRef || undefined,
        }),
      });
      setMsg('Goal successfully created.');
      setShowGoalModal(false);
      setGoalForm({
        employeeId: '',
        parentGoalId: '',
        title: '',
        kpi: '',
        targetValue: '',
        targetMetric: '',
        currentMetric: '',
        weightage: 100,
        progressPct: 0,
        dueDate: '',
        periodLabel: 'H2 2026',
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function bumpProgress(id, current) {
    setMsg('');
    setError('');
    const next = Math.min(100, Number(current || 0) + 10);
    try {
      const body = role === 'employee'
        ? { progressPct: next }
        : { progressPct: next, status: next >= 100 ? 'completed' : 'active' };
      await api(`/performance/goals/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setMsg(`Progress updated to ${next}%.`);
      load();
    } catch (e) {
      setError(e.message || 'Failed to update progress.');
    }
  }

  async function saveReview(e) {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      await api('/performance/reviews', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: Number(reviewForm.employeeId),
          reviewerName: reviewForm.reviewerName,
          reviewType: reviewForm.reviewType,
          rating: reviewForm.rating === '' ? null : Number(reviewForm.rating),
          potentialRating: reviewForm.potentialRating === '' ? 3.0 : Number(reviewForm.potentialRating),
          summary: reviewForm.summary,
          reviewDate: reviewForm.reviewDate,
          templateId: reviewForm.templateId ? Number(reviewForm.templateId) : null,
          answersJson: reviewForm.answers,
          status: 'submitted',
          fileRef: reviewForm.fileRef || undefined,
          employeeType: reviewForm.employeeType || 'full_time'
        }),
      });
      setMsg('Appraisal review submitted successfully.');
      setShowReviewModal(false);
      setReviewForm({
        employeeId: '',
        reviewerName: '',
        reviewType: 'annual',
        templateId: '',
        rating: '4.0',
        potentialRating: '3.5',
        summary: '',
        reviewDate: todayISO(),
        answers: {},
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function setReviewStatus(id, status) {
    try {
      await api(`/performance/reviews/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setMsg(`Review status updated to ${status}.`);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function saveTemplate(e) {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      await api('/performance/templates', {
        method: 'POST',
        body: JSON.stringify({
          title: templateForm.title,
          description: templateForm.description,
          reviewType: templateForm.reviewType,
          sectionsJson: templateForm.sections,
          isActive: true
        })
      });
      setMsg('Appraisal rubric template created.');
      setShowTemplateModal(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveNomination(e) {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      await api('/performance/peer-nominations', {
        method: 'POST',
        body: JSON.stringify({
          reviewId: Number(nominationForm.reviewId),
          nomineeId: Number(nominationForm.nomineeId),
          reviewerId: Number(nominationForm.reviewerId),
          isAnonymous: Boolean(nominationForm.isAnonymous)
        })
      });
      setMsg('Peer reviewer nominated successfully.');
      setShowNominationModal(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateNominationStatus(id, status) {
    setMsg('');
    setError('');
    try {
      await api(`/performance/peer-nominations/${id}/approve`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      setMsg(`Nomination marked as ${status}.`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function dispatchReminders() {
    setMsg('');
    setError('');
    setLoading(true);
    try {
      const res = await api('/performance/reminders/send', {
        method: 'POST',
        body: JSON.stringify(reminderForm)
      });
      setMsg(res.message || 'Reminders dispatched successfully.');
      setShowRemindersModal(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Selected template when reviewing
  const selectedTemplate = useMemo(() => {
    if (!reviewForm.templateId) return null;
    return templates.find(t => String(t.id) === String(reviewForm.templateId));
  }, [reviewForm.templateId, templates]);

  return (
    <AppShell
      title="Performance Excellence & 360 Feedback"
      subtitle="Hierarchical OKRs, Competency Rubrics, 360 Peer Evaluations & 9-Box Talent Analytics"
    >
      {error ? <div className="error" style={{ marginBottom: 14 }}>{error}</div> : null}
      {msg ? <div className="muted" style={{ marginBottom: 14, color: 'var(--ok)', fontWeight: 600 }}>{msg}</div> : null}

      {/* Top Navigation & Action Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, background: 'var(--surface-sunken, #f1f5f9)', padding: 4, borderRadius: 8 }}>
          <button
            type="button"
            className={`btn ${activeTab === 'goals' ? '' : 'secondary'}`}
            style={{ fontSize: 13, padding: '6px 14px' }}
            onClick={() => setActiveTab('goals')}
          >
            🎯 OKRs & Sub-Goals ({goals.length})
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'reviews' ? '' : 'secondary'}`}
            style={{ fontSize: 13, padding: '6px 14px' }}
            onClick={() => setActiveTab('reviews')}
          >
            📋 Reviews & Rubrics ({reviews.length})
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'templates' ? '' : 'secondary'}`}
            style={{ fontSize: 13, padding: '6px 14px' }}
            onClick={() => setActiveTab('templates')}
          >
            📑 Rubric Builder ({templates.length})
          </button>
          <button
            type="button"
            className={`btn ${activeTab === '360' ? '' : 'secondary'}`}
            style={{ fontSize: 13, padding: '6px 14px' }}
            onClick={() => setActiveTab('360')}
          >
            🔄 360° Peer Feedback ({peerNominations.length})
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'nine_box' ? '' : 'secondary'}`}
            style={{ fontSize: 13, padding: '6px 14px' }}
            onClick={() => setActiveTab('nine_box')}
          >
            📊 9-Box Talent Grid
          </button>
        </div>

        {canManage ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn secondary"
              style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={() => setShowRemindersModal(true)}
            >
              🔔 Send Reminders
            </button>
            {activeTab === 'goals' && (
              <button
                type="button"
                className="btn"
                style={{ fontSize: 13 }}
                onClick={() => {
                  setGoalForm({
                    employeeId: '',
                    parentGoalId: '',
                    title: '',
                    kpi: '',
                    targetValue: '',
                    targetMetric: '',
                    currentMetric: '',
                    weightage: 100,
                    progressPct: 0,
                    dueDate: '',
                    periodLabel: 'H2 2026',
                  });
                  setShowGoalModal(true);
                }}
              >
                + Add Goal / OKR
              </button>
            )}
            {activeTab === 'reviews' && (
              <button
                type="button"
                className="btn"
                style={{ fontSize: 13 }}
                onClick={() => setShowReviewModal(true)}
              >
                + Start Review Cycle
              </button>
            )}
            {activeTab === 'templates' && (
              <button
                type="button"
                className="btn"
                style={{ fontSize: 13 }}
                onClick={() => setShowTemplateModal(true)}
              >
                + Create Rubric Template
              </button>
            )}
            {activeTab === '360' && (
              <button
                type="button"
                className="btn"
                style={{ fontSize: 13 }}
                onClick={() => setShowNominationModal(true)}
              >
                + Nominate Peer Reviewer
              </button>
            )}
          </div>
        ) : null}
      </div>

      {/* TAB 1: Hierarchical Goals & Key Results */}
      {activeTab === 'goals' && (
        <div className="card">
          <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Strategic Goals & Key Results Hierarchy</h3>
            <span className="muted" style={{ fontSize: 12 }}>Showing nested parent objectives and sub-goal key results</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>Objective / Key Result</th>
                  <th>Employee</th>
                  <th>Metrics & KPIs</th>
                  <th>Weight</th>
                  <th>Due Date</th>
                  <th>Progress</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {parentGoals.map((p) => {
                  const pid = v(p, 'id');
                  const children = subGoalsMap[pid] || [];
                  const isExpanded = expandedGoals.has(pid);
                  const progress = Number(v(p, 'progressPct', 'progress_pct') || 0);

                  return (
                    <span key={pid} style={{ display: 'contents' }}>
                      {/* Parent Goal Row */}
                      <tr style={{ background: isExpanded ? 'rgba(0,184,219,0.04)' : undefined, fontWeight: 500 }}>
                        <td>
                          {children.length > 0 ? (
                            <button
                              type="button"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--brand)' }}
                              onClick={() => toggleExpand(pid)}
                              title={isExpanded ? 'Collapse sub-goals' : 'Expand sub-goals'}
                            >
                              {isExpanded ? '▼' : '▶'}
                            </button>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: 12 }}>●</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 600, color: 'var(--brand)' }}>🎯 {v(p, 'title')}</span>
                            {children.length > 0 && (
                              <span style={{ fontSize: 11, background: 'rgba(0,184,219,0.1)', color: 'var(--brand)', padding: '2px 6px', borderRadius: 4 }}>
                                {children.length} Key Results
                              </span>
                            )}
                          </div>
                          <div className="muted" style={{ fontSize: 11, marginLeft: 22 }}>
                            {v(p, 'periodLabel', 'period_label') || 'Annual Goal'}
                          </div>
                        </td>
                        <td>
                          <div>{v(p, 'fullName', 'full_name')}</div>
                          <div className="muted" style={{ fontSize: 11 }}>{v(p, 'empCode', 'emp_code')}</div>
                        </td>
                        <td>
                          <div>{v(p, 'kpi') || '—'}</div>
                          <div className="muted" style={{ fontSize: 11 }}>Target: {v(p, 'targetValue', 'target_value') || '—'}</div>
                        </td>
                        <td>{Number(v(p, 'weightage') || 100)}%</td>
                        <td>{formatDate(v(p, 'dueDate', 'due_date'))}</td>
                        <td style={{ minWidth: 120 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${progress}%`, height: '100%', background: progress >= 100 ? '#10b981' : 'var(--brand)' }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 600 }}>{progress}%</span>
                          </div>
                        </td>
                        <td><Badge status={v(p, 'status')} /></td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            {v(p, 'fileRef', 'file_ref') && (
                              <a
                                href={v(p, 'fileRef', 'file_ref')}
                                target="_blank"
                                rel="noreferrer"
                                className="btn secondary"
                                style={{ fontSize: 11, padding: '3px 8px', textDecoration: 'none' }}
                                title="View Goal Evidence File"
                              >
                                📎 Evidence
                              </a>
                            )}
                            {canManage && (
                              <button
                                type="button"
                                className="btn secondary"
                                style={{ fontSize: 11, padding: '3px 8px' }}
                                title="Add Key Result under this goal"
                                onClick={() => {
                                  setGoalForm({
                                    employeeId: String(v(p, 'employeeId', 'employee_id')),
                                    parentGoalId: String(pid),
                                    title: '',
                                    kpi: '',
                                    targetValue: '',
                                    targetMetric: '',
                                    currentMetric: '',
                                    weightage: 50,
                                    progressPct: 0,
                                    dueDate: todayISO(),
                                    periodLabel: v(p, 'periodLabel', 'period_label') || 'H2 2026',
                                  });
                                  setShowGoalModal(true);
                                }}
                              >
                                + Key Result
                              </button>
                            )}
                            {(canManage || role === 'employee') && String(v(p, 'status')) === 'active' && children.length === 0 && (
                              <button
                                type="button"
                                className="btn secondary"
                                style={{ fontSize: 11, padding: '3px 8px' }}
                                onClick={() => bumpProgress(pid, progress)}
                              >
                                +10%
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Nested Child Sub-Goals */}
                      {isExpanded && children.map((c) => {
                        const cid = v(c, 'id');
                        const cProg = Number(v(c, 'progressPct', 'progress_pct') || 0);

                        return (
                          <tr key={cid} style={{ background: '#f8fafc', fontSize: 13 }}>
                            <td style={{ textAlign: 'right', color: '#94a3b8' }}>↳</td>
                            <td style={{ paddingLeft: 24 }}>
                              <div style={{ fontWeight: 500, color: '#334155' }}>🔑 {v(c, 'title')}</div>
                              {v(c, 'targetMetric', 'target_metric') && (
                                <div className="muted" style={{ fontSize: 11 }}>
                                  Metric: {v(c, 'currentMetric', 'current_metric') || '0'} / {v(c, 'targetMetric', 'target_metric')}
                                </div>
                              )}
                            </td>
                            <td>
                              <div className="muted" style={{ fontSize: 12 }}>{v(c, 'fullName', 'full_name')}</div>
                            </td>
                            <td>
                              <div>{v(c, 'kpi') || '—'}</div>
                              <div className="muted" style={{ fontSize: 11 }}>Target: {v(c, 'targetValue', 'target_value') || '—'}</div>
                            </td>
                            <td>
                              <span style={{ fontSize: 11, background: '#e2e8f0', padding: '2px 6px', borderRadius: 4 }}>
                                {Number(v(c, 'weightage') || 50)}% weight
                              </span>
                            </td>
                            <td>{formatDate(v(c, 'dueDate', 'due_date'))}</td>
                            <td style={{ minWidth: 120 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                                  <div style={{ width: `${cProg}%`, height: '100%', background: cProg >= 100 ? '#10b981' : '#3b82f6' }} />
                                </div>
                                <span style={{ fontSize: 12 }}>{cProg}%</span>
                              </div>
                            </td>
                            <td><Badge status={v(c, 'status')} /></td>
                            <td>
                              {(canManage || role === 'employee') && String(v(c, 'status')) === 'active' ? (
                                <button
                                  type="button"
                                  className="btn secondary"
                                  style={{ fontSize: 11, padding: '3px 8px' }}
                                  onClick={() => bumpProgress(cid, cProg)}
                                >
                                  +10%
                                </button>
                              ) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </span>
                  );
                })}
                {!parentGoals.length && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: 24 }}>No goals recorded yet. Click &quot;Add Goal / OKR&quot; to begin.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Performance Reviews & Rubrics */}
      {activeTab === 'reviews' && (
        <div className="card">
          <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Performance Reviews & Appraisals</h3>
            <span className="muted" style={{ fontSize: 12 }}>Evaluations, ratings, and potential matrix scores</span>
          </div>
          
          {/* Task 5.3: Segmentation Filter Chips */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Employee Segmentation:</span>
            {['all', 'full_time', 'offshore', 'contractor', 'probationary'].map((type) => (
              <button
                key={type}
                type="button"
                className={`btn ${employeeTypeFilter === type ? '' : 'secondary'}`}
                style={{ fontSize: 11, padding: '3px 9px', textTransform: 'capitalize' }}
                onClick={() => setEmployeeTypeFilter(type)}
              >
                {type === 'all' ? 'All Types' : type.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Cycle & Template</th>
                  <th>Reviewer</th>
                  <th>Perf Rating</th>
                  <th>Potential</th>
                  <th>Review Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reviews.filter(r => (!filteredEmpIds || filteredEmpIds.has(String(v(r, 'employeeId', 'employee_id') || ''))) && (employeeTypeFilter === 'all' || String(v(r, 'employeeType', 'employee_type') || 'full_time').toLowerCase() === employeeTypeFilter.toLowerCase())).map((r) => {
                  const status = String(v(r, 'status') || '');
                  const perfRating = Number(v(r, 'rating') || 0);
                  const potRating = Number(v(r, 'potentialRating', 'potential_rating') || 0);

                  return (
                    <tr key={v(r, 'id')}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{v(r, 'fullName', 'full_name')}</div>
                        <div className="muted" style={{ fontSize: 11 }}>{v(r, 'empCode', 'emp_code')}</div>
                      </td>
                      <td>
                        <div style={{ textTransform: 'capitalize', fontWeight: 500 }}>
                          {String(v(r, 'reviewType', 'review_type') || '').replace('_', ' ')}
                        </div>
                        {v(r, 'templateTitle', 'template_title') && (
                          <div className="muted" style={{ fontSize: 11 }}>📜 {v(r, 'templateTitle', 'template_title')}</div>
                        )}
                        {v(r, 'summary') && <div className="muted" style={{ fontSize: 11, maxWidth: 220 }}>&ldquo;{v(r, 'summary')}&rdquo;</div>}
                      </td>
                      <td>{v(r, 'reviewerName', 'reviewer_name') || '—'}</td>
                      <td>
                        <span style={{
                          fontWeight: 700,
                          fontSize: 13,
                          color: perfRating >= 4.0 ? '#10b981' : perfRating >= 3.0 ? '#0284c7' : '#ef4444'
                        }}>
                          ⭐ {perfRating ? perfRating.toFixed(1) : '—'} / 5.0
                        </span>
                      </td>
                      <td>
                        <span style={{
                          fontWeight: 600,
                          fontSize: 12,
                          color: potRating >= 4.0 ? '#8b5cf6' : potRating >= 3.0 ? '#0284c7' : '#64748b'
                        }}>
                          🚀 {potRating ? potRating.toFixed(1) : '—'} / 5.0
                        </span>
                      </td>
                      <td>{formatDate(v(r, 'reviewDate', 'review_date'))}</td>
                      <td><Badge status={status} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {v(r, 'fileRef', 'file_ref') && (
                            <a
                              href={v(r, 'fileRef', 'file_ref')}
                              target="_blank"
                              rel="noreferrer"
                              className="btn secondary"
                              style={{ fontSize: 11, padding: '3px 8px', textDecoration: 'none' }}
                              title="Download / View Appraisal Evidence"
                            >
                              📎 Evidence
                            </a>
                          )}
                          {canManage && status === 'draft' ? (
                          <button type="button" className="btn ok" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setReviewStatus(v(r, 'id'), 'submitted')}>
                            Submit
                          </button>
                        ) : (canManage || role === 'employee') && status === 'submitted' ? (
                          <button type="button" className="btn secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setReviewStatus(v(r, 'id'), 'acknowledged')}>
                            Acknowledge
                          </button>
                        ) : (
                          '-'
                        )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!reviews.length && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 24 }}>No reviews found. Click &quot;Start Review Cycle&quot; to create one.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Dynamic Rubric Builder */}
      {activeTab === 'templates' && (
        <div className="card">
          <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Assessment Templates & Rubric Builder</h3>
            <span className="muted" style={{ fontSize: 12 }}>Corporate evaluation rubrics, Likert scales, and competency matrices</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16, marginTop: 12 }}>
            {templates.map(t => {
              let sections = [];
              try {
                sections = typeof t.sections_json === 'string' ? JSON.parse(t.sections_json) : (t.sections_json || []);
              } catch {}

              return (
                <div key={t.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, background: '#ffffff', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{t.title}</h4>
                      <span style={{ fontSize: 11, background: 'rgba(0,184,219,0.1)', color: 'var(--brand)', padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase', fontWeight: 600 }}>
                        {t.review_type} Review
                      </span>
                    </div>
                    <Badge status={t.is_active ? 'active' : 'cancelled'} />
                  </div>

                  <p className="muted" style={{ fontSize: 12, margin: 0 }}>{t.description || 'Corporate appraisal rubric template.'}</p>

                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Evaluation Sections ({sections.length}):</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {sections.map((s, idx) => (
                        <div key={idx} style={{ background: '#f8fafc', padding: '6px 10px', borderRadius: 6, fontSize: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 500 }}>
                            <span>{s.title}</span>
                            <span style={{ color: 'var(--brand)' }}>{s.weight}%</span>
                          </div>
                          <div className="muted" style={{ fontSize: 11 }}>{s.questions?.length || 0} rubric questions (Scale 1-{s.questions?.[0]?.scale || 5})</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: 360-Degree Peer Feedback */}
      {activeTab === '360' && (
        <div className="card">
          <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>360-Degree Peer Nominations & Feedback Hub</h3>
            <span className="muted" style={{ fontSize: 12 }}>Blind and double-blind peer feedback tracking</span>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nominee (Employee)</th>
                  <th>Peer Reviewer</th>
                  <th>Appraisal Cycle</th>
                  <th>Nomination Status</th>
                  <th>Privacy Mode</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {peerNominations.map(n => {
                  const status = String(v(n, 'status') || 'pending');
                  const isAnon = Boolean(v(n, 'isAnonymous', 'is_anonymous'));

                  return (
                    <tr key={v(n, 'id')}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{v(n, 'nomineeName', 'nominee_name')}</div>
                        <div className="muted" style={{ fontSize: 11 }}>{v(n, 'nomineeCode', 'nominee_code')} · {v(n, 'nomineeTitle', 'nominee_title')}</div>
                      </td>
                      <td>
                        <div>{v(n, 'reviewerName', 'reviewer_name')}</div>
                        <div className="muted" style={{ fontSize: 11 }}>{v(n, 'reviewerCode', 'reviewer_code')}</div>
                      </td>
                      <td>
                        <span style={{ textTransform: 'capitalize' }}>{String(v(n, 'reviewType', 'review_type') || '360').replace('_', ' ')}</span>
                      </td>
                      <td><Badge status={status} /></td>
                      <td>
                        {isAnon ? (
                          <span style={{ fontSize: 11, background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 4 }}>
                            🔒 Blind / Anonymous
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, background: '#f8fafc', color: '#64748b', padding: '2px 8px', borderRadius: 4 }}>
                            🔓 Identified
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {canManage && status === 'pending' && (
                            <>
                              <button
                                type="button"
                                className="btn ok"
                                style={{ fontSize: 11, padding: '3px 8px' }}
                                onClick={() => updateNominationStatus(v(n, 'id'), 'approved')}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className="btn danger"
                                style={{ fontSize: 11, padding: '3px 8px' }}
                                onClick={() => updateNominationStatus(v(n, 'id'), 'declined')}
                              >
                                Decline
                              </button>
                            </>
                          )}
                          {status === 'submitted' && (
                            <button
                              type="button"
                              className="btn secondary"
                              style={{ fontSize: 11, padding: '3px 8px' }}
                              onClick={() => setViewingPeerFeedback(n)}
                            >
                              View Feedback
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!peerNominations.length && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>No 360 peer nominations active. Click &quot;Nominate Peer Reviewer&quot; to assign peers.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: 9-Box Grid Talent Analytics */}
      {activeTab === 'nine_box' && (
        <div className="card">
          <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3>Performance & Potential 9-Box Talent Matrix</h3>
              <span className="muted" style={{ fontSize: 12 }}>Executive talent mapping: Performance (X-Axis) vs. Growth Potential (Y-Axis)</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              Total Evaluated: {nineBoxData?.totalEmployees ?? employees.length}
            </div>
          </div>

          {/* 3x3 Grid Matrix Layout */}
          <div style={{ display: 'flex', marginTop: 14 }}>
            {/* Y-Axis Label */}
            <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', textAlign: 'center', fontWeight: 700, letterSpacing: 2, color: '#475569', padding: '0 8px' }}>
              GROWTH POTENTIAL (High → Low)
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Row 1: High Potential */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {['low_high', 'med_high', 'high_high'].map(key => {
                  const cfg = BOX_CONFIG[key];
                  const empList = nineBoxData?.boxes?.[key] || [];
                  const count = empList.length;

                  return (
                    <div
                      key={key}
                      onClick={() => setSelectedBoxDrillDown({ key, config: cfg, employees: empList })}
                      style={{
                        background: cfg.bg,
                        border: `2px solid ${cfg.border}`,
                        borderRadius: 8,
                        padding: 14,
                        minHeight: 140,
                        cursor: 'pointer',
                        transition: 'transform 0.15s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: cfg.color }}>{cfg.title}</div>
                          <div className="muted" style={{ fontSize: 11 }}>{cfg.subtitle}</div>
                        </div>
                        <span style={{ background: cfg.color, color: '#fff', borderRadius: 12, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>
                          {count}
                        </span>
                      </div>
                      <div style={{ marginTop: 10 }}>
                        {empList.slice(0, 3).map(e => (
                          <div key={e.id} style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#1e293b' }}>
                            • {e.full_name} ({e.emp_code})
                          </div>
                        ))}
                        {count > 3 && <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>+{count - 3} more...</div>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Row 2: Medium Potential */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {['low_med', 'med_med', 'high_med'].map(key => {
                  const cfg = BOX_CONFIG[key];
                  const empList = nineBoxData?.boxes?.[key] || [];
                  const count = empList.length;

                  return (
                    <div
                      key={key}
                      onClick={() => setSelectedBoxDrillDown({ key, config: cfg, employees: empList })}
                      style={{
                        background: cfg.bg,
                        border: `2px solid ${cfg.border}`,
                        borderRadius: 8,
                        padding: 14,
                        minHeight: 140,
                        cursor: 'pointer',
                        transition: 'transform 0.15s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: cfg.color }}>{cfg.title}</div>
                          <div className="muted" style={{ fontSize: 11 }}>{cfg.subtitle}</div>
                        </div>
                        <span style={{ background: cfg.color, color: '#fff', borderRadius: 12, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>
                          {count}
                        </span>
                      </div>
                      <div style={{ marginTop: 10 }}>
                        {empList.slice(0, 3).map(e => (
                          <div key={e.id} style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#1e293b' }}>
                            • {e.full_name} ({e.emp_code})
                          </div>
                        ))}
                        {count > 3 && <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>+{count - 3} more...</div>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Row 3: Low Potential */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {['low_low', 'med_low', 'high_low'].map(key => {
                  const cfg = BOX_CONFIG[key];
                  const empList = nineBoxData?.boxes?.[key] || [];
                  const count = empList.length;

                  return (
                    <div
                      key={key}
                      onClick={() => setSelectedBoxDrillDown({ key, config: cfg, employees: empList })}
                      style={{
                        background: cfg.bg,
                        border: `2px solid ${cfg.border}`,
                        borderRadius: 8,
                        padding: 14,
                        minHeight: 140,
                        cursor: 'pointer',
                        transition: 'transform 0.15s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: cfg.color }}>{cfg.title}</div>
                          <div className="muted" style={{ fontSize: 11 }}>{cfg.subtitle}</div>
                        </div>
                        <span style={{ background: cfg.color, color: '#fff', borderRadius: 12, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>
                          {count}
                        </span>
                      </div>
                      <div style={{ marginTop: 10 }}>
                        {empList.slice(0, 3).map(e => (
                          <div key={e.id} style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#1e293b' }}>
                            • {e.full_name} ({e.emp_code})
                          </div>
                        ))}
                        {count > 3 && <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>+{count - 3} more...</div>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* X-Axis Label */}
              <div style={{ textAlign: 'center', fontWeight: 700, letterSpacing: 2, color: '#475569', marginTop: 6 }}>
                PERFORMANCE DELIVERY (Low → Medium → High)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Add Goal / OKR */}
      {showGoalModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ width: 560, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>{goalForm.parentGoalId ? 'Add Sub-Goal / Key Result' : 'Add Strategic Goal / OKR'}</h3>
              <button type="button" className="btn secondary" style={{ padding: '2px 8px' }} onClick={() => setShowGoalModal(false)}>✕</button>
            </div>
            <form className="stack" onSubmit={saveGoal}>
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <label className="field">
                  Employee
                  <select required value={goalForm.employeeId} onChange={(e) => setGoalForm({ ...goalForm, employeeId: e.target.value })}>
                    <option value="">Select Employee…</option>
                    {employees.filter(e => !filteredEmpIds || filteredEmpIds.has(String(v(e, 'id')))).map((e) => (
                      <option key={v(e, 'id')} value={v(e, 'id')}>
                        {v(e, 'fullName', 'full_name')} ({v(e, 'empCode', 'emp_code')})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  Parent Goal (Optional)
                  <select value={goalForm.parentGoalId} onChange={(e) => setGoalForm({ ...goalForm, parentGoalId: e.target.value })}>
                    <option value="">None (Top-Level Objective)</option>
                    {parentGoals.filter(p => !goalForm.employeeId || String(v(p, 'employeeId', 'employee_id')) === String(goalForm.employeeId)).map(p => (
                      <option key={v(p, 'id')} value={v(p, 'id')}>
                        {v(p, 'title')}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field" style={{ gridColumn: 'span 2' }}>
                  Goal / Key Result Title
                  <input required value={goalForm.title} onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })} placeholder="e.g. Reduce server latency under 200ms" />
                </label>

                <label className="field">
                  Target Metric
                  <input value={goalForm.targetMetric} onChange={(e) => setGoalForm({ ...goalForm, targetMetric: e.target.value })} placeholder="e.g. < 200ms or $150K" />
                </label>

                <label className="field">
                  Current Metric
                  <input value={goalForm.currentMetric} onChange={(e) => setGoalForm({ ...goalForm, currentMetric: e.target.value })} placeholder="e.g. 350ms" />
                </label>

                <label className="field">
                  KPI Description
                  <input value={goalForm.kpi} onChange={(e) => setGoalForm({ ...goalForm, kpi: e.target.value })} placeholder="e.g. Performance SLA" />
                </label>

                <label className="field">
                  Target Value
                  <input value={goalForm.targetValue} onChange={(e) => setGoalForm({ ...goalForm, targetValue: e.target.value })} placeholder="e.g. 99.9%" />
                </label>

                <label className="field">
                  Weightage (%)
                  <input type="number" min="1" max="100" value={goalForm.weightage} onChange={(e) => setGoalForm({ ...goalForm, weightage: e.target.value })} />
                </label>

                <label className="field">
                  Due Date
                  <input type="date" value={goalForm.dueDate} onChange={(e) => setGoalForm({ ...goalForm, dueDate: e.target.value })} />
                </label>

                <label className="field">
                  Period
                  <input value={goalForm.periodLabel} onChange={(e) => setGoalForm({ ...goalForm, periodLabel: e.target.value })} />
                </label>

                <label className="field">
                  Progress %
                  <input type="number" min="0" max="100" value={goalForm.progressPct} onChange={(e) => setGoalForm({ ...goalForm, progressPct: e.target.value })} />
                </label>

                <label className="field" style={{ gridColumn: 'span 2' }}>
                  Supporting Evidence Document (PDF, Report, Screenshot)
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, (url) => setGoalForm(prev => ({ ...prev, fileRef: url })));
                      }}
                      style={{ fontSize: 13 }}
                    />
                    {goalForm.fileRef && (
                      <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', fontSize: 12 }}>
                        ✓ File Attached
                      </span>
                    )}
                  </div>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button type="button" className="btn secondary" onClick={() => setShowGoalModal(false)}>Cancel</button>
                <button className="btn" type="submit">Save Goal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Add Appraisal Review with Rubric */}
      {showReviewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ width: 620, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Conduct Performance Review</h3>
              <button type="button" className="btn secondary" style={{ padding: '2px 8px' }} onClick={() => setShowReviewModal(false)}>✕</button>
            </div>
            <form className="stack" onSubmit={saveReview}>
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <label className="field">
                  Employee
                  <select required value={reviewForm.employeeId} onChange={(e) => setReviewForm({ ...reviewForm, employeeId: e.target.value })}>
                    <option value="">Select Employee…</option>
                    {employees.filter(e => !filteredEmpIds || filteredEmpIds.has(String(v(e, 'id')))).map((e) => (
                      <option key={v(e, 'id')} value={v(e, 'id')}>
                        {v(e, 'fullName', 'full_name')} ({v(e, 'empCode', 'emp_code')})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  Assessment Template
                  <select value={reviewForm.templateId} onChange={(e) => setReviewForm({ ...reviewForm, templateId: e.target.value })}>
                    <option value="">Standard Review (No Rubric)</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.title} ({t.review_type})</option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  Review Cycle Type
                  <select value={reviewForm.reviewType} onChange={(e) => setReviewForm({ ...reviewForm, reviewType: e.target.value })}>
                    <option value="annual">Annual Review</option>
                    <option value="mid_year">Mid-Year Review</option>
                    <option value="probation">Probationary Review</option>
                    <option value="360">360-Degree Review</option>
                  </select>
                </label>

                <label className="field">
                  Reviewer Name
                  <input value={reviewForm.reviewerName} onChange={(e) => setReviewForm({ ...reviewForm, reviewerName: e.target.value })} placeholder="e.g. HR Evaluation Board" />
                </label>

                <label className="field">
                  Overall Performance Rating (1.0 - 5.0)
                  <input type="number" min="1" max="5" step="0.1" value={reviewForm.rating} onChange={(e) => setReviewForm({ ...reviewForm, rating: e.target.value })} />
                </label>

                <label className="field">
                  Leadership Potential Rating (1.0 - 5.0)
                  <input type="number" min="1" max="5" step="0.1" value={reviewForm.potentialRating} onChange={(e) => setReviewForm({ ...reviewForm, potentialRating: e.target.value })} />
                </label>

                <label className="field">
                  Review Date
                  <input type="date" value={reviewForm.reviewDate} onChange={(e) => setReviewForm({ ...reviewForm, reviewDate: e.target.value })} />
                </label>

                <label className="field">
                  Employee Type (Segmentation)
                  <select
                    value={reviewForm.employeeType || 'full_time'}
                    onChange={(e) => setReviewForm({ ...reviewForm, employeeType: e.target.value })}
                  >
                    <option value="full_time">Full-Time (Onshore Corporate)</option>
                    <option value="offshore">Offshore Crew / Rig</option>
                    <option value="contractor">Contractor / Consultant</option>
                    <option value="probationary">Probationary New Hire</option>
                  </select>
                </label>

                <label className="field" style={{ gridColumn: 'span 2' }}>
                  Supporting Evidence File (Appraisal Evidence, PDF, Evaluation Doc)
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, (url) => setReviewForm(prev => ({ ...prev, fileRef: url })));
                      }}
                      style={{ fontSize: 13 }}
                    />
                    {reviewForm.fileRef && (
                      <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', fontSize: 12 }}>
                        ✓ File Attached
                      </span>
                    )}
                  </div>
                </label>
              </div>

              {/* Dynamic Rubric Questions if Template Selected */}
              {selectedTemplate && (
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', marginTop: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--brand)' }}>
                    Evaluation Rubric Criteria: {selectedTemplate.title}
                  </div>
                  {(() => {
                    let secs = [];
                    try {
                      secs = typeof selectedTemplate.sections_json === 'string'
                        ? JSON.parse(selectedTemplate.sections_json)
                        : (selectedTemplate.sections_json || []);
                    } catch {}

                    return secs.map((sec, sIdx) => (
                      <div key={sIdx} style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>{sec.title} ({sec.weight}%)</div>
                        {sec.questions?.map((q) => (
                          <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0', fontSize: 12 }}>
                            <span title={q.description}>{q.label}</span>
                            <select
                              style={{ width: 110, padding: '2px 4px' }}
                              value={reviewForm.answers[q.id]?.score || '4'}
                              onChange={(e) => setReviewForm({
                                ...reviewForm,
                                answers: {
                                  ...reviewForm.answers,
                                  [q.id]: { label: q.label, score: Number(e.target.value) }
                                }
                              })}
                            >
                              <option value="5">5 - Excellent</option>
                              <option value="4">4 - Exceeds</option>
                              <option value="3">3 - Meets</option>
                              <option value="2">2 - Developing</option>
                              <option value="1">1 - Unsatisfactory</option>
                            </select>
                          </div>
                        ))}
                      </div>
                    ));
                  })()}
                </div>
              )}

              <label className="field">
                Appraisal Summary & Comments
                <textarea rows={3} value={reviewForm.summary} onChange={(e) => setReviewForm({ ...reviewForm, summary: e.target.value })} placeholder="Key achievements, developmental opportunities, and growth objectives..." />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button type="button" className="btn secondary" onClick={() => setShowReviewModal(false)}>Cancel</button>
                <button className="btn" type="submit">Submit Review</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Create Assessment Rubric Template */}
      {showTemplateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ width: 560, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Create Appraisal Rubric Template</h3>
              <button type="button" className="btn secondary" style={{ padding: '2px 8px' }} onClick={() => setShowTemplateModal(false)}>✕</button>
            </div>
            <form className="stack" onSubmit={saveTemplate}>
              <label className="field">
                Template Title
                <input required value={templateForm.title} onChange={(e) => setTemplateForm({ ...templateForm, title: e.target.value })} placeholder="e.g. Sales Team Quarterly Performance Rubric" />
              </label>

              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <label className="field">
                  Review Type
                  <select value={templateForm.reviewType} onChange={(e) => setTemplateForm({ ...templateForm, reviewType: e.target.value })}>
                    <option value="annual">Annual Review</option>
                    <option value="mid_year">Mid-Year Review</option>
                    <option value="probation">Probation Review</option>
                    <option value="360">360 Multilateral Review</option>
                  </select>
                </label>
                <label className="field">
                  Sections Count
                  <input readOnly value={`${templateForm.sections.length} Standard Sections`} style={{ background: '#f8fafc' }} />
                </label>
              </div>

              <label className="field">
                Description
                <textarea rows={2} value={templateForm.description} onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })} placeholder="Target employee cohort, objectives, and evaluation purpose..." />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button type="button" className="btn secondary" onClick={() => setShowTemplateModal(false)}>Cancel</button>
                <button className="btn" type="submit">Create Template</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Nominate Peer Reviewer */}
      {showNominationModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ width: 520, maxWidth: '95vw' }}>
            <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Nominate 360° Peer Reviewer</h3>
              <button type="button" className="btn secondary" style={{ padding: '2px 8px' }} onClick={() => setShowNominationModal(false)}>✕</button>
            </div>
            <form className="stack" onSubmit={saveNomination}>
              <label className="field">
                Appraisal Review Cycle
                <select required value={nominationForm.reviewId} onChange={(e) => {
                  const rid = e.target.value;
                  const rev = reviews.find(r => String(v(r, 'id')) === rid);
                  setNominationForm({
                    ...nominationForm,
                    reviewId: rid,
                    nomineeId: rev ? String(v(rev, 'employeeId', 'employee_id')) : nominationForm.nomineeId
                  });
                }}>
                  <option value="">Select Active Review…</option>
                  {reviews.map(r => (
                    <option key={v(r, 'id')} value={v(r, 'id')}>
                      {v(r, 'fullName', 'full_name')} — {String(v(r, 'reviewType', 'review_type')).replace('_', ' ')} ({formatDate(v(r, 'reviewDate', 'review_date'))})
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                Nominee (Employee receiving feedback)
                <select required value={nominationForm.nomineeId} onChange={(e) => setNominationForm({ ...nominationForm, nomineeId: e.target.value })}>
                  <option value="">Select Nominee…</option>
                  {employees.map(e => (
                    <option key={v(e, 'id')} value={v(e, 'id')}>{v(e, 'fullName', 'full_name')} ({v(e, 'empCode', 'emp_code')})</option>
                  ))}
                </select>
              </label>

              <label className="field">
                Peer Reviewer (Employee providing feedback)
                <select required value={nominationForm.reviewerId} onChange={(e) => setNominationForm({ ...nominationForm, reviewerId: e.target.value })}>
                  <option value="">Select Peer Reviewer…</option>
                  {employees.filter(e => String(v(e, 'id')) !== String(nominationForm.nomineeId)).map(e => (
                    <option key={v(e, 'id')} value={v(e, 'id')}>{v(e, 'fullName', 'full_name')} ({v(e, 'empCode', 'emp_code')})</option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginTop: 4 }}>
                <input
                  type="checkbox"
                  checked={nominationForm.isAnonymous}
                  onChange={(e) => setNominationForm({ ...nominationForm, isAnonymous: e.target.checked })}
                />
                Anonymous Evaluation (Keep reviewer identity blind from nominee)
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button type="button" className="btn secondary" onClick={() => setShowNominationModal(false)}>Cancel</button>
                <button className="btn" type="submit">Send Nomination</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Send Appraisal Deadline Reminders */}
      {showRemindersModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ width: 480, maxWidth: '95vw' }}>
            <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Dispatch Appraisal Deadline Reminders</h3>
              <button type="button" className="btn secondary" style={{ padding: '2px 8px' }} onClick={() => setShowRemindersModal(false)}>✕</button>
            </div>
            <div className="stack">
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                This will automatically broadcast email notifications to all employees and managers with active appraisal reviews pending self-evaluations, manager reviews, or sign-offs.
              </p>

              <label className="field">
                Appraisal Cycle
                <select value={reminderForm.reviewType} onChange={(e) => setReminderForm({ ...reminderForm, reviewType: e.target.value })}>
                  <option value="annual">Annual Appraisal Cycle</option>
                  <option value="mid_year">Mid-Year Review</option>
                  <option value="probation">Probationary Period</option>
                  <option value="360">360° Peer Feedback Round</option>
                </select>
              </label>

              <label className="field">
                Appraisal Deadline Date
                <input type="date" value={reminderForm.dueDate} onChange={(e) => setReminderForm({ ...reminderForm, dueDate: e.target.value })} />
              </label>

              <label className="field">
                Review Stage
                <input value={reminderForm.stage} onChange={(e) => setReminderForm({ ...reminderForm, stage: e.target.value })} placeholder="e.g. Self-Evaluation & Manager Sign-Off" />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button type="button" className="btn secondary" onClick={() => setShowRemindersModal(false)}>Cancel</button>
                <button className="btn" type="button" disabled={loading} onClick={dispatchReminders}>
                  {loading ? 'Sending Reminders…' : '🚀 Dispatch Email Reminders'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: 9-Box Drill-Down Details */}
      {selectedBoxDrillDown && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ width: 600, maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ color: selectedBoxDrillDown.config.color }}>{selectedBoxDrillDown.config.title}</h3>
                <span className="muted" style={{ fontSize: 12 }}>{selectedBoxDrillDown.config.subtitle} ({selectedBoxDrillDown.employees.length} employees)</span>
              </div>
              <button type="button" className="btn secondary" style={{ padding: '2px 8px' }} onClick={() => setSelectedBoxDrillDown(null)}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {selectedBoxDrillDown.employees.map(e => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{e.full_name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{e.emp_code} · {e.job_title || 'Employee'} {e.department_name ? `(${e.department_name})` : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0284c7' }}>
                      Perf: {Number(e.performance_rating || 3.0).toFixed(1)} / 5.0
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#8b5cf6' }}>
                      Potential: {Number(e.potential_rating || 3.0).toFixed(1)} / 5.0
                    </div>
                  </div>
                </div>
              ))}
              {!selectedBoxDrillDown.employees.length && (
                <div className="muted" style={{ textAlign: 'center', padding: 20 }}>No employees currently mapped to this quadrant.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: View 360 Feedback */}
      {viewingPeerFeedback && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ width: 500, maxWidth: '95vw' }}>
            <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>360° Peer Review Feedback</h3>
              <button type="button" className="btn secondary" style={{ padding: '2px 8px' }} onClick={() => setViewingPeerFeedback(null)}>✕</button>
            </div>
            <div className="stack" style={{ marginTop: 8 }}>
              <div>
                <span className="muted" style={{ fontSize: 12 }}>Nominee:</span>
                <div style={{ fontWeight: 600 }}>{v(viewingPeerFeedback, 'nomineeName', 'nominee_name')}</div>
              </div>

              <div>
                <span className="muted" style={{ fontSize: 12 }}>Reviewer Identity:</span>
                <div>{v(viewingPeerFeedback, 'isAnonymous', 'is_anonymous') ? '🔒 Anonymous / Blind Reviewer' : v(viewingPeerFeedback, 'reviewerName', 'reviewer_name')}</div>
              </div>

              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', marginTop: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Submitted Feedback:</div>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 12, color: '#334155' }}>
                  {typeof viewingPeerFeedback.feedback_json === 'string'
                    ? viewingPeerFeedback.feedback_json
                    : JSON.stringify(viewingPeerFeedback.feedback_json || {}, null, 2)}
                </pre>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <button type="button" className="btn" onClick={() => setViewingPeerFeedback(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
