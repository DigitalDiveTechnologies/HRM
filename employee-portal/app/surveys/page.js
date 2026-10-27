'use client';

import React, { useState, useEffect, useCallback } from 'react';
import PortalShell from '@/components/PortalShell';
import { api } from '@/lib/api';
import { useLocale } from '@/lib/LocaleContext';

export default function EmployeeSurveysPage() {
  const { t, locale } = useLocale();

  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Active survey being responded to
  const [activeSurveyModal, setActiveSurveyModal] = useState(null);
  const [npsScore, setNpsScore] = useState(10);
  const [answers, setAnswers] = useState({});
  const [feedbackText, setFeedbackText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const loadSurveys = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api('/surveys');
      setSurveys(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'Failed to load surveys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSurveys();
  }, [loadSurveys]);

  const openSurveyModal = (survey) => {
    setActiveSurveyModal(survey);
    setNpsScore(10);
    // Initialize default answers
    const initialAnswers = {};
    if (survey.questions && Array.isArray(survey.questions)) {
      survey.questions.forEach((q) => {
        if (q.type === 'rating') initialAnswers[q.id] = 5;
        else if (q.type === 'nps') initialAnswers[q.id] = 10;
        else initialAnswers[q.id] = '';
      });
    }
    setAnswers(initialAnswers);
    setFeedbackText('');
  };

  const handleSubmitResponse = async (e) => {
    e.preventDefault();
    if (!activeSurveyModal) return;

    setSubmitting(true);
    setError('');
    try {
      await api(`/surveys/${activeSurveyModal.id}/respond`, {
        method: 'POST',
        body: JSON.stringify({
          npsScore: npsScore,
          answers: answers,
          feedbackText: feedbackText.trim() || null
        })
      });

      setActiveSurveyModal(null);
      showSuccess('Thank you! Your survey feedback has been recorded anonymously.');
      await loadSurveys();
    } catch (err) {
      setError(err.message || 'Failed to submit survey response.');
    } finally {
      setSubmitting(false);
    }
  };

  const getNpsColor = (score) => {
    if (score >= 9) return { bg: '#ecfdf5', text: '#059669', border: '#10b981', label: 'Promoter (9-10)' };
    if (score >= 7) return { bg: '#fffbeb', text: '#d97706', border: '#f59e0b', label: 'Passive (7-8)' };
    return { bg: '#fef2f2', text: '#dc2626', border: '#ef4444', label: 'Detractor (0-6)' };
  };

  const activeSurveysList = surveys.filter((s) => s.isActive);
  const pastSurveysList = surveys.filter((s) => !s.isActive);

  return (
    <PortalShell
      title="Surveys & Employee Wellbeing"
      subtitle="Share your voice, participate in confidential pulse surveys, and shape corporate culture."
      actions={
        <button
          className="portal-btn-secondary"
          onClick={loadSurveys}
          style={{ padding: '8px 14px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <span>↻</span> Refresh Surveys
        </button>
      }
    >
      {/* Toast Notifications */}
      {error && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid #ef4444',
            color: '#dc2626',
            padding: '12px 16px',
            borderRadius: 8,
            marginBottom: 18,
            fontWeight: 600,
            fontSize: 13
          }}
        >
          {error}
        </div>
      )}

      {successMsg && (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid #10b981',
            color: '#065f46',
            padding: '12px 16px',
            borderRadius: 8,
            marginBottom: 18,
            fontWeight: 600,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <span>✓</span> {successMsg}
        </div>
      )}

      {/* Info Banner */}
      <div
        className="portal-card"
        style={{
          background: 'linear-gradient(135deg, rgba(0, 184, 219, 0.08) 0%, rgba(2, 132, 199, 0.04) 100%)',
          border: '1px solid rgba(0, 184, 219, 0.3)',
          borderRadius: 14,
          padding: '20px 24px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 16
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'rgba(0, 184, 219, 0.15)',
            color: '#00b8db',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            flexShrink: 0
          }}
        >
          🔒
        </div>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: 'var(--foreground)' }}>
            Confidentiality & Anonymity Guarantee
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
            Your feedback in employee pulse surveys is strictly anonymous. Individual employee identifiers are not linked
            to survey responses, ensuring you can provide honest, constructive feedback freely.
          </p>
        </div>
      </div>

      {/* Active Surveys Section */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Active Pulse Surveys</span>
          <span
            style={{
              background: '#00b8db',
              color: '#fff',
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 12,
              fontWeight: 800
            }}
          >
            {activeSurveysList.length}
          </span>
        </h2>

        {loading ? (
          <div className="portal-card" style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            Loading active surveys…
          </div>
        ) : activeSurveysList.length === 0 ? (
          <div
            className="portal-card"
            style={{
              padding: 40,
              textAlign: 'center',
              color: 'var(--muted)',
              borderRadius: 12,
              border: '1px dashed var(--border)'
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
            <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--foreground)' }}>
              No active surveys at this time
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 13 }}>
              Check back soon! HR will publish periodic wellbeing and team pulse surveys here.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 18 }}>
            {activeSurveysList.map((survey) => {
              const hasResponded = survey.hasResponded;
              const questionCount = survey.questions ? survey.questions.length : 0;

              return (
                <div
                  key={survey.id}
                  className="portal-card"
                  style={{
                    padding: 22,
                    borderRadius: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    border: hasResponded ? '1px solid var(--border)' : '1px solid rgba(0, 184, 219, 0.4)',
                    boxShadow: hasResponded ? 'none' : '0 4px 16px rgba(0, 184, 219, 0.08)'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                      <span
                        style={{
                          background: survey.isAnonymous ? 'rgba(16, 185, 129, 0.12)' : 'rgba(2, 132, 199, 0.12)',
                          color: survey.isAnonymous ? '#059669' : '#0284c7',
                          padding: '3px 8px',
                          borderRadius: 8,
                          fontSize: 11,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        {survey.isAnonymous ? '🔒 Anonymous Survey' : 'Identified Survey'}
                      </span>

                      {hasResponded ? (
                        <span
                          style={{
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#059669',
                            padding: '3px 10px',
                            borderRadius: 12,
                            fontSize: 11.5,
                            fontWeight: 700
                          }}
                        >
                          ✓ Completed
                        </span>
                      ) : (
                        <span
                          style={{
                            background: 'rgba(245, 158, 11, 0.15)',
                            color: '#d97706',
                            padding: '3px 10px',
                            borderRadius: 12,
                            fontSize: 11.5,
                            fontWeight: 700
                          }}
                        >
                          ● Pending Feedback
                        </span>
                      )}
                    </div>

                    <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: 'var(--foreground)' }}>
                      {survey.title}
                    </h3>

                    {survey.description && (
                      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                        {survey.description}
                      </p>
                    )}

                    <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
                      <span>📝 {questionCount} Questions</span>
                      <span>👥 {survey.responseCount || 0} Responses</span>
                    </div>
                  </div>

                  <div>
                    {hasResponded ? (
                      <div
                        style={{
                          background: 'var(--surface-muted, #f8fafc)',
                          padding: '10px 14px',
                          borderRadius: 8,
                          fontSize: 12.5,
                          color: 'var(--muted)',
                          textAlign: 'center',
                          fontWeight: 600
                        }}
                      >
                        ✓ You have completed this survey. Thank you!
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => openSurveyModal(survey)}
                        style={{
                          width: '100%',
                          padding: '10px 16px',
                          fontSize: 13,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6
                        }}
                      >
                        <span>✍️</span> Take Survey Now
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Past Surveys Section */}
      {pastSurveysList.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: 'var(--muted)' }}>
            Closed / Archived Surveys
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
            {pastSurveysList.map((s) => (
              <div
                key={s.id}
                className="portal-card"
                style={{ padding: 18, opacity: 0.75, borderRadius: 10 }}
              >
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Closed • {s.responseCount || 0} Total Responses
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: SURVEY RESPONSE SUBMISSION */}
      {/* ============================================================ */}
      {activeSurveyModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) setActiveSurveyModal(null);
          }}
        >
          <div className="modal-content" style={{ maxWidth: 620, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">{activeSurveyModal.title}</h3>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {activeSurveyModal.isAnonymous ? '🔒 100% Anonymous & Confidential' : 'Internal Survey'}
                </span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => !submitting && setActiveSurveyModal(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitResponse} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
              <div className="modal-body" style={{ flex: 1, padding: 20 }}>
                {activeSurveyModal.description && (
                  <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                    {activeSurveyModal.description}
                  </p>
                )}

                {/* Primary Question: eNPS Rating 0-10 */}
                <div
                  style={{
                    background: 'var(--surface-muted, #f8fafc)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: 18,
                    marginBottom: 20
                  }}
                >
                  <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', marginBottom: 6, display: 'block' }}>
                    1. On a scale of 0 to 10, how likely are you to recommend working here to friends or colleagues? *
                  </label>
                  <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--muted)' }}>
                    0 = Not at all likely, 10 = Extremely likely
                  </p>

                  {/* 0-10 Score Pills */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => {
                      const isSelected = npsScore === score;
                      const scoreInfo = getNpsColor(score);
                      return (
                        <button
                          key={score}
                          type="button"
                          onClick={() => setNpsScore(score)}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 8,
                            border: isSelected ? `2px solid ${scoreInfo.border}` : '1px solid var(--border)',
                            background: isSelected ? scoreInfo.border : 'var(--surface)',
                            color: isSelected ? '#fff' : 'var(--foreground)',
                            fontWeight: isSelected ? 800 : 600,
                            fontSize: 14,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {score}
                        </button>
                      );
                    })}
                  </div>

                  {/* Dynamic Sentiment Preview */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                    <span style={{ color: 'var(--muted)' }}>Selected Rating: <strong>{npsScore} / 10</strong></span>
                    <span
                      style={{
                        background: getNpsColor(npsScore).bg,
                        color: getNpsColor(npsScore).text,
                        border: `1px solid ${getNpsColor(npsScore).border}`,
                        padding: '2px 8px',
                        borderRadius: 10,
                        fontWeight: 700,
                        fontSize: 11
                      }}
                    >
                      {getNpsColor(npsScore).label}
                    </span>
                  </div>
                </div>

                {/* Additional Dynamic Questions */}
                {activeSurveyModal.questions &&
                  activeSurveyModal.questions
                    .filter((q) => q.id !== 'enps')
                    .map((q, idx) => {
                      const qAnswer = answers[q.id] || 3;
                      return (
                        <div
                          key={q.id || idx}
                          style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 12,
                            padding: 16,
                            marginBottom: 16
                          }}
                        >
                          <label style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--foreground)', marginBottom: 8, display: 'block' }}>
                            {idx + 2}. {q.question} *
                          </label>

                          {q.type === 'rating' ? (
                            <div>
                              <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                                {[1, 2, 3, 4, 5].map((val) => {
                                  const isSel = qAnswer === val;
                                  return (
                                    <button
                                      key={val}
                                      type="button"
                                      onClick={() => setAnswers({ ...answers, [q.id]: val })}
                                      style={{
                                        flex: 1,
                                        padding: '10px 0',
                                        borderRadius: 8,
                                        border: isSel ? '2px solid #00b8db' : '1px solid var(--border)',
                                        background: isSel ? 'rgba(0, 184, 219, 0.12)' : 'var(--surface-muted, #f8fafc)',
                                        color: isSel ? '#00b8db' : 'var(--foreground)',
                                        fontWeight: isSel ? 800 : 600,
                                        fontSize: 13,
                                        cursor: 'pointer'
                                      }}
                                    >
                                      ★ {val}
                                    </button>
                                  );
                                })}
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)' }}>
                                <span>1 - Needs Improvement</span>
                                <span>3 - Neutral</span>
                                <span>5 - Excellent</span>
                              </div>
                            </div>
                          ) : (
                            <input
                              type="text"
                              value={qAnswer || ''}
                              onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                              placeholder="Your response..."
                              style={{ width: '100%', padding: '8px 12px', borderRadius: 8 }}
                            />
                          )}
                        </div>
                      );
                    })}

                {/* Qualitative Feedback Textarea */}
                <div className="form-group" style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 13, fontWeight: 700 }}>
                    Qualitative Feedback & Comments (Optional)
                  </label>
                  <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--muted)' }}>
                    Share anything that would make your work experience better. Your feedback is strictly anonymous.
                  </p>
                  <textarea
                    rows={4}
                    placeholder="What are we doing well? What changes would make your work environment even better?"
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    style={{
                      width: '100%',
                      padding: 12,
                      fontSize: 13,
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      resize: 'vertical'
                    }}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '16px 20px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={submitting}
                  onClick={() => setActiveSurveyModal(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting}
                  style={{ minWidth: 140 }}
                >
                  {submitting ? 'Submitting…' : 'Submit Feedback 🚀'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
