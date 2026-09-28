'use client';

import { useEffect, useState, useCallback } from 'react';
import PortalShell from '@/components/PortalShell';
import { api, apiBlob, session, value } from '@/lib/api';
import { useLocale } from '@/lib/LocaleContext';

const formatDate = (v) => (v ? new Date(v).toLocaleDateString() : '—');

const CERT_TYPES = [
  { id: 'salary', label: 'Salary Certificate' },
  { id: 'bank', label: 'Bank Certificate' },
  { id: 'noc_travel', label: 'NOC (Travel)' },
];

export default function Certificates() {
  const { t, locale } = useLocale();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  // Form State
  const [certType, setCertType] = useState('salary');
  const [purpose, setPurpose] = useState('');
  const [bankName, setBankName] = useState('');
  const [travelDestination, setTravelDestination] = useState('');

  const loadCertificates = useCallback(async (quiet = false) => {
    if (!quiet) setError('');
    try {
      const data = await api('/certificates');
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      if (!quiet) setError(e.message);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  // Initial load + Real-time auto-polling every 4 seconds + window focus
  useEffect(() => {
    loadCertificates();
    const timer = setInterval(() => {
      loadCertificates(true);
    }, 4000);
    const onFocus = () => loadCertificates(true);
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadCertificates]);

  async function handleRequest(e) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const s = session.get();
      let eid = s?.user?.employeeId;
      if (!eid) {
        const me = await api('/auth/me');
        eid = me?.employeeId;
      }
      if (!eid) throw new Error('Employee account ID not detected.');

      await api('/certificates', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: eid,
          certificateType: certType,
          purpose: purpose.trim() || undefined,
          bankName: certType === 'bank' ? bankName.trim() : undefined,
          travelDestination: certType === 'noc_travel' ? travelDestination.trim() : undefined,
        }),
      });

      setSuccessMsg(locale === 'ar' ? 'تم تقديم طلب الشهادة بنجاح' : 'Certificate request submitted successfully.');
      setShowModal(false);
      setPurpose('');
      setBankName('');
      setTravelDestination('');
      await loadCertificates();
    } catch (err) {
      setError(err.message || 'Failed to submit certificate request');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownload(id) {
    if (downloadingId) return;
    setDownloadingId(id);
    setError('');
    try {
      const blob = await apiBlob(`/certificates/${id}/file`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Certificate-${id}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Failed to download certificate file');
    } finally {
      setDownloadingId(null);
    }
  }

  const total = rows.length;
  const issuedCount = rows.filter((r) => String(value(r, 'status') || '').toLowerCase() === 'issued').length;
  const approvedCount = rows.filter((r) => String(value(r, 'status') || '').toLowerCase() === 'approved').length;
  const pendingCount = rows.filter((r) => String(value(r, 'status') || '').toLowerCase() === 'pending').length;

  return (
    <PortalShell
      title={locale === 'ar' ? 'الشهادات والخطابات' : 'Certificates & Letters'}
      subtitle={locale === 'ar' ? 'طلب ومتابعة وتحميل شهادات العمل الرسمية وخطابات الراتب' : 'Request, track, and download official employment & salary certificates'}
      actions={
        <button
          type="button"
          onClick={() => {
            setError('');
            setSuccessMsg('');
            setShowModal(true);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            borderRadius: 8,
            border: 'none',
            background: '#00b8db',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '13.5px',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0, 184, 219, 0.3)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>{locale === 'ar' ? 'طلب شهادة جديدة' : 'Request Certificate'}</span>
        </button>
      }
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

      {/* KPI Top Cards */}
      <div className="dash-kpi-grid">
        <div className="kpi-card blue">
          <div className="kpi-info">
            <span className="kpi-title">{locale === 'ar' ? 'إجمالي الطلبات' : 'Total Requests'}</span>
            <span className="kpi-val">{total}</span>
            <span className="kpi-badge">{locale === 'ar' ? 'جميع السجلات' : 'All time'}</span>
          </div>
          <div className="kpi-ring">{total}</div>
        </div>

        <div className="kpi-card green">
          <div className="kpi-info">
            <span className="kpi-title">{locale === 'ar' ? 'تم الإصدار' : 'Issued'}</span>
            <span className="kpi-val">{issuedCount}</span>
            <span className="kpi-badge">{locale === 'ar' ? 'جاهز للتحميل' : 'Ready to download'}</span>
          </div>
          <div className="kpi-ring">{issuedCount}</div>
        </div>

        <div className="kpi-card amber">
          <div className="kpi-info">
            <span className="kpi-title">{locale === 'ar' ? 'قيد المراجعة' : 'Pending Review'}</span>
            <span className="kpi-val">{pendingCount}</span>
            <span className="kpi-badge">{locale === 'ar' ? 'لدى الموارد البشرية' : 'Under HR review'}</span>
          </div>
          <div className="kpi-ring">{pendingCount}</div>
        </div>
      </div>

      {/* Requests List */}
      <div className="panel-card">
        <div className="panel-head">
          <div className="panel-title">
            <h2>{locale === 'ar' ? 'سجل طلبات الشهادات' : 'Certificate Request History'}</h2>
            <p>{locale === 'ar' ? 'يتم التحديث تلقائياً دون الحاجة لتحديث الصفحة' : 'Live updates automatically without page refresh'}</p>
          </div>
        </div>

        <div className="table-wrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th>{locale === 'ar' ? 'نوع الشهادة' : 'Certificate Type'}</th>
                <th>{locale === 'ar' ? 'الغرض / التفاصيل' : 'Purpose / Details'}</th>
                <th>{locale === 'ar' ? 'تاريخ الطلب' : 'Request Date'}</th>
                <th>{locale === 'ar' ? 'الحالة' : 'Status'}</th>
                <th>{locale === 'ar' ? 'ملاحظة HR' : 'HR Note'}</th>
                <th style={{ textAlign: 'center' }}>{locale === 'ar' ? 'الإجراء' : 'Action'}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '30px 0' }}>
                    {locale === 'ar' ? 'جاري تحميل الشهادات…' : 'Loading certificates…'}
                  </td>
                </tr>
              ) : rows.length ? (
                rows.map((r, i) => {
                  const id = value(r, 'id');
                  const certTypeVal = String(value(r, 'certificateType', 'certificate_type') || '').toLowerCase();
                  const typeObj = CERT_TYPES.find((ct) => ct.id === certTypeVal);
                  const typeName = typeObj ? typeObj.label : (certTypeVal || 'Certificate');
                  const status = String(value(r, 'status') || 'pending').toLowerCase();
                  const hrNote = value(r, 'hrNote', 'hr_note');
                  const isIssued = status === 'issued' || Boolean(value(r, 'filePath', 'file_path'));

                  let statusBadgeClass = 'pending';
                  let statusLabel = 'Pending';
                  if (status === 'issued') {
                    statusBadgeClass = 'approved';
                    statusLabel = 'Issued';
                  } else if (status === 'approved') {
                    statusBadgeClass = 'cyan';
                    statusLabel = 'Approved';
                  } else if (status === 'rejected') {
                    statusBadgeClass = 'late';
                    statusLabel = 'Rejected';
                  }

                  let details = value(r, 'purpose') || '—';
                  if (certTypeVal === 'bank' && value(r, 'bankName', 'bank_name')) {
                    details = `${value(r, 'bankName', 'bank_name')} ${value(r, 'purpose') ? `(${value(r, 'purpose')})` : ''}`;
                  } else if (certTypeVal === 'noc_travel' && value(r, 'travelDestination', 'travel_destination')) {
                    details = `Destination: ${value(r, 'travelDestination', 'travel_destination')} ${value(r, 'purpose') ? `(${value(r, 'purpose')})` : ''}`;
                  }

                  return (
                    <tr key={id || i}>
                      <td style={{ fontWeight: 700, color: 'var(--ink)' }}>
                        <span className="code-pill" style={{ fontSize: '12px' }}>{typeName}</span>
                      </td>
                      <td style={{ fontSize: '13px', color: 'var(--ink)' }}>{details}</td>
                      <td>{formatDate(value(r, 'createdAt', 'created_at'))}</td>
                      <td>
                        <span className={`status-pill ${statusBadgeClass}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td style={{ fontSize: '12.5px', color: 'var(--muted)', maxWidth: 200 }}>
                        {hrNote || '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {isIssued ? (
                          <button
                            type="button"
                            disabled={downloadingId === id}
                            onClick={() => handleDownload(id)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '6px 12px',
                              borderRadius: 6,
                              border: '1px solid #10b981',
                              background: 'rgba(16, 185, 129, 0.1)',
                              color: '#065f46',
                              fontWeight: 700,
                              fontSize: '12px',
                              cursor: downloadingId === id ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            <span>{downloadingId === id ? '...' : (locale === 'ar' ? 'تحميل' : 'Download')}</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                            {status === 'approved' ? (locale === 'ar' ? 'بانتظار الإصدار' : 'Generating…') : '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '30px 0' }}>
                    {locale === 'ar' ? 'لا توجد طلبات شهادات حالياً' : 'No certificate requests submitted yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REQUEST MODAL */}
      {showModal ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 11, 31, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) setShowModal(false);
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 480,
              background: 'var(--surface)',
              borderRadius: 14,
              border: '1px solid var(--line)',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--ink)' }}>
                {locale === 'ar' ? 'طلب شهادة رسمية' : 'Request Official Certificate'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                disabled={submitting}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  lineHeight: 1,
                  color: 'var(--muted)',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRequest} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
                  {locale === 'ar' ? 'نوع الشهادة' : 'Certificate Type'}
                </label>
                <select
                  value={certType}
                  onChange={(e) => setCertType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--line)',
                    background: 'var(--surface-alt)',
                    color: 'var(--ink)',
                    fontSize: '14px',
                  }}
                >
                  <option value="salary">Salary Certificate</option>
                  <option value="bank">Bank Certificate</option>
                  <option value="noc_travel">NOC (Travel)</option>
                </select>
              </div>

              {certType === 'bank' ? (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
                    {locale === 'ar' ? 'اسم البنك' : 'Bank Name'} <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={locale === 'ar' ? 'مثال: بنك الإمارات دبي الوطني' : 'e.g. Emirates NBD, ADCB'}
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--line)',
                      background: 'var(--surface-alt)',
                      color: 'var(--ink)',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              ) : null}

              {certType === 'noc_travel' ? (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
                    {locale === 'ar' ? 'وجهة السفر' : 'Travel Destination'} <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={locale === 'ar' ? 'مثال: تركيا، المملكة المتحدة' : 'e.g. United Kingdom, Turkey'}
                    value={travelDestination}
                    onChange={(e) => setTravelDestination(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--line)',
                      background: 'var(--surface-alt)',
                      color: 'var(--ink)',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              ) : null}

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
                  {locale === 'ar' ? 'الغرض من الشهادة (اختياري)' : 'Purpose / Additional Remarks (Optional)'}
                </label>
                <textarea
                  rows={3}
                  placeholder={locale === 'ar' ? 'اذكر سبب طلب الشهادة…' : 'e.g. For visa application, bank loan, embassy…'}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--line)',
                    background: 'var(--surface-alt)',
                    color: 'var(--ink)',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 8,
                    border: '1px solid var(--line)',
                    background: 'transparent',
                    color: 'var(--ink)',
                    fontWeight: 600,
                    fontSize: '13.5px',
                    cursor: 'pointer',
                  }}
                >
                  {locale === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#00b8db',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '13.5px',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(0, 184, 219, 0.3)',
                  }}
                >
                  {submitting ? (locale === 'ar' ? 'جاري الإرسال…' : 'Submitting…') : (locale === 'ar' ? 'إرسال الطلب' : 'Submit Request')}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </PortalShell>
  );
}
