'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api } from '../../lib/auth';
import { formatDate, v } from '../../lib/format';
import { useLocale } from '../../lib/i18n/LocaleContext';

export default function MssPage() {
  const { t } = useLocale();
  const [summary, setSummary] = useState(null);
  const [team, setTeam] = useState([]);
  const [leave, setLeave] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    setError('');
    Promise.all([
      api('/mss/summary'),
      api('/mss/team'),
      api('/mss/leave'),
      api('/mss/attendance'),
      api('/mss/approvals'),
    ])
      .then(([s, tRow, l, a, ap]) => {
        setSummary(s || null);
        setTeam(tRow || []);
        setLeave(l || []);
        setAttendance(a || []);
        setApprovals(ap || []);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setApprovalStatus(id, status) {
    setMsg('');
    setError('');
    try {
      await api(`/mss/approvals/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setMsg(`${status}`);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <AppShell title={t('mss_title')} subtitle={t('mss_subtitle')}>
      {error ? <div className="error">{error}</div> : null}
      {msg ? <div className="muted" style={{ marginBottom: 12, color: 'var(--ok)', fontWeight: 600 }}>{msg}</div> : null}

      <div className="grid ess-mss-stats" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
        {[
          [t('mss_team'), v(summary || {}, 'teamCount', 'team_count') || 0],
          [t('mss_pending_leave'), v(summary || {}, 'pendingLeave', 'pending_leave') || 0],
          [t('mss_pending_approvals'), v(summary || {}, 'pendingApprovals', 'pending_approvals') || 0],
          [t('mss_on_leave'), v(summary || {}, 'onLeaveToday', 'on_leave_today') || 0],
        ].map(([label, value]) => (
          <div className="card" key={label} style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="panel-title">
          <h3>{t('mss_my_team')}</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('mss_employee')}</th>
                <th>{t('mss_title_col')}</th>
                <th>{t('mss_department')}</th>
                <th>{t('mss_status')}</th>
              </tr>
            </thead>
            <tbody>
              {team.map((e) => (
                <tr key={v(e, 'id')}>
                  <td>
                    {v(e, 'fullName', 'full_name')}
                    <div className="muted">{v(e, 'empCode', 'emp_code')}</div>
                  </td>
                  <td>{v(e, 'jobTitle', 'job_title') || '—'}</td>
                  <td>{v(e, 'departmentName', 'department_name') || '—'}</td>
                  <td>
                    <Badge status={v(e, 'status')} />
                  </td>
                </tr>
              ))}
              {!team.length ? (
                <tr>
                  <td colSpan={4}>{t('mss_none')}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="panel-title">
          <h3>{t('mss_approvals')}</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('ess_title_col')}</th>
                <th>{t('mss_employee')}</th>
                <th>{t('ess_type')}</th>
                <th>{t('mss_status')}</th>
                <th>{t('common_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {approvals.map((a) => {
                const status = String(v(a, 'status') || '');
                return (
                  <tr key={v(a, 'id')}>
                    <td>{v(a, 'title')}</td>
                    <td>{v(a, 'fullName', 'full_name')}</td>
                    <td>{v(a, 'requestType', 'request_type')}</td>
                    <td>
                      <Badge status={status} />
                    </td>
                    <td>
                      {status === 'pending' ? (
                        <div className="row-actions">
                          <button type="button" className="btn ok" onClick={() => setApprovalStatus(v(a, 'id'), 'approved')}>
                            {t('mss_approve')}
                          </button>
                          <button type="button" className="btn danger" onClick={() => setApprovalStatus(v(a, 'id'), 'rejected')}>
                            {t('mss_reject')}
                          </button>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                );
              })}
              {!approvals.length ? (
                <tr>
                  <td colSpan={5}>{t('mss_none')}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="panel-title">
          <h3>{t('mss_leave_requests')}</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('mss_employee')}</th>
                <th>{t('ess_type')}</th>
                <th>{t('ess_date')}</th>
                <th>{t('ess_days')}</th>
                <th>{t('mss_status')}</th>
              </tr>
            </thead>
            <tbody>
              {leave.map((l) => (
                <tr key={v(l, 'id')}>
                  <td>{v(l, 'fullName', 'full_name')}</td>
                  <td>{v(l, 'leaveType', 'leave_type')}</td>
                  <td>
                    {formatDate(v(l, 'startDate', 'start_date'))} → {formatDate(v(l, 'endDate', 'end_date'))}
                  </td>
                  <td>{v(l, 'days')}</td>
                  <td>
                    <Badge status={v(l, 'status')} />
                  </td>
                </tr>
              ))}
              {!leave.length ? (
                <tr>
                  <td colSpan={5}>{t('mss_none')}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="panel-title">
          <h3>{t('mss_attendance')}</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('mss_employee')}</th>
                <th>{t('ess_date')}</th>
                <th>{t('mss_status')}</th>
                <th>Late</th>
              </tr>
            </thead>
            <tbody>
              {attendance.map((a) => (
                <tr key={v(a, 'id')}>
                  <td>{v(a, 'fullName', 'full_name')}</td>
                  <td>{formatDate(v(a, 'workDate', 'work_date'))}</td>
                  <td>
                    <Badge status={v(a, 'status')} />
                  </td>
                  <td>{v(a, 'lateMinutes', 'late_minutes') || 0}</td>
                </tr>
              ))}
              {!attendance.length ? (
                <tr>
                  <td colSpan={4}>{t('mss_none')}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
