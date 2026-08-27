'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api, getUser, normalizeRole } from '../../lib/auth';
import { formatDate, todayISO, v } from '../../lib/format';

export default function LeavePage() {
  const [user, setUser] = useState(null);
  const role = normalizeRole(user);
  const isEmployee = role === 'employee';
  const canApprove = role === 'admin' || role === 'manager';

  const [rows, setRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
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
      const [leave, emps] = await Promise.all([api('/leave'), api('/employees')]);
      setRows(leave);
      setEmployees(emps);
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
    setMsg('');
    setError('');
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
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function setStatus(id, status) {
    try {
      await api(`/leave/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <AppShell title="Leave Management" subtitle="Annual / sick / unpaid · approvals · balances">
      {error ? <div className="error">{error}</div> : null}
      <div className="stack">
        <div className="card">
          <div className="panel-title">
            <h3>Apply leave</h3>
          </div>
          {msg ? <div style={{ color: 'var(--ok)', marginBottom: 10 }}>{msg}</div> : null}
          <form className="stack" onSubmit={onSubmit}>
            <div className="grid-2" style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
              <div className="field">
                <label>Employee</label>
                {isEmployee ? (
                  <input value={user?.fullName || user?.email || ''} disabled />
                ) : (
                  <select
                    required
                    value={form.employeeId}
                    onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                  >
                    <option value="">Select…</option>
                    {employees.map((emp) => (
                      <option key={v(emp, 'id')} value={v(emp, 'id')}>
                        {v(emp, 'fullName', 'full_name')}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="field">
                <label>Type</label>
                <select value={form.leaveType} onChange={(e) => setForm({ ...form, leaveType: e.target.value })}>
                  <option>Annual</option>
                  <option>Sick</option>
                  <option>Maternity</option>
                  <option>Unpaid</option>
                </select>
              </div>
              <div className="field">
                <label>Start</label>
                <input
                  type="date"
                  required
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div className="field">
                <label>End</label>
                <input
                  type="date"
                  required
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Days</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  required
                  value={form.days}
                  onChange={(e) => setForm({ ...form, days: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Reason</label>
                <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              </div>
            </div>
            <button className="btn" type="submit">
              Submit request
            </button>
          </form>
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Type</th>
                  <th>Dates</th>
                  <th>Days</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={v(r, 'id')}>
                    <td>{v(r, 'fullName', 'full_name')}</td>
                    <td>{v(r, 'leaveType', 'leave_type')}</td>
                    <td>
                      {formatDate(v(r, 'startDate', 'start_date'))} → {formatDate(v(r, 'endDate', 'end_date'))}
                    </td>
                    <td>{v(r, 'days')}</td>
                    <td>
                      <Badge status={v(r, 'status')} />
                    </td>
                    <td>
                      {String(v(r, 'status')).toLowerCase() === 'pending' && canApprove ? (
                        <div className="row-actions">
                          <button type="button" className="btn ok" onClick={() => setStatus(v(r, 'id'), 'approved')}>
                            Approve
                          </button>
                          <button type="button" className="btn danger" onClick={() => setStatus(v(r, 'id'), 'rejected')}>
                            Reject
                          </button>
                        </div>
                      ) : String(v(r, 'status')).toLowerCase() === 'pending' ? (
                        <span className="muted">Pending</span>
                      ) : (
                        '-'
                      )}
                    </td>
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
