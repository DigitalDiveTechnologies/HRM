'use client';

import { useEffect, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { api, session, value } from '@/lib/api';
import { useLocale } from '@/lib/LocaleContext';

const formatDate = (v) => (v ? new Date(v).toLocaleDateString() : '—');

export default function Profile() {
  const { t, locale } = useLocale();
  const [data, setData] = useState(null);
  const [team, setTeam] = useState(null);
  const [divisions, setDivisions] = useState([]);
  const [error, setError] = useState('');

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
                  </tr>
                </thead>
                <tbody>
                  {docs.length ? (
                    docs.map((d) => (
                      <tr key={value(d, 'id')}>
                        <td style={{ fontWeight: 600 }}>{value(d, 'title')}</td>
                        <td>
                          <span className="code-pill">{value(d, 'docType', 'doc_type')}</span>
                        </td>
                        <td>{formatDate(value(d, 'issueDate', 'issue_date'))}</td>
                        <td>{formatDate(value(d, 'expiryDate', 'expiry_date'))}</td>
                        <td>
                          <span className="status-pill active">{value(d, 'status') || 'verified'}</span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 0' }}>
                        {locale === 'ar' ? 'لا توجد مستندات مرفوعة لهذا الموظف.' : 'No documents uploaded for this profile.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
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
