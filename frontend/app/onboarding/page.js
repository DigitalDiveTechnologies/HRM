'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api, getUser, normalizeRole } from '../../lib/auth';
import { formatDate, todayISO, v } from '../../lib/format';
import { useCompanyFilter } from '../../lib/useCompanyFilter';

export default function OnboardingPage() {
  const [user, setUser] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        return getUser();
      } catch {}
    }
    return null;
  });
  const role = normalizeRole(user);
  const isAdmin = role === 'admin';
  const { filteredEmpIds } = useCompanyFilter();

  const [employees, setEmployees] = useState([]);
  const [rows, setRows] = useState([]);

  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Form state for assigning device
  const [form, setForm] = useState({
    employeeId: '',
    category: 'Laptop',
    title: '',
    tagNo: '',
    dueDate: todayISO(),
  });

  const load = useCallback(async () => {
    setError('');
    try {
      const [onboardRes, empsRes] = await Promise.all([
        api('/onboarding'),
        api('/employees'),
      ]);
      setEmployees(empsRes || []);
      setRows(onboardRes || []);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    const u = getUser();
    if (u) setUser(u);
    load();
  }, [load]);

  async function handleAssignDevice(e) {
    e.preventDefault();
    if (!form.employeeId || !form.title.trim()) return;

    setError('');
    setMsg('');
    try {
      await api('/onboarding', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: Number(form.employeeId),
          title: form.title.trim(),
          category: form.category,
          dueDate: form.dueDate,
          tagNo: form.tagNo.trim() || null,
        }),
      });
      setMsg('Device / checklist item assigned.');
      setForm({
        employeeId: '',
        category: 'Laptop',
        title: '',
        tagNo: '',
        dueDate: todayISO(),
      });
      setShowAddForm(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function markDone(id) {
    setError('');
    try {
      await api(`/onboarding/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'done' }) });
      setMsg('Marked received / done.');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const s = String(v(r, 'status') || '').toLowerCase();
      const c = String(v(r, 'category') || '').toLowerCase();
      const name = String(v(r, 'fullName', 'full_name') || '').toLowerCase();
      const code = String(v(r, 'empCode', 'emp_code') || '').toLowerCase();
      const title = String(v(r, 'title') || '').toLowerCase();
      const tag = String(v(r, 'tagNo', 'tag_no') || '').toLowerCase();
      const q = searchQuery.toLowerCase();

      const matchStatus = !statusFilter || s === statusFilter.toLowerCase();
      const matchCategory = !categoryFilter || c === categoryFilter.toLowerCase();
      const matchSearch = !q || name.includes(q) || code.includes(q) || title.includes(q) || tag.includes(q);
      const matchCompany = !filteredEmpIds || filteredEmpIds.has(String(v(r, 'employeeId', 'employee_id') || ''));

      return matchStatus && matchCategory && matchSearch && matchCompany;
    });
  }, [rows, statusFilter, categoryFilter, searchQuery, filteredEmpIds]);

  // Statistics
  const totalTasks = rows.length;
  const pendingCount = rows.filter((r) => String(v(r, 'status')).toLowerCase() !== 'done').length;
  const completedCount = rows.filter((r) => String(v(r, 'status')).toLowerCase() === 'done').length;

  function getCategoryColor(cat) {
    const c = String(cat || '').toLowerCase();
    if (c === 'laptop') return { bg: 'rgba(0, 184, 219, 0.12)', color: '#008fa8', border: 'rgba(0, 184, 219, 0.3)' };
    if (c === 'phone') return { bg: 'rgba(168, 85, 247, 0.12)', color: '#7c3aed', border: 'rgba(168, 85, 247, 0.3)' };
    if (c === 'desktop pc' || c === 'desktop') return { bg: 'rgba(59, 130, 246, 0.12)', color: '#2563eb', border: 'rgba(59, 130, 246, 0.3)' };
    if (c === 'display' || c === 'monitor') return { bg: 'rgba(245, 158, 11, 0.12)', color: '#d97706', border: 'rgba(245, 158, 11, 0.3)' };
    if (c === 'access card' || c === 'sim') return { bg: 'rgba(16, 185, 129, 0.12)', color: '#059669', border: 'rgba(16, 185, 129, 0.3)' };
    return { bg: 'var(--surface-alt, #f1f5f9)', color: 'var(--ink, #0f172a)', border: 'var(--line, #cbd5e1)' };
  }

  return (
    <AppShell title="Onboarding" subtitle="Employee device allocation & hardware provisioning checklist">
      {error ? <div className="error" style={{ marginBottom: 14 }}>{error}</div> : null}
      {msg ? <div className="muted" style={{ marginBottom: 14, color: 'var(--ok, #10b981)', fontWeight: 600 }}>{msg}</div> : null}

      <div className="stack" style={{ gap: 20 }}>
        {/* =========================================================================
            1. TOP BAR: Summary Badges + Action Button
           ========================================================================= */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 14,
          }}
        >
          {/* Quick Metrics Badges */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div
              style={{
                background: 'var(--surface, #ffffff)',
                border: '1px solid var(--line, #e2e8f0)',
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: '12.5px',
                fontWeight: 600,
                color: 'var(--ink, #0f172a)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span className="muted" style={{ fontSize: '11.5px' }}>Total Devices:</span>
              <strong style={{ color: '#008fa8' }}>{totalTasks}</strong>
            </div>

            <div
              style={{
                background: 'var(--surface, #ffffff)',
                border: '1px solid var(--line, #e2e8f0)',
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: '12.5px',
                fontWeight: 600,
                color: 'var(--ink, #0f172a)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span className="muted" style={{ fontSize: '11.5px' }}>Pending Handover:</span>
              <strong style={{ color: '#f59e0b' }}>{pendingCount}</strong>
            </div>

            <div
              style={{
                background: 'var(--surface, #ffffff)',
                border: '1px solid var(--line, #e2e8f0)',
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: '12.5px',
                fontWeight: 600,
                color: 'var(--ink, #0f172a)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span className="muted" style={{ fontSize: '11.5px' }}>Received / Signed:</span>
              <strong style={{ color: '#10b981' }}>{completedCount}</strong>
            </div>
          </div>

          {/* Action Button */}
          <div>
            <button
              type="button"
              className="btn"
              onClick={() => setShowAddForm((prev) => !prev)}
              style={{
                background: showAddForm ? 'var(--surface-alt, #f1f5f9)' : '#00b8db',
                color: showAddForm ? 'var(--ink, #0f172a)' : '#ffffff',
                fontWeight: 600,
                fontSize: '12.5px',
                borderRadius: 8,
                padding: '8px 16px',
                border: showAddForm ? '1px solid var(--line, #cbd5e1)' : 'none',
              }}
            >
              {showAddForm ? '✕ Close Form' : '+ Assign Device'}
            </button>
          </div>
        </div>

        {/* =========================================================================
            2. ASSIGN DEVICE FORM (Clean Collapsible Card)
           ========================================================================= */}
        {showAddForm ? (
          <div className="card" style={{ padding: '22px', borderRadius: 12, border: '1px solid #00b8db' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '15.5px', fontWeight: 700, color: 'var(--ink)' }}>
              Assign Onboarding Device to Employee
            </h3>
            <form onSubmit={handleAssignDevice} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <label className="field">
                <span>Select Employee</span>
                <select
                  required
                  value={form.employeeId}
                  onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
                >
                  <option value="">Choose Employee…</option>
                  {employees.map((e) => (
                    <option key={v(e, 'id')} value={v(e, 'id')}>
                      {v(e, 'fullName', 'full_name')} ({v(e, 'empCode', 'emp_code')})
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Device Category</span>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  <option value="Laptop">Laptop / MacBook</option>
                  <option value="Phone">Corporate Mobile / SIM</option>
                  <option value="Desktop PC">Desktop PC</option>
                  <option value="Display">Monitor / Display</option>
                  <option value="Access Card">Office Access Keycard</option>
                </select>
              </label>

              <label className="field">
                <span>Device Name & Model</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. MacBook Pro 14 M3 / Dell Latitude"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </label>

              <label className="field">
                <span>Asset Tag / Serial No.</span>
                <input
                  type="text"
                  placeholder="e.g. DD-LT-105"
                  value={form.tagNo}
                  onChange={(e) => setForm((f) => ({ ...f, tagNo: e.target.value }))}
                />
              </label>

              <label className="field">
                <span>Handover Due Date</span>
                <input
                  type="date"
                  required
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, gridColumn: '1 / -1' }}>
                <button
                  type="submit"
                  className="btn"
                  style={{
                    background: '#00b8db',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '13px',
                    padding: '9px 18px',
                    borderRadius: 8,
                    height: '38px',
                  }}
                >
                  Confirm Assignment
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setShowAddForm(false)}
                  style={{ height: '38px', borderRadius: 8 }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {/* =========================================================================
            3. ONBOARDING DEVICES TABLE (White Card, Dark Mode Compatible)
           ========================================================================= */}
        <div className="card" style={{ padding: '20px', borderRadius: 14 }}>
          {/* Filter Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Search Bar */}
              <input
                type="text"
                placeholder="Search employee, device or tag…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '7px 12px',
                  fontSize: '12.5px',
                  borderRadius: 8,
                  border: '1px solid var(--line, #cbd5e1)',
                  background: 'var(--surface-alt, #f8fafc)',
                  color: 'var(--ink, #0f172a)',
                  width: '240px',
                  outline: 'none',
                }}
              />

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: '7px 12px',
                  fontSize: '12.5px',
                  borderRadius: 8,
                  border: '1px solid var(--line, #cbd5e1)',
                  background: 'var(--surface, #ffffff)',
                  color: 'var(--ink, #0f172a)',
                  outline: 'none',
                }}
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending Handover</option>
                <option value="done">Received / Signed</option>
              </select>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{
                  padding: '7px 12px',
                  fontSize: '12.5px',
                  borderRadius: 8,
                  border: '1px solid var(--line, #cbd5e1)',
                  background: 'var(--surface, #ffffff)',
                  color: 'var(--ink, #0f172a)',
                  outline: 'none',
                }}
              >
                <option value="">All Devices</option>
                <option value="laptop">Laptop / MacBook</option>
                <option value="phone">Corporate Phone</option>
                <option value="desktop pc">Desktop PC</option>
                <option value="display">Display / Monitor</option>
                <option value="access card">Access Card</option>
              </select>
            </div>

            <div className="muted" style={{ fontSize: '12px' }}>
              Showing {filteredRows.length} of {totalTasks} devices
            </div>
          </div>

          {/* Table Container */}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Device / Asset</th>
                  <th>Category</th>
                  <th>Tag / Serial</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((t) => {
                  const isDone = String(v(t, 'status')).toLowerCase() === 'done';
                  const catStyle = getCategoryColor(v(t, 'category'));
                  return (
                    <tr key={v(t, 'id')}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{v(t, 'fullName', 'full_name')}</div>
                        <div className="muted" style={{ fontSize: '11px' }}>{v(t, 'empCode', 'emp_code')}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{v(t, 'title')}</div>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '11.5px',
                            fontWeight: 700,
                            padding: '3px 9px',
                            borderRadius: 6,
                            background: catStyle.bg,
                            color: catStyle.color,
                            border: `1px solid ${catStyle.border}`,
                            display: 'inline-block',
                          }}
                        >
                          {v(t, 'category') || 'Device'}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            color: 'var(--muted)',
                            background: 'var(--surface-alt)',
                            padding: '2px 7px',
                            borderRadius: 4,
                          }}
                        >
                          {v(t, 'tagNo', 'tag_no') || '—'}
                        </span>
                      </td>
                      <td>{formatDate(v(t, 'dueDate', 'due_date'))}</td>
                      <td>
                        <Badge status={isDone ? 'done' : 'pending'} />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {!isDone ? (
                          <button
                            type="button"
                            className="btn ok"
                            onClick={() => markDone(v(t, 'id'))}
                            style={{ padding: '4px 10px', fontSize: '11.5px', borderRadius: 6 }}
                          >
                            Mark Handover
                          </button>
                        ) : (
                          <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--ok, #10b981)' }}>
                            ✓ Acknowledged
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted" style={{ textAlign: 'center', padding: '32px 0' }}>
                      No device onboarding records matching current filter.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
