'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api } from '../../lib/auth';
import { v } from '../../lib/format';

const emptyForm = () => ({
  code: '',
  name: '',
  payrollType: 'wps',
});

export default function DivisionsPage() {
  const [rows, setRows] = useState([]);
  const [companyPage, setCompanyPage] = useState(1);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setError('');
    api('/divisions')
      .then((data) => setRows(data || []))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createDivision(e) {
    e.preventDefault();
    setMsg('');
    setError('');
    setSaving(true);
    try {
      await api('/divisions', {
        method: 'POST',
        body: JSON.stringify({
          code: form.code.trim(),
          name: form.name.trim(),
          payrollType: form.payrollType,
        }),
      });
      setMsg('Company created.');
      setForm(emptyForm());
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

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
      setError(err.message);
    }
  }

  const totalPages = Math.ceil(rows.length / 10) || 1;
  const paginatedRows = rows.slice((companyPage - 1) * 10, companyPage * 10);

  return (
    <AppShell title="Company Master" subtitle="GOCs companies — Alkidma, Alqat, Overseas, Royal Oceans">
      {error ? <div className="error">{error}</div> : null}
      {msg ? <div className="muted" style={{ marginBottom: 12, color: 'var(--ok)', fontWeight: 600 }}>{msg}</div> : null}

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="panel-title">
          <h3>Add company</h3>
        </div>
        <p className="muted" style={{ marginBottom: 12 }}>
          Companies are never hard-deleted — use <strong>Deactivate</strong> to set inactive.
        </p>
        <form className="stack" onSubmit={createDivision}>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <label className="field">
              Code
              <input
                required
                placeholder="e.g. ALKIDMA"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              />
            </label>
            <label className="field">
              Name
              <input
                required
                placeholder="e.g. Alkidma"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
          </div>
          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Create company'}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="panel-title">
          <h3>All companies</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Employees</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((d) => (
                <tr key={v(d, 'id')}>
                  <td>{v(d, 'code')}</td>
                  <td>{v(d, 'name')}</td>
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
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={5}>No companies yet.</td>
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
