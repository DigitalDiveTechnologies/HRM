'use client';

import { useEffect, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { api, value } from '@/lib/api';
import { useLocale } from '@/lib/LocaleContext';

const formatDate = (v) => (v ? new Date(v).toLocaleDateString() : '—');

export default function Attendance() {
  const { t, locale } = useLocale();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 10;

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
  const totalPages = Math.ceil(rows.length / pageSize);

  return (
    <PortalShell
      title={t('att_title')}
      subtitle={t('att_subtitle')}
    >
      {error ? <div className="error-box">{error}</div> : null}

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
            <span className="kpi-val">{totalLateMins}m</span>
            <span className="kpi-badge">{t('deduction_time')}</span>
          </div>
          <div className="kpi-ring">{totalLateMins}m</div>
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
                          {late > 0 ? `${late} min` : '0 min'}
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
