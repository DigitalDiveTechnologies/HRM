'use client';

import { useEffect, useState } from 'react';
import AppShell from '../../components/AppShell';
import { api, getUser, normalizeRole } from '../../lib/auth';

const ICON_OPTIONS = [
  { key: 'globe', label: 'Globe / Web Portal' },
  { key: 'shield', label: 'Shield / Security / UAE PASS' },
  { key: 'mail', label: 'Mail / Webmail' },
  { key: 'heart', label: 'Heart / Medical Insurance' },
  { key: 'life-buoy', label: 'Life Buoy / Helpdesk' },
  { key: 'book', label: 'Book / Policy Manual' },
  { key: 'award', label: 'Award / Training' },
  { key: 'activity', label: 'Activity / Health' },
  { key: 'external-link', label: 'External Link' },
];

const CATEGORY_OPTIONS = [
  'Government & Labour',
  'Health & Wellness',
  'Productivity',
  'IT & Operations',
  'Company Resources',
  'Career & Training',
  'Other',
];

export default function CompanyLinksPage() {
  const user = typeof window !== 'undefined' ? getUser() : null;
  const role = normalizeRole(user);
  const isAdmin = role === 'admin' || role === 'super_admin';

  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const [form, setForm] = useState({
    title: '',
    url: '',
    category: 'Government & Labour',
    iconKey: 'globe',
    description: '',
    isInternal: false,
    sortOrder: 0,
  });

  const loadLinks = async () => {
    try {
      setLoading(true);
      const data = await api('/company-links');
      setLinks(Array.isArray(data) ? data : []);
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to load company links.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLinks();
  }, []);

  const openCreateModal = () => {
    setEditingItem(null);
    setForm({
      title: '',
      url: '',
      category: 'Government & Labour',
      iconKey: 'globe',
      description: '',
      isInternal: false,
      sortOrder: links.length + 1,
    });
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setForm({
      title: item.title || '',
      url: item.url || '',
      category: item.category || 'Government & Labour',
      iconKey: item.iconKey || item.icon_key || 'globe',
      description: item.description || '',
      isInternal: !!(item.isInternal ?? item.is_internal),
      sortOrder: item.sortOrder ?? item.sort_order ?? 0,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.url.trim()) return;

    setSaving(true);
    setMsg({ type: '', text: '' });
    try {
      if (editingItem) {
        await api(`/company-links/${editingItem.id}`, {
          method: 'PATCH',
          body: JSON.stringify(form),
        });
        setMsg({ type: 'success', text: 'Corporate link updated successfully!' });
      } else {
        await api('/company-links', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        setMsg({ type: 'success', text: 'Corporate link created successfully!' });
      }
      setModalOpen(false);
      await loadLinks();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to save link.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!confirm(`Are you sure you want to delete bookmark "${item.title}"?`)) return;
    try {
      await api(`/company-links/${item.id}`, { method: 'DELETE' });
      setMsg({ type: 'success', text: 'Bookmark deleted successfully.' });
      await loadLinks();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to delete bookmark.' });
    }
  };

  return (
    <AppShell
      title="Corporate Links & Resource Directory"
      subtitle="Publish corporate bookmarks, government portals, and operational resource shortcuts across Employee Portal and Mobile App"
      action={
        isAdmin ? (
          <button
            type="button"
            onClick={openCreateModal}
            style={{
              background: 'linear-gradient(135deg, #00b8db, #0284c7)',
              color: '#ffffff',
              border: 'none',
              padding: '9px 18px',
              borderRadius: 8,
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 6px rgba(0, 184, 219, 0.25)',
            }}
          >
            <span>+</span> Add Corporate Link
          </button>
        ) : null
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {msg.text && (
          <div
            style={{
              padding: '12px 18px',
              borderRadius: 8,
              fontSize: '13px',
              fontWeight: 600,
              background: msg.type === 'success' ? '#ecfdf5' : '#fef2f2',
              color: msg.type === 'success' ? '#065f46' : '#991b1b',
              border: `1px solid ${msg.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
            }}
          >
            {msg.text}
          </div>
        )}

        <div
          style={{
            background: 'var(--surface, #ffffff)',
            border: '1px solid var(--line, #e2e8f0)',
            borderRadius: 14,
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--surface-alt, #f8fafc)', borderBottom: '1px solid var(--line, #e2e8f0)' }}>
                <th style={{ padding: '12px 18px', fontWeight: 700, color: '#475569' }}>Order</th>
                <th style={{ padding: '12px 18px', fontWeight: 700, color: '#475569' }}>Title & Description</th>
                <th style={{ padding: '12px 18px', fontWeight: 700, color: '#475569' }}>Target URL</th>
                <th style={{ padding: '12px 18px', fontWeight: 700, color: '#475569' }}>Category</th>
                <th style={{ padding: '12px 18px', fontWeight: 700, color: '#475569' }}>Type</th>
                {isAdmin && <th style={{ padding: '12px 18px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 36, textAlign: 'center', color: '#64748b' }}>
                    Loading corporate links...
                  </td>
                </tr>
              ) : links.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 36, textAlign: 'center', color: '#64748b' }}>
                    No corporate links published yet. Click <strong>+ Add Corporate Link</strong> to create bookmarks.
                  </td>
                </tr>
              ) : (
                links.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--line, #e2e8f0)' }}>
                    <td style={{ padding: '14px 18px', fontWeight: 600, color: '#64748b' }}>
                      #{item.sortOrder ?? item.sort_order ?? 0}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: '18px' }}>
                          {item.iconKey === 'heart' ? '❤️' : item.iconKey === 'shield' ? '🛡️' : item.iconKey === 'mail' ? '✉️' : '🌐'}
                        </span>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--ink, #101828)' }}>{item.title}</div>
                          {item.description && (
                            <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: 2 }}>{item.description}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 500 }}
                      >
                        {item.url} ↗
                      </a>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 9px',
                          borderRadius: 999,
                          background: 'rgba(0, 184, 219, 0.1)',
                          color: '#0284c7',
                        }}
                      >
                        {item.category || 'General'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: item.isInternal ? '#10b981' : '#64748b' }}>
                        {item.isInternal ? 'Internal' : 'External'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            style={{
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              padding: '5px 12px',
                              borderRadius: 6,
                              fontSize: '12px',
                              fontWeight: 600,
                              color: '#334155',
                              cursor: 'pointer',
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            style={{
                              background: '#fff1f2',
                              border: '1px solid #fecdd3',
                              padding: '5px 12px',
                              borderRadius: 6,
                              fontSize: '12px',
                              fontWeight: 600,
                              color: '#e11d48',
                              cursor: 'pointer',
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Create / Edit Modal */}
        {modalOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.5)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: 16,
            }}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: 14,
                width: '100%',
                maxWidth: 540,
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                padding: '24px 28px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#101828' }}>
                  {editingItem ? 'Edit Corporate Bookmark' : 'Add Corporate Bookmark'}
                </h3>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{ background: 'transparent', border: 'none', fontSize: '20px', color: '#94a3b8', cursor: 'pointer' }}
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: 5 }}>
                    Bookmark Title <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. MOHRE UAE Portal or Health Insurance Daman"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: 5 }}>
                    Target URL <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    placeholder="https://www.mohre.gov.ae or /documents"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: 5 }}>
                      Category
                    </label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '13px' }}
                    >
                      {CATEGORY_OPTIONS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: 5 }}>
                      Icon
                    </label>
                    <select
                      value={form.iconKey}
                      onChange={(e) => setForm({ ...form, iconKey: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '13px' }}
                    >
                      {ICON_OPTIONS.map((ico) => (
                        <option key={ico.key} value={ico.key}>{ico.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: 5 }}>
                    Brief Description
                  </label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="e.g. Government portal for labour contracts and UAE visa regulations"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'center' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: 5 }}>
                      Display Sort Order
                    </label>
                    <input
                      type="number"
                      value={form.sortOrder}
                      onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value, 10) || 0 })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>

                  <div style={{ paddingTop: 20 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '12.5px', color: '#1e293b', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form.isInternal}
                        onChange={(e) => setForm({ ...form, isInternal: e.target.checked })}
                        style={{ width: 16, height: 16 }}
                      />
                      <span>Internal Portal Link</span>
                    </label>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      padding: '9px 18px',
                      borderRadius: 8,
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      background: 'linear-gradient(135deg, #00b8db, #0284c7)',
                      color: '#ffffff',
                      border: 'none',
                      padding: '9px 24px',
                      borderRadius: 8,
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: saving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {saving ? 'Saving...' : editingItem ? 'Save Changes' : 'Create Bookmark'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
