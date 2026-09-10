'use client';

import { useEffect, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { api, session, value } from '@/lib/api';

const formatDate = (v) => (v ? new Date(v).toLocaleDateString() : '—');

export default function Profile() {
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
  const company = value(profile, 'divisionName', 'division_name', 'companyName', 'company_name');
  const divId = value(profile, 'divisionId', 'division_id');
  const matchedComp = divisions.find(
    (d) =>
      (divId && String(value(d, 'id')) === String(divId)) ||
      (company && String(value(d, 'name')).toLowerCase().trim() === String(company).toLowerCase().trim())
  );
  const companyLogo = matchedComp?.logo_url || matchedComp?.logoUrl || '';

  return (
    <PortalShell title="My Profile" subtitle="Your employment record, credentials and uploaded documents">
      {error ? <div className="error-box">{error}</div> : null}

      {!data ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--muted)' }}>
          Loading profile details…
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
                {value(profile, 'jobTitle', 'job_title') || 'Employee'} · {value(profile, 'departmentName', 'department_name') || 'General'}
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
                  Team Lead
                </span>
              ) : null}
            </div>
          </div>

          {/* Employment Details Grid */}
          <div className="panel-card">
            <div className="panel-head" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>
              <div className="panel-title">
                <h2>Employment Details</h2>
                <p>Personal and professional assignment records</p>
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
              <DetailItem label="Employee Code" value={value(profile, 'empCode', 'emp_code')} isCode />
              <DetailItem label="Official Email" value={value(profile, 'email')} />
              <DetailItem label="Department" value={value(profile, 'departmentName', 'department_name')} />
              <DetailItem label="Job Title" value={value(profile, 'jobTitle', 'job_title')} />
              <DetailItem label="Contact Phone" value={value(profile, 'phone')} />
              
              {/* Company with Logo (Only shown if assigned) */}
              {company ? (
                <div>
                  <small style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Operating Company
                  </small>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    {companyLogo ? (
                      <img
                        src={companyLogo}
                        alt={company}
                        style={{
                          height: 26,
                          maxWidth: 42,
                          objectFit: 'contain',
                          borderRadius: 4,
                          background: '#ffffff',
                          border: '1px solid var(--line)',
                          padding: '1px',
                        }}
                      />
                    ) : null}
                    <strong style={{ fontSize: '13.5px', color: 'var(--ink)' }}>{company}</strong>
                  </div>
                </div>
              ) : null}

              <DetailItem label="Joining Date" value={formatDate(value(profile, 'joinDate', 'join_date'))} />
              <DetailItem label="Employment Status" value={value(profile, 'status')} isStatus />
            </div>
          </div>

          {/* My Documents Table */}
          <div className="panel-card">
            <div className="panel-head">
              <div className="panel-title">
                <h2>Uploaded Documents & Credentials</h2>
                <p>Official identification and visa records</p>
              </div>
            </div>
            <div className="table-wrap">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Document Title</th>
                    <th>Type</th>
                    <th>Issue Date</th>
                    <th>Expiry Date</th>
                    <th>Status</th>
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
                        No documents uploaded for this profile.
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
