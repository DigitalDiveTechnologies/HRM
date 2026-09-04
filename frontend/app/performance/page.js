'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api, getUser, normalizeRole } from '../../lib/auth';
import { formatDate, todayISO, v } from '../../lib/format';

export default function PerformancePage() {
  const role = normalizeRole(getUser());
  const isAdmin = role === 'admin';

  const [goals, setGoals] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [goalForm, setGoalForm] = useState({
    employeeId: '',
    title: '',
    kpi: '',
    targetValue: '',
    progressPct: 0,
    periodLabel: 'H2 2026',
  });
  const [reviewForm, setReviewForm] = useState({
    employeeId: '',
    reviewerName: '',
    reviewType: 'mid_year',
    rating: '4.0',
    summary: '',
    reviewDate: todayISO(),
  });

  const load = useCallback(() => {
    setError('');
    Promise.all([api('/performance/goals'), api('/performance/reviews'), api('/employees')])
      .then(([g, r, emps]) => {
        setGoals(g || []);
        setReviews(r || []);
        setEmployees(emps || []);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createGoal(e) {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      await api('/performance/goals', {
        method: 'POST',
        body: JSON.stringify({
          ...goalForm,
          employeeId: Number(goalForm.employeeId),
          progressPct: Number(goalForm.progressPct) || 0,
        }),
      });
      setMsg('Goal created.');
      setGoalForm({
        employeeId: '',
        title: '',
        kpi: '',
        targetValue: '',
        progressPct: 0,
        periodLabel: 'H2 2026',
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createReview(e) {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      await api('/performance/reviews', {
        method: 'POST',
        body: JSON.stringify({
          ...reviewForm,
          employeeId: Number(reviewForm.employeeId),
          rating: reviewForm.rating === '' ? null : Number(reviewForm.rating),
        }),
      });
      setMsg('Review saved.');
      setReviewForm({
        employeeId: '',
        reviewerName: '',
        reviewType: 'mid_year',
        rating: '4.0',
        summary: '',
        reviewDate: todayISO(),
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
      await api(`/performance/goals/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ progressPct: next, status: next >= 100 ? 'completed' : 'active' }),
      });
      setMsg(`Progress updated to ${next}%.`);
      load();
    } catch (e) {
      setError(e.message || 'Failed to update progress. Please try again.');
    }
  }

  async function setReviewStatus(id, status) {
    try {
      await api(`/performance/reviews/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setMsg(`Review marked ${status}.`);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <AppShell title="Performance Management" subtitle="Goals, KPIs and performance reviews">
      {error ? <div className="error">{error}</div> : null}
      {msg ? <div className="muted" style={{ marginBottom: 12, color: 'var(--ok)', fontWeight: 600 }}>{msg}</div> : null}

      {isAdmin ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="panel-title">
            <h3>Add goal</h3>
          </div>
          <form className="stack" onSubmit={createGoal}>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <label className="field">
                Employee
                <select required value={goalForm.employeeId} onChange={(e) => setGoalForm({ ...goalForm, employeeId: e.target.value })}>
                  <option value="">Select…</option>
                  {employees.map((e) => (
                    <option key={v(e, 'id')} value={v(e, 'id')}>
                      {v(e, 'fullName', 'full_name')} ({v(e, 'empCode', 'emp_code')})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Period
                <input value={goalForm.periodLabel} onChange={(e) => setGoalForm({ ...goalForm, periodLabel: e.target.value })} />
              </label>
              <label className="field">
                Title
                <input required value={goalForm.title} onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })} />
              </label>
              <label className="field">
                KPI
                <input value={goalForm.kpi} onChange={(e) => setGoalForm({ ...goalForm, kpi: e.target.value })} />
              </label>
              <label className="field">
                Target
                <input value={goalForm.targetValue} onChange={(e) => setGoalForm({ ...goalForm, targetValue: e.target.value })} />
              </label>
              <label className="field">
                Progress %
                <input type="number" min="0" max="100" value={goalForm.progressPct} onChange={(e) => setGoalForm({ ...goalForm, progressPct: e.target.value })} />
              </label>
            </div>
            <button className="btn" type="submit">
              Create goal
            </button>
          </form>
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="panel-title">
          <h3>Goals</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Goal</th>
                <th>KPI / Target</th>
                <th>Period</th>
                <th>Progress</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {goals.map((g) => (
                <tr key={v(g, 'id')}>
                  <td>
                    {v(g, 'fullName', 'full_name')}
                    <div className="muted">{v(g, 'empCode', 'emp_code')}</div>
                  </td>
                  <td>{v(g, 'title')}</td>
                  <td>
                    {v(g, 'kpi') || '—'}
                    <div className="muted">{v(g, 'targetValue', 'target_value') || ''}</div>
                  </td>
                  <td>{v(g, 'periodLabel', 'period_label') || '—'}</td>
                  <td>{Number(v(g, 'progressPct', 'progress_pct') || 0)}%</td>
                  <td>
                    <Badge status={v(g, 'status')} />
                  </td>
                  <td>
                    {isAdmin && String(v(g, 'status')) === 'active' ? (
                      <button type="button" className="btn secondary" onClick={() => bumpProgress(v(g, 'id'), v(g, 'progressPct', 'progress_pct'))}>
                        +10%
                      </button>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
              {!goals.length ? (
                <tr>
                  <td colSpan={7}>No goals yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {isAdmin ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="panel-title">
            <h3>Add review</h3>
          </div>
          <form className="stack" onSubmit={createReview}>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <label className="field">
                Employee
                <select required value={reviewForm.employeeId} onChange={(e) => setReviewForm({ ...reviewForm, employeeId: e.target.value })}>
                  <option value="">Select…</option>
                  {employees.map((e) => (
                    <option key={v(e, 'id')} value={v(e, 'id')}>
                      {v(e, 'fullName', 'full_name')} ({v(e, 'empCode', 'emp_code')})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Type
                <select value={reviewForm.reviewType} onChange={(e) => setReviewForm({ ...reviewForm, reviewType: e.target.value })}>
                  <option value="annual">Annual</option>
                  <option value="mid_year">Mid-year</option>
                  <option value="probation">Probation</option>
                  <option value="360">360</option>
                </select>
              </label>
              <label className="field">
                Reviewer
                <input value={reviewForm.reviewerName} onChange={(e) => setReviewForm({ ...reviewForm, reviewerName: e.target.value })} />
              </label>
              <label className="field">
                Rating
                <input type="number" min="1" max="5" step="0.1" value={reviewForm.rating} onChange={(e) => setReviewForm({ ...reviewForm, rating: e.target.value })} />
              </label>
              <label className="field">
                Review date
                <input type="date" value={reviewForm.reviewDate} onChange={(e) => setReviewForm({ ...reviewForm, reviewDate: e.target.value })} />
              </label>
            </div>
            <label className="field">
              Summary
              <textarea rows={2} value={reviewForm.summary} onChange={(e) => setReviewForm({ ...reviewForm, summary: e.target.value })} />
            </label>
            <button className="btn" type="submit">
              Save review
            </button>
          </form>
        </div>
      ) : null}

      <div className="card">
        <div className="panel-title">
          <h3>Reviews</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Reviewer</th>
                <th>Rating</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => {
                const status = String(v(r, 'status') || '');
                return (
                  <tr key={v(r, 'id')}>
                    <td>
                      {v(r, 'fullName', 'full_name')}
                      <div className="muted">{v(r, 'summary') || ''}</div>
                    </td>
                    <td>{String(v(r, 'reviewType', 'review_type') || '').replace('_', ' ')}</td>
                    <td>{v(r, 'reviewerName', 'reviewer_name') || '—'}</td>
                    <td>{v(r, 'rating') ?? '—'}</td>
                    <td>{formatDate(v(r, 'reviewDate', 'review_date'))}</td>
                    <td>
                      <Badge status={status} />
                    </td>
                    <td>
                      {isAdmin && status === 'draft' ? (
                        <button type="button" className="btn ok" onClick={() => setReviewStatus(v(r, 'id'), 'submitted')}>
                          Submit
                        </button>
                      ) : isAdmin && status === 'submitted' ? (
                        <button type="button" className="btn secondary" onClick={() => setReviewStatus(v(r, 'id'), 'acknowledged')}>
                          Acknowledge
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                );
              })}
              {!reviews.length ? (
                <tr>
                  <td colSpan={7}>No reviews yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
