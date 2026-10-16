'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api, getUser, getPermissions, normalizeRole } from '../../lib/auth';
import { canUsePermission } from '../../lib/nav';
import { formatDate } from '../../lib/format';

const CATEGORIES = ['General', 'Policy', 'Wellness', 'Celebration', 'Urgent', 'Holiday'];

function getCategoryColor(cat) {
  const raw = String(cat || '').toLowerCase().trim();
  if (raw.includes('holiday')) return { bg: '#eff6ff', text: '#2563eb', border: 'rgba(37,99,235,0.2)' };
  if (raw.includes('wellness') || raw.includes('health') || raw.includes('medical')) return { bg: '#ecfdf5', text: '#059669', border: 'rgba(5,150,105,0.2)' };
  if (raw.includes('policy') || raw.includes('rule') || raw.includes('notice')) return { bg: '#fffbeb', text: '#d97706', border: 'rgba(217,119,6,0.2)' };
  if (raw.includes('event') || raw.includes('party') || raw.includes('celebrat')) return { bg: '#f5f3ff', text: '#7c3aed', border: 'rgba(124,58,237,0.2)' };
  if (raw.includes('urgent') || raw.includes('alert') || raw.includes('warning')) return { bg: '#fef2f2', text: '#dc2626', border: 'rgba(220,38,38,0.2)' };
  return { bg: '#e0f2fe', text: '#0284c7', border: 'rgba(2,132,199,0.2)' };
}

function getPriorityColor(priority) {
  const p = String(priority || '').toLowerCase();
  if (p === 'urgent') return { bg: '#fef2f2', text: '#dc2626', label: 'Urgent' };
  if (p === 'important') return { bg: '#fffbeb', text: '#d97706', label: 'Important' };
  return { bg: '#f1f5f9', text: '#475569', label: 'Normal' };
}

export default function AnnouncementsPage() {
  const role = normalizeRole(getUser());
  const permissions = getPermissions(getUser());
  const canManage = role === 'admin' || role === 'super_admin' || canUsePermission(role, permissions, 'dashboard.view');

  const [announcements, setAnnouncements] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [ackFilter, setAckFilter] = useState('ALL');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [complianceModalItem, setComplianceModalItem] = useState(null);
  const [complianceData, setComplianceData] = useState(null);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceTab, setComplianceTab] = useState('acknowledged'); // 'acknowledged' | 'pending'

  // Form state
  const [form, setForm] = useState({
    title: '',
    category: 'General',
    priority: 'normal',
    audienceType: 'all',
    divisionId: '',
    departmentId: '',
    requiresAck: false,
    isPinned: false,
    expiresAt: '',
    bodyHtml: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Initial loader
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [annRes, divRes, deptRes] = await Promise.all([
        api('/announcements?all=true').catch(() => []),
        api('/divisions').catch(() => []),
        api('/departments').catch(() => []),
      ]);
      setAnnouncements(Array.isArray(annRes) ? annRes : []);
      setDivisions(Array.isArray(divRes) ? divRes : []);
      setDepartments(Array.isArray(deptRes) ? deptRes : []);
    } catch (err) {
      console.error('Error loading announcements:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Create Modal
  function handleOpenCreate() {
    setEditingItem(null);
    setForm({
      title: '',
      category: 'General',
      priority: 'normal',
      audienceType: 'all',
      divisionId: '',
      departmentId: '',
      requiresAck: false,
      isPinned: false,
      expiresAt: '',
      bodyHtml: '',
    });
    setErrorMsg('');
    setCreateModalOpen(true);
  }

  // Open Edit Modal
  function handleOpenEdit(item) {
    setEditingItem(item);
    setForm({
      title: item.title || '',
      category: item.category || 'General',
      priority: item.priority || 'normal',
      audienceType: item.audienceType || item.audience_type || 'all',
      divisionId: item.divisionId || item.division_id || '',
      departmentId: item.departmentId || item.department_id || '',
      requiresAck: Boolean(item.requiresAck || item.requires_ack),
      isPinned: Boolean(item.isPinned || item.is_pinned),
      expiresAt: item.expiresAt || item.expires_at ? String(item.expiresAt || item.expires_at).slice(0, 10) : '',
      bodyHtml: item.bodyHtml || item.body_html || item.content || item.desc || '',
    });
    setErrorMsg('');
    setCreateModalOpen(true);
  }

  // Submit Create or Edit
  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setErrorMsg('Announcement title is required.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const payload = {
        title: form.title.trim(),
        category: form.category,
        priority: form.priority,
        audienceType: form.audienceType,
        divisionId: form.divisionId ? parseInt(form.divisionId, 10) : null,
        departmentId: form.departmentId ? parseInt(form.departmentId, 10) : null,
        requiresAck: form.requiresAck,
        isPinned: form.isPinned,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        bodyHtml: form.bodyHtml.trim(),
        content: form.bodyHtml.trim(),
      };

      if (editingItem?.id) {
        await api(`/announcements/${editingItem.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setSuccessMsg(`Announcement #${editingItem.id} successfully updated.`);
      } else {
        await api('/announcements', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSuccessMsg('Announcement successfully published and broadcasted.');
      }

      setCreateModalOpen(false);
      await loadData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Operation failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // Delete Announcement
  async function handleDelete(item) {
    if (!window.confirm(`Are you sure you want to delete "${item.title}"? This will also remove associated read receipts.`)) {
      return;
    }

    try {
      await api(`/announcements/${item.id}`, { method: 'DELETE' });
      setSuccessMsg(`Announcement deleted.`);
      await loadData();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert(err.message || 'Failed to delete announcement.');
    }
  }

  // Open Compliance Metrics Modal
  async function handleOpenCompliance(item) {
    setComplianceModalItem(item);
    setComplianceData(null);
    setComplianceLoading(true);
    setComplianceTab('acknowledged');

    try {
      const res = await api(`/announcements/${item.id}/compliance`);
      setComplianceData(res);
    } catch (err) {
      console.error('Error fetching compliance data:', err);
    } finally {
      setComplianceLoading(false);
    }
  }

  // Filtered List
  const filteredList = useMemo(() => {
    return announcements.filter((a) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const tMatch = (a.title || '').toLowerCase().includes(q);
        const bMatch = (a.bodyHtml || a.body_html || a.content || '').toLowerCase().includes(q);
        if (!tMatch && !bMatch) return false;
      }
      if (categoryFilter !== 'ALL' && (a.category || '').toLowerCase() !== categoryFilter.toLowerCase()) {
        return false;
      }
      if (ackFilter === 'ACK_REQUIRED' && !a.requiresAck && !a.requires_ack) {
        return false;
      }
      if (ackFilter === 'NOTICE_ONLY' && (a.requiresAck || a.requires_ack)) {
        return false;
      }
      return true;
    });
  }, [announcements, search, categoryFilter, ackFilter]);

  // Overall KPIs
  const kpiStats = useMemo(() => {
    const total = announcements.length;
    const reqAck = announcements.filter((a) => a.requiresAck || a.requires_ack).length;
    const pinned = announcements.filter((a) => a.isPinned || a.is_pinned).length;
    const totalAcks = announcements.reduce((sum, a) => sum + (a.ackCount || a.ack_count || 0), 0);
    return { total, reqAck, pinned, totalAcks };
  }, [announcements]);

  return (
    <AppShell
      title="Company Announcements"
      subtitle="Publish enterprise notices, target specific divisions, enforce compliance read receipts, and track employee acknowledgment metrics."
      actions={
        canManage ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenCreate}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create Announcement
          </button>
        ) : null
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Alerts */}
        {successMsg && (
          <div style={{ padding: '12px 16px', borderRadius: 8, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', fontSize: '13px', fontWeight: 600 }}>
            ✓ {successMsg}
          </div>
        )}

        {/* 1. Summary KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <div className="admin-card-hover" style={{ background: 'var(--surface, #fff)', border: '1px solid var(--line, #e2e8f0)', borderRadius: 12, padding: '16px 18px' }}>
            <div className="muted" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Announcements
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--ink, #101828)', marginTop: 4 }}>
              {kpiStats.total}
            </div>
            <div className="muted" style={{ fontSize: '11.5px', marginTop: 4 }}>
              Across all entities and branches
            </div>
          </div>

          <div className="admin-card-hover" style={{ background: 'var(--surface, #fff)', border: '1px solid var(--line, #e2e8f0)', borderRadius: 12, padding: '16px 18px' }}>
            <div className="muted" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Compliance Receipts
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#00b8db', marginTop: 4 }}>
              {kpiStats.reqAck}
            </div>
            <div className="muted" style={{ fontSize: '11.5px', marginTop: 4 }}>
              Notices requiring signed confirmation
            </div>
          </div>

          <div className="admin-card-hover" style={{ background: 'var(--surface, #fff)', border: '1px solid var(--line, #e2e8f0)', borderRadius: 12, padding: '16px 18px' }}>
            <div className="muted" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Pinned Broadcasts
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#f59e0b', marginTop: 4 }}>
              {kpiStats.pinned}
            </div>
            <div className="muted" style={{ fontSize: '11.5px', marginTop: 4 }}>
              Featured on employee dashboards
            </div>
          </div>

          <div className="admin-card-hover" style={{ background: 'var(--surface, #fff)', border: '1px solid var(--line, #e2e8f0)', borderRadius: 12, padding: '16px 18px' }}>
            <div className="muted" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Logged Read Receipts
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#10b981', marginTop: 4 }}>
              {kpiStats.totalAcks}
            </div>
            <div className="muted" style={{ fontSize: '11.5px', marginTop: 4 }}>
              Audit-verified employee confirmations
            </div>
          </div>
        </div>

        {/* 2. Search & Filter Bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', background: 'var(--surface, #fff)', padding: '14px 16px', borderRadius: 10, border: '1px solid var(--line, #e2e8f0)' }}>
          <div style={{ flex: '1 1 240px', position: 'relative' }}>
            <input
              type="text"
              placeholder="Search announcements by title or content..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                borderRadius: 6,
                border: '1px solid var(--line, #cbd5e1)',
                fontSize: '13px',
                outline: 'none',
              }}
            />
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#94a3b8"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--line, #cbd5e1)', fontSize: '13px', background: '#fff' }}
            >
              <option value="ALL">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select
              value={ackFilter}
              onChange={(e) => setAckFilter(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--line, #cbd5e1)', fontSize: '13px', background: '#fff' }}
            >
              <option value="ALL">All Acknowledgment Types</option>
              <option value="ACK_REQUIRED">Requires Acknowledgment</option>
              <option value="NOTICE_ONLY">Notice Only</option>
            </select>
          </div>
        </div>

        {/* 3. Announcements List */}
        {loading ? (
          <div className="muted" style={{ textAlign: 'center', padding: '60px 0', fontSize: '14px' }}>
            Loading announcements from database...
          </div>
        ) : filteredList.length === 0 ? (
          <div style={{ background: 'var(--surface, #fff)', border: '1px solid var(--line, #e2e8f0)', borderRadius: 12, padding: '50px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: 12 }}>📢</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink, #101828)' }}>No announcements found</div>
            <div className="muted" style={{ fontSize: '13px', marginTop: 4 }}>
              {search || categoryFilter !== 'ALL' || ackFilter !== 'ALL'
                ? 'Try adjusting your search or filters.'
                : 'Click "Create Announcement" to publish your first company broadcast.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filteredList.map((item) => {
              const c = getCategoryColor(item.category);
              const p = getPriorityColor(item.priority);
              const isAck = Boolean(item.requiresAck || item.requires_ack);
              const isPinned = Boolean(item.isPinned || item.is_pinned);
              const acks = item.ackCount || item.ack_count || 0;

              let audLabel = 'All Employees';
              const audType = String(item.audienceType || item.audience_type || 'all').toLowerCase();
              if (audType === 'division') {
                audLabel = `Division: ${item.divisionName || item.division_name || 'Selected Entity'}`;
              } else if (audType === 'department') {
                audLabel = `Department: ${item.departmentName || item.department_name || 'Selected Dept'}`;
              }

              return (
                <div
                  key={item.id}
                  className="admin-card-hover"
                  style={{
                    background: 'var(--surface, #fff)',
                    border: '1px solid var(--line, #e2e8f0)',
                    borderRadius: 12,
                    padding: '18px 22px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '11.5px',
                          fontWeight: 700,
                          color: c.text,
                          background: c.bg,
                          border: `1px solid ${c.border}`,
                          padding: '3px 10px',
                          borderRadius: 6,
                          letterSpacing: '0.02em',
                        }}
                      >
                        {item.category || 'General'}
                      </span>

                      {item.priority && item.priority.toLowerCase() !== 'normal' && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: p.text,
                            background: p.bg,
                            padding: '3px 8px',
                            borderRadius: 6,
                          }}
                        >
                          {p.label}
                        </span>
                      )}

                      {isPinned && (
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#0284c7', background: '#e0f2fe', padding: '3px 8px', borderRadius: 6 }}>
                          📌 Pinned
                        </span>
                      )}

                      <span style={{ fontSize: '12px', color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '3px 10px', borderRadius: 6 }}>
                        👥 {audLabel}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="muted" style={{ fontSize: '12px' }}>
                        Published {formatDate(item.publishedAt || item.published_at || item.createdAt || item.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Title & Body */}
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--ink, #101828)' }}>
                      {item.title}
                    </h3>
                    <div style={{ fontSize: '13px', color: 'var(--muted, #475569)', marginTop: 6, lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                      {item.bodyHtml || item.body_html || item.content || item.desc || item.description}
                    </div>
                  </div>

                  {/* Footer & Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, paddingTop: 10, borderTop: '1px solid var(--line, #f1f5f9)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      {isAck ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '12px', fontWeight: 600, color: '#0284c7' }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Requires Acknowledgment · <strong>{acks} confirmed</strong>
                        </span>
                      ) : (
                        <span className="muted" style={{ fontSize: '12px' }}>
                          General announcement (No acknowledgment required)
                        </span>
                      )}

                      {item.authorEmail && (
                        <span className="muted" style={{ fontSize: '11.5px' }}>
                          By {item.authorEmail}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {canManage && isAck && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleOpenCompliance(item)}
                          style={{ fontSize: '12px', padding: '5px 12px', color: '#0284c7', borderColor: '#bae6fd', background: '#f0f9ff' }}
                        >
                          📊 Compliance Metrics ({acks})
                        </button>
                      )}

                      {canManage && (
                        <>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleOpenEdit(item)}
                            style={{ fontSize: '12px', padding: '5px 12px' }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleDelete(item)}
                            style={{ fontSize: '12px', padding: '5px 12px', color: '#dc2626' }}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 4. Modal: Create / Edit Announcement */}
        {createModalOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: 16,
            }}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: 14,
                width: '100%',
                maxWidth: 620,
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ padding: '18px 22px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#101828' }}>
                  {editingItem ? `Edit Announcement #${editingItem.id}` : 'Create Company Announcement'}
                </h3>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {errorMsg && (
                  <div style={{ padding: '10px 14px', borderRadius: 6, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '12.5px' }}>
                    {errorMsg}
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                    Announcement Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Annual Medical Check-Up Schedule 2026"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '13.5px' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                      Category
                    </label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                      Priority
                    </label>
                    <select
                      value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                    >
                      <option value="normal">Normal</option>
                      <option value="important">Important</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                      Target Audience
                    </label>
                    <select
                      value={form.audienceType}
                      onChange={(e) => setForm({ ...form, audienceType: e.target.value, divisionId: '', departmentId: '' })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                    >
                      <option value="all">All Employees (Company-wide)</option>
                      <option value="division">Specific Division / Legal Entity</option>
                      <option value="department">Specific Department</option>
                    </select>
                  </div>

                  {form.audienceType === 'division' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                        Select Division
                      </label>
                      <select
                        value={form.divisionId}
                        onChange={(e) => setForm({ ...form, divisionId: e.target.value })}
                        required
                        style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                      >
                        <option value="">-- Choose Division --</option>
                        {divisions.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {form.audienceType === 'department' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                        Select Department
                      </label>
                      <select
                        value={form.departmentId}
                        onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                        required
                        style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                      >
                        <option value="">-- Choose Department --</option>
                        {departments.map((dp) => (
                          <option key={dp.id} value={dp.id}>{dp.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {form.audienceType === 'all' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                        Expiry Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={form.expiresAt}
                        onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '13px' }}
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                    Announcement Content / Instructions
                  </label>
                  <textarea
                    rows={5}
                    placeholder="Provide full details, policies, timings, and instructions for team members..."
                    value={form.bodyHtml}
                    onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '13px', resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: '#f8fafc', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '13px', fontWeight: 600, color: '#1e293b', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.requiresAck}
                      onChange={(e) => setForm({ ...form, requiresAck: e.target.checked })}
                      style={{ width: 16, height: 16 }}
                    />
                    Require Employee Read Receipt (Compliance Acknowledgment)
                  </label>
                  <span className="muted" style={{ fontSize: '11.5px', marginLeft: 24 }}>
                    When enabled, employees will see an &quot;Acknowledge & Confirm&quot; prompt on their portal, and completion metrics will be tracked.
                  </span>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '13px', fontWeight: 600, color: '#1e293b', cursor: 'pointer', marginTop: 4 }}>
                    <input
                      type="checkbox"
                      checked={form.isPinned}
                      onChange={(e) => setForm({ ...form, isPinned: e.target.checked })}
                      style={{ width: 16, height: 16 }}
                    />
                    Pin Announcement to top of Employee Portal
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setCreateModalOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submitting}
                  >
                    {submitting ? 'Saving...' : editingItem ? 'Save Changes' : 'Publish Announcement'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 5. Modal: Compliance Read Metrics */}
        {complianceModalItem && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: 16,
            }}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: 14,
                width: '100%',
                maxWidth: 720,
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ padding: '18px 22px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#101828' }}>
                    Compliance Read Receipts
                  </h3>
                  <div className="muted" style={{ fontSize: '12px', marginTop: 2 }}>
                    {complianceModalItem.title}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setComplianceModalItem(null)}
                  style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
                >
                  ✕
                </button>
              </div>

              <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                {complianceLoading ? (
                  <div className="muted" style={{ textAlign: 'center', padding: '40px 0' }}>
                    Calculating compliance metrics from audit logs...
                  </div>
                ) : complianceData ? (
                  <>
                    {/* Compliance KPI Banner */}
                    <div
                      style={{
                        background: 'linear-gradient(135deg, rgba(0, 184, 219, 0.08) 0%, rgba(2, 132, 199, 0.04) 100%)',
                        border: '1px solid rgba(0, 184, 219, 0.25)',
                        borderRadius: 12,
                        padding: '16px 20px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                        gap: 14,
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div className="muted" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                          Eligible Audience
                        </div>
                        <div style={{ fontSize: '22px', fontWeight: 800, color: '#101828', marginTop: 2 }}>
                          {complianceData.totalEligible || 0}
                        </div>
                      </div>

                      <div>
                        <div className="muted" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                          Confirmed Reads
                        </div>
                        <div style={{ fontSize: '22px', fontWeight: 800, color: '#10b981', marginTop: 2 }}>
                          {complianceData.totalAcknowledged || 0}
                        </div>
                      </div>

                      <div>
                        <div className="muted" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                          Pending
                        </div>
                        <div style={{ fontSize: '22px', fontWeight: 800, color: '#f59e0b', marginTop: 2 }}>
                          {complianceData.pendingCount || 0}
                        </div>
                      </div>

                      <div>
                        <div className="muted" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                          Compliance Rate
                        </div>
                        <div style={{ fontSize: '22px', fontWeight: 800, color: '#00b8db', marginTop: 2 }}>
                          {complianceData.complianceRate || 0}%
                        </div>
                      </div>
                    </div>

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid #e2e8f0' }}>
                      <button
                        type="button"
                        onClick={() => setComplianceTab('acknowledged')}
                        style={{
                          padding: '8px 16px',
                          fontSize: '13px',
                          fontWeight: 600,
                          background: 'none',
                          border: 'none',
                          borderBottom: complianceTab === 'acknowledged' ? '2px solid #00b8db' : '2px solid transparent',
                          color: complianceTab === 'acknowledged' ? '#00b8db' : '#64748b',
                          cursor: 'pointer',
                        }}
                      >
                        Acknowledged ({complianceData.acknowledgements?.length || 0})
                      </button>
                      <button
                        type="button"
                        onClick={() => setComplianceTab('pending')}
                        style={{
                          padding: '8px 16px',
                          fontSize: '13px',
                          fontWeight: 600,
                          background: 'none',
                          border: 'none',
                          borderBottom: complianceTab === 'pending' ? '2px solid #00b8db' : '2px solid transparent',
                          color: complianceTab === 'pending' ? '#00b8db' : '#64748b',
                          cursor: 'pointer',
                        }}
                      >
                        Pending Acknowledgment ({complianceData.pendingAcknowledgements?.length || 0})
                      </button>
                    </div>

                    {/* Table View */}
                    {complianceTab === 'acknowledged' ? (
                      <div>
                        {complianceData.acknowledgements && complianceData.acknowledgements.length > 0 ? (
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                              <thead>
                                <tr style={{ borderBottom: '1.5px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                                  <th style={{ padding: '8px 10px' }}>Employee</th>
                                  <th style={{ padding: '8px 10px' }}>Department</th>
                                  <th style={{ padding: '8px 10px' }}>Acknowledged Time</th>
                                  <th style={{ padding: '8px 10px' }}>IP Address</th>
                                </tr>
                              </thead>
                              <tbody>
                                {complianceData.acknowledgements.map((ack, idx) => (
                                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '10px', fontWeight: 600, color: '#1e293b' }}>
                                      {ack.fullName || ack.full_name}
                                      <span className="muted" style={{ display: 'block', fontSize: '11px', fontWeight: 400 }}>
                                        {ack.empCode || ack.emp_code}
                                      </span>
                                    </td>
                                    <td style={{ padding: '10px', color: '#475569' }}>
                                      {ack.departmentName || ack.department_name || '—'}
                                    </td>
                                    <td style={{ padding: '10px', color: '#059669', fontWeight: 600 }}>
                                      {formatDate(ack.acknowledgedAt || ack.acknowledged_at)}
                                    </td>
                                    <td style={{ padding: '10px', color: '#64748b', fontFamily: 'monospace', fontSize: '11.5px' }}>
                                      {ack.ipAddress || ack.ip_address || '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="muted" style={{ textAlign: 'center', padding: '30px 0', fontSize: '13px' }}>
                            No employees have acknowledged this announcement yet.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        {complianceData.pendingAcknowledgements && complianceData.pendingAcknowledgements.length > 0 ? (
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                              <thead>
                                <tr style={{ borderBottom: '1.5px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                                  <th style={{ padding: '8px 10px' }}>Employee</th>
                                  <th style={{ padding: '8px 10px' }}>Department</th>
                                  <th style={{ padding: '8px 10px' }}>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {complianceData.pendingAcknowledgements.map((p, idx) => (
                                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '10px', fontWeight: 600, color: '#1e293b' }}>
                                      {p.fullName || p.full_name}
                                      <span className="muted" style={{ display: 'block', fontSize: '11px', fontWeight: 400 }}>
                                        {p.empCode || p.emp_code}
                                      </span>
                                    </td>
                                    <td style={{ padding: '10px', color: '#475569' }}>
                                      {p.departmentName || p.department_name || '—'}
                                    </td>
                                    <td style={{ padding: '10px' }}>
                                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#d97706', background: '#fffbeb', padding: '3px 8px', borderRadius: 5 }}>
                                        Pending Read Receipt
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div style={{ textAlign: 'center', padding: '30px 0', fontSize: '13px', color: '#059669', fontWeight: 600 }}>
                            🎉 100% Compliance! All eligible employees have acknowledged this notice.
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="muted" style={{ textAlign: 'center', padding: '30px 0' }}>
                    Unable to load compliance data.
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 10 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setComplianceModalItem(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
