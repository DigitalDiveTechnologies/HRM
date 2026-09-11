'use client';

import { useEffect, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { api, apiBlob, session, value } from '@/lib/api';
import { useLocale } from '@/lib/LocaleContext';

const formatDate = (v) => (v ? new Date(v).toLocaleDateString() : '—');

export default function Profile() {
  const { t, locale } = useLocale();
  const [data, setData] = useState(null);
  const [team, setTeam] = useState(null);
  const [divisions, setDivisions] = useState([]);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewImgError, setPreviewImgError] = useState(false);

  useEffect(() => {
    const id = session.get()?.user?.employeeId;
    if (!id) return;
    Promise.all([
      api('/ess/' + id).catch(() => null),
      api('/leave/team/summary').catch(() => null),
      api('/divisions').catch(() => []),
    ])
      .then(([ess, summary, divs]) => {
        setData(ess);
        setTeam(summary);
        setDivisions(Array.isArray(divs) ? divs : []);
      })
      .catch((e) => setError(e.message));
  }, []);

  const profile = data?.profile || {};
  const docs = data?.documents || [];
  let md = {};
  try {
    md = typeof profile.masterData === 'string' ? JSON.parse(profile.masterData || '{}') : profile.masterData || {};
  } catch {}

  const divId = String(value(profile, 'divisionId', 'division_id') || md.divisionId || (md.companyIds && md.companyIds[0]) || '');
  const company = value(profile, 'divisionName', 'division_name', 'companyName', 'company_name') || md.divisionName || '';

  const matchedComp = divisions.find(
    (d) =>
      (divId && String(value(d, 'id')) === divId) ||
      (company && String(value(d, 'name') || '').toLowerCase().trim() === String(company).toLowerCase().trim()) ||
      (company && String(value(d, 'code') || '').toLowerCase().trim() === String(company).toLowerCase().trim())
  );
  const companyLogo = matchedComp?.logo_url || matchedComp?.logoUrl || value(profile, 'division_logo', 'divisionLogo', 'logo_url') || '';
  const displayCompany = matchedComp ? value(matchedComp, 'name') : company;

  const citizenIdAddress = md.homeCountryAddress || md.citizenIdAddress || value(profile, 'homeCountryAddress', 'home_country_address') || '';
  const residentialAddress = md.addressInUae || md.residentialAddress || value(profile, 'addressInUae', 'address_in_uae', 'residentialAddress', 'residential_address') || '';
  const appPassword = value(profile, 'password') || md.password || md.appPassword || 'demo123';

  async function handleDownloadDoc(doc) {
    try {
      const docId = value(doc, 'id');
      const title = value(doc, 'title') || 'document';
      const fileName = value(doc, 'fileName', 'file_name') || `${title}.pdf`;
      const blob = await apiBlob(`/documents/${docId}/file`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Failed to download document.');
    }
  }

  async function openDocPreview(doc) {
    setPreviewImgError(false);
    const docId = value(doc, 'id');
    const fileRef = value(doc, 'fileRef', 'file_ref');
    const title = value(doc, 'title') || 'Official Document';
    const fileName = value(doc, 'fileName', 'file_name') || `${title}.pdf`;
    const docType = value(doc, 'docType', 'doc_type') || 'Document';

    let fileUrl = '';
    if (fileRef && fileRef.startsWith('http')) {
      fileUrl = fileRef;
    } else if (docId) {
      try {
        const blob = await apiBlob(`/documents/${docId}/file`);
        fileUrl = URL.createObjectURL(blob);
      } catch {}
    }

    setPreviewDoc({
      id: docId,
      title,
      fileName,
      docType,
      fileUrl,
      isImage: /\.(png|jpe?g|webp|gif)$/i.test(fileName) || /\.(png|jpe?g|webp|gif)$/i.test(fileRef || ''),
      isPdf: /\.pdf$/i.test(fileName) || /\.pdf$/i.test(fileRef || ''),
    });
  }

  return (
    <PortalShell
      title={t('profile_title')}
      subtitle={t('profile_subtitle')}
    >
      {error ? <div className="error-box">{error}</div> : null}

      {!data ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--muted)' }}>
          {locale === 'ar' ? 'جاري تحميل الملف الشخصي…' : 'Loading profile details…'}
        </div>
      ) : (
        <>
          {/* Profile Header Banner Card */}
          <div className="panel-card" style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #00b8db, #0284c7)',
                color: '#ffffff',
                fontSize: '26px',
                fontWeight: 800,
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 4px 12px rgba(0, 184, 219, 0.3)',
                flexShrink: 0,
              }}
            >
              {String(value(profile, 'fullName', 'full_name') || 'E').slice(0, 1).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 4px', color: 'var(--ink)' }}>
                {value(profile, 'fullName', 'full_name')}
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
                {value(profile, 'jobTitle', 'job_title') || (locale === 'ar' ? 'موظف' : 'Employee')} · {value(profile, 'departmentName', 'department_name') || (locale === 'ar' ? 'عام' : 'General')}
              </p>
              {team?.isTeamLead ? (
                <span
                  style={{
                    display: 'inline-block',
                    marginTop: 8,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: '#00b8db',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  {locale === 'ar' ? 'قائد الفريق' : 'Team Lead'}
                </span>
              ) : null}
            </div>
          </div>

          {/* Employment Details Grid */}
          <div className="panel-card">
            <div className="panel-head" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>
              <div className="panel-title">
                <h2>{t('employment_info')}</h2>
                <p>{t('personal_info')}</p>
              </div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '20px',
                marginTop: 16,
              }}
            >
              <DetailItem label={t('employee_code')} value={value(profile, 'empCode', 'emp_code')} isCode />
              <DetailItem label={t('email_address')} value={value(profile, 'email')} />
              
              {/* App Password with Show/Hide button next to Email */}
              <div>
                <small style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {t('app_password')}
                </small>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 4 }}>
                  <span
                    style={{
                      fontFamily: showPassword ? 'inherit' : 'monospace',
                      fontSize: showPassword ? '13px' : '15px',
                      fontWeight: 600,
                      color: 'var(--ink)',
                      letterSpacing: showPassword ? 'normal' : '2px',
                    }}
                  >
                    {showPassword ? appPassword : '••••••••'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      color: 'var(--muted)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {showPassword ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <DetailItem label={t('department')} value={value(profile, 'departmentName', 'department_name')} />
              <DetailItem label={t('designation')} value={value(profile, 'jobTitle', 'job_title')} />
              <DetailItem label={t('phone_number')} value={value(profile, 'phone')} />
              
              {/* Company with Logo (Only shown if assigned) */}
              {displayCompany ? (
                <div>
                  <small style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {t('company')}
                  </small>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    {companyLogo ? (
                      <img
                        src={companyLogo}
                        alt={displayCompany}
                        style={{
                          height: 28,
                          maxWidth: 44,
                          objectFit: 'contain',
                          borderRadius: 4,
                          background: '#ffffff',
                          border: '1px solid var(--line)',
                          padding: '1px',
                        }}
                      />
                    ) : null}
                    <strong style={{ fontSize: '13.5px', color: 'var(--ink)' }}>{displayCompany}</strong>
                  </div>
                </div>
              ) : null}

              <DetailItem label={t('joining_date')} value={formatDate(value(profile, 'joinDate', 'join_date'))} />
              <DetailItem label={t('status')} value={value(profile, 'status')} isStatus />

              {/* Citizen ID Address */}
              <div style={{ gridColumn: 'span 1' }}>
                <small style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {t('citizen_id_address')}
                </small>
                <div style={{ marginTop: 4, lineHeight: 1.4 }}>
                  <strong style={{ fontSize: '13px', color: 'var(--ink)', fontWeight: 600 }}>
                    {citizenIdAddress || '—'}
                  </strong>
                </div>
              </div>

              {/* Residential Address */}
              <div style={{ gridColumn: 'span 1' }}>
                <small style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {t('residential_address')}
                </small>
                <div style={{ marginTop: 4, lineHeight: 1.4 }}>
                  <strong style={{ fontSize: '13px', color: 'var(--ink)', fontWeight: 600 }}>
                    {residentialAddress || '—'}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* My Documents Table */}
          <div className="panel-card">
            <div className="panel-head">
              <div className="panel-title">
                <h2>{locale === 'ar' ? 'المستندات والشهادات المرفوعة' : 'Uploaded Documents & Credentials'}</h2>
                <p>{locale === 'ar' ? 'سجلات الهوية الرسمية والإقامات' : 'Official identification and visa records'}</p>
              </div>
            </div>
            <div className="table-wrap">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>{t('item_title')}</th>
                    <th>{locale === 'ar' ? 'النوع' : 'Type'}</th>
                    <th>{locale === 'ar' ? 'تاريخ الإصدار' : 'Issue Date'}</th>
                    <th>{locale === 'ar' ? 'تاريخ الانتهاء' : 'Expiry Date'}</th>
                    <th>{t('status')}</th>
                    <th>{t('action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.length ? (
                    docs.map((d) => {
                      const id = value(d, 'id');
                      const title = value(d, 'title') || 'Official Document';
                      const docType = value(d, 'docType', 'doc_type') || 'Document';
                      const issueDate = value(d, 'issueDate', 'issue_date');
                      const expiryDate = value(d, 'expiryDate', 'expiry_date');
                      const status = String(value(d, 'status') || 'valid').toLowerCase();

                      return (
                        <tr key={id}>
                          <td style={{ fontWeight: 600 }}>{title}</td>
                          <td>
                            <span className="code-pill">{docType}</span>
                          </td>
                          <td>{formatDate(issueDate)}</td>
                          <td>{formatDate(expiryDate)}</td>
                          <td>
                            <span className={`status-pill ${status === 'valid' ? 'approved' : status === 'expiring' ? 'late' : 'pending'}`}>
                              {status}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
                              <button
                                type="button"
                                onClick={() => openDocPreview(d)}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: 6,
                                  border: '1px solid var(--line)',
                                  background: 'var(--surface)',
                                  color: 'var(--ink)',
                                  fontSize: '11.5px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                👁 {t('preview')}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadDoc(d)}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: 6,
                                  border: '1px solid #10b981',
                                  background: 'rgba(16, 185, 129, 0.08)',
                                  color: '#059669',
                                  fontSize: '11.5px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                ⤓ {t('download')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 0' }}>
                        {locale === 'ar' ? 'لا توجد مستندات مرفوعة لهذا الموظف.' : 'No documents uploaded for this profile.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Document Preview Modal */}
          {previewDoc ? (
            <>
              <div
                onClick={() => setPreviewDoc(null)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0,0,0,0.6)',
                  zIndex: 1000,
                  backdropFilter: 'blur(2px)',
                }}
              />
              <div
                role="dialog"
                aria-modal="true"
                style={{
                  position: 'fixed',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 1001,
                  width: 'min(780px, calc(100vw - 32px))',
                  maxHeight: '85vh',
                  background: 'var(--surface)',
                  borderRadius: 12,
                  boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)',
                  border: '1px solid var(--line)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 20px',
                    borderBottom: '1px solid var(--line)',
                    background: 'var(--surface-alt)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: 'rgba(0, 184, 219, 0.15)', color: 'var(--brand)' }}>
                      {previewDoc.docType}
                    </span>
                    <strong style={{ fontSize: '14px', color: 'var(--ink)' }}>
                      {previewDoc.title || previewDoc.fileName}
                    </strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewDoc(null)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      fontSize: '20px',
                      color: 'var(--muted)',
                      cursor: 'pointer',
                      padding: '2px 6px',
                    }}
                  >
                    ×
                  </button>
                </div>

                <div
                  style={{
                    padding: '20px',
                    overflowY: 'auto',
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#0b1120',
                    minHeight: '300px',
                  }}
                >
                  {!previewImgError && previewDoc.fileUrl && previewDoc.isImage ? (
                    <img
                      src={previewDoc.fileUrl}
                      alt={previewDoc.title}
                      onError={() => setPreviewImgError(true)}
                      style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: 6 }}
                    />
                  ) : (
                    <div style={{ color: '#ffffff', textAlign: 'center', padding: '30px' }}>
                      <div style={{ fontSize: '44px', marginBottom: 12 }}>
                        {previewDoc.isPdf ? '📕' : '📄'}
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 600 }}>{previewDoc.fileName || previewDoc.title}</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: 4 }}>
                        {previewDoc.docType} • Verified Attachment Record
                      </div>
                      {previewDoc.fileUrl ? (
                        <a
                          href={previewDoc.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            marginTop: 18,
                            background: 'var(--brand)',
                            color: '#ffffff',
                            padding: '8px 18px',
                            borderRadius: 6,
                            textDecoration: 'none',
                            fontSize: '12.5px',
                            fontWeight: 600,
                          }}
                        >
                          {t('open_in_new_tab')} ↗
                        </a>
                      ) : null}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 20px',
                    borderTop: '1px solid var(--line)',
                    background: 'var(--surface-alt)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleDownloadDoc(previewDoc)}
                    style={{
                      background: '#059669',
                      color: '#ffffff',
                      padding: '7px 16px',
                      fontSize: '12.5px',
                      borderRadius: 6,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: 'none',
                    }}
                  >
                    ⤓ {t('download')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDoc(null)}
                    style={{
                      padding: '7px 16px',
                      fontSize: '12.5px',
                      borderRadius: 6,
                      background: 'transparent',
                      border: '1px solid var(--line)',
                      color: 'var(--ink)',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    {t('close_preview')}
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </>
      )}
    </PortalShell>
  );
}

function DetailItem({ label, value: val, isCode, isStatus }) {
  return (
    <div>
      <small style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </small>
      <div style={{ marginTop: 4 }}>
        {isCode ? (
          <span className="code-pill">{val || '—'}</span>
        ) : isStatus ? (
          <span className="status-pill active">{val || 'active'}</span>
        ) : (
          <strong style={{ fontSize: '13.5px', color: 'var(--ink)' }}>{val || '—'}</strong>
        )}
      </div>
    </div>
  );
}
