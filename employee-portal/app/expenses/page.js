'use client';

import { useEffect, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { api, session, value } from '@/lib/api';

export default function ExpensesPage() {
  const [form, setForm] = useState({ title: '', category: 'general', amount: '', expenseDate: '', notes: '' });
  const [receipt, setReceipt] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const employeeId = session.get()?.user?.employeeId;
    const rows = await api('/travel/expenses');
    setExpenses((Array.isArray(rows) ? rows : []).filter((x) => String(value(x, 'employeeId', 'employee_id')) === String(employeeId)));
  }

  useEffect(() => { load().catch((e) => setError(e.message)); }, []);

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setError(''); setMessage('');
    try {
      let uploaded = null;
      if (receipt) {
        const fd = new FormData(); fd.append('file', receipt);
        uploaded = await api('/travel/expenses/upload-receipt', { method: 'POST', body: fd });
      }
      await api('/travel/expenses', { method: 'POST', body: JSON.stringify({
        employeeId: session.get()?.user?.employeeId,
        ...form, amount: Number(form.amount), currency: 'AED',
        receiptFileRef: uploaded?.fileRef, receiptFileName: uploaded?.fileName,
      }) });
      setForm({ title: '', category: 'general', amount: '', expenseDate: '', notes: '' });
      setReceipt(null); document.getElementById('expense-receipt').value = '';
      setMessage('Expense submitted to your line manager for approval.');
      await load();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return <PortalShell title="Expenses" subtitle="Submit an expense claim with its invoice or receipt.">
    {message && <div className="success-box" style={{ marginBottom: 16 }}>{message}</div>}
    {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 500px) 1fr', gap: 20, alignItems: 'start' }}>
      <form className="panel-card" onSubmit={submit} style={{ padding: 24, display: 'grid', gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>New expense claim</h2>
        <label>What did you purchase? <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
        <label>Category <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option value="general">General</option><option value="travel">Travel</option><option value="office">Office</option><option value="client">Client</option></select></label>
        <label>Amount (AED) <input required min="0.01" step="0.01" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
        <label>Purchase date <input type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} /></label>
        <label>Invoice / receipt <input id="expense-receipt" required type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => setReceipt(e.target.files?.[0] || null)} /></label>
        <small style={{ color: 'var(--muted)' }}>PDF, PNG, JPG, JPEG or WEBP · maximum 20 MB</small>
        <label>Notes <textarea rows="3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
        <button type="submit" disabled={saving}>{saving ? 'Submitting…' : 'Submit for manager approval'}</button>
      </form>
      <div className="panel-card" style={{ padding: 24 }}><h2 style={{ margin: '0 0 16px', fontSize: 18 }}>My claims</h2>
        {expenses.length === 0 ? <p style={{ color: 'var(--muted)' }}>No expense claims yet.</p> : expenses.map((x) => <div key={x.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', gap: 12 }}><span><strong>{x.title}</strong><br /><small>{x.expenseDate || x.expense_date}</small></span><span style={{ textAlign: 'right' }}>AED {Number(x.amount || 0).toFixed(2)}<br /><small>{x.status}</small></span></div>)}
      </div>
    </div>
  </PortalShell>;
}
