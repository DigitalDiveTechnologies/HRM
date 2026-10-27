'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api, getUser, normalizeRole } from '../../lib/auth';
import { formatDate, todayISO, v } from '../../lib/format';
import { useCompanyFilter, buildLocalEmpIds } from '../../lib/useCompanyFilter';
import { getInstantEmployees } from '../../lib/employeeCache';

export default function BenefitsPage() {
  const [user, setUser] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        return getUser();
      } catch {}
    }
    return null;
  });
  const role = normalizeRole(user);
  const isAdmin = role === 'admin' || role === 'super_admin';
  const { selectedCompanyId } = useCompanyFilter();

  const [employees, setEmployees] = useState(() => {
    const instant = getInstantEmployees();
    return instant.filter((e) => !String(v(e, 'fullName', 'full_name')).toLowerCase().includes('ayan'));
  });

  const localFilteredEmpIds = useMemo(
    () => buildLocalEmpIds(employees, selectedCompanyId),
    [employees, selectedCompanyId]
  );

  const [plans, setPlans] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [activeTab, setActiveTab] = useState('assignments'); // 'assignments' | 'plans'

  // Modals
  const [showNewPlanModal, setShowNewPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [previewCardItem, setPreviewCardItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Forms
  const [planForm, setPlanForm] = useState({
    name: '',
    benefitType: 'medical_insurance',
    providerName: '',
    policyNumber: '',
    coverageSummary: '',
    annualPremiumEmployer: 3500,
    annualPremiumEmployee: 0,
    isActive: true,
  });

  const [assignForm, setAssignForm] = useState({
    employeeId: '',
    benefitPlanId: '',
    memberId: '',
    coverageTier: 'employee_only',
    dependentsCount: 0,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    status: 'active',
  });

  // Filters
  const [searchFilter, setSearchFilter] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [plansRes, assignsRes, empsRes] = await Promise.allSettled([
        api('/benefits/plans'),
        api('/benefits/assignments'),
        api('/employees'),
      ]);

      if (plansRes.status === 'fulfilled' && Array.isArray(plansRes.value)) {
        setPlans(plansRes.value);
      }
      if (assignsRes.status === 'fulfilled' && Array.isArray(assignsRes.value)) {
        setAssignments(assignsRes.value);
      }
      if (empsRes.status === 'fulfilled' && Array.isArray(empsRes.value) && empsRes.value.length > 0) {
        setEmployees(empsRes.value);
      }
    } catch (err) {
      setError(err.message || 'Failed to load benefits data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Create or Update Plan
  async function handleCreatePlan(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setMsg('');
    setError('');
    try {
      const payload = {
        name: planForm.name,
        benefitType: planForm.benefitType,
        providerName: planForm.providerName,
        policyNumber: planForm.policyNumber,
        coverageSummary: planForm.coverageSummary,
        annualPremiumEmployer: Number(planForm.annualPremiumEmployer || 0),
        annualPremiumEmployee: Number(planForm.annualPremiumEmployee || 0),
        isActive: planForm.isActive,
      };

      if (editingPlan) {
        await api(`/benefits/plans/${editingPlan.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setMsg('Corporate benefit scheme updated successfully!');
      } else {
        await api('/benefits/plans', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setMsg('Corporate benefit scheme created successfully!');
      }

      setShowNewPlanModal(false);
      setEditingPlan(null);
      setPlanForm({
        name: '',
        benefitType: 'medical_insurance',
        providerName: '',
        policyNumber: '',
        coverageSummary: '',
        annualPremiumEmployer: 3500,
        annualPremiumEmployee: 0,
        isActive: true,
      });
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to save benefit scheme');
    } finally {
      setSubmitting(false);
    }
  }

  const handleDeletePlan = async (p) => {
    const id = v(p, 'id');
    const name = v(p, 'name');
    if (!confirm(`Are you sure you want to remove benefit plan "${name}"?`)) return;
    try {
      await api(`/benefits/plans/${id}`, { method: 'DELETE' });
      setMsg(`Benefit plan "${name}" deleted successfully.`);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to delete plan.');
    }
  };

  const openEditPlanModal = (p) => {
    setEditingPlan(p);
    setPlanForm({
      name: v(p, 'name') || '',
      benefitType: v(p, 'benefitType', 'benefit_type') || 'medical_insurance',
      providerName: v(p, 'providerName', 'provider_name') || '',
      policyNumber: v(p, 'policyNumber', 'policy_number') || '',
      coverageSummary: v(p, 'coverageSummary', 'coverage_summary') || '',
      annualPremiumEmployer: Number(v(p, 'annualPremiumEmployer', 'annual_premium_employer') || 0),
      annualPremiumEmployee: Number(v(p, 'annualPremiumEmployee', 'annual_premium_employee') || 0),
      isActive: p.isActive !== false && p.is_active !== false,
    });
    setShowNewPlanModal(true);
  };

  // Assign or Update Plan
  async function handleAssignBenefit(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setMsg('');
    setError('');
    try {
      const payload = {
        employeeId: Number(assignForm.employeeId),
        benefitPlanId: Number(assignForm.benefitPlanId),
        memberId: assignForm.memberId,
        coverageTier: assignForm.coverageTier,
        dependentsCount: Number(assignForm.dependentsCount || 0),
        startDate: assignForm.startDate,
        endDate: assignForm.endDate,
        status: assignForm.status,
      };

      if (editingAssignment) {
        await api(`/benefits/assignments/${editingAssignment.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setMsg('Employee insurance enrolment updated successfully!');
      } else {
        await api('/benefits/assign', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setMsg('Insurance scheme assigned to employee successfully!');
      }

      setShowAssignModal(false);
      setEditingAssignment(null);
      setAssignForm({
        employeeId: '',
        benefitPlanId: '',
        memberId: '',
        coverageTier: 'employee_only',
        dependentsCount: 0,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        status: 'active',
      });
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to assign benefit plan');
    } finally {
      setSubmitting(false);
    }
  }

  const handleDeleteAssignment = async (a) => {
    const id = v(a, 'id');
    const empName = v(a, 'fullName', 'full_name') || 'Employee';
    if (!confirm(`Are you sure you want to remove insurance enrolment for ${empName}?`)) return;
    try {
      await api(`/benefits/assignments/${id}`, { method: 'DELETE' });
      setMsg('Enrolment removed successfully.');
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to remove enrolment.');
    }
  };

  const openEditAssignmentModal = (a) => {
    setEditingAssignment(a);
    setAssignForm({
      employeeId: String(v(a, 'employeeId', 'employee_id') || ''),
      benefitPlanId: String(v(a, 'benefitPlanId', 'benefit_plan_id') || ''),
      memberId: v(a, 'memberId', 'member_id') || '',
      coverageTier: v(a, 'coverageTier', 'coverage_tier') || 'employee_only',
      dependentsCount: Number(v(a, 'dependentsCount', 'dependents_count') || 0),
      startDate: String(v(a, 'startDate', 'start_date') || '').slice(0, 10),
      endDate: String(v(a, 'endDate', 'end_date') || '').slice(0, 10),
      status: v(a, 'status') || 'active',
    });
    setShowAssignModal(true);
  };

  // Filtered assignments
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      const empId = String(v(a, 'employeeId', 'employee_id') || '');
      if (localFilteredEmpIds && !localFilteredEmpIds.has(empId)) return false;

      const name = String(v(a, 'fullName', 'full_name') || '').toLowerCase();
      const code = String(v(a, 'empCode', 'emp_code') || '').toLowerCase();
      const memId = String(v(a, 'memberId', 'member_id') || '').toLowerCase();
      const planName = String(v(a, 'planName', 'plan_name') || '').toLowerCase();
      const q = searchFilter.toLowerCase();
      const matchSearch = !q || name.includes(q) || code.includes(q) || memId.includes(q) || planName.includes(q);

      const tier = String(v(a, 'coverageTier', 'coverage_tier') || '').toLowerCase();
      const matchTier = !tierFilter || tier === tierFilter.toLowerCase();

      const stat = String(v(a, 'status') || '').toLowerCase();
      const matchStatus = !statusFilter || stat === statusFilter.toLowerCase();

      return matchSearch && matchTier && matchStatus;
    });
  }, [assignments, localFilteredEmpIds, searchFilter, tierFilter, statusFilter]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalEnrolled = assignments.filter((a) => String(v(a, 'status')).toLowerCase() === 'active').length;
    const totalDependents = assignments.reduce(
      (sum, a) => sum + (Number(v(a, 'dependentsCount', 'dependents_count')) || 0),
      0
    );
    const totalEmployerCost = assignments.reduce(
      (sum, a) => sum + (Number(v(a, 'annualPremiumEmployer', 'annual_premium_employer')) || 0),
      0
    );
    const totalPlans = plans.length;
    return { totalEnrolled, totalDependents, totalEmployerCost, totalPlans };
  }, [assignments, plans]);

  return (
    <AppShell
      title="Benefits & Medical Insurance"
      subtitle="Corporate health insurance tiers, policy numbers, dependent coverage & premium contributions"
    >
      {error ? <div className="error" style={{ marginBottom: 16 }}>{error}</div> : null}
      {msg ? (
        <div className="card" style={{ marginBottom: 16, background: 'rgba(16, 185, 129, 0.1)', color: '#065f46', border: '1px solid #10b981', padding: '12px 18px', fontWeight: 600 }}>
          ✓ {msg}
        </div>
      ) : null}

      {/* KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div className="card" style={{ padding: '18px 20px', borderRadius: 12 }}>
          <div className="muted" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Active Schemes</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--ink, #0f172a)', marginTop: 4 }}>{metrics.totalPlans}</div>
          <div className="muted" style={{ fontSize: '12px', marginTop: 2 }}>Medical & Life Insurance</div>
        </div>

        <div className="card" style={{ padding: '18px 20px', borderRadius: 12 }}>
          <div className="muted" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Enrolled Staff</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#008fa8', marginTop: 4 }}>{metrics.totalEnrolled}</div>
          <div className="muted" style={{ fontSize: '12px', marginTop: 2 }}>Active policy holders</div>
        </div>

        <div className="card" style={{ padding: '18px 20px', borderRadius: 12 }}>
          <div className="muted" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Covered Dependents</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#8b5cf6', marginTop: 4 }}>{metrics.totalDependents}</div>
          <div className="muted" style={{ fontSize: '12px', marginTop: 2 }}>Spouses & Children covered</div>
        </div>

        <div className="card" style={{ padding: '18px 20px', borderRadius: 12 }}>
          <div className="muted" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Annual Employer Cost</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#10b981', marginTop: 4 }}>
            AED {metrics.totalEmployerCost.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div className="muted" style={{ fontSize: '12px', marginTop: 2 }}>Annual employer subsidies</div>
        </div>
      </div>

      {/* Main Section */}
      <div className="card" style={{ padding: '24px', borderRadius: 14 }}>
        {/* Navigation & Action Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
          {/* Tabs */}
          <div style={{ display: 'inline-flex', background: 'var(--surface-alt, #f1f5f9)', padding: 4, borderRadius: 8, border: '1px solid var(--line, #e2e8f0)' }}>
            <button
              type="button"
              onClick={() => setActiveTab('assignments')}
              style={{
                padding: '6px 16px',
                fontSize: '13px',
                fontWeight: activeTab === 'assignments' ? 700 : 500,
                borderRadius: 6,
                border: 'none',
                background: activeTab === 'assignments' ? '#00b8db' : 'transparent',
                color: activeTab === 'assignments' ? '#ffffff' : 'var(--muted, #64748b)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Employee Enrolments ({assignments.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('plans')}
              style={{
                padding: '6px 16px',
                fontSize: '13px',
                fontWeight: activeTab === 'plans' ? 700 : 500,
                borderRadius: 6,
                border: 'none',
                background: activeTab === 'plans' ? '#00b8db' : 'transparent',
                color: activeTab === 'plans' ? '#ffffff' : 'var(--muted, #64748b)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Corporate Schemes ({plans.length})
            </button>
          </div>

          {/* Action Buttons */}
          {isAdmin ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setShowAssignModal(true)}
                style={{
                  height: 38,
                  padding: '0 16px',
                  borderRadius: 8,
                  background: '#00b8db',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '13px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(0, 184, 219, 0.25)',
                }}
              >
                + Assign Plan to Employee
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setShowNewPlanModal(true)}
                style={{
                  height: 38,
                  padding: '0 16px',
                  borderRadius: 8,
                  background: 'var(--surface-alt, #f8fafc)',
                  border: '1px solid var(--line-strong, #cbd5e1)',
                  color: 'var(--ink, #0f172a)',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                + New Benefit Plan
              </button>
            </div>
          ) : null}
        </div>

        {/* TAB 1: EMPLOYEE ENROLMENTS */}
        {activeTab === 'assignments' ? (
          <div>
            {/* Filters Bar */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
              <input
                type="text"
                placeholder="Search staff, code, member ID, plan..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{
                  fontSize: '12.5px',
                  padding: '7px 12px',
                  borderRadius: 6,
                  minWidth: 240,
                  border: '1px solid var(--line-strong, #cbd5e1)',
                  background: 'var(--surface, #ffffff)',
                  color: 'var(--ink)',
                  outline: 'none',
                }}
              />
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                style={{
                  fontSize: '12.5px',
                  padding: '7px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--line-strong, #cbd5e1)',
                  background: 'var(--surface, #ffffff)',
                  color: 'var(--ink)',
                  outline: 'none',
                }}
              >
                <option value="">All Coverage Tiers</option>
                <option value="employee_only">Employee Only</option>
                <option value="family">Family Coverage</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  fontSize: '12.5px',
                  padding: '7px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--line-strong, #cbd5e1)',
                  background: 'var(--surface, #ffffff)',
                  color: 'var(--ink)',
                  outline: 'none',
                }}
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Table */}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Plan & Provider</th>
                    <th>Member ID</th>
                    <th>Coverage Tier</th>
                    <th>Dependents</th>
                    <th>Validity Period</th>
                    <th>Annual Employer Cost</th>
                    <th style={{ textAlign: 'center' }}>Digital Card</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssignments.map((a) => {
                    const isFamily = String(v(a, 'coverageTier', 'coverage_tier')).toLowerCase() === 'family';
                    return (
                      <tr key={v(a, 'id')}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{v(a, 'fullName', 'full_name')}</div>
                          <div className="muted" style={{ fontSize: '11px' }}>
                            {v(a, 'empCode', 'emp_code')} • {v(a, 'departmentName', 'department_name') || 'General'}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#008fa8' }}>{v(a, 'planName', 'plan_name')}</div>
                          <div className="muted" style={{ fontSize: '11px' }}>
                            {v(a, 'providerName', 'provider_name')} • Pol: {v(a, 'policyNumber', 'policy_number')}
                          </div>
                        </td>
                        <td>
                          <code style={{ fontSize: '12px', padding: '2px 6px', background: 'var(--surface-alt, #f1f5f9)', borderRadius: 4 }}>
                            {v(a, 'memberId', 'member_id') || '—'}
                          </code>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: '11.5px',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: 6,
                              background: isFamily ? 'rgba(139, 92, 246, 0.12)' : 'rgba(0, 184, 219, 0.12)',
                              color: isFamily ? '#7c3aed' : '#008fa8',
                            }}
                          >
                            {isFamily ? '👨‍👩‍👧 Family' : '👤 Employee Only'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>
                          {v(a, 'dependentsCount', 'dependents_count') || 0}
                        </td>
                        <td style={{ fontSize: '12px' }}>
                          {formatDate(v(a, 'startDate', 'start_date'))} → {formatDate(v(a, 'endDate', 'end_date'))}
                        </td>
                        <td style={{ fontWeight: 700, color: '#10b981' }}>
                          AED {Number(v(a, 'annualPremiumEmployer', 'annual_premium_employer') || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                            <button
                              type="button"
                              className="btn"
                              onClick={() => setPreviewCardItem(a)}
                              style={{
                                padding: '3px 8px',
                                fontSize: '11px',
                                fontWeight: 600,
                                background: 'rgba(0, 184, 219, 0.1)',
                                color: '#008fa8',
                                border: '1px solid rgba(0, 184, 219, 0.3)',
                                borderRadius: 6,
                                cursor: 'pointer',
                              }}
                            >
                              💳 Card
                            </button>
                            {isAdmin && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openEditAssignmentModal(a)}
                                  style={{
                                    padding: '3px 8px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    background: '#ffffff',
                                    color: '#334155',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAssignment(a)}
                                  style={{
                                    padding: '3px 8px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    background: '#fff1f2',
                                    color: '#e11d48',
                                    border: '1px solid #fecdd3',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Remove
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!filteredAssignments.length ? (
                    <tr>
                      <td colSpan={8} className="muted" style={{ textAlign: 'center', padding: '28px 0' }}>
                        No employee insurance enrolments found. Click &quot;+ Assign Plan to Employee&quot; to enroll staff.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {/* TAB 2: CORPORATE BENEFIT PLANS */}
        {activeTab === 'plans' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
            {plans.map((p) => (
              <div
                key={v(p, 'id')}
                className="card"
                style={{
                  padding: '20px',
                  borderRadius: 12,
                  border: '1px solid var(--line, #e2e8f0)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>
                        {v(p, 'name')}
                      </h4>
                      <div className="muted" style={{ fontSize: '12px', marginTop: 2 }}>
                        {v(p, 'providerName', 'provider_name')}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 9999,
                        background: 'rgba(16, 185, 129, 0.12)',
                        color: '#10b981',
                      }}
                    >
                      Active Tier
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                      <span className="muted">Policy Number</span>
                      <strong>{v(p, 'policyNumber', 'policy_number')}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                      <span className="muted">Benefit Type</span>
                      <span style={{ textTransform: 'capitalize' }}>
                        {String(v(p, 'benefitType', 'benefit_type')).replace('_', ' ')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                      <span className="muted">Annual Employer Subsidy</span>
                      <strong style={{ color: '#10b981' }}>
                        AED {Number(v(p, 'annualPremiumEmployer', 'annual_premium_employer') || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                      <span className="muted">Annual Employee Deductible</span>
                      <strong>
                        AED {Number(v(p, 'annualPremiumEmployee', 'annual_premium_employee') || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                  </div>

                  {v(p, 'coverageSummary', 'coverage_summary') ? (
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        background: 'var(--surface-alt, #f8fafc)',
                        fontSize: '12px',
                        color: 'var(--muted, #64748b)',
                        lineHeight: 1.45,
                        marginBottom: 14,
                      }}
                    >
                      {v(p, 'coverageSummary', 'coverage_summary')}
                    </div>
                  ) : null}
                </div>

                <div style={{ paddingTop: 12, borderTop: '1px solid var(--line, #f1f5f9)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontSize: '12px', color: '#008fa8', fontWeight: 600 }}>
                    👥 {v(p, 'enrolledCount', 'enrolled_count') || 0} enrolled
                  </span>
                  <div style={{ display: 'inline-flex', gap: 6 }}>
                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditPlanModal(p)}
                          style={{
                            padding: '4px 10px',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            background: '#ffffff',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                            borderRadius: 6,
                            cursor: 'pointer',
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePlan(p)}
                          style={{
                            padding: '4px 10px',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            background: '#fff1f2',
                            color: '#e11d48',
                            border: '1px solid #fecdd3',
                            borderRadius: 6,
                            cursor: 'pointer',
                          }}
                        >
                          Remove
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        setEditingAssignment(null);
                        setAssignForm((f) => ({ ...f, benefitPlanId: String(v(p, 'id')) }));
                        setShowAssignModal(true);
                      }}
                      style={{ padding: '4px 10px', fontSize: '11.5px', background: 'var(--surface-alt)' }}
                    >
                      + Enroll
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* MODAL: ASSIGN BENEFIT PLAN */}
      {showAssignModal ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 20,
          }}
        >
          <div className="card" style={{ maxWidth: 540, width: '100%', padding: '24px', borderRadius: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
                {editingAssignment ? 'Edit Employee Insurance Enrolment' : 'Assign Insurance Scheme to Employee'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAssignModal(false);
                  setEditingAssignment(null);
                }}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAssignBenefit} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              <label className="field" style={{ gridColumn: '1 / -1' }}>
                <span>Select Employee</span>
                <select
                  required
                  value={assignForm.employeeId}
                  onChange={(e) => setAssignForm((f) => ({ ...f, employeeId: e.target.value }))}
                >
                  <option value="">Choose Employee…</option>
                  {employees
                    .filter((e) => !localFilteredEmpIds || localFilteredEmpIds.has(String(v(e, 'id'))))
                    .map((e) => (
                      <option key={v(e, 'id')} value={v(e, 'id')}>
                        {v(e, 'fullName', 'full_name')} ({v(e, 'empCode', 'emp_code')})
                      </option>
                    ))}
                </select>
              </label>

              <label className="field" style={{ gridColumn: '1 / -1' }}>
                <span>Benefit Scheme</span>
                <select
                  required
                  value={assignForm.benefitPlanId}
                  onChange={(e) => setAssignForm((f) => ({ ...f, benefitPlanId: e.target.value }))}
                >
                  <option value="">Choose Insurance Scheme…</option>
                  {plans.map((p) => (
                    <option key={v(p, 'id')} value={v(p, 'id')}>
                      {v(p, 'name')} — {v(p, 'providerName', 'provider_name')} (Pol: {v(p, 'policyNumber', 'policy_number')})
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Member ID / Card #</span>
                <input
                  type="text"
                  placeholder="e.g. DAM-8829104"
                  value={assignForm.memberId}
                  onChange={(e) => setAssignForm((f) => ({ ...f, memberId: e.target.value }))}
                />
              </label>

              <label className="field">
                <span>Coverage Tier</span>
                <select
                  value={assignForm.coverageTier}
                  onChange={(e) => setAssignForm((f) => ({ ...f, coverageTier: e.target.value }))}
                >
                  <option value="employee_only">Employee Only</option>
                  <option value="family">Family (Spouse / Children)</option>
                </select>
              </label>

              {assignForm.coverageTier === 'family' ? (
                <label className="field">
                  <span>Number of Dependents</span>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={assignForm.dependentsCount}
                    onChange={(e) => setAssignForm((f) => ({ ...f, dependentsCount: e.target.value }))}
                  />
                </label>
              ) : null}

              <label className="field">
                <span>Status</span>
                <select
                  value={assignForm.status}
                  onChange={(e) => setAssignForm((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="pending">Pending</option>
                </select>
              </label>

              <label className="field">
                <span>Start Date</span>
                <input
                  type="date"
                  required
                  value={assignForm.startDate}
                  onChange={(e) => setAssignForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </label>

              <label className="field">
                <span>End Date</span>
                <input
                  type="date"
                  required
                  value={assignForm.endDate}
                  onChange={(e) => setAssignForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </label>

              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="button" className="btn" onClick={() => setShowAssignModal(false)} style={{ background: 'var(--surface-alt)' }}>
                  Cancel
                </button>
                <button type="submit" className="btn" disabled={submitting} style={{ background: '#00b8db', color: '#ffffff', fontWeight: 600 }}>
                  {submitting ? 'Assigning…' : 'Confirm Enrolment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* MODAL: CREATE BENEFIT PLAN */}
      {showNewPlanModal ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 20,
          }}
        >
          <div className="card" style={{ maxWidth: 540, width: '100%', padding: '24px', borderRadius: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
                {editingPlan ? 'Edit Corporate Benefit Scheme' : 'Add Corporate Benefit Scheme'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowNewPlanModal(false);
                  setEditingPlan(null);
                }}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePlan} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              <label className="field" style={{ gridColumn: '1 / -1' }}>
                <span>Scheme / Tier Name</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Daman Enhanced Gold, AXA Silver"
                  value={planForm.name}
                  onChange={(e) => setPlanForm((f) => ({ ...f, name: e.target.value }))}
                />
              </label>

              <label className="field">
                <span>Provider Name</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Daman National Insurance"
                  value={planForm.providerName}
                  onChange={(e) => setPlanForm((f) => ({ ...f, providerName: e.target.value }))}
                />
              </label>

              <label className="field">
                <span>Master Policy Number</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. DAMAN-UAE-998822"
                  value={planForm.policyNumber}
                  onChange={(e) => setPlanForm((f) => ({ ...f, policyNumber: e.target.value }))}
                />
              </label>

              <label className="field">
                <span>Annual Employer Premium (AED)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={planForm.annualPremiumEmployer}
                  onChange={(e) => setPlanForm((f) => ({ ...f, annualPremiumEmployer: e.target.value }))}
                />
              </label>

              <label className="field">
                <span>Annual Employee Premium (AED)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={planForm.annualPremiumEmployee}
                  onChange={(e) => setPlanForm((f) => ({ ...f, annualPremiumEmployee: e.target.value }))}
                />
              </label>

              <label className="field" style={{ gridColumn: '1 / -1' }}>
                <span>Coverage Summary</span>
                <textarea
                  rows={3}
                  placeholder="e.g. Inpatient & Outpatient 100% network direct billing across UAE & GCC..."
                  value={planForm.coverageSummary}
                  onChange={(e) => setPlanForm((f) => ({ ...f, coverageSummary: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--line-strong, #cbd5e1)',
                    background: 'var(--surface, #ffffff)',
                    fontSize: '12.5px',
                    boxSizing: 'border-box',
                  }}
                />
              </label>

              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="button" className="btn" onClick={() => setShowNewPlanModal(false)} style={{ background: 'var(--surface-alt)' }}>
                  Cancel
                </button>
                <button type="submit" className="btn" disabled={submitting} style={{ background: '#00b8db', color: '#ffffff', fontWeight: 600 }}>
                  {submitting ? 'Creating…' : 'Create Scheme'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* MODAL: DIGITAL INSURANCE CARD PREVIEW */}
      {previewCardItem ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
            padding: 20,
          }}
        >
          <div style={{ maxWidth: 440, width: '100%' }}>
            {/* Digital Insurance Card UI */}
            <div
              style={{
                borderRadius: 16,
                padding: '24px',
                background: 'linear-gradient(135deg, #092c42 0%, #0369a1 50%, #0284c7 100%)',
                color: '#ffffff',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Card Hologram Wave */}
              <div
                style={{
                  position: 'absolute',
                  top: -60,
                  right: -60,
                  width: 180,
                  height: 180,
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.08)',
                  pointerEvents: 'none',
                }}
              />

              {/* Provider Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: '10.5px', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.85 }}>
                    HEALTHCARE IDENTIFICATION CARD
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 800, marginTop: 2 }}>
                    {v(previewCardItem, 'providerName', 'provider_name')}
                  </div>
                </div>
                <div
                  style={{
                    padding: '4px 10px',
                    borderRadius: 9999,
                    background: 'rgba(255, 255, 255, 0.2)',
                    fontSize: '11px',
                    fontWeight: 700,
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  {v(previewCardItem, 'planName', 'plan_name')}
                </div>
              </div>

              {/* Member Details */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: '11px', opacity: 0.8 }}>INSURED MEMBER</div>
                <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '0.02em' }}>
                  {v(previewCardItem, 'fullName', 'full_name')}
                </div>
                <div style={{ fontSize: '12px', opacity: 0.9 }}>
                  Emp Code: {v(previewCardItem, 'empCode', 'emp_code')}
                </div>
              </div>

              {/* Card Numbers Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.2)', borderBottom: '1px solid rgba(255,255,255,0.2)', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: '10px', opacity: 0.75 }}>MEMBER ID</div>
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>
                    {v(previewCardItem, 'memberId', 'member_id') || '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', opacity: 0.75 }}>POLICY NUMBER</div>
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>
                    {v(previewCardItem, 'policyNumber', 'policy_number')}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', opacity: 0.75 }}>COVERAGE TIER</div>
                  <div style={{ fontSize: '12.5px', fontWeight: 600 }}>
                    {String(v(previewCardItem, 'coverageTier', 'coverage_tier')).toLowerCase() === 'family'
                      ? `Family (${v(previewCardItem, 'dependentsCount', 'dependents_count')} dep)`
                      : 'Employee Only'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', opacity: 0.75 }}>VALID THROUGH</div>
                  <div style={{ fontSize: '12.5px', fontWeight: 600 }}>
                    {formatDate(v(previewCardItem, 'endDate', 'end_date'))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', opacity: 0.85 }}>
                <span>Direct Billing Network • UAE & GCC</span>
                <span style={{ fontWeight: 700 }}>STATUS: ACTIVE</span>
              </div>
            </div>

            {/* Close button */}
            <div style={{ marginTop: 12, textAlign: 'center' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setPreviewCardItem(null)}
                style={{
                  background: 'var(--surface, #ffffff)',
                  border: '1px solid var(--line, #cbd5e1)',
                  padding: '8px 24px',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close Digital Card
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
