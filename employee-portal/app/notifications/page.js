'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import PortalShell from '@/components/PortalShell';
import { api, value } from '@/lib/api';
import { useLocale } from '@/lib/LocaleContext';

const formatDate = (v) => (v ? new Date(v).toLocaleDateString() : '—');

function getRenewalUrgency(dueDate, isArabic) {
  if (!dueDate) return null;
  const target = new Date(dueDate);
  if (isNaN(target.getTime())) return null;
  const now = new Date();
  const diffDays = Math.ceil((target.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      label: isArabic ? `منتهي (${Math.abs(diffDays)} يوم)` : `Expired (${Math.abs(diffDays)}d ago)`,
      bg: 'rgba(239, 68, 68, 0.12)',
      color: '#dc2626',
      border: 'rgba(239, 68, 68, 0.3)',
      icon: '⚠️',
    };
  }
  if (diffDays <= 15) {
    return {
      label: isArabic ? `عاجل: ${diffDays} يوم متبقي` : `Urgent: ${diffDays}d left`,
      bg: 'rgba(249, 115, 22, 0.12)',
      color: '#ea580c',
      border: 'rgba(249, 115, 22, 0.3)',
      icon: '🔥',
    };
  }
  if (diffDays <= 30) {
    return {
      label: isArabic ? `مهلة 30 يوم: ${diffDays} يوم متبقي` : `30-Day Window: ${diffDays}d left`,
      bg: 'rgba(234, 179, 8, 0.12)',
      color: '#ca8a04',
      border: 'rgba(234, 179, 8, 0.3)',
      icon: '⏳',
    };
  }
  return {
    label: isArabic ? `${diffDays} يوم متبقي` : `${diffDays}d remaining`,
    bg: 'rgba(14, 165, 233, 0.12)',
    color: '#0284c7',
    border: 'rgba(14, 165, 233, 0.3)',
    icon: '🗓️',
  };
}

export default function Notifications() {
  const { t, locale } = useLocale();
  const isArabic = locale === 'ar';
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api('/notifications')
      .then((data) => {
        setRows(Array.isArray(data) ? data : []);
        setError('');
      })
      .catch((e) => setError(e.message || 'Could not load notifications.'))
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
      setMsg(isArabic ? 'تم تحديد جميع الإشعارات كمقروءة.' : 'All notifications marked as read.');
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setMarkingAll(false);
    }
  }

  const filteredRows = useMemo(() => {
    if (activeTab === 'all') return rows;
    if (activeTab === 'renewals') {
      return rows.filter((r) => {
        const cat = String(value(r, 'category') || '').toLowerCase();
        const title = String(value(r, 'title') || '').toLowerCase();
        return (
          cat === 'passport' ||
          cat === 'visa' ||
          cat === 'emirates_id' ||
          cat === 'document' ||
          title.includes('renewal') ||
          title.includes('expired')
        );
      });
    }
    if (activeTab === 'general') {
      return rows.filter((r) => {
        const cat = String(value(r, 'category') || '').toLowerCase();
        return cat !== 'passport' && cat !== 'visa' && cat !== 'emirates_id' && cat !== 'document';
      });
    }
    return rows;
  }, [rows, activeTab]);

  const renewalCount = useMemo(() => {
    return rows.filter((r) => {
      const cat = String(value(r, 'category') || '').toLowerCase();
      const title = String(value(r, 'title') || '').toLowerCase();
      return (
        cat === 'passport' ||
        cat === 'visa' ||
        cat === 'emirates_id' ||
        cat === 'document' ||
        title.includes('renewal') ||
        title.includes('expired')
      );
    }).length;
  }, [rows]);

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
          {markingAll ? (isArabic ? 'جاري التحديث…' : 'Updating…') : t('mark_all_read')}
        </button>
      }
    >
      {error ? <div className="error-box">{error}</div> : null}
      {msg ? <div className="success-box">{msg}</div> : null}

      {/* 30-Day renewal alert header if renewals present */}
      {renewalCount > 0 ? (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.08) 0%, rgba(239, 68, 68, 0.04) 100%)',
            border: '1px solid rgba(234, 88, 12, 0.25)',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🛂</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: '#9a3412' }}>
                {isArabic
                  ? 'تنبيه تجديد الوثائق الرسمية (30 يوماً)'
                  : 'Statutory Document Renewal Notification (30-Day Window)'}
              </div>
              <div style={{ fontSize: 12, color: '#7c2d12' }}>
                {isArabic
                  ? 'لديك وثائق رسمية (جواز سفر أو تأشيرة إقامة أو هوية إماراتية) تتطلب التجديد لتجنب الغرامات القانونية.'
                  : 'You have official documents (Passport, Residence Visa, or Emirates ID) requiring renewal under UAE MOHRE/ICP compliance.'}
              </div>
            </div>
          </div>
          <Link
            href="/profile"
            className="btn-primary"
            style={{ fontSize: 12, padding: '6px 14px', textDecoration: 'none' }}
          >
            {isArabic ? 'تحديث الوثائق في الملف الشخصي &larr;' : 'Upload Renewed Docs in Profile &rarr;'}
          </Link>
        </div>
      ) : null}

      <div className="panel-card">
        <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div className="panel-title">
            <h2>{t('notif_title')}</h2>
            <p>{t('notif_subtitle')}</p>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`btn-primary ${activeTab === 'all' ? '' : 'btn-outline'}`}
              style={{
                padding: '4px 10px',
                fontSize: '11.5px',
                background: activeTab === 'all' ? undefined : 'transparent',
                color: activeTab === 'all' ? undefined : 'var(--text)',
                borderColor: 'var(--border)',
              }}
              onClick={() => setActiveTab('all')}
            >
              {isArabic ? `الكل (${rows.length})` : `All (${rows.length})`}
            </button>
            <button
              type="button"
              className={`btn-primary ${activeTab === 'renewals' ? '' : 'btn-outline'}`}
              style={{
                padding: '4px 10px',
                fontSize: '11.5px',
                background: activeTab === 'renewals' ? '#ea580c' : 'transparent',
                color: activeTab === 'renewals' ? '#fff' : '#ea580c',
                borderColor: '#ea580c',
              }}
              onClick={() => setActiveTab('renewals')}
            >
              {isArabic ? `تجديدات الوثائق (${renewalCount})` : `Document Renewals (${renewalCount})`}
            </button>
            <button
              type="button"
              className={`btn-primary ${activeTab === 'general' ? '' : 'btn-outline'}`}
              style={{
                padding: '4px 10px',
                fontSize: '11.5px',
                background: activeTab === 'general' ? undefined : 'transparent',
                color: activeTab === 'general' ? undefined : 'var(--text)',
                borderColor: 'var(--border)',
              }}
              onClick={() => setActiveTab('general')}
            >
              {isArabic ? 'إشعارات عامة' : 'General Alerts'}
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>{t('category')}</th>
                <th>{t('item_title')}</th>
                <th style={{ width: 160 }}>{t('due_date')} & {isArabic ? 'الحالة' : 'Urgency'}</th>
                <th style={{ width: 90 }}>{t('status')}</th>
                <th style={{ width: 140 }}>{t('action')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: '30px 0' }}>
                    {isArabic ? 'جاري تحميل الإشعارات…' : 'Loading notifications…'}
                  </td>
                </tr>
              ) : filteredRows.length ? (
                filteredRows.map((n) => {
                  const read = value(n, 'isRead', 'is_read') === true;
                  const cat = String(value(n, 'category') || '').toLowerCase();
                  const dueDate = value(n, 'dueDate', 'due_date');
                  const urgency = getRenewalUrgency(dueDate, isArabic);
                  const isDocumentAlert =
                    cat === 'passport' ||
                    cat === 'visa' ||
                    cat === 'emirates_id' ||
                    cat === 'document' ||
                    String(value(n, 'title') || '').toLowerCase().includes('renewal');

                  return (
                    <tr key={value(n, 'id')} style={!read && isDocumentAlert ? { background: 'rgba(234, 88, 12, 0.03)' } : undefined}>
                      <td>
                        <span className="code-pill" style={{ textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.03em' }}>
                          {value(n, 'category') || 'Alert'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>{value(n, 'title')}</div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: 2 }}>
                          {value(n, 'message')}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '12px', fontWeight: 500 }}>{formatDate(dueDate)}</div>
                        {isDocumentAlert && urgency ? (
                          <span
                            style={{
                              display: 'inline-block',
                              marginTop: 3,
                              padding: '2px 7px',
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 700,
                              background: urgency.bg,
                              color: urgency.color,
                              border: `1px solid ${urgency.border}`,
                            }}
                          >
                            {urgency.icon} {urgency.label}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <span className={`status-pill ${read ? 'approved' : 'pending'}`}>
                          {read ? t('read') : t('unread')}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          {!read ? (
                            <button
                              type="button"
                              onClick={() => markRead(value(n, 'id'))}
                              className="btn-primary"
                              style={{
                                padding: '4px 10px',
                                fontSize: '11.5px',
                                background: 'transparent',
                                color: 'var(--brand)',
                                border: '1px solid var(--brand)',
                              }}
                            >
                              {t('mark_read')}
                            </button>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>—</span>
                          )}
                          {isDocumentAlert ? (
                            <Link
                              href="/profile"
                              style={{
                                fontSize: '11px',
                                color: '#0284c7',
                                textDecoration: 'none',
                                fontWeight: 600,
                              }}
                            >
                              {isArabic ? 'تحديث' : 'Upload'} &rarr;
                            </Link>
                          ) : null}
                        </div>
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
