'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell from '../../components/AppShell';
import { api, getUser, normalizeRole } from '../../lib/auth';
import { formatDate } from '../../lib/format';

export default function SurveysPage() {
  const role = normalizeRole(getUser());
  const isAdmin = role === 'admin' || role === 'super_admin';

  const [surveys, setSurveys] = useState([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [responses, setResponses] = useState([]);
  const [responsesLoading, setResponsesLoading] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [filterRating, setFilterRating] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Create Survey Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newSurvey, setNewSurvey] = useState({
    title: '',
    description: '',
    isAnonymous: true,
    questions: [
      { id: 'enps', type: 'nps', question: 'How likely are you to recommend working here to friends or colleagues? (0-10)' },
      { id: 'work_life', type: 'rating', question: 'How satisfied are you with your work-life balance? (1-5)' },
      { id: 'growth', type: 'rating', question: 'Do you feel you have adequate opportunities for professional growth? (1-5)' }
    ]
  });

  const activeSurvey = surveys.find((s) => s.id === selectedSurveyId);

  const filteredResponses = responses.filter((r) => {
    if (filterRating === 'promoter' && (r.nps_score < 9 || r.nps_score == null)) return false;
    if (filterRating === 'passive' && (r.nps_score < 7 || r.nps_score > 8)) return false;
    if (filterRating === 'detractor' && (r.nps_score > 6 || r.nps_score == null)) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const name = (r.respondent_name || '').toLowerCase();
      const code = (r.respondent_code || '').toLowerCase();
      const dept = (r.department_name || '').toLowerCase();
      const fb = (r.feedback_text || '').toLowerCase();
      if (!name.includes(q) && !code.includes(q) && !dept.includes(q) && !fb.includes(q)) {
        return false;
      }
    }
    return true;
  });

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const loadSurveys = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api('/surveys');
      const list = Array.isArray(data) ? data : [];
      setSurveys(list);
      if (list.length > 0) {
        setSelectedSurveyId((prev) => (prev ? prev : list[0].id));
      }
    } catch (e) {
      setError(e.message || 'Failed to load surveys');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAnalytics = useCallback(async (surveyId) => {
    if (!surveyId) return;
    setAnalyticsLoading(true);
    try {
      const data = await api(`/surveys/${surveyId}/analytics`);
      setAnalytics(data);
    } catch (e) {
      console.error('Failed to load survey analytics:', e);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  const loadResponses = useCallback(async (surveyId) => {
    if (!surveyId) return;
    setResponsesLoading(true);
    try {
      const data = await api(`/surveys/${surveyId}/responses`);
      setResponses(data && Array.isArray(data.responses) ? data.responses : []);
    } catch (e) {
      console.error('Failed to load survey responses:', e);
      setResponses([]);
    } finally {
      setResponsesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSurveys();
  }, [loadSurveys]);

  useEffect(() => {
    if (selectedSurveyId) {
      loadAnalytics(selectedSurveyId);
      loadResponses(selectedSurveyId);
    }
  }, [selectedSurveyId, loadAnalytics, loadResponses]);

  // Task 5.4: Apply Research-Validated Question Pack
  const applyQuestionPack = async (packId) => {
    try {
      const packs = await api('/surveys/template-questions');
      const selected = Array.isArray(packs) ? packs.find(p => p.id === packId) : null;
      if (selected) {
        setNewSurvey(prev => ({
          ...prev,
          title: selected.name,
          description: selected.description,
          questions: selected.questions || []
        }));
        showSuccess(`Loaded ${selected.name} (${selected.questions?.length || 0} questions).`);
      }
    } catch (e) {
      console.error('Failed to load question pack:', e);
    }
  };

  const handleCreateSurvey = async (e) => {
    e.preventDefault();
    if (!newSurvey.title.trim()) {
      setError('Survey title is required.');
      return;
    }

    try {
      const res = await api('/surveys', {
        method: 'POST',
        body: JSON.stringify({
          title: newSurvey.title.trim(),
          description: newSurvey.description.trim() || null,
          isAnonymous: newSurvey.isAnonymous,
          questions: newSurvey.questions
        })
      });
      setCreateModalOpen(false);
      showSuccess('Wellbeing & eNPS Survey published successfully!');
      await loadSurveys();
      if (res && res.id) {
        setSelectedSurveyId(res.id);
      }
    } catch (err) {
      setError(err.message || 'Failed to create survey');
    }
  };

  const handleDeleteSurvey = async (id) => {
    if (!window.confirm('Are you sure you want to delete this survey and its analytics?')) return;
    try {
      await api(`/surveys/${id}`, { method: 'DELETE' });
      showSuccess('Survey deleted.');
      setSelectedSurveyId(null);
      setAnalytics(null);
      await loadSurveys();
    } catch (err) {
      setError(err.message || 'Failed to delete survey');
    }
  };

  const getEnpsTier = (score) => {
    if (score >= 50) return { label: 'World Class (+50 to +100)', color: '#059669', bg: 'rgba(16, 185, 129, 0.12)' };
    if (score >= 20) return { label: 'Strong / Good (+20 to +49)', color: '#0284c7', bg: 'rgba(2, 132, 199, 0.12)' };
    if (score >= 0) return { label: 'Average (0 to +19)', color: '#d97706', bg: 'rgba(245, 158, 11, 0.12)' };
    return { label: 'Needs Improvement (< 0)', color: '#dc2626', bg: 'rgba(239, 68, 68, 0.12)' };
  };

  return (
    <AppShell
      title="Employee Wellbeing & eNPS Analytics"
      subtitle="Corporate employee Net Promoter Score (-100 to +100), participation metrics, and departmental sentiment analytics."
      actions={
        <div style={{ display: 'flex', gap: 10 }}>
          {isAdmin && (
            <button className="btn-primary" onClick={() => setCreateModalOpen(true)}>
              + New Wellbeing Survey
            </button>
          )}
          <button className="btn-secondary" onClick={() => selectedSurveyId && loadAnalytics(selectedSurveyId)}>
            Refresh
          </button>
        </div>
      }
    >
      {/* Toast Messages */}
      {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}
      {successMsg && (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid #10b981',
            color: '#065f46',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 16,
            fontWeight: 600
          }}
        >
          {successMsg}
        </div>
      )}

      {/* Survey Selector Header */}
      <div
        className="panel-card"
        style={{
          padding: '16px 20px',
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Active Survey:</span>
          {surveys.length > 0 ? (
            <select
              value={selectedSurveyId || ''}
              onChange={(e) => setSelectedSurveyId(parseInt(e.target.value, 10))}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                fontWeight: 600,
                fontSize: 14
              }}
            >
              {surveys.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} ({s.responseCount} responses)
                </option>
              ))}
            </select>
          ) : (
            <span style={{ color: 'var(--muted)', fontSize: 14 }}>No surveys published yet</span>
          )}
        </div>

        {selectedSurveyId && isAdmin && (
          <button
            onClick={() => handleDeleteSurvey(selectedSurveyId)}
            style={{
              background: 'transparent',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            🗑️ Delete Survey
          </button>
        )}
      </div>

      {loading || analyticsLoading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Loading sentiment analytics…</div>
      ) : !analytics ? (
        <div className="panel-card" style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
          Please select or create a survey to view eNPS and sentiment analytics.
        </div>
      ) : (
        <>
          {/* Top KPI Metric Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: 16,
              marginBottom: 24
            }}
          >
            {/* eNPS Master Card */}
            {(() => {
              const tier = getEnpsTier(analytics.enps_score);
              return (
                <div
                  className="kpi-card blue"
                  style={{
                    gridColumn: 'span 2',
                    minWidth: 280,
                    background: 'linear-gradient(135deg, rgba(0, 184, 219, 0.08) 0%, rgba(14, 165, 233, 0.14) 100%)',
                    border: '1px solid rgba(0, 184, 219, 0.35)',
                    borderTop: '4px solid #00b8db',
                    borderRadius: 14,
                    padding: '20px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.04)'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted, #64748b)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Corporate Employee Net Promoter Score
                    </span>
                    <span style={{ fontSize: 38, fontWeight: 900, lineHeight: 1.1, color: tier.color }}>
                      {analytics.enps_score > 0 ? `+${analytics.enps_score}` : analytics.enps_score}
                    </span>
                    <div>
                      <span
                        style={{
                          background: tier.bg,
                          color: tier.color,
                          padding: '4px 12px',
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 700,
                          display: 'inline-block'
                        }}
                      >
                        {tier.label}
                      </span>
                    </div>
                  </div>
                  <div
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: 16,
                      background: 'rgba(0, 184, 219, 0.12)',
                      color: tier.color,
                      fontSize: 20,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    eNPS
                  </div>
                </div>
              );
            })()}

            {/* Total Responses */}
            <div
              className="kpi-card green"
              style={{
                background: 'var(--surface, #ffffff)',
                border: '1px solid var(--line, #e2e8f0)',
                borderTop: '4px solid #10b981',
                borderRadius: 14,
                padding: '20px 22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 4px 12px rgba(0,0,0,0.04)'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted, #64748b)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Total Responses
                </span>
                <span style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.1, color: 'var(--ink, #0f172a)' }}>
                  {analytics.total_responses}
                </span>
                <div>
                  <span style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#059669', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                    100% Confidential
                  </span>
                </div>
              </div>
              <div style={{ width: 50, height: 50, borderRadius: 12, background: 'rgba(16, 185, 129, 0.1)', color: '#059669', fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {analytics.total_responses}
              </div>
            </div>

            {/* Promoters */}
            <div
              className="kpi-card green"
              style={{
                background: 'var(--surface, #ffffff)',
                border: '1px solid var(--line, #e2e8f0)',
                borderTop: '4px solid #059669',
                borderRadius: 14,
                padding: '20px 22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 4px 12px rgba(0,0,0,0.04)'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted, #64748b)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Promoters (Score 9-10)
                </span>
                <span style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.1, color: '#059669' }}>
                  {analytics.promoters_percentage}%
                </span>
                <div>
                  <span style={{ background: 'rgba(5, 150, 105, 0.12)', color: '#059669', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                    {analytics.promoters_count} Employees
                  </span>
                </div>
              </div>
              <div style={{ width: 50, height: 50, borderRadius: 12, background: 'rgba(5, 150, 105, 0.1)', color: '#059669', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                9-10
              </div>
            </div>

            {/* Passives */}
            <div
              className="kpi-card amber"
              style={{
                background: 'var(--surface, #ffffff)',
                border: '1px solid var(--line, #e2e8f0)',
                borderTop: '4px solid #f59e0b',
                borderRadius: 14,
                padding: '20px 22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 4px 12px rgba(0,0,0,0.04)'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted, #64748b)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Passives (Score 7-8)
                </span>
                <span style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.1, color: '#d97706' }}>
                  {analytics.passives_percentage}%
                </span>
                <div>
                  <span style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                    {analytics.passives_count} Employees
                  </span>
                </div>
              </div>
              <div style={{ width: 50, height: 50, borderRadius: 12, background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                7-8
              </div>
            </div>

            {/* Detractors */}
            <div
              className="kpi-card red"
              style={{
                background: 'var(--surface, #ffffff)',
                border: '1px solid var(--line, #e2e8f0)',
                borderTop: '4px solid #dc2626',
                borderRadius: 14,
                padding: '20px 22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 4px 12px rgba(0,0,0,0.04)'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted, #64748b)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Detractors (Score 0-6)
                </span>
                <span style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.1, color: '#dc2626' }}>
                  {analytics.detractors_percentage}%
                </span>
                <div>
                  <span style={{ background: 'rgba(220, 38, 38, 0.12)', color: '#dc2626', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                    {analytics.detractors_count} Employees
                  </span>
                </div>
              </div>
              <div style={{ width: 50, height: 50, borderRadius: 12, background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                0-6
              </div>
            </div>
          </div>

          {/* Score Distribution Chart */}
          <div className="panel-card" style={{ padding: 24, marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>
              Score Distribution Breakdown (0 through 10)
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--muted)' }}>
              Detractors (0-6) in red, Passives (7-8) in amber, and Promoters (9-10) in green.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(11, 1fr)',
                gap: 8,
                alignItems: 'end',
                height: 160,
                paddingBottom: 24,
                borderBottom: '1px solid var(--border)'
              }}
            >
              {analytics.score_distribution &&
                analytics.score_distribution.map((item) => {
                  const maxCount = Math.max(
                    ...analytics.score_distribution.map((d) => d.count),
                    1
                  );
                  const heightPct = Math.round((item.count / maxCount) * 100);
                  const isPromoter = item.score >= 9;
                  const isPassive = item.score >= 7 && item.score <= 8;
                  const barColor = isPromoter ? '#10b981' : isPassive ? '#f59e0b' : '#ef4444';

                  return (
                    <div
                      key={item.score}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        height: '100%',
                        justifyContent: 'flex-end'
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, color: item.count > 0 ? barColor : 'var(--muted)' }}>
                        {item.count}
                      </span>
                      <div
                        style={{
                          width: '100%',
                          maxWidth: 36,
                          height: `${Math.max(heightPct, 6)}%`,
                          background: barColor,
                          borderRadius: '4px 4px 0 0',
                          opacity: item.count > 0 ? 1 : 0.2,
                          transition: 'height 0.4s ease'
                        }}
                      />
                      <span style={{ fontSize: 12, fontWeight: 700, marginTop: 8 }}>{item.score}</span>
                    </div>
                  );
                })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>
              <span>← Detractors (0 - 6)</span>
              <span>Passives (7 - 8)</span>
              <span>Promoters (9 - 10) →</span>
            </div>
          </div>

          {/* Departmental Engagement & Sentiment Breakdown */}
          <div className="panel-card" style={{ padding: 24, marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>
              Departmental Sentiment & Participation Breakdown
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--muted)' }}>
                    <th style={{ padding: '10px 12px' }}>Department</th>
                    <th style={{ padding: '10px 12px' }}>Responses</th>
                    <th style={{ padding: '10px 12px' }}>Avg Score</th>
                    <th style={{ padding: '10px 12px' }}>Promoters</th>
                    <th style={{ padding: '10px 12px' }}>Passives</th>
                    <th style={{ padding: '10px 12px' }}>Detractors</th>
                    <th style={{ padding: '10px 12px' }}>Department eNPS</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.department_breakdown && analytics.department_breakdown.length > 0 ? (
                    analytics.department_breakdown.map((dept, i) => {
                      const tier = getEnpsTier(dept.enps);
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px', fontWeight: 600 }}>{dept.departmentName}</td>
                          <td style={{ padding: '12px' }}>{dept.responseCount}</td>
                          <td style={{ padding: '12px', fontWeight: 700 }}>{dept.averageScore} / 10</td>
                          <td style={{ padding: '12px', color: '#059669', fontWeight: 600 }}>{dept.promoters}</td>
                          <td style={{ padding: '12px', color: '#d97706', fontWeight: 600 }}>{dept.passives}</td>
                          <td style={{ padding: '12px', color: '#dc2626', fontWeight: 600 }}>{dept.detractors}</td>
                          <td style={{ padding: '12px' }}>
                            <span
                              style={{
                                background: tier.bg,
                                color: tier.color,
                                padding: '3px 10px',
                                borderRadius: 12,
                                fontWeight: 700,
                                fontSize: 12
                              }}
                            >
                              {dept.enps > 0 ? `+${dept.enps}` : dept.enps}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                        No departmental responses recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Qualitative Anonymous Employee Feedback Wall */}
          <div className="panel-card" style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>
              Voice of the Employee: Anonymous Feedback Wall ({analytics.feedback_quotes ? analytics.feedback_quotes.length : 0})
            </h3>
            {analytics.feedback_quotes && analytics.feedback_quotes.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                {analytics.feedback_quotes.map((quote, i) => (
                  <div
                    key={i}
                    style={{
                      background: 'var(--surface-muted, #f8fafc)',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      padding: 16,
                      fontSize: 13,
                      lineHeight: 1.5,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <p style={{ margin: '0 0 10px', fontStyle: 'italic', color: 'var(--foreground)' }}>
                      &ldquo;{quote}&rdquo;
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)' }}>
                      <span>🔒 Anonymous Employee</span>
                      <span>Verified Feedback</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                No qualitative feedback comments submitted yet.
              </div>
            )}
          </div>

          {/* Submitted Survey Responses & Question Answers Audit Table */}
          <div className="panel-card" style={{ padding: 24, marginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 18 }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>
                  Survey Submissions & Individual Responses Audit ({filteredResponses.length})
                </h3>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>
                  Audit log of employee survey submissions, individual question ratings, and verbatim feedback.
                </p>
              </div>

              {/* Rating Filter Pills & Search */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ display: 'inline-flex', background: 'var(--surface-muted, #f1f5f9)', padding: 3, borderRadius: 8, gap: 2 }}>
                  <button
                    type="button"
                    onClick={() => setFilterRating('all')}
                    style={{
                      border: 'none',
                      background: filterRating === 'all' ? '#00b8db' : 'transparent',
                      color: filterRating === 'all' ? '#fff' : 'var(--foreground)',
                      padding: '5px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    All ({responses.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterRating('promoter')}
                    style={{
                      border: 'none',
                      background: filterRating === 'promoter' ? '#059669' : 'transparent',
                      color: filterRating === 'promoter' ? '#fff' : 'var(--foreground)',
                      padding: '5px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Promoters ({responses.filter((r) => r.nps_score >= 9).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterRating('passive')}
                    style={{
                      border: 'none',
                      background: filterRating === 'passive' ? '#d97706' : 'transparent',
                      color: filterRating === 'passive' ? '#fff' : 'var(--foreground)',
                      padding: '5px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Passives ({responses.filter((r) => r.nps_score >= 7 && r.nps_score <= 8).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterRating('detractor')}
                    style={{
                      border: 'none',
                      background: filterRating === 'detractor' ? '#dc2626' : 'transparent',
                      color: filterRating === 'detractor' ? '#fff' : 'var(--foreground)',
                      padding: '5px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Detractors ({responses.filter((r) => r.nps_score != null && r.nps_score <= 6).length})
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Search respondent, department..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    width: 200
                  }}
                />
              </div>
            </div>

            {responsesLoading ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>
                Loading individual survey responses...
              </div>
            ) : filteredResponses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)', background: 'var(--surface-muted, #f8fafc)', borderRadius: 8 }}>
                No survey responses match the selected criteria.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--muted)' }}>
                      <th style={{ padding: '10px 12px' }}>Respondent</th>
                      <th style={{ padding: '10px 12px' }}>Department</th>
                      <th style={{ padding: '10px 12px' }}>eNPS Score</th>
                      <th style={{ padding: '10px 12px' }}>Category</th>
                      <th style={{ padding: '10px 12px' }}>Feedback Excerpt</th>
                      <th style={{ padding: '10px 12px' }}>Submitted At</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResponses.map((r) => {
                      const score = r.nps_score;
                      const isProm = score >= 9;
                      const isPass = score >= 7 && score <= 8;
                      const badgeBg = isProm ? 'rgba(16, 185, 129, 0.12)' : isPass ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)';
                      const badgeColor = isProm ? '#059669' : isPass ? '#d97706' : '#dc2626';
                      const badgeLabel = isProm ? 'Promoter' : isPass ? 'Passive' : 'Detractor';

                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px', fontWeight: 600 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span>{r.respondent_name}</span>
                              {r.respondent_code && r.respondent_code !== 'CONFIDENTIAL' && (
                                <span style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--surface-muted, #f1f5f9)', padding: '1px 6px', borderRadius: 4 }}>
                                  {r.respondent_code}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '12px', color: 'var(--muted)' }}>{r.department_name}</td>
                          <td style={{ padding: '12px', fontWeight: 700, fontSize: 14 }}>
                            {score !== null ? `${score} / 10` : '—'}
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span
                              style={{
                                background: badgeBg,
                                color: badgeColor,
                                padding: '3px 8px',
                                borderRadius: 12,
                                fontWeight: 700,
                                fontSize: 11
                              }}
                            >
                              {badgeLabel}
                            </span>
                          </td>
                          <td style={{ padding: '12px', maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {r.feedback_text ? `"${r.feedback_text}"` : <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>None provided</span>}
                          </td>
                          <td style={{ padding: '12px', color: 'var(--muted)', fontSize: 12 }}>
                            {formatDate(r.submitted_at)}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => setSelectedResponse(r)}
                              style={{ padding: '4px 10px', fontSize: 12, fontWeight: 600 }}
                            >
                              Inspect Answers
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* MODAL: CREATE SURVEY */}
      {createModalOpen && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCreateModalOpen(false);
          }}
        >
          <div className="modal-content" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h3 className="modal-title">Create Wellbeing & eNPS Survey</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setCreateModalOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateSurvey}>
              <div className="modal-body">
                {/* Task 5.4: Research-Validated Question Packs */}
                <div style={{ background: 'rgba(0,184,219,0.06)', border: '1px solid rgba(0,184,219,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)' }}>✨ Research-Validated Question Packs</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>Feature #53</span>
                  </div>
                  <select
                    style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1' }}
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        applyQuestionPack(e.target.value);
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="">Insert Standardized Framework…</option>
                    <option value="gallup_q12">Gallup Q12 Engagement Index (12 questions)</option>
                    <option value="uae_wellbeing">UAE National Wellbeing Framework (6 questions)</option>
                    <option value="burnout_sentiment">Burnout & Workload Sentiment (5 questions)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Survey Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Q4 2026 Employee Wellbeing Pulse"
                    value={newSurvey.title}
                    onChange={(e) => setNewSurvey({ ...newSurvey, title: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    rows={3}
                    placeholder="Explain the purpose of this survey to employees..."
                    value={newSurvey.description}
                    onChange={(e) => setNewSurvey({ ...newSurvey, description: e.target.value })}
                  />
                </div>

                {newSurvey.questions && newSurvey.questions.length > 0 && (
                  <div style={{ marginTop: 10, marginBottom: 10, maxHeight: 180, overflowY: 'auto', background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                      Active Questions ({newSurvey.questions.length})
                    </div>
                    {newSurvey.questions.map((q, idx) => (
                      <div key={q.id || idx} style={{ fontSize: 12, padding: '3px 0', borderBottom: '1px solid #eee' }}>
                        <span style={{ fontWeight: 600, color: 'var(--brand)' }}>Q{idx + 1}:</span> {q.question} <span style={{ fontSize: 10, color: '#94a3b8' }}>({q.type})</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="form-group">
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 13,
                      userSelect: 'none',
                      marginTop: 4
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={newSurvey.isAnonymous}
                      onChange={(e) => setNewSurvey({ ...newSurvey, isAnonymous: e.target.checked })}
                      style={{ width: 18, height: 18, accentColor: '#00b8db', margin: 0 }}
                    />
                    <span>Strict Anonymous Mode (Individual employee identity is never recorded)</span>
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setCreateModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Launch Survey
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: INSPECT RESPONSE */}
      {selectedResponse && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedResponse(null);
          }}
        >
          <div className="modal-content" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Inspect Survey Submission</h3>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Submitted on {formatDate(selectedResponse.submitted_at)}
                </span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedResponse(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* Respondent Header Summary */}
              <div
                style={{
                  background: 'var(--surface-muted, #f8fafc)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: 16,
                  marginBottom: 20,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 12
                }}
              >
                <div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Respondent
                  </span>
                  <div style={{ fontWeight: 700, fontSize: 14, marginTop: 2 }}>
                    {selectedResponse.respondent_name}
                  </div>
                  {selectedResponse.respondent_code && selectedResponse.respondent_code !== 'CONFIDENTIAL' && (
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>({selectedResponse.respondent_code})</span>
                  )}
                </div>

                <div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Department
                  </span>
                  <div style={{ fontWeight: 600, fontSize: 14, marginTop: 2 }}>
                    {selectedResponse.department_name}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    eNPS Rating
                  </span>
                  <div style={{ marginTop: 2 }}>
                    {selectedResponse.nps_score !== null ? (
                      <span
                        style={{
                          background:
                            selectedResponse.nps_score >= 9
                              ? 'rgba(16, 185, 129, 0.15)'
                              : selectedResponse.nps_score >= 7
                              ? 'rgba(245, 158, 11, 0.15)'
                              : 'rgba(239, 68, 68, 0.15)',
                          color:
                            selectedResponse.nps_score >= 9
                              ? '#059669'
                              : selectedResponse.nps_score >= 7
                              ? '#d97706'
                              : '#dc2626',
                          padding: '3px 10px',
                          borderRadius: 12,
                          fontWeight: 700,
                          fontSize: 13
                        }}
                      >
                        {selectedResponse.nps_score} / 10 (
                        {selectedResponse.nps_score >= 9
                          ? 'Promoter'
                          : selectedResponse.nps_score >= 7
                          ? 'Passive'
                          : 'Detractor'}
                        )
                      </span>
                    ) : (
                      <span style={{ color: 'var(--muted)' }}>N/A</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Verbatim Feedback */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                  Qualitative Feedback & Comments
                </label>
                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: 14,
                    fontSize: 13,
                    fontStyle: selectedResponse.feedback_text ? 'normal' : 'italic',
                    color: selectedResponse.feedback_text ? 'var(--foreground)' : 'var(--muted)',
                    lineHeight: 1.5
                  }}
                >
                  {selectedResponse.feedback_text ? selectedResponse.feedback_text : 'No written feedback was provided.'}
                </div>
              </div>

              {/* Individual Question Answers */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 8 }}>
                  Question-by-Question Answers
                </label>
                {activeSurvey?.questions && activeSurvey.questions.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {activeSurvey.questions.map((q, idx) => {
                      const answerVal = selectedResponse.answers
                        ? selectedResponse.answers[q.id]
                        : null;
                      return (
                        <div
                          key={q.id || idx}
                          style={{
                            padding: '12px 14px',
                            background: 'var(--surface-muted, #f8fafc)',
                            border: '1px solid var(--border)',
                            borderRadius: 8
                          }}
                        >
                          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 4 }}>
                            Question {idx + 1} ({q.type || 'standard'})
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                            {q.question}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#00b8db' }}>
                            Answer:{' '}
                            {answerVal !== null && answerVal !== undefined ? (
                              <span style={{ color: 'var(--foreground)' }}>
                                {typeof answerVal === 'object' ? JSON.stringify(answerVal) : String(answerVal)}
                                {q.type === 'nps' ? ' / 10' : q.type === 'rating' ? ' / 5' : ''}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--muted)', fontStyle: 'italic', fontWeight: 400 }}>No response</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : selectedResponse.answers && Object.keys(selectedResponse.answers).length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {Object.entries(selectedResponse.answers).map(([key, val]) => (
                      <div
                        key={key}
                        style={{
                          padding: '10px 12px',
                          background: 'var(--surface-muted, #f8fafc)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 13
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{key}</span>
                        <span style={{ fontWeight: 700, color: '#00b8db' }}>{String(val)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', padding: 12, textAlign: 'center', background: 'var(--surface-muted)', borderRadius: 8 }}>
                    No additional question answers recorded for this submission.
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setSelectedResponse(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
