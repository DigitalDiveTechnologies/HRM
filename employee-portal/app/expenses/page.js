'use client';

import { useEffect, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { api, session, value } from '@/lib/api';

export default function ExpensesPage() {
  const [form, setForm] = useState({
    title: '',
    category: 'general',
    amount: '',
    expenseDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [receipt, setReceipt] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const employeeId = session.get()?.user?.employeeId;
      const rows = await api('/travel/expenses');
      const list = (Array.isArray(rows) ? rows : []).filter(
        (x) => String(value(x, 'employeeId', 'employee_id')) === String(employeeId)
      );
      setExpenses(list);
    } catch (e) {
      setError(e.message || 'Failed to load expense claims.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      let uploaded = null;
      if (receipt) {
        const fd = new FormData();
        fd.append('file', receipt);
        uploaded = await api('/travel/expenses/upload-receipt', { method: 'POST', body: fd });
      }

      await api('/travel/expenses', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: session.get()?.user?.employeeId,
          ...form,
          amount: Number(form.amount),
          currency: 'AED',
          receiptFileRef: uploaded?.fileRef,
          receiptFileName: uploaded?.fileName,
        }),
      });

      setForm({
        title: '',
        category: 'general',
        amount: '',
        expenseDate: new Date().toISOString().slice(0, 10),
        notes: '',
      });
      setReceipt(null);
      const fileInput = document.getElementById('expense-receipt');
      if (fileInput) fileInput.value = '';
      setMessage('Your expense claim was submitted successfully and sent to your manager for approval.');
      await load();
    } catch (e) {
      setError(e.message || 'Failed to submit expense claim.');
    } finally {
      setSaving(false);
    }
  }

  const getStatusBadgeClass = (status) => {
    const s = String(status || '').toLowerCase();
    if (s.includes('approv') || s.includes('paid')) return 'status-pill active';
    if (s.includes('reject') || s.includes('declin')) return 'status-pill rejected';
    return 'status-pill pending';
  };

  return (
    <PortalShell
      title="Expense Claims"
      subtitle="Submit an out-of-pocket business expense claim with receipt for manager review"
    >
      {message && <div className="success-box">{message}</div>}
      {error && <div className="error-box">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24, alignItems: 'start' }}>
        {/* New Expense Claim Form */}
        <div className="panel-card" style={{ padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, borderBottom: '1px solid var(--line)', paddingBottom: 14 }}>
            <span style={{ fontSize: 22 }}>🧾</span>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>
                New Expense Claim
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                Attach proof of purchase for reimbursement
              </p>
            </div>
          </div>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-field">
              <label>Purchase Title / Description *</label>
              <input
                type="text"
                required
                placeholder="e.g. Client lunch meeting, Taxi to Abu Dhabi"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-field">
                <label>Category *</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  <option value="general">General Expense</option>
                  <option value="travel">Travel & Transport</option>
                  <option value="office">Office Supplies</option>
                  <option value="client">Client Entertainment</option>
                  <option value="training">Training & Certification</option>
                </select>
              </div>

              <div className="form-field">
                <label>Amount (AED) *</label>
                <input
                  required
                  min="0.01"
                  step="0.01"
                  type="number"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
            </div>

            <div className="form-field">
              <label>Date of Purchase *</label>
              <input
                required
                type="date"
                value={form.expenseDate}
                onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
              />
            </div>

            <div className="form-field">
              <label>Invoice or Receipt Document *</label>
              <div
                style={{
                  border: '2px dashed var(--line)',
                  borderRadius: 8,
                  padding: '16px',
                  textAlign: 'center',
                  background: 'var(--bg)',
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                <input
                  id="expense-receipt"
                  required
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => setReceipt(e.target.files?.[0] || null)}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0,
                    cursor: 'pointer',
                    width: '100%',
                    height: '100%',
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#00b8db' }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                    {receipt ? receipt.name : 'Click to upload receipt or invoice'}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                    PDF, PNG, JPG, or WEBP (Max 20 MB)
                  </span>
                </div>
              </div>
            </div>

            <div className="form-field">
              <label>Business Purpose / Notes</label>
              <textarea
                rows={3}
                placeholder="Brief justification or project billing code…"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: 14,
                display: 'inline-flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {saving ? 'Submitting Claim…' : 'Submit for Manager Approval →'}
            </button>
          </form>
        </div>

        {/* Claims History */}
        <div className="panel-card" style={{ padding: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid var(--line)', paddingBottom: 14 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>
                My Expense Claims
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                Track approval status & reimbursement logs
              </p>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#00b8db', background: 'rgba(0, 184, 219, 0.1)', padding: '3px 10px', borderRadius: 999 }}>
              {expenses.length} claims
            </span>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>
              Loading your claims…
            </div>
          ) : expenses.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M3 7h18v14H3z" />
                  <path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
                  <path d="M3 12h18" />
                </svg>
              </div>
              <p className="empty-state-text">No expense claims filed yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {expenses.map((x) => {
                const amt = Number(x.amount || 0).toFixed(2);
                const dt = x.expenseDate || x.expense_date || '—';
                const st = x.status || 'Pending Review';
                return (
                  <div
                    key={x.id}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 12,
                      border: '1px solid var(--line)',
                      background: 'var(--surface-alt, #fafafa)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 14,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
                        {x.title}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>
                        Date: {dt} · Category: <span style={{ textTransform: 'capitalize' }}>{x.category || 'General'}</span>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>
                        AED {amt}
                      </div>
                      <span className={getStatusBadgeClass(st)}>
                        {st}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PortalShell>
  );
}
