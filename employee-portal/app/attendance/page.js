'use client';

import { useEffect, useState, useCallback } from 'react';
import PortalShell from '@/components/PortalShell';
import { api, session, value } from '@/lib/api';
import { useLocale } from '@/lib/LocaleContext';

const formatDate = (v) => (v ? new Date(v).toLocaleDateString() : '—');
const formatDurationMinutes = (minutes) => {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  if (total === 0) return '0m';
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (!hours) return `${mins}m`;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
};
const localDateIso = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function Attendance() {
  const { t, locale } = useLocale();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [employeeId, setEmployeeId] = useState(null);
  const pageSize = 10;

  // Live Clock (1 second interval)
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadAttendance = useCallback(async () => {
    try {
      const data = await api('/attendance');
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const s = session.get();
    const eid = s?.user?.employeeId;
    if (eid) {
      setEmployeeId(eid);
    } else {
      api('/auth/me')
        .then((me) => {
          if (me?.employeeId) setEmployeeId(me.employeeId);
        })
        .catch(() => {});
    }
    loadAttendance();
  }, [loadAttendance]);

  // Today's Date String YYYY-MM-DD
  const todayStr = localDateIso(currentTime);
  const isSameDay = (d1, d2) => d1 && d2 && String(d1).slice(0, 10) === String(d2).slice(0, 10);
  const todayRow = rows.find((r) => isSameDay(value(r, 'workDate', 'work_date'), todayStr));

  const hasCheckedIn = Boolean(todayRow && value(todayRow, 'checkIn', 'check_in'));
  const hasCheckedOut = Boolean(todayRow && value(todayRow, 'checkOut', 'check_out'));
  const todayCheckIn = todayRow ? value(todayRow, 'checkIn', 'check_in') : null;
  const todayCheckOut = todayRow ? value(todayRow, 'checkOut', 'check_out') : null;


  const total = rows.length;
  const presentCount = rows.filter((r) => String(value(r, 'status') || '').toLowerCase().includes('present')).length;
  const lateCount = rows.filter((r) => String(value(r, 'status') || '').toLowerCase().includes('late')).length;
  const totalLateMins = rows.reduce((acc, r) => acc + Number(value(r, 'lateMinutes', 'late_minutes') || 0), 0);
  const totalPages = Math.ceil(rows.length / pageSize);

  const formattedTime = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formattedDate = currentTime.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <PortalShell
      title={t('att_title')}
      subtitle={t('att_subtitle')}
    >
      {error ? <div className="error-box" style={{ marginBottom: 16 }}>{error}</div> : null}
      {successMsg ? (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid #10b981',
            color: '#065f46',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 16,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{successMsg}</span>
        </div>
      ) : null}

      {/* CHECK-IN / CHECK-OUT ACTION CARD */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(0, 184, 219, 0.08) 0%, rgba(16, 185, 129, 0.06) 100%)',
          border: '1px solid rgba(0, 184, 219, 0.25)',
          borderRadius: 14,
          padding: '24px',
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: '#00b8db',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(0, 184, 219, 0.35)',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <polyline points="12 7 12 12 15 15" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--ink)', letterSpacing: '0.5px' }}>
              {formattedTime}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: 2 }}>
              {formattedDate}
            </div>
            <div style={{ marginTop: 6, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {hasCheckedIn ? (
                <span className="status-pill present" style={{ fontSize: '12px' }}>
                  ✓ {locale === 'ar' ? 'سجل الحضور في' : 'In:'} {todayCheckIn}
                </span>
              ) : (
                <span className="status-pill" style={{ background: '#fef3c7', color: '#92400e', fontSize: '12px' }}>
                  ● {locale === 'ar' ? 'لم يتم تسجيل الحضور اليوم' : 'Not Checked In Today'}
                </span>
              )}

              {hasCheckedOut ? (
                <span className="status-pill late" style={{ fontSize: '12px' }}>
                  ✓ {locale === 'ar' ? 'سجل الانصراف في' : 'Out:'} {todayCheckOut}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Mobile App Only Notice */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 18px',
            borderRadius: 10,
            background: 'rgba(0, 184, 219, 0.08)',
            border: '1px solid rgba(0, 184, 219, 0.25)',
            color: '#0284c7',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="3" />
          </svg>
          <span>
            {locale === 'ar'
              ? 'تسجيل الحضور والانصراف متاح فقط عبر تطبيق الهاتف مع التحقق البيومتري.'
              : 'Attendance check-in & check-out are restricted to the mobile app with biometric verification.'}
          </span>
        </div>
      </div>

      {/* KPI Top Cards */}
      <div className="dash-kpi-grid">
        <div className="kpi-card green">
          <div className="kpi-info">
            <span className="kpi-title">{t('total_logs')}</span>
            <span className="kpi-val">{total}</span>
            <span className="kpi-badge">{t('recorded_days')}</span>
          </div>
          <div className="kpi-ring">{total}</div>
        </div>

        <div className="kpi-card blue">
          <div className="kpi-info">
            <span className="kpi-title">{t('on_time_present')}</span>
            <span className="kpi-val">{presentCount}</span>
            <span className="kpi-badge">{total > 0 ? `${Math.round((presentCount / total) * 100)}% Rate` : '100%'}</span>
          </div>
          <div className="kpi-ring">{presentCount}</div>
        </div>

        <div className="kpi-card amber">
          <div className="kpi-info">
            <span className="kpi-title">{t('late_checkins')}</span>
            <span className="kpi-val">{lateCount}</span>
            <span className="kpi-badge">{t('punctuality_gap')}</span>
          </div>
          <div className="kpi-ring">{lateCount}</div>
        </div>

        <div className="kpi-card red">
          <div className="kpi-info">
            <span className="kpi-title">{t('late_minutes')}</span>
            <span className="kpi-val">{formatDurationMinutes(totalLateMins)}</span>
            <span className="kpi-badge">{t('deduction_time')}</span>
          </div>
          <div className="kpi-ring">{formatDurationMinutes(totalLateMins)}</div>
        </div>
      </div>

      {/* Attendance History Panel */}
      <div className="panel-card">
        <div className="panel-head">
          <div className="panel-title">
            <h2>{t('att_history')}</h2>
            <p>{t('att_history_sub')}</p>
          </div>
        </div>

        <div className="table-wrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th>{t('date')}</th>
                <th>{t('check_in')}</th>
                <th>{t('check_out')}</th>
                <th>{t('shift_schedule')}</th>
                <th>{t('status')}</th>
                <th>{t('late_min')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '30px 0' }}>
                    {t('loading_att')}
                  </td>
                </tr>
              ) : rows.length ? (
                rows
                  .slice((page - 1) * pageSize, page * pageSize)
                  .map((r, i) => {
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
                          {formatDurationMinutes(late)}
                        </td>
                      </tr>
                    );
                  })
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '30px 0' }}>
                    {t('no_att_logs')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {rows.length > pageSize ? (
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
              {t('showing')} {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, rows.length)} {t('of')} {rows.length} {t('records')}
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
              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((num) => (
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
                disabled={page >= totalPages}
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
