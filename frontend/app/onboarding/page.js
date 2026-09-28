'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api, getUser, getPermissions, normalizeRole } from '../../lib/auth';
import { canUsePermission } from '../../lib/nav';
import { formatDate, todayISO, v } from '../../lib/format';
import { useCompanyFilter } from '../../lib/useCompanyFilter';
import { getInstantEmployees, loadEmployeesFast } from '../../lib/employeeCache';
import { fetchOnboardingDirect } from '../../lib/dbDirect';

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
  const permissions = getPermissions(user);
  const canManage = canUsePermission(role, permissions, 'onboarding.view');
  const { filteredEmpIds } = useCompanyFilter();

  const [employees, setEmployees] = useState(() => getInstantEmployees());
  const [rows, setRows] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('gocs_cached_onboarding');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return [];
  });

  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Device categories state
  const [deviceCategories, setDeviceCategories] = useState([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState('');

  // Form state for assigning device
  const [form, setForm] = useState({
    employeeId: '',
    category: '',
    title: '',
    tagNo: '',
    dueDate: todayISO(),
  });

  const loadCategories = useCallback(async () => {
    try {
      const cats = await api('/onboarding/categories');
      if (Array.isArray(cats)) {
        setDeviceCategories(cats);
        return cats;
      }
    } catch {}
    return [];
  }, []);

  async function handleAddCategory(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!newCatName.trim()) return;
    setCatSaving(true);
    setCatError('');
    try {
      const res = await api('/onboarding/categories', {
        method: 'POST',
        body: JSON.stringify({ name: newCatName.trim() }),
      });
      setNewCatName('');
      const updatedCats = await loadCategories();
      const addedName = res?.name || newCatName.trim();
      setForm((f) => ({ ...f, category: f.category || addedName }));
    } catch (err) {
      setCatError(err.message || 'Failed to add category.');
    } finally {
      setCatSaving(false);
    }
  }

  async function handleDeleteCategory(catId, catName) {
    setCatSaving(true);
    setCatError('');
    try {
      await api(`/onboarding/categories/${catId}`, { method: 'DELETE' });
      await loadCategories();
      setForm((f) => (f.category === catName ? { ...f, category: '' } : f));
    } catch (err) {
      setCatError(err.message || 'Failed to delete category.');
    } finally {
      setCatSaving(false);
    }
  }

  const load = useCallback(() => {
    setError('');

    // Instant & fast background employee sync
    loadEmployeesFast(setEmployees);

    // Load categories
    loadCategories();

    // Direct DB fetch for onboarding records (<150ms)
    fetchOnboardingDirect().then((directTasks) => {
      if (Array.isArray(directTasks) && directTasks.length > 0) {
        setRows(directTasks);
        try {
          localStorage.setItem('gocs_cached_onboarding', JSON.stringify(directTasks));
        } catch {}
      }
    }).catch(() => {});

    // Backend endpoint sync
    api('/onboarding')
      .then((onboardRes) => {
        if (Array.isArray(onboardRes)) {
          setRows(onboardRes);
          try {
            localStorage.setItem('gocs_cached_onboarding', JSON.stringify(onboardRes));
          } catch {}
        }
      })
      .catch((e) => setError(e.message));
  }, [loadCategories]);

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
        category: '',
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
    const list = rows.filter((r) => {
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

    // Latest assignments on top (newest created_at or highest id first)
    return list.sort((a, b) => {
      const dateA = new Date(v(a, 'createdAt', 'created_at') || 0).getTime();
      const dateB = new Date(v(b, 'createdAt', 'created_at') || 0).getTime();
      if (dateA && dateB && dateA !== dateB) return dateB - dateA;
      const idA = Number(v(a, 'id') || 0);
      const idB = Number(v(b, 'id') || 0);
      return idB - idA;
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
          {canManage ? (
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
          ) : null}
        </div>

        {/* =========================================================================
            2. ASSIGN DEVICE FORM (Clean Collapsible Card)
           ========================================================================= */}
        {canManage && showAddForm ? (
          <div className="card" style={{ padding: '22px', borderRadius: 12, border: '1px solid #00b8db' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 700, color: 'var(--ink)' }}>
                Assign Onboarding Device to Employee
              </h3>
              <button
                type="button"
                className="btn secondary"
                onClick={() => { setCatError(''); setShowCategoryModal(true); }}
                style={{ fontSize: '12px', padding: '5px 12px', borderRadius: 6, fontWeight: 600 }}
              >
                ⚙ Manage Categories
              </button>
            </div>
            <form onSubmit={handleAssignDevice} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <label className="field">
                <span>Select Employee</span>
                <select
                  required
                  value={form.employeeId}
                  onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
                >
                  <option value="">Choose Employee…</option>
                  {employees.filter(e => !filteredEmpIds || filteredEmpIds.has(String(v(e, 'id')))).map((e) => (
                    <option key={v(e, 'id')} value={v(e, 'id')}>
                      {v(e, 'fullName', 'full_name')} ({v(e, 'empCode', 'emp_code')})
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Device Category</span>
                  <button
                    type="button"
                    onClick={() => { setCatError(''); setShowCategoryModal(true); }}
                    style={{ background: 'none', border: 'none', color: '#00b8db', fontSize: '11px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                  >
                    + Add / Manage
                  </button>
                </div>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  <option value="">{deviceCategories.length ? 'Choose Category…' : 'No categories yet — click + Add'}</option>
                  {deviceCategories.map((c) => (
                    <option key={v(c, 'id')} value={v(c, 'name')}>
                      {v(c, 'name')}
                    </option>
                  ))}
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
                <option value="">All Categories</option>
                {deviceCategories.map((c) => (
                  <option key={v(c, 'id')} value={String(v(c, 'name')).toLowerCase()}>
                    {v(c, 'name')}
                  </option>
                ))}
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
                        {!isDone && canManage ? (
                          <button
                            type="button"
                            className="btn ok"
                            onClick={() => markDone(v(t, 'id'))}
                            style={{ padding: '4px 10px', fontSize: '11.5px', borderRadius: 6 }}
                          >
                            Mark Handover
                          </button>
                        ) : !isDone ? (
                          <span className="muted" style={{ fontSize: '11.5px' }}>Pending</span>
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

      {/* =========================================================================
          4. MANAGE CATEGORIES MODAL (Add & Delete Dynamic Categories)
         ========================================================================= */}
      {showCategoryModal ? (
        <>
          <div
            className="backdrop show"
            onClick={() => setShowCategoryModal(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="manage-cat-title"
            style={{
              position: 'fixed',
              left: '50%',
              top: '18%',
              transform: 'translateX(-50%)',
              zIndex: 60,
              width: 'min(460px, calc(100vw - 32px))',
              background: 'var(--card, #fff)',
              border: '1px solid var(--border, #d7e3ef)',
              borderRadius: 14,
              boxShadow: '0 20px 50px rgba(2, 11, 31, 0.25)',
              padding: '24px 26px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 id="manage-cat-title" style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>
                Manage Device Categories
              </h3>
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--muted)' }}
              >
                ✕
              </button>
            </div>

            <p className="muted" style={{ fontSize: '12.5px', margin: '0 0 16px' }}>
              Add custom device categories or delete existing ones. Changes appear in the assignment dropdown immediately.
            </p>

            {catError ? (
              <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: 6, fontSize: '12.5px', marginBottom: 12 }}>
                {catError}
              </div>
            ) : null}

            {/* Add Category Input & Button */}
            <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
              <input
                type="text"
                placeholder="Category name (e.g. Laptop, Phone, SIM Card)"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--line, #cbd5e1)',
                  background: 'var(--surface, #fff)',
                  color: 'var(--ink)',
                  fontSize: '13px',
                }}
              />
              <button
                type="submit"
                className="btn"
                disabled={catSaving || !newCatName.trim()}
                style={{
                  background: '#00b8db',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '13px',
                  borderRadius: 8,
                  padding: '8px 16px',
                  whiteSpace: 'nowrap',
                }}
              >
                + Add
              </button>
            </form>

            {/* Existing Categories List */}
            <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--line, #e2e8f0)', borderRadius: 8, padding: '6px' }}>
              {deviceCategories.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--muted)', fontSize: '13px' }}>
                  No categories added yet. Type a name above and click <strong>+ Add</strong>!
                </div>
              ) : (
                deviceCategories.map((cat) => (
                  <div
                    key={v(cat, 'id')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 6,
                      background: 'var(--surface-alt, #f8fafc)',
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--ink)' }}>
                      {v(cat, 'name')}
                    </span>
                    <button
                      type="button"
                      disabled={catSaving}
                      onClick={() => handleDeleteCategory(v(cat, 'id'), v(cat, 'name'))}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        fontSize: '12px',
                        fontWeight: 600,
                        borderRadius: 4,
                      }}
                      title="Delete category"
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>

            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setShowCategoryModal(false)}
                style={{ padding: '8px 18px', borderRadius: 8, fontSize: '13px', fontWeight: 600 }}
              >
                Done
              </button>
            </div>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
