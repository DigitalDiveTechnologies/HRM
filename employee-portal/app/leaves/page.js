'use client';

import { useEffect, useMemo, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { api, value } from '@/lib/api';
import { useLocale } from '@/lib/LocaleContext';

const formatDate = (v) => (v ? new Date(v).toLocaleDateString() : '—');

export default function Leaves() {
  const { t, locale } = useLocale();
  const [leaves, setLeaves] = useState([]);
  const [balances, setBalances] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [showApply, setShowApply] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [form, setForm] = useState({
    leaveType: 'Annual',
    startDate: '',
    endDate: '',
    reason: '',
  });
  const [page, setPage] = useState(1);
  const pageSize = 10;

  function loadData() {
    Promise.all([api('/leave'), api('/leave/balances')])
      .then(([l, b]) => {
        setLeaves(Array.isArray(l) ? l : []);
        setBalances(Array.isArray(b) ? b : []);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleApply(e) {
    e.preventDefault();
    if (!form.startDate || !form.endDate) return;
    setSubmitting(true);
    setError('');
    setMsg('');
    try {
      await api('/leave', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setMsg(t('leave_submitted_success'));
      setForm({ leaveType: 'Annual', startDate: '', endDate: '', reason: '' });
      setShowApply(false);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to submit leave request.');
    } finally {
      setSubmitting(false);
    }
  }

  // Group leaves category-wise (Unpaid together, Maternity together, Sick together, Annual together, etc.)
  const categories = useMemo(() => {
    const list = ['Annual', 'Sick', 'Unpaid', 'Maternity', 'Casual', 'Paternity'];
    const dynamic = new Set();
    leaves.forEach((l) => {
      const type = value(l, 'leaveType', 'leave_type');
      if (type) dynamic.add(type);
    });
    // Combine standard + any dynamic types found
    const all = Array.from(new Set([...list, ...Array.from(dynamic)]));
    return all.filter((cat) => {
      return leaves.some(
        (l) => (value(l, 'leaveType', 'leave_type') || '').toLowerCase() === cat.toLowerCase()
      );
    });
  }, [leaves]);

  // Sort leaves by Category so identical categories are always grouped together
  const sortedAndFilteredLeaves = useMemo(() => {
    let list = [...leaves];
    if (selectedCategory !== 'ALL') {
      list = list.filter(
        (l) =>
          (value(l, 'leaveType', 'leave_type') || '').toLowerCase() === selectedCategory.toLowerCase()
      );
    } else {
      // In ALL view, sort primarily by Category name so all Unpaid, all Maternity, all Sick, all Annual stay together!
      list.sort((a, b) => {
        const catA = String(value(a, 'leaveType', 'leave_type') || '').toLowerCase();
        const catB = String(value(b, 'leaveType', 'leave_type') || '').toLowerCase();
        if (catA !== catB) return catA.localeCompare(catB);
        const dateA = new Date(value(a, 'startDate', 'start_date') || 0).getTime();
        const dateB = new Date(value(b, 'startDate', 'start_date') || 0).getTime();
        return dateB - dateA;
      });
    }
    return list;
  }, [leaves, selectedCategory]);

  const totalPages = Math.ceil(sortedAndFilteredLeaves.length / pageSize);
  const pagedLeaves = sortedAndFilteredLeaves.slice((page - 1) * pageSize, page * pageSize);

  function getCategoryLabel(cat) {
    const map = {
      Annual: t('annual_leave'),
      Sick: t('sick_leave'),
      Unpaid: t('unpaid_leave'),
      Maternity: t('maternity_leave'),
      Paternity: t('paternity_leave'),
      Casual: t('casual_leave'),
    };
    return map[cat] || cat;
  }

  function getCategoryColor(type) {
    const t = String(type || '').toLowerCase();
    if (t.includes('annual')) return { bg: 'rgba(0, 184, 219, 0.12)', color: '#00A8CF', border: 'rgba(0, 184, 219, 0.3)' };
    if (t.includes('sick')) return { bg: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' };
    if (t.includes('unpaid')) return { bg: 'rgba(245, 158, 11, 0.12)', color: '#d97706', border: 'rgba(245, 158, 11, 0.3)' };
    if (t.includes('maternity') || t.includes('paternity')) return { bg: 'rgba(168, 85, 247, 0.12)', color: '#9333ea', border: 'rgba(168, 85, 247, 0.3)' };
    return { bg: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: 'rgba(16, 185, 129, 0.3)' };
  }

  return (
    <PortalShell
      title={t('leaves_title')}
      subtitle={t('leaves_subtitle')}
      actions={
        <button
          type="button"
          onClick={() => setShowApply((p) => !p)}
          className="btn-primary"
          style={{ padding: '7px 14px', fontSize: '12px' }}
        >
          {showApply ? t('close_form') : t('apply_for_leave')}
        </button>
      }
    >
      {error ? <div className="error-box">{error}</div> : null}
      {msg ? <div className="success-box">{msg}</div> : null}

      {/* Leave Entitlement Balances Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        {balances.map((r, i) => {
          const type = value(r, 'leaveType', 'leave_type') || 'Annual';
          const rem = Number(value(r, 'remainingDays', 'remaining_days') || 0);
          const used = Number(value(r, 'usedDays', 'used_days') || 0);
          const total = Number(value(r, 'entitlementDays', 'entitlement_days') || 0);

          return (
            <div key={i} className="panel-card" style={{ padding: '16px 18px', margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)' }}>
                  {getCategoryLabel(type)}
                </span>
                <span className={`status-pill ${rem > 0 ? 'active' : 'pending'}`}>
                  {rem > 0 ? t('available') : t('exhausted')}
                </span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--brand)', marginBottom: 4 }}>
                {rem} <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>{t('days_left')}</span>
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                {used} {t('used_of')} {total} {t('total_entitlement')}
              </div>
            </div>
          );
        })}
      </div>

      {/* Expandable Leave Application Form */}
      {showApply ? (
        <div className="panel-card" style={{ marginBottom: 20 }}>
          <div className="panel-head" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>
            <div className="panel-title">
              <h2>{t('new_leave_request')}</h2>
              <p>{t('new_leave_request_sub')}</p>
            </div>
          </div>
          <form onSubmit={handleApply} style={{ marginTop: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              <div className="form-field">
                <label>{t('leave_type')}</label>
                <select
                  value={form.leaveType}
                  onChange={(e) => setForm({ ...form, leaveType: e.target.value })}
                >
                  <option value="Annual">{t('annual_leave')}</option>
                  <option value="Sick">{t('sick_leave')}</option>
                  <option value="Casual">{t('casual_leave')}</option>
                  <option value="Unpaid">{t('unpaid_leave')}</option>
                  <option value="Maternity">{t('maternity_leave')}</option>
                  <option value="Paternity">{t('paternity_leave')}</option>
                </select>
              </div>
              <div className="form-field">
                <label>{t('start_date')}</label>
                <input
                  type="date"
                  required
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div className="form-field">
                <label>{t('end_date')}</label>
                <input
                  type="date"
                  required
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
            </div>
            <div className="form-field" style={{ marginTop: 4 }}>
              <label>{t('reason')}</label>
              <textarea
                rows={3}
                placeholder={t('reason_placeholder')}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? t('submitting') : t('submit_leave_request')}
              </button>
              <button
                type="button"
                onClick={() => setShowApply(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--line)',
                  borderRadius: 6,
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--muted)',
                  cursor: 'pointer',
                }}
              >
                {t('cancel')}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Leave Request History Table with Category Filters */}
      <div className="panel-card">
        <div className="panel-head" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div className="panel-title">
            <h2>{t('leave_request_history')}</h2>
            <p>{t('leave_request_history_sub')}</p>
          </div>
        </div>

        {/* Category Filter Pills / Cards */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 16,
            padding: '12px 14px',
            background: 'var(--surface-alt)',
            borderRadius: 8,
            border: '1px solid var(--line)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('ALL');
              setPage(1);
            }}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              border: selectedCategory === 'ALL' ? '1px solid var(--brand)' : '1px solid var(--line)',
              background: selectedCategory === 'ALL' ? 'var(--brand)' : 'var(--surface)',
              color: selectedCategory === 'ALL' ? '#FFFFFF' : 'var(--ink)',
              transition: 'all 0.15s ease',
            }}
          >
            {t('all_categories')} ({leaves.length})
          </button>

          {categories.map((cat) => {
            const count = leaves.filter(
              (l) => (value(l, 'leaveType', 'leave_type') || '').toLowerCase() === cat.toLowerCase()
            ).length;
            const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat);
                  setPage(1);
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: isSelected ? '1px solid var(--brand)' : '1px solid var(--line)',
                  background: isSelected ? 'var(--brand)' : 'var(--surface)',
                  color: isSelected ? '#FFFFFF' : 'var(--ink)',
                  transition: 'all 0.15s ease',
                }}
              >
                {getCategoryLabel(cat)} ({count})
              </button>
            );
          })}
        </div>

        {/* Leave Requests Table (Grouped / Categorized) */}
        <div className="table-wrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th>{t('category')} / {t('leave_type')}</th>
                <th>{t('from_date')}</th>
                <th>{t('to_date')}</th>
                <th>{t('total_days')}</th>
                <th>{t('reason')}</th>
                <th>{t('workflow_stage')}</th>
              </tr>
            </thead>
            <tbody>
              {pagedLeaves.length ? (
                pagedLeaves.map((r) => {
                  const type = value(r, 'leaveType', 'leave_type') || 'Annual';
                  const stage = String(value(r, 'workflowStage', 'workflow_stage', 'status') || 'pending').toLowerCase();
                  const col = getCategoryColor(type);

                  return (
                    <tr key={value(r, 'id')}>
                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '4px 10px',
                            borderRadius: 6,
                            fontSize: '12px',
                            fontWeight: 700,
                            background: col.bg,
                            color: col.color,
                            border: `1px solid ${col.border}`,
                          }}
                        >
                          {getCategoryLabel(type)}
                        </span>
                      </td>
                      <td>{formatDate(value(r, 'startDate', 'start_date'))}</td>
                      <td>{formatDate(value(r, 'endDate', 'end_date'))}</td>
                      <td>
                        <span className="code-pill">{value(r, 'days') || 1} {t('days')}</span>
                      </td>
                      <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {value(r, 'reason') || '—'}
                      </td>
                      <td>
                        <span className={`status-pill ${stage.includes('approved') ? 'approved' : stage.includes('reject') ? 'rejected' : 'pending'}`}>
                          {stage.includes('approved') ? t('approved') : stage.includes('reject') ? t('rejected') : t('pending')}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '30px 0' }}>
                    {t('no_leaves_found')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {sortedAndFilteredLeaves.length > pageSize ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 16,
              paddingTop: 14,
              borderTop: '1px solid var(--line)',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
              {t('showing')} {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sortedAndFilteredLeaves.length)} {t('of')} {sortedAndFilteredLeaves.length} {t('records')}
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="pagination-btn"
                aria-label="Previous page"
              >
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setPage(num)}
                  className={`pagination-btn ${page === num ? 'active' : ''}`}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="pagination-btn"
                aria-label="Next page"
              >
                ›
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </PortalShell>
  );
}
