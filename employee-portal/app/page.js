'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PortalShell from '@/components/PortalShell';
import { api, session, value } from '@/lib/api';

const formatDate = (v) => (v ? new Date(v).toLocaleDateString() : '—');

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const id = session.get()?.user?.employeeId;
    if (!id) return;
    Promise.all([
      api('/ess/' + id).catch(() => null),
      api('/leave/balances').catch(() => []),
      api('/notifications').catch(() => []),
      api('/onboarding/my').catch(() => []),
    ])
      .then(([ess, balances, notifications, onboarding]) =>
        setData({
          ess,
          balances: Array.isArray(balances) ? balances : [],
          notifications: Array.isArray(notifications) ? notifications : [],
          onboarding: Array.isArray(onboarding) ? onboarding : [],
        })
      )
      .catch((e) => setError(e.message));
  }, []);

  const attendance = data?.ess?.attendance || [];
  const leaves = data?.ess?.leave || [];
  const balances = data?.balances || [];
  const onboarding = data?.onboarding || [];
  const notifications = data?.notifications || [];

  const remaining = balances.reduce(
    (sum, row) => sum + Number(value(row, 'remainingDays', 'remaining_days') || 0),
    0
  );
  const pendingOnboarding = onboarding.filter((x) => value(x, 'status') !== 'done').length;
  const unreadNotifs = notifications.filter((x) => !value(x, 'isRead', 'is_read')).length;
  const todayAtt = attendance[0];
  const todayStatus = todayAtt ? value(todayAtt, 'status') || 'Recorded' : 'Not marked';

  return (
    <PortalShell
      title="Dashboard"
      subtitle="Workforce overview, live statistics and operational metrics"
    >
      {error ? <div className="error-box">{error}</div> : null}

      {!data ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--muted)' }}>
          Loading your workforce statistics…
        </div>
      ) : (
        <>
          {/* 4 Primary KPI Stat Cards (Exact Admin Portal Design) */}
          <div className="dash-kpi-grid">
            {/* Green Card: Attendance */}
            <div className="kpi-card green">
              <div className="kpi-info">
                <span className="kpi-title">Today's Attendance</span>
                <span className="kpi-val">{todayStatus}</span>
                <span className="kpi-badge">{todayAtt ? 'Active Today' : 'Shift Open'}</span>
              </div>
              <div className="kpi-ring">100%</div>
            </div>

            {/* Amber Card: Leave Balance */}
            <div className="kpi-card amber">
              <div className="kpi-info">
                <span className="kpi-title">Leave Balance</span>
                <span className="kpi-val">{remaining}</span>
                <span className="kpi-badge">Days Remaining</span>
              </div>
              <div className="kpi-ring">{remaining}d</div>
            </div>

            {/* Red Card: Onboarding */}
            <div className="kpi-card red">
              <div className="kpi-info">
                <span className="kpi-title">Onboarding Tasks</span>
                <span className="kpi-val">{pendingOnboarding}</span>
                <span className="kpi-badge">{pendingOnboarding > 0 ? 'Action Required' : 'All Completed'}</span>
              </div>
              <div className="kpi-ring">{onboarding.length ? `${Math.round(((onboarding.length - pendingOnboarding) / onboarding.length) * 100)}%` : '100%'}</div>
            </div>

            {/* Blue Card: Notifications */}
            <div className="kpi-card blue">
              <div className="kpi-info">
                <span className="kpi-title">Notifications</span>
                <span className="kpi-val">{unreadNotifs}</span>
                <span className="kpi-badge">Unread Alerts</span>
              </div>
              <div className="kpi-ring">{unreadNotifs}</div>
            </div>
          </div>

          {/* Row 1 Panels: Attendance & Leave Summary */}
          <div className="dash-grid-2">
            {/* Recent Attendance */}
            <div className="panel-card">
              <div className="panel-head">
                <div className="panel-title">
                  <h2>Recent Attendance</h2>
                  <p>Latest check-in logs & punctuality</p>
                </div>
                <Link href="/attendance">
                  <button type="button" className="panel-btn">
                    All Attendance
                  </button>
                </Link>
              </div>
              <div className="table-wrap">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Check In</th>
                      <th>Check Out</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.length ? (
                      attendance.slice(0, 6).map((r, i) => {
                        const s = (value(r, 'status') || 'recorded').toLowerCase();
                        return (
                          <tr key={i}>
                            <td style={{ fontWeight: 600 }}>
                              {formatDate(value(r, 'workDate', 'work_date'))}
                            </td>
                            <td>{value(r, 'checkIn', 'check_in') || '—'}</td>
                            <td>{value(r, 'checkOut', 'check_out') || '—'}</td>
                            <td>
                              <span className={`status-pill ${s.includes('present') ? 'present' : s.includes('late') ? 'late' : 'cyan'}`}>
                                {value(r, 'status') || 'recorded'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 0' }}>
                          No recent attendance records.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Leave Summary by Type */}
            <div className="panel-card">
              <div className="panel-head">
                <div className="panel-title">
                  <h2>Leave Balances</h2>
                  <p>Current entitlement & balance breakdown</p>
                </div>
                <Link href="/leaves">
                  <button type="button" className="panel-btn">
                    Apply Leave
                  </button>
                </Link>
              </div>
              <div className="table-wrap">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>Leave Type</th>
                      <th>Used</th>
                      <th>Remaining</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balances.length ? (
                      balances.map((b, i) => {
                        const rem = Number(value(b, 'remainingDays', 'remaining_days') || 0);
                        return (
                          <tr key={i}>
                            <td style={{ fontWeight: 600 }}>{value(b, 'leaveType', 'leave_type')}</td>
                            <td>{value(b, 'usedDays', 'used_days') || 0} days</td>
                            <td style={{ fontWeight: 700, color: rem > 0 ? 'var(--brand)' : 'var(--muted)' }}>
                              {rem} days
                            </td>
                            <td>
                              <span className={`status-pill ${rem > 0 ? 'active' : 'pending'}`}>
                                {rem > 0 ? 'available' : 'exhausted'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 0' }}>
                          No leave balance information available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Row 2 Panels: Recent Leave Requests & Assigned Onboarding */}
          <div className="dash-grid-2">
            {/* Recent Leaves */}
            <div className="panel-card">
              <div className="panel-head">
                <div className="panel-title">
                  <h2>Recent Leave Activity</h2>
                  <p>Applied leave requests & workflow status</p>
                </div>
                <Link href="/leaves">
                  <button type="button" className="panel-btn">
                    All Leaves
                  </button>
                </Link>
              </div>
              <div className="table-wrap">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Dates</th>
                      <th>Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaves.length ? (
                      leaves.slice(0, 6).map((l, i) => {
                        const st = (value(l, 'workflowStage', 'workflow_stage', 'status') || 'pending').toLowerCase();
                        return (
                          <tr key={i}>
                            <td style={{ fontWeight: 600 }}>{value(l, 'leaveType', 'leave_type')}</td>
                            <td>
                              {formatDate(value(l, 'startDate', 'start_date'))} – {formatDate(value(l, 'endDate', 'end_date'))}
                            </td>
                            <td>{value(l, 'days') || 1}d</td>
                            <td>
                              <span className={`status-pill ${st.includes('approved') ? 'approved' : st.includes('reject') ? 'rejected' : 'pending'}`}>
                                {value(l, 'workflowStage', 'workflow_stage', 'status')}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 0' }}>
                          No recent leave requests.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Assigned Onboarding */}
            <div className="panel-card">
              <div className="panel-head">
                <div className="panel-title">
                  <h2>Onboarding & Handover</h2>
                  <p>Assigned equipment, accounts & tasks</p>
                </div>
                <Link href="/onboarding">
                  <button type="button" className="panel-btn">
                    View Items
                  </button>
                </Link>
              </div>
              <div className="table-wrap">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>Item / Title</th>
                      <th>Due Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {onboarding.length ? (
                      onboarding.slice(0, 6).map((o, i) => {
                        const st = (value(o, 'status') || 'pending').toLowerCase();
                        return (
                          <tr key={i}>
                            <td style={{ fontWeight: 600 }}>{value(o, 'title')}</td>
                            <td>{formatDate(value(o, 'dueDate', 'due_date'))}</td>
                            <td>
                              <span className={`status-pill ${st === 'done' ? 'approved' : 'pending'}`}>
                                {value(o, 'status') || 'pending'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 0' }}>
                          No onboarding tasks assigned.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </PortalShell>
  );
}
