'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api } from '../../lib/auth';
import { formatDate, formatLate, v } from '../../lib/format';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/dashboard')
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <AppShell title="Dashboard" subtitle="Workforce overview and key HR metrics">
      {error ? <div className="error">{error}</div> : null}
      {!data && !error ? <div className="muted">Loading…</div> : null}
      {data ? (
        <>
          <div className="grid" style={{ marginBottom: 14 }}>
            <Link className="card stat stat-link" href="/employees">
              <h3>Headcount</h3>
              <div className="value">{data.headcount}</div>
              <span className="stat-go">Open employees →</span>
            </Link>
            <Link className="card stat stat-link" href="/leave">
              <h3>Pending leave</h3>
              <div className="value">{data.pendingLeave}</div>
              <span className="stat-go">Open leave →</span>
            </Link>
            <Link className="card stat stat-link" href="/documents">
              <h3>Docs expiring (90d)</h3>
              <div className="value">{data.expiringDocs}</div>
              <span className="stat-go">Open documents →</span>
            </Link>
            <Link className="card stat stat-link" href="/notifications">
              <h3>Unread alerts</h3>
              <div className="value">{data.unreadNotifications}</div>
              <span className="stat-go">Open notifications →</span>
            </Link>
          </div>
          <div className="card">
            <div className="panel-title">
              <h3>Recent attendance</h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Employee</th>
                    <th>Status</th>
                    <th>Late (min)</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.recentAttendance || []).length ? (
                    data.recentAttendance.map((r, i) => (
                      <tr key={i}>
                        <td>{formatDate(v(r, 'workDate', 'work_date'))}</td>
                        <td>{v(r, 'fullName', 'full_name')}</td>
                        <td>
                          <Badge status={r.status} />
                        </td>
                        <td>{formatLate(v(r, 'lateMinutes', 'late_minutes'))}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4}>No data</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
