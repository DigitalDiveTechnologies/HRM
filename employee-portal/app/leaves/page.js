'use client';

import { useEffect, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { api, value } from '@/lib/api';

const formatDate = (v) => (v ? new Date(v).toLocaleDateString() : '—');

export default function Leaves() {
  const [leaves, setLeaves] = useState([]);
  const [balances, setBalances] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [showApply, setShowApply] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    leaveType: 'Annual',
    startDate: '',
    endDate: '',
    reason: '',
  });
  const [page, setPage] = useState(1);
  const pageSize = 10;

  function loadData() {
    Promise.all([api('/leave'), api('/leave/balances')])
      .then(([l, b]) => {
        setLeaves(Array.isArray(l) ? l : []);
        setBalances(Array.isArray(b) ? b : []);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleApply(e) {
    e.preventDefault();
    if (!form.startDate || !form.endDate) return;
    setSubmitting(true);
    setError('');
    setMsg('');
    try {
      await api('/leave', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setMsg('Leave request submitted successfully for manager approval.');
      setForm({ leaveType: 'Annual', startDate: '', endDate: '', reason: '' });
      setShowApply(false);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to submit leave request.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PortalShell
      title="Leaves"
      subtitle="Leave entitlement balances, active workflows and historical requests"
      actions={
        <button
          type="button"
          onClick={() => setShowApply((p) => !p)}
          className="btn-primary"
          style={{ padding: '7px 14px', fontSize: '12px' }}
        >
          {showApply ? 'Close Form' : '+ Apply For Leave'}
        </button>
      }
    >
      {error ? <div className="error-box">{error}</div> : null}
      {msg ? <div className="success-box">{msg}</div> : null}

      {/* Leave Entitlement Balances Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        {balances.map((r, i) => {
          const type = value(r, 'leaveType', 'leave_type') || 'Annual';
          const rem = Number(value(r, 'remainingDays', 'remaining_days') || 0);
          const used = Number(value(r, 'usedDays', 'used_days') || 0);
          const total = Number(value(r, 'entitlementDays', 'entitlement_days') || 0);

          return (
            <div key={i} className="panel-card" style={{ padding: '16px 18px', margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)' }}>{type}</span>
                <span className={`status-pill ${rem > 0 ? 'active' : 'pending'}`}>
                  {rem > 0 ? 'Available' : 'Exhausted'}
                </span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--brand)', marginBottom: 4 }}>
                {rem} <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>days left</span>
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                {used} used of {total} total entitlement
              </div>
            </div>
          );
        })}
      </div>

      {/* Expandable Leave Application Form */}
      {showApply ? (
        <div className="panel-card" style={{ marginBottom: 20 }}>
          <div className="panel-head" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>
            <div className="panel-title">
              <h2>New Leave Request</h2>
              <p>Submit request for line manager and HR ops approval</p>
            </div>
          </div>
          <form onSubmit={handleApply} style={{ marginTop: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              <div className="form-field">
                <label>Leave Type</label>
                <select
                  value={form.leaveType}
                  onChange={(e) => setForm({ ...form, leaveType: e.target.value })}
                >
                  <option value="Annual">Annual Leave</option>
                  <option value="Sick">Sick Leave</option>
                  <option value="Casual">Casual Leave</option>
                  <option value="Unpaid">Unpaid Leave</option>
                  <option value="Maternity">Maternity Leave</option>
                  <option value="Paternity">Paternity Leave</option>
                </select>
              </div>
              <div className="form-field">
                <label>Start Date</label>
                <input
                  type="date"
                  required
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div className="form-field">
                <label>End Date</label>
                <input
                  type="date"
                  required
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
            </div>
            <div className="form-field" style={{ marginTop: 4 }}>
              <label>Reason / Covering Details</label>
              <textarea
                rows={3}
                placeholder="State the reason for leave and any colleague covering urgent duties…"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? 'Submitting…' : 'Submit Leave Request'}
              </button>
              <button
                type="button"
                onClick={() => setShowApply(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--line)',
                  borderRadius: 6,
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--muted)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Leave Request History Table */}
      <div className="panel-card">
        <div className="panel-head">
          <div className="panel-title">
            <h2>Leave Request History</h2>
            <p>Track submissions, approval stages and historical records</p>
          </div>
        </div>

        <div className="table-wrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th>Leave Type</th>
                <th>From Date</th>
                <th>To Date</th>
                <th>Total Days</th>
                <th>Reason</th>
                <th>Workflow Stage</th>
              </tr>
            </thead>
            <tbody>
              {leaves.length ? (
                leaves
                  .slice((page - 1) * pageSize, page * pageSize)
                  .map((r) => {
                    const stage = String(value(r, 'workflowStage', 'workflow_stage', 'status') || 'pending').toLowerCase();
                    return (
                      <tr key={value(r, 'id')}>
                        <td style={{ fontWeight: 600 }}>{value(r, 'leaveType', 'leave_type')}</td>
                        <td>{formatDate(value(r, 'startDate', 'start_date'))}</td>
                        <td>{formatDate(value(r, 'endDate', 'end_date'))}</td>
                        <td>
                          <span className="code-pill">{value(r, 'days') || 1} days</span>
                        </td>
                        <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {value(r, 'reason') || '—'}
                        </td>
                        <td>
                          <span className={`status-pill ${stage.includes('approved') ? 'approved' : stage.includes('reject') ? 'rejected' : 'pending'}`}>
                            {value(r, 'workflowStage', 'workflow_stage', 'status')}
                          </span>
                        </td>
                      </tr>
                    );
                  })
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '30px 0' }}>
                    No leave requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar (Exact Admin Bottom-Right Style) */}
        {leaves.length > pageSize ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 16,
              paddingTop: 14,
              borderTop: '1px solid var(--line)',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, leaves.length)} of {leaves.length} records
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="pagination-btn"
                aria-label="Previous page"
              >
                ‹
              </button>
              {Array.from({ length: Math.ceil(leaves.length / pageSize) }, (_, idx) => idx + 1).map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setPage(num)}
                  className={`pagination-btn ${page === num ? 'active' : ''}`}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                disabled={page >= Math.ceil(leaves.length / pageSize)}
                onClick={() => setPage((p) => p + 1)}
                className="pagination-btn"
                aria-label="Next page"
              >
                ›
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </PortalShell>
  );
}
