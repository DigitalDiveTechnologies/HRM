'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PortalShell from '@/components/PortalShell';
import { api, session, value } from '@/lib/api';
import { useLocale } from '@/lib/LocaleContext';

const formatDate = (v) => (v ? new Date(v).toLocaleDateString() : '—');

export default function Dashboard() {
  const { t, locale } = useLocale();
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
      title={t('dash_title')}
      subtitle={t('dash_subtitle')}
    >
      {error ? <div className="error-box">{error}</div> : null}

      {!data ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--muted)' }}>
          {t('loading_stats')}
        </div>
      ) : (
        <>
          {/* 4 Primary KPI Stat Cards (Clickable & Linked to Pages) */}
          <div className="dash-kpi-grid">
            {/* Green Card: Attendance -> /attendance */}
            <Link href="/attendance" style={{ textDecoration: 'none', display: 'block' }}>
              <div className="kpi-card green clickable-card">
                <div className="kpi-info">
                  <span className="kpi-title">{t('kpi_today_attendance')}</span>
                  <span className={`kpi-val ${isNaN(Number(todayStatus)) ? 'kpi-val-text' : ''}`}>
                    {todayStatus === 'Not marked' ? t('not_marked') : todayStatus}
                  </span>
                  <span className="kpi-badge">{todayAtt ? t('kpi_active_today') : t('kpi_shift_open')}</span>
                </div>
                <div className="kpi-ring">100%</div>
              </div>
            </Link>

            {/* Amber Card: Leave Balance -> /leaves */}
            <Link href="/leaves" style={{ textDecoration: 'none', display: 'block' }}>
              <div className="kpi-card amber clickable-card">
                <div className="kpi-info">
                  <span className="kpi-title">{t('kpi_leave_balance')}</span>
                  <span className="kpi-val">{remaining}</span>
                  <span className="kpi-badge">{t('kpi_days_remaining')}</span>
                </div>
                <div className="kpi-ring">{remaining}d</div>
              </div>
            </Link>

            {/* Red Card: Onboarding Tasks -> /onboarding */}
            <Link href="/onboarding" style={{ textDecoration: 'none', display: 'block' }}>
              <div className="kpi-card red clickable-card">
                <div className="kpi-info">
                  <span className="kpi-title">{t('kpi_onboarding_tasks')}</span>
                  <span className="kpi-val">{pendingOnboarding}</span>
                  <span className="kpi-badge">
                    {pendingOnboarding > 0 ? t('kpi_action_required') : t('kpi_all_completed')}
                  </span>
                </div>
                <div className="kpi-ring">
                  {onboarding.length
                    ? `${Math.round(((onboarding.length - pendingOnboarding) / onboarding.length) * 100)}%`
                    : '100%'}
                </div>
              </div>
            </Link>

            {/* Blue Card: Notifications -> /notifications */}
            <Link href="/notifications" style={{ textDecoration: 'none', display: 'block' }}>
              <div className="kpi-card blue clickable-card">
                <div className="kpi-info">
                  <span className="kpi-title">{t('kpi_notifications')}</span>
                  <span className="kpi-val">{unreadNotifs}</span>
                  <span className="kpi-badge">{t('kpi_unread_alerts')}</span>
                </div>
                <div className="kpi-ring">{unreadNotifs}</div>
              </div>
            </Link>
          </div>

          {/* Row 1 Panels: Attendance & Leave Summary */}
          <div className="dash-grid-2">
            {/* Recent Attendance */}
            <div className="panel-card">
              <div className="panel-head">
                <div className="panel-title">
                  <h2>{t('recent_attendance')}</h2>
                  <p>{t('recent_attendance_sub')}</p>
                </div>
                <Link href="/attendance">
                  <button type="button" className="panel-btn">
                    {t('all_attendance')}
                  </button>
                </Link>
              </div>
              <div className="table-wrap">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>{t('date')}</th>
                      <th>{t('check_in')}</th>
                      <th>{t('check_out')}</th>
                      <th>{t('status')}</th>
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
                          {t('no_att_logs')}
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
                  <h2>{t('leave_balances')}</h2>
                  <p>{t('leave_balances_sub')}</p>
                </div>
                <Link href="/leaves">
                  <button type="button" className="panel-btn">
                    {t('apply_leave')}
                  </button>
                </Link>
              </div>
              <div className="table-wrap">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>{t('leave_type')}</th>
                      <th>{t('used')}</th>
                      <th>{t('remaining')}</th>
                      <th>{t('status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balances.length ? (
                      balances.map((b, i) => {
                        const rem = Number(value(b, 'remainingDays', 'remaining_days') || 0);
                        return (
                          <tr key={i}>
                            <td style={{ fontWeight: 600 }}>{value(b, 'leaveType', 'leave_type')}</td>
                            <td>{value(b, 'usedDays', 'used_days') || 0} {t('days')}</td>
                            <td style={{ fontWeight: 700, color: rem > 0 ? 'var(--brand)' : 'var(--muted)' }}>
                              {rem} {t('days')}
                            </td>
                            <td>
                              <span className={`status-pill ${rem > 0 ? 'active' : 'pending'}`}>
                                {rem > 0 ? t('available') : t('exhausted')}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 0' }}>
                          {locale === 'ar' ? 'لا توجد بيانات متاحة لرصيد الإجازات.' : 'No leave balance information available.'}
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
                  <h2>{t('recent_leaves')}</h2>
                  <p>{t('recent_leaves_sub')}</p>
                </div>
                <Link href="/leaves">
                  <button type="button" className="panel-btn">
                    {t('all_leaves')}
                  </button>
                </Link>
              </div>
              <div className="table-wrap">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>{t('leave_type')}</th>
                      <th>{t('date')}</th>
                      <th>{t('total_days')}</th>
                      <th>{t('status')}</th>
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
                          {locale === 'ar' ? 'لا توجد طلبات إجازة حديثة.' : 'No recent leave requests.'}
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
                  <h2>{t('onboarding_handover')}</h2>
                  <p>{t('onboarding_handover_sub')}</p>
                </div>
                <Link href="/onboarding">
                  <button type="button" className="panel-btn">
                    {t('view_items')}
                  </button>
                </Link>
              </div>
              <div className="table-wrap">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>{t('item_title')}</th>
                      <th>{t('due_date')}</th>
                      <th>{t('status')}</th>
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
                          {t('no_onboarding_tasks')}
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
