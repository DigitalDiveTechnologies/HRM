'use client';

import { useEffect, useState, useMemo } from 'react';
import AppShell from '../../components/AppShell';
import { api } from '../../lib/auth';

export default function CustomFieldsPage() {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [form, setForm] = useState({
    tabGroup: 'custom',
    fieldKey: '',
    label: '',
    fieldType: 'text',
    optionsText: '',
    isRequired: false,
    sortOrder: 0,
  });

  const loadFields = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api('/custom-fields?includeInactive=true');
      if (Array.isArray(data)) setFields(data);
    } catch (err) {
      console.error('Failed to load custom fields:', err);
      setError(err.message || 'Failed to load custom field definitions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFields();
  }, []);

  const openCreateModal = () => {
    setEditingField(null);
    setForm({
      tabGroup: 'custom',
      fieldKey: '',
      label: '',
      fieldType: 'text',
      optionsText: '',
      isRequired: false,
      sortOrder: (fields.length + 1) * 10,
    });
    setModalOpen(true);
  };

  const openEditModal = (f) => {
    setEditingField(f);
    let opts = '';
    if (Array.isArray(f.optionsJson)) {
      opts = f.optionsJson.map((o) => (typeof o === 'object' ? (o.label || o.value) : o)).join(', ');
    } else if (f.optionsJson) {
      opts = typeof f.optionsJson === 'string' ? f.optionsJson : JSON.stringify(f.optionsJson);
    }
    setForm({
      tabGroup: f.tabGroup || 'custom',
      fieldKey: f.fieldKey || '',
      label: f.label || '',
      fieldType: f.fieldType || 'text',
      optionsText: opts,
      isRequired: !!f.isRequired,
      sortOrder: f.sortOrder || 0,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.label.trim()) return;
    if (!editingField && !form.fieldKey.trim()) return;

    setSaving(true);
    try {
      let optionsArray = null;
      if (form.fieldType === 'select' && form.optionsText.trim()) {
        optionsArray = form.optionsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }

      if (editingField) {
        await api(`/custom-fields/${editingField.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            label: form.label.trim(),
            tabGroup: form.tabGroup.trim(),
            fieldType: form.fieldType,
            options: optionsArray,
            isRequired: form.isRequired,
            sortOrder: Number(form.sortOrder) || 0,
          }),
        });
      } else {
        await api('/custom-fields', {
          method: 'POST',
          body: JSON.stringify({
            tabGroup: form.tabGroup.trim(),
            fieldKey: form.fieldKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
            label: form.label.trim(),
            fieldType: form.fieldType,
            options: optionsArray,
            isRequired: form.isRequired,
            sortOrder: Number(form.sortOrder) || 0,
          }),
        });
      }

      setModalOpen(false);
      await loadFields();
    } catch (err) {
      alert(err.message || 'Failed to save custom field');
    } finally {
      setSaving(false);
    }
  };

  const toggleFieldActive = async (f) => {
    try {
      await api(`/custom-fields/${f.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !f.isActive }),
      });
      await loadFields();
    } catch (err) {
      alert(err.message || 'Failed to update field status');
    }
  };

  const groups = useMemo(() => {
    const set = new Set();
    fields.forEach((f) => {
      if (f.tabGroup) set.add(f.tabGroup);
    });
    return Array.from(set);
  }, [fields]);

  const filteredFields = useMemo(() => {
    return fields.filter((f) => {
      const matchSearch =
        !search.trim() ||
        f.label?.toLowerCase().includes(search.toLowerCase()) ||
        f.fieldKey?.toLowerCase().includes(search.toLowerCase());
      const matchGroup = selectedGroup === 'all' || f.tabGroup === selectedGroup;
      return matchSearch && matchGroup;
    });
  }, [fields, search, selectedGroup]);

  const stats = useMemo(() => {
    return {
      total: fields.length,
      active: fields.filter((f) => f.isActive).length,
      select: fields.filter((f) => f.fieldType === 'select').length,
      dateNum: fields.filter((f) => f.fieldType === 'date' || f.fieldType === 'number').length,
    };
  }, [fields]);

  return (
    <AppShell title="Custom Fields & Dynamic Attributes" subtitle="Task 2.4: JSONB Extensible Attributes Engine">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Top Header Card */}
        <div
          style={{
            background: 'linear-gradient(135deg, #092c42 0%, #0369a1 100%)',
            color: '#ffffff',
            borderRadius: 16,
            padding: '24px 28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            boxShadow: '0 4px 15px rgba(3, 105, 161, 0.15)',
          }}
        >
          <div>
            <div style={{ fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.85, fontWeight: 700 }}>
              Schema-Free Extensibility
            </div>
            <h1 style={{ margin: '4px 0 6px', fontSize: '24px', fontWeight: 800 }}>
              Dynamic Custom Fields Engine
            </h1>
            <p style={{ margin: 0, fontSize: '13px', opacity: 0.9, maxWidth: 640, lineHeight: 1.5 }}>
              Create organization-specific attributes like <em>Sea Crew ID</em>, <em>Uniform Size</em>, or <em>Offshore Clearance</em>. Values are saved inside PostgreSQL <code>employees.master_data</code> JSONB without alter-table operations.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            style={{
              background: '#00b8db',
              color: '#ffffff',
              border: 'none',
              borderRadius: 10,
              padding: '10px 20px',
              fontWeight: 700,
              fontSize: '13.5px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 12px rgba(0, 184, 219, 0.3)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Define Custom Field
          </button>
        </div>

        {/* 4 Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <div style={{ background: 'var(--surface, #ffffff)', border: '1px solid var(--line, #e2e8f0)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: '12px', color: 'var(--muted, #64748b)', fontWeight: 600, textTransform: 'uppercase' }}>Active Attributes</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#00b8db', marginTop: 4 }}>{stats.active}</div>
            <div style={{ fontSize: '11px', color: 'var(--muted, #64748b)', marginTop: 2 }}>{stats.total} total defined</div>
          </div>

          <div style={{ background: 'var(--surface, #ffffff)', border: '1px solid var(--line, #e2e8f0)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: '12px', color: 'var(--muted, #64748b)', fontWeight: 600, textTransform: 'uppercase' }}>Dropdown / Select</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0284c7', marginTop: 4 }}>{stats.select}</div>
            <div style={{ fontSize: '11px', color: 'var(--muted, #64748b)', marginTop: 2 }}>Multi-choice options</div>
          </div>

          <div style={{ background: 'var(--surface, #ffffff)', border: '1px solid var(--line, #e2e8f0)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: '12px', color: 'var(--muted, #64748b)', fontWeight: 600, textTransform: 'uppercase' }}>Date & Number</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#10b981', marginTop: 4 }}>{stats.dateNum}</div>
            <div style={{ fontSize: '11px', color: 'var(--muted, #64748b)', marginTop: 2 }}>Structured types</div>
          </div>

          <div style={{ background: 'var(--surface, #ffffff)', border: '1px solid var(--line, #e2e8f0)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: '12px', color: 'var(--muted, #64748b)', fontWeight: 600, textTransform: 'uppercase' }}>Storage Engine</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#8b5cf6', marginTop: 6 }}>PostgreSQL JSONB</div>
            <div style={{ fontSize: '11px', color: 'var(--muted, #64748b)', marginTop: 2 }}>Zero database locking</div>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setSelectedGroup('all')}
              style={{
                border: 'none',
                background: selectedGroup === 'all' ? '#00b8db' : 'var(--surface, #ffffff)',
                color: selectedGroup === 'all' ? '#ffffff' : 'var(--ink, #101828)',
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                border: '1px solid var(--line, #e2e8f0)',
              }}
            >
              All Groups ({fields.length})
            </button>
            {groups.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setSelectedGroup(g)}
                style={{
                  border: 'none',
                  background: selectedGroup === g ? '#00b8db' : 'var(--surface, #ffffff)',
                  color: selectedGroup === g ? '#ffffff' : 'var(--ink, #101828)',
                  padding: '6px 14px',
                  borderRadius: 8,
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid var(--line, #e2e8f0)',
                  textTransform: 'capitalize',
                }}
              >
                {g.replace('_', ' ')}
              </button>
            ))}
          </div>

          <input
            type="text"
            className="emp-input"
            placeholder="Search custom fields by label or key…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 300 }}
          />
        </div>

        {/* Fields Table */}
        <div style={{ background: 'var(--surface, #ffffff)', border: '1px solid var(--line, #e2e8f0)', borderRadius: 14, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted, #64748b)', fontSize: '13px' }}>
              Loading custom field definitions…
            </div>
          ) : filteredFields.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted, #64748b)' }}>
              No custom fields found matching current filter.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--surface-alt, #f8fafc)', borderBottom: '1px solid var(--line, #e2e8f0)', textAlign: 'left', color: 'var(--muted, #64748b)', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '12px 18px' }}>Label & Key</th>
                  <th style={{ padding: '12px 14px' }}>Tab Group</th>
                  <th style={{ padding: '12px 14px' }}>Field Type</th>
                  <th style={{ padding: '12px 14px' }}>Configuration</th>
                  <th style={{ padding: '12px 14px' }}>Required</th>
                  <th style={{ padding: '12px 14px' }}>Status</th>
                  <th style={{ padding: '12px 18px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFields.map((f) => {
                  let optsList = [];
                  if (Array.isArray(f.optionsJson)) optsList = f.optionsJson;
                  return (
                    <tr key={f.id} style={{ borderBottom: '1px solid var(--line, #e2e8f0)' }}>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--ink, #101828)' }}>{f.label}</div>
                        <div style={{ fontSize: '11px', color: '#0284c7', fontFamily: 'monospace', marginTop: 2 }}>
                          {f.fieldKey}
                        </div>
                      </td>
                      <td style={{ padding: '14px 14px' }}>
                        <span style={{ background: 'var(--surface-alt, #f1f5f9)', padding: '3px 8px', borderRadius: 6, fontSize: '11.5px', textTransform: 'capitalize' }}>
                          {f.tabGroup ? f.tabGroup.replace('_', ' ') : 'custom'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 14px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background:
                              f.fieldType === 'select' ? '#e0f2fe' : f.fieldType === 'date' ? '#dcfce7' : f.fieldType === 'number' ? '#fef3c7' : '#f1f5f9',
                            color:
                              f.fieldType === 'select' ? '#0369a1' : f.fieldType === 'date' ? '#15803d' : f.fieldType === 'number' ? '#b45309' : '#475569',
                          }}
                        >
                          {f.fieldType}
                        </span>
                      </td>
                      <td style={{ padding: '14px 14px', maxWidth: 220 }}>
                        {f.fieldType === 'select' && optsList.length > 0 ? (
                          <div style={{ fontSize: '11px', color: 'var(--muted, #64748b)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={optsList.join(', ')}>
                            {optsList.join(', ')}
                          </div>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--muted, #94a3b8)' }}>Standard input</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 14px' }}>
                        {f.isRequired ? (
                          <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '11px' }}>YES</span>
                        ) : (
                          <span style={{ color: 'var(--muted, #94a3b8)', fontSize: '11px' }}>Optional</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 14px' }}>
                        <button
                          type="button"
                          onClick={() => toggleFieldActive(f)}
                          style={{
                            border: 'none',
                            padding: '3px 10px',
                            borderRadius: 999,
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: f.isActive ? '#ecfdf5' : '#fee2e2',
                            color: f.isActive ? '#059669' : '#dc2626',
                          }}
                        >
                          {f.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => openEditModal(f)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#00b8db',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '12.5px',
                          }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal: Create/Edit Custom Field */}
        {modalOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              backdropFilter: 'blur(3px)',
            }}
          >
            <div
              style={{
                background: 'var(--surface, #ffffff)',
                borderRadius: 16,
                padding: '24px 28px',
                width: '100%',
                maxWidth: 480,
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--ink, #101828)' }}>
                  {editingField ? 'Edit Custom Field' : 'Define New Custom Field'}
                </h3>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--muted, #94a3b8)' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink, #101828)', display: 'block', marginBottom: 4 }}>
                    Field Label *
                  </label>
                  <input
                    type="text"
                    required
                    className="emp-input"
                    placeholder="e.g. Sea Crew ID, Uniform Size…"
                    value={form.label}
                    onChange={(e) => {
                      const lbl = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        label: lbl,
                        fieldKey: !editingField ? lbl.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_') : prev.fieldKey,
                      }));
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink, #101828)', display: 'block', marginBottom: 4 }}>
                    Field Key (JSONB storage key) *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingField}
                    className="emp-input"
                    placeholder="e.g. sea_crew_id"
                    value={form.fieldKey}
                    onChange={(e) => setForm({ ...form, fieldKey: e.target.value })}
                  />
                  <div style={{ fontSize: '11px', color: 'var(--muted, #64748b)', marginTop: 2 }}>
                    Unique identifier stored in <code>master_data</code>. Cannot be altered after creation.
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink, #101828)', display: 'block', marginBottom: 4 }}>
                      Field Type
                    </label>
                    <select
                      className="emp-input"
                      value={form.fieldType}
                      onChange={(e) => setForm({ ...form, fieldType: e.target.value })}
                    >
                      <option value="text">Text (string)</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="select">Select (dropdown)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink, #101828)', display: 'block', marginBottom: 4 }}>
                      Tab Group
                    </label>
                    <input
                      type="text"
                      className="emp-input"
                      placeholder="e.g. marine_ops, general"
                      value={form.tabGroup}
                      onChange={(e) => setForm({ ...form, tabGroup: e.target.value })}
                    />
                  </div>
                </div>

                {form.fieldType === 'select' && (
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink, #101828)', display: 'block', marginBottom: 4 }}>
                      Options (comma-separated) *
                    </label>
                    <input
                      type="text"
                      className="emp-input"
                      placeholder="e.g. Small, Medium, Large, Extra Large"
                      value={form.optionsText}
                      onChange={(e) => setForm({ ...form, optionsText: e.target.value })}
                    />
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12.5px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.isRequired}
                      onChange={(e) => setForm({ ...form, isRequired: e.target.checked })}
                    />
                    <span>Required Field</span>
                  </label>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '12px', color: 'var(--muted, #64748b)' }}>Sort:</span>
                    <input
                      type="number"
                      className="emp-input"
                      style={{ width: 60, padding: '4px 8px' }}
                      value={form.sortOrder}
                      onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    style={{
                      background: 'none',
                      border: '1px solid var(--line, #cbd5e1)',
                      padding: '8px 16px',
                      borderRadius: 8,
                      fontSize: '12.5px',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      background: '#00b8db',
                      color: '#ffffff',
                      border: 'none',
                      padding: '8px 20px',
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: '12.5px',
                      cursor: saving ? 'wait' : 'pointer',
                    }}
                  >
                    {saving ? 'Saving…' : editingField ? 'Save Changes' : 'Create Field'}
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
