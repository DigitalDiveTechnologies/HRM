'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api, getUser, normalizeRole } from '../../lib/auth';
import { money, v } from '../../lib/format';
import { useCompanyFilter, applyEmpFilter } from '../../lib/useCompanyFilter';

export default function ApprovalsPage() {
  const role = normalizeRole(getUser());
  const isAdmin = role === 'admin' || role === 'super_admin';

  const [rows, setRows] = useState([]);
  const { filteredEmpIds } = useCompanyFilter();
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  // Task 5.6: Routing Rules State
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [rules, setRules] = useState([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [savingRule, setSavingRule] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    requestType: 'expense',
    departmentId: '',
    minThreshold: 2000,
    maxThreshold: '',
    levelsCount: 2,
    approverRole: 'director',
    isActive: true,
  });

  const load = useCallback(() => {
    api('/approvals')
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);

  const loadRules = useCallback(async () => {
    setRulesLoading(true);
    try {
      const data = await api('/approvals/rules');
      setRules(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load approval routing rules:', e);
    } finally {
      setRulesLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 5_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  async function setStatus(id, status) {
    try {
      await api(`/approvals/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleSaveRule(e) {
    e.preventDefault();
    setSavingRule(true);
    setError('');
    setMsg('');
    try {
      await api('/approvals/rules', {
        method: 'POST',
        body: JSON.stringify({
          requestType: ruleForm.requestType,
          departmentId: ruleForm.departmentId ? Number(ruleForm.departmentId) : null,
          minThreshold: Number(ruleForm.minThreshold) || 0,
          maxThreshold: ruleForm.maxThreshold ? Number(ruleForm.maxThreshold) : null,
          levelsCount: Number(ruleForm.levelsCount) || 1,
          approverRole: ruleForm.approverRole,
          isActive: ruleForm.isActive,
        }),
      });
      setMsg('Approval routing rule saved successfully.');
      loadRules();
      setRuleForm({
        requestType: 'expense',
        departmentId: '',
        minThreshold: 0,
        maxThreshold: '',
        levelsCount: 1,
        approverRole: 'manager',
        isActive: true,
      });
    } catch (err) {
      setError(err.message || 'Failed to save approval rule');
    } finally {
      setSavingRule(false);
    }
  }

  async function handleDeleteRule(ruleId) {
    if (!confirm('Are you sure you want to delete this approval routing rule?')) return;
    try {
      await api(`/approvals/rules/${ruleId}`, { method: 'DELETE' });
      setMsg('Routing rule removed.');
      loadRules();
    } catch (err) {
      setError(err.message || 'Failed to delete routing rule');
    }
  }

  return (
    <AppShell title="Approval Workflow" subtitle="Leave, travel, expense and exit approvals">
      {error ? <div className="error" style={{ marginBottom: 12 }}>{error}</div> : null}
      {msg ? <div className="notice" style={{ marginBottom: 12 }}>{msg}</div> : null}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div className="muted" style={{ fontSize: 13 }}>
          Multi-tier workflow management with automated threshold routing
        </div>
        <button
          type="button"
          className="btn secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          onClick={() => {
            setShowRulesModal(true);
            loadRules();
          }}
        >
          ⚙️ Routing Rules
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Employee</th>
                <th>Level</th>
                <th>Approver</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {applyEmpFilter(rows, filteredEmpIds).map((a) => (
                <tr key={v(a, 'id')}>
                  <td>{v(a, 'title')}</td>
                  <td>{v(a, 'requestType', 'request_type')}</td>
                  <td>{v(a, 'fullName', 'full_name') || '-'}</td>
                  <td>L{v(a, 'levelNo', 'level_no')}</td>
                  <td>{v(a, 'approverRole', 'approver_role')}</td>
                  <td>
                    <Badge status={v(a, 'status')} />
                  </td>
                  <td>
                    {String(v(a, 'status')).toLowerCase() === 'pending' ? (
                      <div className="row-actions">
                        <button type="button" className="btn ok" onClick={() => setStatus(v(a, 'id'), 'approved')}>
                          Approve
                        </button>
                        <button type="button" className="btn danger" onClick={() => setStatus(v(a, 'id'), 'rejected')}>
                          Reject
                        </button>
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                    No pending approval requests.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: TASK 5.6 CONFIGURABLE APPROVAL ROUTING RULES */}
      {showRulesModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowRulesModal(false);
          }}
        >
          <div className="modal-content" style={{ maxWidth: 760 }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Multi-Tier Approval Routing Rules</h3>
                <span className="muted" style={{ fontSize: 13 }}>
                  Configure tier escalation, threshold amounts, and role requirements (Feature #16)
                </span>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setShowRulesModal(false)}>✕</button>
            </div>

            <div className="modal-body stack" style={{ gap: 16 }}>
              {/* Rules Table */}
              <div className="table-wrap" style={{ maxHeight: 220, overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Request Type</th>
                      <th>Threshold (AED)</th>
                      <th>Tiers</th>
                      <th>Approver Role</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                            {r.request_type}
                          </span>
                        </td>
                        <td>
                          {r.min_threshold > 0 ? (
                            <span>&gt; AED {Number(r.min_threshold).toLocaleString()}</span>
                          ) : (
                            <span className="muted">Any Amount</span>
                          )}
                          {r.max_threshold ? ` to AED ${Number(r.max_threshold).toLocaleString()}` : ''}
                        </td>
                        <td>
                          <span className="badge" style={{ background: r.levels_count > 1 ? 'rgba(139,92,246,0.15)' : 'rgba(2,132,199,0.15)', color: r.levels_count > 1 ? '#8b5cf6' : '#0284c7' }}>
                            {r.levels_count}-Tier ({r.levels_count > 1 ? 'Manager ➔ Director' : 'Direct Manager'})
                          </span>
                        </td>
                        <td>
                          <span style={{ textTransform: 'capitalize' }}>{r.approver_role || 'manager'}</span>
                        </td>
                        <td>
                          <span style={{ color: r.is_active ? '#10b981' : '#94a3b8', fontWeight: 600, fontSize: 12 }}>
                            {r.is_active ? '● Active' : '○ Inactive'}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn danger"
                            style={{ fontSize: 11, padding: '2px 8px' }}
                            onClick={() => handleDeleteRule(r.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!rules.length && !rulesLoading ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 16 }}>
                          No routing rules defined yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              {/* Add New Rule Form */}
              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: 'var(--brand)' }}>
                  Add / Update Routing Rule
                </div>
                <form className="stack" onSubmit={handleSaveRule} style={{ gap: 10 }}>
                  <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <label className="field">
                      Request Type
                      <select
                        value={ruleForm.requestType}
                        onChange={(e) => setRuleForm({ ...ruleForm, requestType: e.target.value })}
                      >
                        <option value="expense">Expense Claim</option>
                        <option value="leave">Leave Request</option>
                        <option value="travel">Business Travel</option>
                        <option value="exit">Exit / Resignation</option>
                      </select>
                    </label>

                    <label className="field">
                      Min Threshold (AED)
                      <input
                        type="number"
                        min="0"
                        value={ruleForm.minThreshold}
                        onChange={(e) => setRuleForm({ ...ruleForm, minThreshold: e.target.value })}
                        placeholder="0 for all"
                      />
                    </label>

                    <label className="field">
                      Max Threshold (Optional)
                      <input
                        type="number"
                        min="0"
                        value={ruleForm.maxThreshold}
                        onChange={(e) => setRuleForm({ ...ruleForm, maxThreshold: e.target.value })}
                        placeholder="Unlimited"
                      />
                    </label>
                  </div>

                  <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <label className="field">
                      Approval Tiers
                      <select
                        value={ruleForm.levelsCount}
                        onChange={(e) => setRuleForm({ ...ruleForm, levelsCount: Number(e.target.value) })}
                      >
                        <option value={1}>1-Tier (Direct Manager)</option>
                        <option value={2}>2-Tier (Manager ➔ Department Head / Director)</option>
                        <option value={3}>3-Tier (Manager ➔ Director ➔ C-Suite / GM)</option>
                      </select>
                    </label>

                    <label className="field">
                      Approver Role
                      <select
                        value={ruleForm.approverRole}
                        onChange={(e) => setRuleForm({ ...ruleForm, approverRole: e.target.value })}
                      >
                        <option value="manager">Manager</option>
                        <option value="director">Director / Dept Head</option>
                        <option value="finance_director">Finance Director</option>
                        <option value="general_manager">General Manager</option>
                      </select>
                    </label>

                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <button type="submit" className="btn" disabled={savingRule} style={{ width: '100%' }}>
                        {savingRule ? 'Saving...' : '+ Save Rule'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button type="button" className="btn secondary" onClick={() => setShowRulesModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
