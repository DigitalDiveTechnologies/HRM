'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api, getUser, normalizeRole } from '../../lib/auth';
import { formatDate, todayISO, v } from '../../lib/format';
import { UAE_HOLIDAYS_2026 } from '../../lib/holidays';

export default function LeavePage() {
  const [user, setUser] = useState(null);
  const role = normalizeRole(user);
  const isEmployee = role === 'employee';
  const canApprove = role === 'admin';

  const [rows, setRows] = useState([]);
  const [balances, setBalances] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    employeeId: '',
    leaveType: 'Annual',
    startDate: todayISO(),
    endDate: todayISO(),
    days: 1,
    reason: '',
  });

  useEffect(() => {
    setUser(getUser());
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [leave, bal, emps, appr] = await Promise.all([
        api('/leave'),
        api('/leave/balances'),
        api('/employees'),
        api('/approvals'),
      ]);
      setRows(leave);
      setBalances(bal || []);
      setEmployees(emps);
      setApprovals(appr || []);
      if (normalizeRole(user) === 'employee' && user?.employeeId) {
        setForm((f) => ({ ...f, employeeId: String(user.employeeId) }));
      }
    } catch (e) {
      setError(e.message);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setMsg('');
    setError('');
    setSubmitting(true);
    try {
      await api('/leave', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: Number(form.employeeId),
          leaveType: form.leaveType,
          startDate: form.startDate,
          endDate: form.endDate,
          days: Number(form.days),
          reason: form.reason,
        }),
      });
      setMsg('Leave request submitted.');
      setForm((f) => ({ ...f, reason: '' }));
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function setStatus(leaveId, status) {
    setMsg('');
    setError('');
    try {
      const leaveIdNum = Number(leaveId);
      const pendingHr = approvals.find(
        (a) =>
          String(v(a, 'requestType', 'request_type')).toLowerCase() === 'leave' &&
          Number(v(a, 'referenceId', 'reference_id')) === leaveIdNum &&
          String(v(a, 'status')).toLowerCase() === 'pending' &&
          String(v(a, 'approverRole', 'approver_role')).toLowerCase() === 'admin',
      );
      if (!pendingHr) {
        setError('This request is still awaiting manager approval.');
        return;
      }
      await api(`/approvals/${v(pendingHr, 'id')}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setMsg(status === 'approved' ? 'Leave approved (HR final).' : 'Leave rejected.');
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  function workflowLabel(row) {
    const stage = v(row, 'workflowStage', 'workflow_stage');
    if (stage === 'pending_manager') return 'Pending manager';
    if (stage === 'pending_hr') return 'Pending HR';
    return v(row, 'status');
  }

  function canHrAct(row) {
    const stage = v(row, 'workflowStage', 'workflow_stage');
    return String(v(row, 'status')).toLowerCase() === 'pending' && stage === 'pending_hr';
  }

  // Compute stats
  const totalLeavesCount = rows.length;
  const totalDays = rows.reduce((sum, r) => sum + (Number(v(r, 'days')) || 0), 0);
  const annualCount = rows.filter((r) => String(v(r, 'leaveType', 'leave_type')).toLowerCase() === 'annual').length;
  const sickCount = rows.filter((r) => String(v(r, 'leaveType', 'leave_type')).toLowerCase() === 'sick').length;
  const maternityCount = rows.filter((r) => String(v(r, 'leaveType', 'leave_type')).toLowerCase() === 'maternity').length;
  const unpaidCount = rows.filter((r) => String(v(r, 'leaveType', 'leave_type')).toLowerCase() === 'unpaid').length;

  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  const filteredLeaves = rows.filter((r) => {
    const t = String(v(r, 'leaveType', 'leave_type') || '').toLowerCase();
    const s = String(v(r, 'status') || '').toLowerCase();
    const name = String(v(r, 'fullName', 'full_name') || '').toLowerCase();
    const code = String(v(r, 'empCode', 'emp_code') || '').toLowerCase();
    const q = searchFilter.toLowerCase();

    const matchType = !typeFilter || t === typeFilter.toLowerCase();
    const matchStatus = !statusFilter || s === statusFilter.toLowerCase();
    const matchSearch = !q || name.includes(q) || code.includes(q);
    return matchType && matchStatus && matchSearch;
  });

  return (
    <AppShell title="Leave Management" subtitle="Employee leave history, category breakdown & remaining balances">
      {error ? <div className="error">{error}</div> : null}
      {msg ? <div className="muted" style={{ marginBottom: 12, color: 'var(--ok)', fontWeight: 600 }}>{msg}</div> : null}

      <div className="stack">
        {/* Top Summary Stat Chips */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
          <div className="card" style={{ padding: '14px 16px' }}>
            <div className="muted" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Total Leaves Taken</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)', marginTop: 4 }}>
              {totalLeavesCount} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--muted)' }}>({totalDays} days)</span>
            </div>
          </div>
          <div className="card" style={{ padding: '14px 16px' }}>
            <div className="muted" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Annual Leaves</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#008fa8', marginTop: 4 }}>
              {annualCount} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--muted)' }}>records</span>
            </div>
          </div>
          <div className="card" style={{ padding: '14px 16px' }}>
            <div className="muted" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Sick Leaves</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#eab308', marginTop: 4 }}>
              {sickCount} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--muted)' }}>records</span>
            </div>
          </div>
          <div className="card" style={{ padding: '14px 16px' }}>
            <div className="muted" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Maternity Leaves</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#ec4899', marginTop: 4 }}>
              {maternityCount} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--muted)' }}>records</span>
            </div>
          </div>
          <div className="card" style={{ padding: '14px 16px' }}>
            <div className="muted" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Unpaid Leaves</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#64748b', marginTop: 4 }}>
              {unpaidCount} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--muted)' }}>records</span>
            </div>
          </div>
        </div>

        {/* Leaves Records Table */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Leaves Overview</h3>
              <p className="muted" style={{ margin: '2px 0 0', fontSize: '12px' }}>
                Employee leave history, type breakdown, days consumed, and approvals
              </p>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Search employee…"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{
                  fontSize: '12.5px',
                  padding: '6px 12px',
                  borderRadius: 6,
                  minWidth: 180,
                  border: '1px solid var(--line-strong, #d0d5dd)',
                  background: 'var(--surface, #ffffff)',
                  color: 'var(--ink)',
                  outline: 'none',
                }}
              />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{
                  fontSize: '12px',
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--line-strong, #d0d5dd)',
                  background: 'var(--surface, #ffffff)',
                  color: 'var(--ink)',
                  outline: 'none',
                }}
              >
                <option value="">All Leave Types</option>
                <option value="annual">Annual</option>
                <option value="sick">Sick</option>
                <option value="maternity">Maternity</option>
                <option value="unpaid">Unpaid</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  fontSize: '12px',
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--line-strong, #d0d5dd)',
                  background: 'var(--surface, #ffffff)',
                  color: 'var(--ink)',
                  outline: 'none',
                }}
              >
                <option value="">All Statuses</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Leave Type</th>
                  <th>Days Taken</th>
                  <th>Date Period</th>
                  <th>Reason / Details</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeaves.map((r) => (
                  <tr key={v(r, 'id')}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{v(r, 'fullName', 'full_name')}</div>
                      <div className="muted" style={{ fontSize: '11px' }}>{v(r, 'empCode', 'emp_code')}</div>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '11.5px',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background:
                            String(v(r, 'leaveType', 'leave_type')).toLowerCase() === 'annual'
                              ? 'rgba(0, 184, 219, 0.12)'
                              : String(v(r, 'leaveType', 'leave_type')).toLowerCase() === 'sick'
                              ? 'rgba(234, 179, 8, 0.15)'
                              : String(v(r, 'leaveType', 'leave_type')).toLowerCase() === 'maternity'
                              ? 'rgba(236, 72, 153, 0.15)'
                              : 'var(--surface-alt)',
                          color:
                            String(v(r, 'leaveType', 'leave_type')).toLowerCase() === 'annual'
                              ? '#008fa8'
                              : String(v(r, 'leaveType', 'leave_type')).toLowerCase() === 'sick'
                              ? '#b45309'
                              : String(v(r, 'leaveType', 'leave_type')).toLowerCase() === 'maternity'
                              ? '#be185d'
                              : 'var(--muted)',
                        }}
                      >
                        {v(r, 'leaveType', 'leave_type')}
                      </span>
                    </td>
                    <td>
                      <strong>{v(r, 'days')}</strong> <span className="muted" style={{ fontSize: '11px' }}>days</span>
                    </td>
                    <td>
                      {formatDate(v(r, 'startDate', 'start_date'))} → {formatDate(v(r, 'endDate', 'end_date'))}
                    </td>
                    <td style={{ maxWidth: 220, fontSize: '12px' }} className="muted">
                      {v(r, 'reason') || '—'}
                    </td>
                    <td>
                      <Badge status={workflowLabel(r)} />
                    </td>
                    <td>
                      {canHrAct(r) && canApprove ? (
                        <div className="row-actions">
                          <button type="button" className="btn ok" onClick={() => setStatus(v(r, 'id'), 'approved')} style={{ padding: '3px 8px', fontSize: '11.5px' }}>
                            Approve (HR)
                          </button>
                          <button type="button" className="btn danger" onClick={() => setStatus(v(r, 'id'), 'rejected')} style={{ padding: '3px 8px', fontSize: '11.5px' }}>
                            Reject
                          </button>
                        </div>
                      ) : String(v(r, 'status')).toLowerCase() === 'pending' ? (
                        <span className="muted" style={{ fontSize: '11px' }}>{workflowLabel(r)}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
                {!filteredLeaves.length ? (
                  <tr>
                    <td colSpan={7} className="muted" style={{ textAlign: 'center', padding: '24px 0' }}>
                      No leave records matching current filter.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {/* Leave Balances Table */}
        <div className="card">
          <div className="panel-title">
            <h3>Leave balances</h3>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Type</th>
                  <th>Entitlement</th>
                  <th>Used</th>
                  <th>Remaining</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b, i) => (
                  <tr key={`${v(b, 'employeeId', 'employee_id')}-${v(b, 'leaveType', 'leave_type')}-${i}`}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{v(b, 'fullName', 'full_name')}</div>
                      <div className="muted" style={{ fontSize: '11px' }}>{v(b, 'empCode', 'emp_code')}</div>
                    </td>
                    <td>{v(b, 'leaveType', 'leave_type')}</td>
                    <td>{v(b, 'entitlementDays', 'entitlement_days')}</td>
                    <td>{v(b, 'usedDays', 'used_days')}</td>
                    <td>
                      <strong style={{ color: '#008fa8' }}>{v(b, 'remainingDays', 'remaining_days')}</strong>
                    </td>
                  </tr>
                ))}
                {!balances.length ? (
                  <tr>
                    <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: '20px 0' }}>
                      No balance rows.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {/* Holiday Calendar */}
        <div className="card">
          <div className="panel-title">
            <h3>Holiday calendar (UAE 2026)</h3>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Holiday</th>
                </tr>
              </thead>
              <tbody>
                {UAE_HOLIDAYS_2026.map((h) => (
                  <tr key={h.date}>
                    <td>{formatDate(h.date)}</td>
                    <td>{h.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
