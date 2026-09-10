'use client';

import { useEffect, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { api, value } from '@/lib/api';

const formatDate = (v) => (v ? new Date(v).toLocaleDateString() : '—');

export default function Attendance() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/attendance')
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const total = rows.length;
  const presentCount = rows.filter((r) => String(value(r, 'status') || '').toLowerCase().includes('present')).length;
  const lateCount = rows.filter((r) => String(value(r, 'status') || '').toLowerCase().includes('late')).length;
  const totalLateMins = rows.reduce((acc, r) => acc + Number(value(r, 'lateMinutes', 'late_minutes') || 0), 0);

  return (
    <PortalShell
      title="Attendance"
      subtitle="Complete daily check-in logs, punctuality metrics and shift records"
    >
      {error ? <div className="error-box">{error}</div> : null}

      {/* KPI Top Cards */}
      <div className="dash-kpi-grid">
        <div className="kpi-card green">
          <div className="kpi-info">
            <span className="kpi-title">Total Logs</span>
            <span className="kpi-val">{total}</span>
            <span className="kpi-badge">Recorded Days</span>
          </div>
          <div className="kpi-ring">{total}</div>
        </div>

        <div className="kpi-card blue">
          <div className="kpi-info">
            <span className="kpi-title">On Time / Present</span>
            <span className="kpi-val">{presentCount}</span>
            <span className="kpi-badge">{total > 0 ? `${Math.round((presentCount / total) * 100)}% Rate` : '100%'}</span>
          </div>
          <div className="kpi-ring">{presentCount}</div>
        </div>

        <div className="kpi-card amber">
          <div className="kpi-info">
            <span className="kpi-title">Late Check-ins</span>
            <span className="kpi-val">{lateCount}</span>
            <span className="kpi-badge">Punctuality Gap</span>
          </div>
          <div className="kpi-ring">{lateCount}</div>
        </div>

        <div className="kpi-card red">
          <div className="kpi-info">
            <span className="kpi-title">Late Minutes</span>
            <span className="kpi-val">{totalLateMins}m</span>
            <span className="kpi-badge">Total Deduction Time</span>
          </div>
          <div className="kpi-ring">{totalLateMins}m</div>
        </div>
      </div>

      {/* Attendance History Panel */}
      <div className="panel-card">
        <div className="panel-head">
          <div className="panel-title">
            <h2>Attendance History</h2>
            <p>Chronological records of biometric and manual punches</p>
          </div>
        </div>

        <div className="table-wrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Shift / Schedule</th>
                <th>Status</th>
                <th>Late (Min)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '30px 0' }}>
                    Loading attendance logs…
                  </td>
                </tr>
              ) : rows.length ? (
                rows.map((r, i) => {
                  const s = String(value(r, 'status') || '').toLowerCase();
                  const late = Number(value(r, 'lateMinutes', 'late_minutes') || 0);
                  return (
                    <tr key={value(r, 'id') || i}>
                      <td style={{ fontWeight: 600 }}>{formatDate(value(r, 'workDate', 'work_date'))}</td>
                      <td>{value(r, 'checkIn', 'check_in') || '—'}</td>
                      <td>{value(r, 'checkOut', 'check_out') || '—'}</td>
                      <td>
                        <span className="code-pill">{value(r, 'shiftName', 'shift_name') || 'Regular 9-6'}</span>
                      </td>
                      <td>
                        <span className={`status-pill ${s.includes('present') ? 'present' : s.includes('late') ? 'late' : 'cyan'}`}>
                          {value(r, 'status') || 'recorded'}
                        </span>
                      </td>
                      <td style={{ fontWeight: late > 0 ? 700 : 400, color: late > 0 ? '#b42318' : 'var(--muted)' }}>
                        {late > 0 ? `${late} min` : '0 min'}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '30px 0' }}>
                    No attendance records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PortalShell>
  );
}
