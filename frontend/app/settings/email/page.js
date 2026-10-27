'use client';

import { useEffect, useState } from 'react';
import AppShell from '../../../components/AppShell';
import { api, getUser, normalizeRole } from '../../../lib/auth';

export default function EmailSettingsPage() {
  const user = typeof window !== 'undefined' ? getUser() : null;
  const role = normalizeRole(user);
  const isAdmin = role === 'admin' || role === 'super_admin';

  const [form, setForm] = useState({
    host: 'smtp.gmail.com',
    port: 587,
    username: '',
    password: '',
    fromEmail: '',
    fromName: 'GOCs HR',
    useTls: true,
    isActive: true,
  });

  const [hasPassword, setHasPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [source, setSource] = useState('appsettings');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        const res = await api('/settings/email');
        if (res) {
          setForm({
            host: res.host || 'smtp.gmail.com',
            port: res.port || 587,
            username: res.username || '',
            password: res.password || '',
            fromEmail: res.fromEmail || '',
            fromName: res.fromName || 'GOCs HR',
            useTls: res.useTls !== false,
            isActive: !!res.isActive,
          });
          setHasPassword(!!res.hasPassword);
          setSource(res.source || 'appsettings');
          if (user?.email) {
            setTestEmail(user.email);
          }
        }
      } catch (err) {
        setMessage({ type: 'error', text: err.message || 'Failed to load email settings.' });
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handlePresetSelect = (preset) => {
    if (preset === 'gmail') {
      setForm((prev) => ({
        ...prev,
        host: 'smtp.gmail.com',
        port: 587,
        useTls: true,
      }));
    } else if (preset === 'office365') {
      setForm((prev) => ({
        ...prev,
        host: 'smtp.office365.com',
        port: 587,
        useTls: true,
      }));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      await api('/settings/email', {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      setMessage({ type: 'success', text: 'Email SMTP credentials saved and activated successfully in the database!' });
      setSource('database');
      setHasPassword(true);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to save email settings.' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async () => {
    if (!testEmail.trim()) {
      setMessage({ type: 'error', text: 'Please enter a recipient email address for testing.' });
      return;
    }
    setTesting(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await api('/settings/email/test', {
        method: 'POST',
        body: JSON.stringify({ toEmail: testEmail.trim() }),
      });
      setMessage({ type: 'success', text: res.message || `Test email dispatched successfully to ${testEmail}!` });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'SMTP test failed. Please verify credentials or App Password.' });
    } finally {
      setTesting(false);
    }
  };

  if (!isAdmin) {
    return (
      <AppShell title="Email Architecture" subtitle="System SMTP Configuration">
        <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontWeight: 600 }}>
          Access Restricted: Only Super Admins and HR Administrators can configure system email credentials.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Email Architecture & SMTP Settings" subtitle="Configure automated welcome email credentials, Google App Passwords, and Office 365 dispatch">
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        
        {/* Banner notification */}
        {message.text && (
          <div
            style={{
              padding: '14px 20px',
              borderRadius: 10,
              fontSize: '13.5px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: message.type === 'success' ? '#ecfdf5' : '#fef2f2',
              color: message.type === 'success' ? '#065f46' : '#991b1b',
              border: `1px solid ${message.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
            }}
          >
            <span>{message.type === 'success' ? '✓' : '⚠️'}</span>
            <span>{message.text}</span>
          </div>
        )}

        {/* Quick presets & Status header */}
        <div
          style={{
            background: 'var(--surface, #ffffff)',
            border: '1px solid var(--line, #e2e8f0)',
            borderRadius: 14,
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#00b8db', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Active Email Engine
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: form.isActive ? '#ecfdf5' : '#fffbeb',
                  color: form.isActive ? '#059669' : '#d97706',
                  border: `1px solid ${form.isActive ? '#a7f3d0' : '#fde68a'}`,
                }}
              >
                {form.isActive ? '● Live Dispatch Active' : '○ Standby / Test Mode'}
              </span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                (Config source: <strong>{source}</strong>)
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
              Used for <strong>Automated Welcome Emails</strong> to new hires, leave notifications, and password reset dispatches.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => handlePresetSelect('gmail')}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                background: form.host.includes('gmail') ? 'rgba(0, 184, 219, 0.1)' : '#ffffff',
                color: form.host.includes('gmail') ? '#0284c7' : '#475569',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>🔴</span> Google Workspace / Gmail
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect('office365')}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                background: form.host.includes('office365') ? 'rgba(0, 184, 219, 0.1)' : '#ffffff',
                color: form.host.includes('office365') ? '#0284c7' : '#475569',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>🔷</span> Microsoft Office 365
            </button>
          </div>
        </div>

        {/* Configuration Form */}
        <form
          onSubmit={handleSave}
          style={{
            background: 'var(--surface, #ffffff)',
            border: '1px solid var(--line, #e2e8f0)',
            borderRadius: 14,
            padding: '24px 28px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <h3 style={{ margin: '0 0 18px 0', fontSize: '16px', fontWeight: 700, color: 'var(--ink, #101828)' }}>
            Mail Server Connection Settings
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                SMTP Server Host <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                required
                value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })}
                placeholder="smtp.gmail.com or smtp.office365.com"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '13.5px' }}
              />
              <span style={{ fontSize: '11px', color: '#64748b', marginTop: 4, display: 'block' }}>
                Default: <code>smtp.gmail.com</code> (Port 587) or <code>smtp.office365.com</code>
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Port Number <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="number"
                required
                value={form.port}
                onChange={(e) => setForm({ ...form, port: parseInt(e.target.value, 10) || 587 })}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '13.5px' }}
              />
              <span style={{ fontSize: '11px', color: '#64748b', marginTop: 4, display: 'block' }}>
                Standard TLS: <strong>587</strong> | SSL: <strong>465</strong> | Plain: <strong>25</strong>
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Username / Authenticating Mailbox <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                required
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="hr@yourcompany.ae"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '13.5px' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>
                  Password or Google App Password <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ background: 'transparent', border: 'none', color: '#0284c7', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {showPassword ? 'Hide' : 'Reveal'}
                </button>
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={hasPassword ? '•••••••• (Leave blank to keep existing)' : 'Enter password or 16-character App Password'}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '13.5px' }}
              />
              <span style={{ fontSize: '11px', color: '#64748b', marginTop: 4, display: 'block' }}>
                For Gmail: Use a 16-character <strong>App Password</strong> generated under Google Account &rarr; Security &rarr; 2-Step Verification.
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18, marginBottom: 24 }}>
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Sender From Email
              </label>
              <input
                type="email"
                value={form.fromEmail}
                onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
                placeholder="no-reply@gocs.ae (Defaults to Username)"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '13.5px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Sender Display Name
              </label>
              <input
                type="text"
                value={form.fromName}
                onChange={(e) => setForm({ ...form, fromName: e.target.value })}
                placeholder="GOCs HR Department"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '13.5px' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 24, padding: '14px 18px', background: 'var(--surface-alt, #f8fafc)', borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 24, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '13px', color: '#1e293b', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.useTls}
                onChange={(e) => setForm({ ...form, useTls: e.target.checked })}
                style={{ width: 18, height: 18 }}
              />
              <strong>Enable TLS / STARTTLS Encryption (Recommended)</strong>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '13px', color: '#1e293b', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                style={{ width: 18, height: 18 }}
              />
              <strong>Enable Live Email Delivery</strong>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                background: 'linear-gradient(135deg, #00b8db, #0284c7)',
                color: '#ffffff',
                border: 'none',
                padding: '11px 28px',
                borderRadius: 8,
                fontSize: '13.5px',
                fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(0, 184, 219, 0.25)',
              }}
            >
              {saving ? 'Saving Credentials...' : 'Save & Activate Email Settings'}
            </button>
          </div>
        </form>

        {/* Live Test Console */}
        <div
          style={{
            background: 'var(--surface, #ffffff)',
            border: '1px solid var(--line, #e2e8f0)',
            borderRadius: 14,
            padding: '24px 28px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700, color: 'var(--ink, #101828)' }}>
            Live SMTP Diagnostics & Test Dispatch
          </h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
            Verify end-to-end socket handshake and authentication by sending an official test email to any inbox.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="recipient@example.com"
              style={{ flex: 1, minWidth: 260, padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '13.5px' }}
            />
            <button
              type="button"
              onClick={handleTestSend}
              disabled={testing || !form.username}
              style={{
                background: '#10b981',
                color: '#ffffff',
                border: 'none',
                padding: '10px 24px',
                borderRadius: 8,
                fontSize: '13px',
                fontWeight: 700,
                cursor: testing || !form.username ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {testing ? 'Sending Test...' : 'Send Live Test Email ✈️'}
            </button>
          </div>
        </div>

      </div>
    </AppShell>
  );
}
