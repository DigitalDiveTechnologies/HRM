'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PortalShell from '@/components/PortalShell';
import { api, session, value } from '@/lib/api';
import { useLocale } from '@/lib/LocaleContext';

const formatDate = (v) => (v ? new Date(v).toLocaleDateString() : '—');

const RING_C = 2 * Math.PI * 15.5; // r=15.5 in 36 viewBox

function KpiRing({ percent = 0, label }) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  const len = (p / 100) * RING_C;
  return (
    <div className="kpi-ring" aria-hidden="true">
      <svg viewBox="0 0 36 36">
        <circle className="kpi-ring-track" cx="18" cy="18" r="15.5" />
        <circle
          className="kpi-ring-value"
          cx="18"
          cy="18"
          r="15.5"
          style={{
            '--ring-len': String(len),
            '--ring-total': String(RING_C),
          }}
        />
      </svg>
      <span className="kpi-ring-label">{label}</span>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" aria-hidden="true">
        <svg viewBox="0 0 64 64" fill="none">
          <circle cx="32" cy="32" r="30" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2" />
          <circle cx="32" cy="32" r="22" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
          <rect x="22" y="20" width="20" height="24" rx="3" stroke="currentColor" strokeWidth="1.75" />
          <path d="M26 28h12M26 33h12M26 38h7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      </div>
      <p className="empty-state-text">{message}</p>
    </div>
  );
}

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
  const onboardingPct = onboarding.length
    ? Math.round(((onboarding.length - pendingOnboarding) / onboarding.length) * 100)
    : 100;

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
          <div className="dash-kpi-grid">
            <Link href="/attendance" style={{ textDecoration: 'none', display: 'block' }}>
              <div className="kpi-card tone-cyan clickable-card">
                <div className="kpi-info">
                  <span className="kpi-title">{t('kpi_today_attendance')}</span>
                  <span className={`kpi-val ${isNaN(Number(todayStatus)) ? 'kpi-val-text' : ''}`}>
                    {todayStatus === 'Not marked' ? t('not_marked') : todayStatus}
                  </span>
                  <span className="kpi-badge">{todayAtt ? t('kpi_active_today') : t('kpi_shift_open')}</span>
                </div>
                <KpiRing percent={todayAtt ? 100 : 0} label={todayAtt ? '100%' : '0%'} />
              </div>
            </Link>

            <Link href="/leaves" style={{ textDecoration: 'none', display: 'block' }}>
              <div className="kpi-card tone-amber clickable-card">
                <div className="kpi-info">
                  <span className="kpi-title">{t('kpi_leave_balance')}</span>
                  <span className="kpi-val">{remaining}</span>
                  <span className="kpi-badge">{t('kpi_days_remaining')}</span>
                </div>
                <KpiRing percent={Math.min(100, remaining)} label={`${remaining}d`} />
              </div>
            </Link>

            <Link href="/onboarding" style={{ textDecoration: 'none', display: 'block' }}>
              <div className="kpi-card tone-emerald clickable-card">
                <div className="kpi-info">
                  <span className="kpi-title">{t('kpi_onboarding_tasks')}</span>
                  <span className="kpi-val">{pendingOnboarding}</span>
                  <span className="kpi-badge">
                    {pendingOnboarding > 0 ? t('kpi_action_required') : t('kpi_all_completed')}
                  </span>
                </div>
                <KpiRing percent={onboardingPct} label={`${onboardingPct}%`} />
              </div>
            </Link>

            <Link href="/notifications" style={{ textDecoration: 'none', display: 'block' }}>
              <div className="kpi-card tone-rose clickable-card">
                <div className="kpi-info">
                  <span className="kpi-title">{t('kpi_notifications')}</span>
                  <span className="kpi-val">{unreadNotifs}</span>
                  <span className="kpi-badge">{t('kpi_unread_alerts')}</span>
                </div>
                <KpiRing percent={unreadNotifs > 0 ? Math.min(100, unreadNotifs * 20) : 0} label={String(unreadNotifs)} />
              </div>
            </Link>
          </div>

          <div className="dash-grid-2">
            <div className="dash-enter-item">
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
                {attendance.length ? (
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
                        {attendance.slice(0, 6).map((r, i) => {
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
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState message={t('no_att_logs')} />
                )}
              </div>
            </div>

            <div className="dash-enter-item">
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
                {balances.length ? (
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
                        {balances.map((b, i) => {
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
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    message={
                      locale === 'ar'
                        ? 'لا توجد بيانات متاحة لرصيد الإجازات.'
                        : 'No leave balance information available.'
                    }
                  />
                )}
              </div>
            </div>
          </div>

          <div className="dash-grid-2">
            <div className="dash-enter-item">
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
                {leaves.length ? (
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
                        {leaves.slice(0, 6).map((l, i) => {
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
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    message={
                      locale === 'ar' ? 'لا توجد طلبات إجازة حديثة.' : 'No recent leave requests.'
                    }
                  />
                )}
              </div>
            </div>

            <div className="dash-enter-item">
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
                {onboarding.length ? (
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
                        {onboarding.slice(0, 6).map((o, i) => {
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
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState message={t('no_onboarding_tasks')} />
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </PortalShell>
  );
}
