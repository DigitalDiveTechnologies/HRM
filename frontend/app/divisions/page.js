'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell, { Badge } from '../../components/AppShell';
import { api } from '../../lib/auth';
import { sortCompaniesLatest, writeCompaniesCache } from '../../lib/companyCache';
import { fetchDivisionsDirect, updateDivisionStatusDirect } from '../../lib/dbDirect';
import { formatDateTime, v } from '../../lib/format';

export default function DivisionsPage() {
  const [rows, setRows] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('gocs_cached_divisions');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return sortCompaniesLatest(parsed);
        }
      } catch {}
    }
    return [];
  });
  const [loading, setLoading] = useState(false);
  const [companyPage, setCompanyPage] = useState(1);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    setError('');
    let isMounted = true;

    // 1. Fast path: direct DB query via Neon HTTP API (< 200ms)
    fetchDivisionsDirect().then((directData) => {
      if (!isMounted) return;
      if (directData && Array.isArray(directData) && directData.length > 0) {
        const sorted = sortCompaniesLatest(directData);
        setRows(sorted);
        setLoading(false);
        try {
          localStorage.setItem('gocs_cached_divisions', JSON.stringify(sorted));
          writeCompaniesCache(sorted);
        } catch {}
      }
    }).catch(() => {});

    // 2. Standard path: backend API endpoint
    api('/divisions')
      .then((data) => {
        if (!isMounted) return;
        if (data && Array.isArray(data) && data.length > 0) {
          const sorted = sortCompaniesLatest(data);
          setRows(sorted);
          setLoading(false);
          try {
            localStorage.setItem('gocs_cached_divisions', JSON.stringify(sorted));
            writeCompaniesCache(sorted);
          } catch {}
        }
      })
      .catch((e) => {
        if (!isMounted) return;
        setLoading(false);
        setRows((prev) => {
          if (!prev.length) setError(e.message);
          return prev;
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleUpdate = () => {
      try {
        const cached = localStorage.getItem('gocs_cached_divisions');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setRows(sortCompaniesLatest(parsed));
          }
        }
      } catch {}
    };
    window.addEventListener('gocs_company_changed', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('gocs_company_changed', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  async function setStatus(id, status) {
    setMsg('');
    setError('');
    try {
      await api(`/divisions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setMsg(status === 'inactive' ? 'Company deactivated (soft delete).' : 'Company reactivated.');
      load();
    } catch (err) {
      try {
        const ok = await updateDivisionStatusDirect(id, status);
        if (ok) {
          setMsg(status === 'inactive' ? 'Company deactivated (soft delete).' : 'Company reactivated.');
          load();
          return;
        }
      } catch {}
      setError(err.message);
    }
  }

  const totalPages = Math.ceil(rows.length / 10) || 1;
  const paginatedRows = rows.slice((companyPage - 1) * 10, companyPage * 10);

  return (
    <AppShell
      title="Company Master"
              subtitle="Synergy companies"
      actions={
        <Link
          href="/divisions/management"
          className="btn"
          style={{
            height: '40px',
            boxSizing: 'border-box',
            background: '#00b8db',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '13px',
            padding: '0 14px',
            borderRadius: '6px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0, 184, 219, 0.25)',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Create Company</span>
        </Link>
      }
    >
      {error ? <div className="error">{error}</div> : null}
      {msg ? <div className="muted" style={{ marginBottom: 12, color: 'var(--ok)', fontWeight: 600 }}>{msg}</div> : null}

      <div className="card">
        <div className="panel-title">
          <h3>All companies</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: '44px' }}>Logo</th>
                <th>Company Name</th>
                <th>Created Date & Time</th>
                <th>Employees</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((d) => {
                const name = v(d, 'name') || '—';
                const logo = d.logo_url || d.logoUrl || '';
                const createdAt = v(d, 'created_at', 'createdAt');
                return (
                  <tr key={v(d, 'id')}>
                    <td>
                      {logo ? (
                        <img
                          src={logo}
                          alt={name}
                          style={{
                            height: 26,
                            width: 26,
                            objectFit: 'contain',
                            borderRadius: 4,
                            border: '1px solid var(--line, #cbd5e1)',
                            background: '#ffffff',
                            padding: '1px',
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 4,
                            background: 'var(--surface-alt, #e2e8f0)',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: 'var(--muted, #64748b)',
                          }}
                        >
                          {name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </td>
                    <td>
                      <strong style={{ color: 'var(--ink)' }}>{name}</strong>
                    </td>
                    <td style={{ fontSize: '12.5px', color: 'var(--muted, #64748b)' }}>
                      {createdAt ? formatDateTime(createdAt) : '—'}
                    </td>
                    <td>{v(d, 'employeeCount', 'employee_count') ?? 0}</td>
                    <td>
                      <Badge status={v(d, 'status')} />
                    </td>
                    <td>
                      {String(v(d, 'status')).toLowerCase() === 'active' ? (
                        <button type="button" className="btn secondary" onClick={() => setStatus(v(d, 'id'), 'inactive')}>
                          Deactivate
                        </button>
                      ) : (
                        <button type="button" className="btn secondary" onClick={() => setStatus(v(d, 'id'), 'active')}>
                          Reactivate
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!rows.length ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--muted, #64748b)' }}>
                    No companies yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls (< 1, 2, 3... >) */}
        {rows.length > 0 ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
              marginTop: 14,
              paddingTop: 12,
              borderTop: '1px solid var(--line, #e2e8f0)',
            }}
          >
            <div className="muted" style={{ fontSize: '12px' }}>
              Showing {(companyPage - 1) * 10 + 1}–{Math.min(companyPage * 10, rows.length)} of {rows.length} companies
            </div>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {/* Previous < Chevron Button */}
              <button
                type="button"
                disabled={companyPage <= 1}
                onClick={() => setCompanyPage((p) => Math.max(1, p - 1))}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: '1px solid var(--line, #cbd5e1)',
                  background: 'var(--surface, #ffffff)',
                  color: companyPage <= 1 ? 'var(--muted, #94a3b8)' : 'var(--ink, #0f172a)',
                  cursor: companyPage <= 1 ? 'not-allowed' : 'pointer',
                  opacity: companyPage <= 1 ? 0.45 : 1,
                  transition: 'all 0.15s ease',
                }}
                title="Previous page"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>

              {/* Page Number Buttons */}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                const isActive = p === companyPage;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCompanyPage(p)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 28,
                      height: 28,
                      padding: '0 6px',
                      borderRadius: 6,
                      border: isActive ? '1px solid #00b8db' : '1px solid var(--line, #cbd5e1)',
                      background: isActive ? '#00b8db' : 'var(--surface, #ffffff)',
                      color: isActive ? '#ffffff' : 'var(--ink, #0f172a)',
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {p}
                  </button>
                );
              })}

              {/* Next > Chevron Button */}
              <button
                type="button"
                disabled={companyPage >= totalPages}
                onClick={() => setCompanyPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: '1px solid var(--line, #cbd5e1)',
                  background: 'var(--surface, #ffffff)',
                  color: companyPage >= totalPages ? 'var(--muted, #94a3b8)' : 'var(--ink, #0f172a)',
                  cursor: companyPage >= totalPages ? 'not-allowed' : 'pointer',
                  opacity: companyPage >= totalPages ? 0.45 : 1,
                  transition: 'all 0.15s ease',
                }}
                title="Next page"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
