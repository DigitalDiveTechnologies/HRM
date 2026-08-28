'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api, getUser, normalizeRole } from '../../lib/auth';
import { formatDate, formatLate, todayISO, v } from '../../lib/format';

export default function AttendancePage() {
  const [user, setUser] = useState(null);
  const role = normalizeRole(user);
  const isEmployee = role === 'employee';

  const [rows, setRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    employeeId: '',
    workDate: todayISO(),
    checkIn: '09:00',
    checkOut: '18:00',
    status: 'present',
    shiftName: 'General',
    overtimeHours: 0,
  });

  useEffect(() => {
    setUser(getUser());
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [att, emps] = await Promise.all([api('/attendance'), api('/employees')]);
      setRows(att);
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

  async function onSave(e) {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      await api('/attendance', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: Number(form.employeeId),
          workDate: form.workDate,
          checkIn: form.checkIn || null,
          checkOut: form.checkOut || null,
          status: form.status,
          shiftName: form.shiftName,
          overtimeHours: Number(form.overtimeHours) || 0,
        }),
      });
      setMsg('Attendance saved.');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function calcOtHint() {
    // Simple: hours past 9h shift
    const [ih, im] = String(form.checkIn || '09:00').split(':').map(Number);
    const [oh, om] = String(form.checkOut || '18:00').split(':').map(Number);
    const mins = oh * 60 + om - (ih * 60 + im);
    const ot = Math.max(0, mins / 60 - 9);
    setForm((f) => ({ ...f, overtimeHours: Math.round(ot * 100) / 100 }));
  }

  return (
    <AppShell title="Attendance & Time" subtitle="Shifts, late tracking, overtime and check-in">
      {error ? <div className="error">{error}</div> : null}
      <div className="grid-2" style={{ display: 'grid', gap: 14, gridTemplateColumns: '1fr 1fr' }}>
        <div className="card">
          <div className="panel-title">
            <h3>Quick punch</h3>
          </div>
          {msg ? <div className="ok-msg" style={{ color: 'var(--ok)', marginBottom: 10 }}>{msg}</div> : null}
          <form className="stack" onSubmit={onSave}>
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
              <label>Date</label>
              <input
                type="date"
                required
                value={form.workDate}
                onChange={(e) => setForm({ ...form, workDate: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Check in</label>
              <input
                type="time"
                value={form.checkIn}
                onChange={(e) => setForm({ ...form, checkIn: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Check out</label>
              <input
                type="time"
                value={form.checkOut}
                onChange={(e) => setForm({ ...form, checkOut: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Shift</label>
              <select value={form.shiftName} onChange={(e) => setForm({ ...form, shiftName: e.target.value })}>
                <option value="General">General (09–18)</option>
                <option value="Morning">Morning (07–16)</option>
                <option value="Evening">Evening (12–21)</option>
                <option value="Night">Night (21–06)</option>
              </select>
            </div>
            <div className="field">
              <label>Overtime hours</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={form.overtimeHours}
                  onChange={(e) => setForm({ ...form, overtimeHours: e.target.value })}
                />
                <button type="button" className="btn secondary" onClick={calcOtHint}>
                  Auto OT
                </button>
              </div>
            </div>
            <div className="field">
              <label>Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="present">present</option>
                <option value="late">late</option>
                <option value="leave">leave</option>
              </select>
            </div>
            <button className="btn" type="submit">
              Save attendance
            </button>
          </form>
        </div>
        <div className="card">
          <div className="panel-title">
            <h3>Recent records</h3>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Employee</th>
                  <th>Shift</th>
                  <th>In</th>
                  <th>Out</th>
                  <th>OT</th>
                  <th>Late</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={v(r, 'id')}>
                    <td>{formatDate(v(r, 'workDate', 'work_date'))}</td>
                    <td>{v(r, 'fullName', 'full_name')}</td>
                    <td>{v(r, 'shiftName', 'shift_name') || 'General'}</td>
                    <td>{String(v(r, 'checkIn', 'check_in') || '-').slice(0, 5)}</td>
                    <td>{String(v(r, 'checkOut', 'check_out') || '-').slice(0, 5)}</td>
                    <td>{v(r, 'overtimeHours', 'overtime_hours') || 0}</td>
                    <td>{formatLate(v(r, 'lateMinutes', 'late_minutes'))}</td>
                    <td>
                      <Badge status={v(r, 'status')} />
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
