'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api, getUser, normalizeRole } from '../../lib/auth';
import { downloadDocumentFile, formatDate, money, v } from '../../lib/format';
import { useLocale } from '../../lib/i18n/LocaleContext';

export default function EssPage() {
  const { t } = useLocale();
  const [user, setUser] = useState(null);
  const role = normalizeRole(user);
  const [data, setData] = useState(null);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setUser(getUser());
  }, []);

  useEffect(() => {
    if (!user) return;
    const eid = user.employeeId || user.employee_id;
    if (!eid) {
      setError(t('ess_no_link'));
      return;
    }
    api(`/ess/${eid}`)
      .then((d) => {
        setData(d);
        setPhone(v(d.profile || {}, 'phone') || '');
      })
      .catch((e) => setError(e.message));
  }, [user, t]);

  async function savePhone(e) {
    e.preventDefault();
    const eid = user?.employeeId || user?.employee_id;
    setMsg('');
    try {
      await api(`/ess/${eid}/profile`, {
        method: 'PATCH',
        body: JSON.stringify({ phone }),
      });
      setMsg(t('ess_updated'));
    } catch (err) {
      setError(err.message);
    }
  }

  const p = data?.profile || {};

  return (
    <AppShell title={t('ess_title')} subtitle={t('ess_subtitle')}>
      {error ? <div className="error">{error}</div> : null}
      {!data && !error ? <div className="muted">{t('loading')}</div> : null}
      {data ? (
        <div className="stack">
          <div className="grid-2 ess-mss-grid" style={{ display: 'grid', gap: 14, gridTemplateColumns: '1fr 1fr' }}>
            <div className="card">
              <div className="panel-title">
                <h3>{t('ess_profile')}</h3>
              </div>
              <p>
                <strong>{v(p, 'fullName', 'full_name') || '-'}</strong>
                <br />
                <span className="muted">
                  {v(p, 'jobTitle', 'job_title') || ''} · {v(p, 'departmentName', 'department_name') || ''}
                </span>
              </p>
              <p className="muted">{v(p, 'email')}</p>
              {msg ? <div style={{ color: 'var(--ok)', marginBottom: 8 }}>{msg}</div> : null}
              <form className="stack" onSubmit={savePhone}>
                <div className="field">
                  <label>{t('ess_phone')}</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <button className="btn" type="submit">
                  {t('ess_update')}
                </button>
              </form>
            </div>
            <div className="card">
              <div className="panel-title">
                <h3>{t('ess_quick_leave')}</h3>
              </div>
              <div className="row-actions">
                <Link className="btn secondary" href="/leave">
                  {t('ess_quick_leave')}
                </Link>
                <Link className="btn secondary" href="/attendance">
                  {t('ess_quick_attendance')}
                </Link>
                <Link className="btn secondary" href="/notifications">
                  {t('ess_quick_notifications')}
                </Link>
                <Link className="btn secondary" href="/performance">
                  Performance
                </Link>
                <Link className="btn secondary" href="/training">
                  Training
                </Link>
                {role === 'admin' ? (
                  <Link className="btn secondary" href="/employees">
                    Directory
                  </Link>
                ) : null}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="panel-title">
              <h3>{t('ess_payslips')}</h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('ess_period')}</th>
                    <th>{t('ess_net')}</th>
                    <th>WPS</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.payslips || []).map((x) => (
                    <tr key={v(x, 'id')}>
                      <td>{v(x, 'periodLabel', 'period_label')}</td>
                      <td>{money(v(x, 'netPay', 'net_pay'))}</td>
                      <td>{v(x, 'wpsRef', 'wps_ref') || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="panel-title">
              <h3>{t('ess_leave')}</h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('ess_type')}</th>
                    <th>{t('ess_date')}</th>
                    <th>{t('ess_days')}</th>
                    <th>{t('ess_status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.leave || []).map((x) => (
                    <tr key={v(x, 'id')}>
                      <td>{v(x, 'leaveType', 'leave_type')}</td>
                      <td>
                        {formatDate(v(x, 'startDate', 'start_date'))} → {formatDate(v(x, 'endDate', 'end_date'))}
                      </td>
                      <td>{v(x, 'days')}</td>
                      <td>
                        <Badge status={v(x, 'status')} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="panel-title">
              <h3>{t('ess_attendance')}</h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('ess_date')}</th>
                    <th>In</th>
                    <th>Out</th>
                    <th>{t('ess_status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.attendance || []).map((x) => (
                    <tr key={v(x, 'id')}>
                      <td>{formatDate(v(x, 'workDate', 'work_date'))}</td>
                      <td>{String(v(x, 'checkIn', 'check_in') || '-').slice(0, 5)}</td>
                      <td>{String(v(x, 'checkOut', 'check_out') || '-').slice(0, 5)}</td>
                      <td>
                        <Badge status={v(x, 'status')} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="panel-title">
              <h3>{t('ess_documents')}</h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('ess_type')}</th>
                    <th>{t('ess_title_col')}</th>
                    <th>{t('ess_expiry')}</th>
                    <th>File</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.documents || []).map((d) => (
                    <tr key={v(d, 'id')}>
                      <td>{v(d, 'docType', 'doc_type')}</td>
                      <td>{v(d, 'title')}</td>
                      <td>{formatDate(v(d, 'expiryDate', 'expiry_date'))}</td>
                      <td>
                        <button type="button" className="btn secondary" onClick={() => downloadDocumentFile(d)}>
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
