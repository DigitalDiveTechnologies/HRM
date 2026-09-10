'use client';

import { useCallback, useEffect, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { api, value } from '@/lib/api';
import { useLocale } from '@/lib/LocaleContext';

const formatDate = (v) => (v ? new Date(v).toLocaleDateString() : '—');

export default function Notifications() {
  const { t, locale } = useLocale();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api('/notifications')
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markRead(id) {
    try {
      await api(`/notifications/${id}/read`, { method: 'PATCH', body: '{}' });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function markAllRead() {
    setMsg('');
    setError('');
    setMarkingAll(true);
    try {
      await api('/notifications/read-all', { method: 'PATCH', body: '{}' });
      setMsg(locale === 'ar' ? 'تم تحديد جميع الإشعارات كمقروءة.' : 'All notifications marked as read.');
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <PortalShell
      title={t('notif_title')}
      subtitle={t('notif_subtitle')}
      actions={
        <button
          type="button"
          className="btn-primary"
          onClick={markAllRead}
          disabled={markingAll || !rows.some((r) => !value(r, 'isRead', 'is_read'))}
          style={{ padding: '7px 14px', fontSize: '12px' }}
        >
          {markingAll ? (locale === 'ar' ? 'جاري التحديث…' : 'Updating…') : t('mark_all_read')}
        </button>
      }
    >
      {error ? <div className="error-box">{error}</div> : null}
      {msg ? <div className="success-box">{msg}</div> : null}

      <div className="panel-card">
        <div className="panel-head">
          <div className="panel-title">
            <h2>{t('notif_title')}</h2>
            <p>{t('notif_subtitle')}</p>
          </div>
        </div>

        <div className="table-wrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th>{t('category')}</th>
                <th>{t('item_title')}</th>
                <th>{t('due_date')}</th>
                <th>{t('status')}</th>
                <th>{t('action')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: '30px 0' }}>
                    {locale === 'ar' ? 'جاري تحميل الإشعارات…' : 'Loading notifications…'}
                  </td>
                </tr>
              ) : rows.length ? (
                rows.map((n) => {
                  const read = value(n, 'isRead', 'is_read') === true;
                  return (
                    <tr key={value(n, 'id')}>
                      <td>
                        <span className="code-pill">{value(n, 'category') || 'Alert'}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{value(n, 'title')}</div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: 2 }}>
                          {value(n, 'message')}
                        </div>
                      </td>
                      <td>{formatDate(value(n, 'dueDate', 'due_date'))}</td>
                      <td>
                        <span className={`status-pill ${read ? 'approved' : 'pending'}`}>
                          {read ? t('read') : t('unread')}
                        </span>
                      </td>
                      <td>
                        {!read ? (
                          <button
                            type="button"
                            onClick={() => markRead(value(n, 'id'))}
                            className="btn-primary"
                            style={{ padding: '4px 10px', fontSize: '11.5px', background: 'transparent', color: 'var(--brand)', border: '1px solid var(--brand)' }}
                          >
                            {t('mark_read')}
                          </button>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: '30px 0' }}>
                    {t('no_notifications')}
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
