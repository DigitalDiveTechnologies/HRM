'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../../../components/AppShell';
import { api } from '../../../lib/auth';
import { upsertCompanyInCache } from '../../../lib/companyCache';
import { LOGO_ACCEPT, readLogoFileAsDataUrl } from '../../../lib/logoUpload';

const emptyForm = () => ({
  name: '',
  payrollType: 'wps',
  logoUrl: '',
});

export default function CompanyManagementPage() {
  const router = useRouter();
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  async function createDivision(e) {
    e.preventDefault();
    setMsg('');
    setError('');
    setSaving(true);
    try {
      const created = await api('/divisions', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          payrollType: form.payrollType,
          logoUrl: form.logoUrl || null,
        }),
      });
      try {
        const cached = localStorage.getItem('gocs_cached_divisions');
        const prev = cached ? JSON.parse(cached) : [];
        upsertCompanyInCache(created, Array.isArray(prev) ? prev : []);
      } catch {
        upsertCompanyInCache(created, []);
      }
      setMsg(`Company "${form.name.trim()}" created successfully.`);
      setForm(emptyForm());
      setTimeout(() => router.push('/divisions'), 600);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Create Company" subtitle="Register company">
      {error ? <div className="error" style={{ marginBottom: 16 }}>{error}</div> : null}
      {msg ? (
        <div
          style={{
            marginBottom: 16,
            padding: '12px 16px',
            borderRadius: 8,
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#10b981',
            fontWeight: 600,
            fontSize: '13.5px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{msg}</span>
        </div>
      ) : null}

      <div className="card">
        <div className="panel-title" style={{ marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Add New Company</h3>
            <p className="muted" style={{ margin: '3px 0 0', fontSize: '12.5px' }}>
              Enter the company name and optional logo.
            </p>
          </div>
        </div>

        <form className="stack" onSubmit={createDivision} style={{ gap: 16 }}>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <label className="field">
              <span>Company Name <strong style={{ color: 'var(--accent, #00b8db)' }}>*</strong></span>
              <input
                required
                placeholder="e.g. Alkidma Global"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Company Logo (Optional)</span>
              <input
                type="file"
                accept={LOGO_ACCEPT}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  try {
                    const dataUrl = await readLogoFileAsDataUrl(file);
                    setForm((prev) => ({ ...prev, logoUrl: dataUrl }));
                    setError('');
                  } catch (err) {
                    setError(err.message || 'Invalid logo file.');
                    setForm((prev) => ({ ...prev, logoUrl: '' }));
                  }
                }}
              />
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 4 }}>
            <button
              className="btn"
              type="submit"
              disabled={saving}
              style={{
                minWidth: 160,
                background: '#00b8db',
                color: '#ffffff',
                fontWeight: 600,
              }}
            >
              {saving ? 'Creating…' : 'Create Company'}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
