'use client';

import { useState } from 'react';
import AppShell from '../../../components/AppShell';
import { api } from '../../../lib/auth';

const emptyForm = () => ({
  code: '',
  name: '',
  payrollType: 'wps',
});

export default function CompanyManagementPage() {
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
      await api('/divisions', {
        method: 'POST',
        body: JSON.stringify({
          code: form.code.trim(),
          name: form.name.trim(),
          payrollType: form.payrollType,
        }),
      });
      setMsg(`Company "${form.name.trim()}" (${form.code.trim()}) created successfully.`);
      setForm(emptyForm());
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Company Management" subtitle="Register and configure GOCs companies">
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

      <div className="card" style={{ maxWidth: 720 }}>
        <div className="panel-title" style={{ marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Add New Company</h3>
            <p className="muted" style={{ margin: '3px 0 0', fontSize: '12.5px' }}>
              Enter the unique company code and registered business name.
            </p>
          </div>
        </div>

        <form className="stack" onSubmit={createDivision} style={{ gap: 16 }}>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <label className="field">
              <span>Company Code <strong style={{ color: 'var(--accent, #00b8db)' }}>*</strong></span>
              <input
                required
                placeholder="e.g. ALKIDMA"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                style={{ textTransform: 'uppercase' }}
              />
            </label>
            <label className="field">
              <span>Company Name <strong style={{ color: 'var(--accent, #00b8db)' }}>*</strong></span>
              <input
                required
                placeholder="e.g. Alkidma Global"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
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
