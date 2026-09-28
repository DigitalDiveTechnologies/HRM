'use client';

import { useEffect, useState, useCallback } from 'react';
import PortalShell from '@/components/PortalShell';
import { api, value } from '@/lib/api';
import { useLocale } from '@/lib/LocaleContext';

const formatDate = (v) => (v ? new Date(v).toLocaleDateString() : '—');

export default function Onboarding() {
  const { t, locale } = useLocale();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const loadTasks = useCallback(async () => {
    try {
      const data = await api('/onboarding/my');
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  async function markDone(id) {
    if (busyId) return;
    setBusyId(id);
    setError('');
    setActionMsg('');
    try {
      await api(`/onboarding/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'done' }),
      });
      setActionMsg(locale === 'ar' ? 'تم تحديث حالة المهمة إلى مكتمل بنجاح!' : 'Task marked as completed successfully!');
      setRows((prev) =>
        prev.map((r) =>
          value(r, 'id') === id
            ? { ...r, status: 'done', signedAt: new Date().toISOString() }
            : r
        )
      );
    } catch (err) {
      setError(err.message || 'Failed to update task');
    } finally {
      setBusyId(null);
    }
  }

  const total = rows.length;
  const completed = rows.filter((r) => String(value(r, 'status') || '').toLowerCase() === 'done').length;
  const pending = total - completed;

  return (
    <PortalShell
      title={t('onboarding_title')}
      subtitle={t('onboarding_subtitle')}
    >
      {error ? <div className="error-box" style={{ marginBottom: 16 }}>{error}</div> : null}
      {actionMsg ? (
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
          <span>{actionMsg}</span>
        </div>
      ) : null}

      {/* KPI Top Cards */}
      <div className="dash-kpi-grid">
        <div className="kpi-card blue">
          <div className="kpi-info">
            <span className="kpi-title">{t('total_assigned')}</span>
            <span className="kpi-val">{total}</span>
            <span className="kpi-badge">{locale === 'ar' ? 'العناصر والمهام' : 'Items & Tasks'}</span>
          </div>
          <div className="kpi-ring">{total}</div>
        </div>

        <div className="kpi-card amber">
          <div className="kpi-info">
            <span className="kpi-title">{t('pending_tasks')}</span>
            <span className="kpi-val">{pending}</span>
            <span className="kpi-badge">
              {pending > 0 ? (locale === 'ar' ? 'في انتظار التحقق' : 'Pending Verification') : (locale === 'ar' ? 'مكتمل' : 'Cleared')}
            </span>
          </div>
          <div className="kpi-ring">{pending}</div>
        </div>

        <div className="kpi-card green">
          <div className="kpi-info">
            <span className="kpi-title">{t('completed_tasks')}</span>
            <span className="kpi-val">{completed}</span>
            <span className="kpi-badge">
              {total > 0 ? `${Math.round((completed / total) * 100)}% ${locale === 'ar' ? 'مكتمل' : 'Done'}` : '100%'}
            </span>
          </div>
          <div className="kpi-ring">{completed}</div>
        </div>
      </div>

      {/* Onboarding Tasks List */}
      <div className="panel-card">
        <div className="panel-head">
          <div className="panel-title">
            <h2>{t('onboarding_checklist')}</h2>
            <p>{t('onboarding_checklist_sub')}</p>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
            {locale === 'ar' ? 'جاري تحميل قائمة المهام…' : 'Loading assigned checklist…'}
          </div>
        ) : rows.length ? (
          <div style={{ display: 'grid', gap: 14 }}>
            {rows.map((r, i) => {
              const status = String(value(r, 'status') || 'pending').toLowerCase();
              const isDone = status === 'done';
              const tag = value(r, 'tagNo', 'tag_no');
              const taskId = value(r, 'id');

              return (
                <div
                  key={taskId || i}
                  style={{
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                    padding: '16px 20px',
                    background: 'var(--surface-alt)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span className={`status-pill ${isDone ? 'approved' : 'pending'}`}>
                          {isDone ? t('done') : t('pending')}
                        </span>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)' }}>
                          {value(r, 'title')}
                        </span>
                        {tag ? <span className="code-pill">Tag: {tag}</span> : null}
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                        {t('category')}: {value(r, 'category') || (locale === 'ar' ? 'معدات عامة' : 'General Equipment')}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ textAlign: locale === 'ar' ? 'left' : 'right', whiteSpace: 'nowrap' }}>
                        <small style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>{t('due_date')}</small>
                        <strong style={{ fontSize: '12.5px', color: 'var(--ink)' }}>{formatDate(value(r, 'dueDate', 'due_date'))}</strong>
                      </div>

                      {!isDone ? (
                        <button
                          type="button"
                          disabled={busyId === taskId}
                          onClick={() => markDone(taskId)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '8px 14px',
                            borderRadius: 8,
                            border: 'none',
                            background: '#10b981',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '12.5px',
                            cursor: busyId === taskId ? 'not-allowed' : 'pointer',
                            boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span>{busyId === taskId ? (locale === 'ar' ? 'جاري التحديث…' : 'Updating…') : (locale === 'ar' ? 'تحديد كمكتمل' : 'Mark as Done')}</span>
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                      gap: 12,
                      paddingTop: 10,
                      borderTop: '1px solid var(--line)',
                      fontSize: '12px',
                    }}
                  >
                    <div>
                      <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px' }}>
                        {locale === 'ar' ? 'تاريخ التكليف' : 'Assigned Date'}
                      </span>
                      <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{formatDate(value(r, 'createdAt', 'created_at'))}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px' }}>
                        {locale === 'ar' ? 'تاريخ التسليم' : 'Handover Signed'}
                      </span>
                      <span style={{ fontWeight: 600, color: isDone ? '#065f46' : 'var(--muted)' }}>
                        {formatDate(value(r, 'signedAt', 'signed_at'))}
                      </span>
                    </div>
                  </div>

                  {value(r, 'notes') ? (
                    <div
                      style={{
                        background: 'var(--surface)',
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid var(--line)',
                        fontSize: '12px',
                        color: 'var(--muted)',
                      }}
                    >
                      <strong style={{ color: 'var(--ink)', marginRight: 6 }}>
                        {locale === 'ar' ? 'ملاحظات:' : 'Notes:'}
                      </strong>
                      {value(r, 'notes')}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
            {t('no_onboarding_tasks')}
          </div>
        )}
      </div>
    </PortalShell>
  );
}
