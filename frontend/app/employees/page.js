'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AppShell, { Badge } from '../../components/AppShell';
import EmployeeMasterForm from '../../components/EmployeeMasterForm';
import { api, apiBlob, apiUpload, getApiBase, getUser, normalizeRole } from '../../lib/auth';
import {
  emptyMasterForm,
  masterFormFromEmployee,
  masterPayloadFromForm,
} from '../../lib/employeeMaster';
import { formatDate, v } from '../../lib/format';

function getEmployeePhotoUrl(emp) {
  if (!emp) return null;
  const p = v(emp, 'photoPath', 'photo_path');
  if (!p) return null;
  return `${getApiBase().replace(/\/api\/?$/, '')}/${String(p).replace(/^\//, '')}`;
}

function getInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'E';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function EmployeesContent() {
  const role = normalizeRole(getUser());
  const isAdmin = role === 'admin';
  const [rows, setRows] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('gocs_cached_employees');
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return [];
  });
  const [loadingEmps, setLoadingEmps] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('gocs_cached_employees');
        if (cached && JSON.parse(cached).length > 0) return false;
      } catch {}
    }
    return true;
  });
  const [departments, setDepartments] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [employmentTypes, setEmploymentTypes] = useState([]);
  const [masterForm, setMasterForm] = useState(emptyMasterForm());
  const [savingEdit, setSavingEdit] = useState(false);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [createForm, setCreateForm] = useState(emptyMasterForm());
  const [creating, setCreating] = useState(false);
  const [createLoginPopup, setCreateLoginPopup] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  // Profile View multi-tab state (matching reference screenshot)
  const [selectedTab, setSelectedTab] = useState('Personal info');
  const [showProfilePassword, setShowProfilePassword] = useState(false);
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [payrollForm, setPayrollForm] = useState({
    basicSalary: '',
    allowances: '',
    grossSalary: '',
    paymentMethod: 'WPS (SIF File Generation)',
    bankName: 'Emirates NBD',
    iban: '',
  });
  const [savingPayroll, setSavingPayroll] = useState(false);
  const [empPayslips, setEmpPayslips] = useState([]);
  const [empDocuments, setEmpDocuments] = useState([]);
  const [empLeaves, setEmpLeaves] = useState([]);
  const [empBalances, setEmpBalances] = useState([]);
  const [empAttendance, setEmpAttendance] = useState([]);
  const [loadingTabDetails, setLoadingTabDetails] = useState(false);
  const [empSwitcherOpen, setEmpSwitcherOpen] = useState(false);
  const [empSearch, setEmpSearch] = useState('');

  // Table search & filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [histForm, setHistForm] = useState({
    jobTitle: '',
    departmentName: '',
    managerName: '',
    startDate: '',
    endDate: '',
    notes: '',
  });

  const searchParams = useSearchParams();
  const queryId = searchParams ? searchParams.get('id') : null;

  useEffect(() => {
    if (queryId && rows.length) {
      const found = rows.find((r) => String(v(r, 'id')) === String(queryId));
      if (found) {
        openDetail(found);
        setTimeout(() => {
          const el = document.getElementById('employee-profile-detail');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 150);
      }
    }
  }, [queryId, rows]);

  // Calculate next sequential employee code (e.g. DD-1015)
  const calculateNextCode = (list) => {
    let maxNum = 1000;
    (list || []).forEach((e) => {
      const code = String(v(e, 'empCode', 'emp_code') || '');
      const match = code.match(/(\d+)/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    });
    return `DD-${maxNum + 1}`;
  };

  const load = useCallback(() => {
    // 1. Prioritized immediate load for Employees table
    api('/employees')
      .then((emps) => {
        const list = emps || [];
        setRows(list);
        setLoadingEmps(false);
        try {
          localStorage.setItem('gocs_cached_employees', JSON.stringify(list));
        } catch {}
        setCreateForm((prev) => ({
          ...prev,
          empCode: prev.empCode || calculateNextCode(list),
        }));
      })
      .catch((e) => {
        setError(e.message);
        setLoadingEmps(false);
      });

    // 2. Load Admin dropdown masters in background
    if (isAdmin) {
      Promise.all([
        api('/employees/departments'),
        api('/divisions?activeOnly=true'),
        api('/designations?activeOnly=true'),
        api('/employment-types?activeOnly=true'),
      ])
        .then(([depts, divs, desigs, empTypes]) => {
          if (depts) setDepartments(depts || []);
          if (divs) setDivisions(divs || []);
          if (desigs) setDesignations(desigs || []);
          if (empTypes) setEmploymentTypes(empTypes || []);
        })
        .catch(() => {});
    }
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  async function openDetail(e) {
    if (!e) return;
    const empId = String(v(e, 'id'));
    setSelected(e);
    setIsEditingProfile(false);
    setSelectedTab('Personal info');
    try {
      setMasterForm(masterFormFromEmployee(e));
    } catch {}
    setLoadingTabDetails(true);

    setTimeout(() => {
      try {
        const el = document.getElementById('employee-profile-detail');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch {}
    }, 60);

    try {
      const [fullRes, histRes, payRes, docRes, leaveRes, balRes, attRes] = await Promise.allSettled([
        api(`/employees/${empId}`),
        api(`/org/history/${empId}`),
        api('/payroll'),
        api('/documents'),
        api('/leave'),
        api('/leave/balances'),
        api('/attendance'),
      ]);

      if (
        fullRes.status === 'fulfilled' &&
        fullRes.value &&
        typeof fullRes.value === 'object' &&
        !fullRes.value.error &&
        v(fullRes.value, 'id')
      ) {
        setSelected(fullRes.value);
        try {
          setMasterForm(masterFormFromEmployee(fullRes.value));
        } catch {}
      }
      if (histRes.status === 'fulfilled') {
        setHistory(Array.isArray(histRes.value) ? histRes.value : []);
      }
      if (payRes.status === 'fulfilled' && Array.isArray(payRes.value)) {
        setEmpPayslips(payRes.value.filter((p) => String(v(p, 'employeeId', 'employee_id')) === empId));
      }
      if (docRes.status === 'fulfilled' && Array.isArray(docRes.value)) {
        setEmpDocuments(docRes.value.filter((d) => String(v(d, 'employeeId', 'employee_id')) === empId));
      }
      if (leaveRes.status === 'fulfilled' && Array.isArray(leaveRes.value)) {
        setEmpLeaves(leaveRes.value.filter((l) => String(v(l, 'employeeId', 'employee_id')) === empId));
      }
      if (balRes.status === 'fulfilled' && Array.isArray(balRes.value)) {
        setEmpBalances(balRes.value.filter((b) => String(v(b, 'employeeId', 'employee_id')) === empId));
      }
      if (attRes.status === 'fulfilled' && Array.isArray(attRes.value)) {
        setEmpAttendance(attRes.value.filter((a) => String(v(a, 'employeeId', 'employee_id')) === empId));
      }
    } catch (err) {
      setError(err?.message || 'Failed to load employee details');
    } finally {
      setLoadingTabDetails(false);
    }
  }

  async function addHistory(ev) {
    ev.preventDefault();
    if (!selected) return;
    try {
      await api('/org/history', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: Number(v(selected, 'id')),
          ...histForm,
          endDate: histForm.endDate || null,
        }),
      });
      setHistForm({ jobTitle: '', departmentName: '', managerName: '', startDate: '', endDate: '', notes: '' });
      openDetail(selected);
    } catch (err) {
      setError(err.message);
    }
  }

  async function createEmployee(ev) {
    ev.preventDefault();
    setError('');
    setMsg('');
    setCreating(true);
    try {
      const payload = masterPayloadFromForm(createForm, { includePassword: true });
      const res = await api('/employees', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const empId = v(res.employee, 'id');
      const appEmail = String(res.login?.email || createForm.email || '')
        .trim()
        .toLowerCase();
      const appPassword = String(createForm.password || 'demo123').trim();
      const employeeName =
        v(res.employee, 'fullName', 'full_name') ||
        createForm.fullName ||
        [createForm.firstName, createForm.lastName].filter(Boolean).join(' ') ||
        'Employee';
      if (createForm.photoFile && empId) {
        const fd = new FormData();
        fd.append('file', createForm.photoFile);
        await apiUpload(`/employees/${empId}/photo`, fd);
      }
      setCreateLoginPopup({
        name: employeeName,
        email: appEmail,
        password: appPassword,
      });
      setShowCreateModal(false);
      setMsg(`Employee created: ${employeeName}`);
      if (createForm.photoPreview) {
        try {
          URL.revokeObjectURL(createForm.photoPreview);
        } catch {
          /* ignore */
        }
      }
      setCreateForm(emptyMasterForm());
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function saveEmployeeEdit(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    if (!selected) return;
    setError('');
    setMsg('');
    setSavingEdit(true);
    try {
      const payload = masterPayloadFromForm(masterForm);
      const empId = v(selected, 'id');
      const isRemovingPhoto = !!masterForm.photoRemoved || (!masterForm.photoPath && !masterForm.photoPreview && !masterForm.photoFile);

      const res = await api(`/employees/${empId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      if (masterForm.photoFile) {
        const fd = new FormData();
        fd.append('file', masterForm.photoFile);
        await apiUpload(`/employees/${empId}/photo`, fd);
      } else if (isRemovingPhoto) {
        try {
          await fetch(`/api/employees/${empId}/photo`, { method: 'DELETE' });
        } catch (e) {
          console.error('Direct DB photo delete error:', e);
        }
        try {
          await api(`/employees/${empId}/photo`, { method: 'DELETE' });
        } catch {
          try {
            await api(`/employees/${empId}/photo/delete`, { method: 'POST' });
          } catch {
            try {
              await api(`/employees/${empId}/remove-photo`, { method: 'POST' });
            } catch {}
          }
        }
      }

      setMsg(res.message || 'Employee updated.');
      const updated = await api(`/employees/${empId}`);
      if (isRemovingPhoto) {
        updated.photo_path = null;
        updated.photoPath = null;
      }
      setSelected(updated);
      setMasterForm(masterFormFromEmployee(updated));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingEdit(false);
    }
  }


  async function resetAppPassword(ev) {
    ev.preventDefault();
    if (!selected || !resetPassword.trim()) return;
    setError('');
    setMsg('');
    setResetting(true);
    try {
      const res = await api(`/employees/${v(selected, 'id')}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password: resetPassword.trim() }),
      });
      setMsg(res.message || 'App login password updated successfully.');
      setResetPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setResetting(false);
    }
  }

  function openPayrollModal() {
    const fin = selectedMd?.finance || {};
    const basic = fin.basicSalary !== undefined && fin.basicSalary !== null ? String(fin.basicSalary) : '';
    const allow = fin.allowances !== undefined && fin.allowances !== null ? String(fin.allowances) : '';
    const gross = fin.grossSalary !== undefined && fin.grossSalary !== null ? String(fin.grossSalary) : (basic ? String(Number(basic || 0) + Number(allow || 0)) : '');
    setPayrollForm({
      basicSalary: basic,
      allowances: allow,
      grossSalary: gross,
      paymentMethod: fin.paymentMethod || 'WPS (SIF File Generation)',
      bankName: fin.bankName || '',
      iban: fin.iban || fin.accountNo || '',
    });
    setShowPayrollModal(true);
  }

  async function savePayrollDetails(ev) {
    ev.preventDefault();
    if (!selected) return;
    setError('');
    setMsg('');
    setSavingPayroll(true);
    try {
      const basicNum = Number(payrollForm.basicSalary) || 0;
      const allowNum = Number(payrollForm.allowances) || 0;
      const calcGross = payrollForm.grossSalary ? Number(payrollForm.grossSalary) : basicNum + allowNum;

      const updatedFinance = {
        ...(selectedMd?.finance || {}),
        basicSalary: String(basicNum),
        allowances: String(allowNum),
        grossSalary: String(calcGross),
        paymentMethod: payrollForm.paymentMethod || 'WPS (SIF File Generation)',
        bankName: payrollForm.bankName || 'Emirates NBD',
        iban: payrollForm.iban || '',
        accountNo: payrollForm.iban || '',
      };

      const rawMd = v(selected, 'masterData', 'master_data') || {};
      const parsedMd = typeof rawMd === 'string' ? JSON.parse(rawMd) : rawMd;
      const newMasterData = {
        ...parsedMd,
        finance: updatedFinance,
      };

      await api(`/employees/${v(selected, 'id')}`, {
        method: 'PATCH',
        body: JSON.stringify({
          masterData: newMasterData,
        }),
      });

      const updated = await api(`/employees/${v(selected, 'id')}`);
      setSelected(updated);
      setShowPayrollModal(false);
      setMsg('Compensation & WPS details updated successfully.');
      load();
    } catch (err) {
      setError(err?.message || 'Failed to update payroll details');
    } finally {
      setSavingPayroll(false);
    }
  }

  // Filtered employees list
  const filteredRows = useMemo(() => {
    return rows.filter((e) => {
      const search = searchTerm.toLowerCase();
      const code = String(v(e, 'empCode', 'emp_code') || '').toLowerCase();
      const name = String(v(e, 'fullName', 'full_name') || '').toLowerCase();
      const email = String(v(e, 'email') || '').toLowerCase();
      const title = String(v(e, 'jobTitle', 'job_title') || '').toLowerCase();

      const matchesSearch = !search || code.includes(search) || name.includes(search) || email.includes(search) || title.includes(search);
      const matchesCompany = !filterCompany || String(v(e, 'divisionId', 'division_id')) === String(filterCompany);
      const matchesDept = !filterDept || String(v(e, 'departmentId', 'department_id')) === String(filterDept);
      const matchesStatus = !filterStatus || String(v(e, 'status')).toLowerCase() === filterStatus.toLowerCase();

      return matchesSearch && matchesCompany && matchesDept && matchesStatus;
    });
  }, [rows, searchTerm, filterCompany, filterDept, filterStatus]);

  // 10-per-page Pagination State for Employees
  const [empPage, setEmpPage] = useState(1);
  const EMP_PAGE_SIZE = 10;

  useEffect(() => {
    setEmpPage(1);
  }, [searchTerm, filterCompany, filterDept, filterStatus]);

  const totalEmpPages = Math.ceil(filteredRows.length / EMP_PAGE_SIZE) || 1;
  const paginatedEmployees = useMemo(() => {
    const start = (empPage - 1) * EMP_PAGE_SIZE;
    return filteredRows.slice(start, start + EMP_PAGE_SIZE);
  }, [filteredRows, empPage]);

  // Selected Employee Master Data helper
  const selectedMd = useMemo(() => {
    if (!selected) return {};
    const raw = v(selected, 'masterData', 'master_data');
    if (!raw) return {};
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }
    return typeof raw === 'object' && raw !== null ? raw : {};
  }, [selected]);

  const selectedPhotoUrl = useMemo(() => {
    return getEmployeePhotoUrl(selected);
  }, [selected]);

  return (
    <AppShell
      title="Employee Information"
      actions={
        isAdmin ? (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setCreateForm({
                ...emptyMasterForm(),
                empCode: calculateNextCode(rows),
              });
              setShowCreateModal(true);
            }}
            style={{
              height: '40px',
              background: '#00b8db',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '13px',
              padding: '0 16px',
              borderRadius: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0, 184, 219, 0.25)',
              marginRight: '4px',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Create Employee</span>
          </button>
        ) : null
      }
    >
      {error ? <div className="error">{error}</div> : null}
      {msg ? <div className="success">{msg}</div> : null}

      {/* Create Employee Modal */}
      {showCreateModal ? (
        <>
          <div
            className="backdrop show"
            onClick={() => setShowCreateModal(false)}
            aria-hidden="true"
            style={{ zIndex: 40 }}
          />
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed',
              left: '50%',
              top: '30px',
              bottom: '30px',
              transform: 'translateX(-50%)',
              zIndex: 50,
              width: 'min(1060px, calc(100vw - 32px))',
              background: 'var(--surface, #ffffff)',
              borderRadius: 14,
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              padding: '24px 28px',
              overflowY: 'auto',
              border: '1px solid var(--line, #e2e8f0)',
            }}
          >
            <EmployeeMasterForm
              mode="create"
              form={createForm}
              setForm={setCreateForm}
              departments={departments}
              divisions={divisions}
              designations={designations}
              employmentTypes={employmentTypes}
              managers={rows}
              saving={creating}
              onSubmit={createEmployee}
              onCancel={() => setShowCreateModal(false)}
            />
          </div>
        </>
      ) : null}

      {/* Login Popup for newly created employee */}
      {createLoginPopup ? (
        <>
          <div
            className="backdrop show"
            onClick={() => setCreateLoginPopup(null)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-login-title"
            style={{
              position: 'fixed',
              left: '50%',
              top: '12%',
              transform: 'translateX(-50%)',
              zIndex: 50,
              width: 'min(440px, calc(100vw - 32px))',
              background: 'var(--card, #fff)',
              border: '1px solid var(--border, #d7e3ef)',
              borderRadius: 12,
              boxShadow: '0 16px 40px rgba(2, 11, 31, 0.2)',
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                ✓
              </div>
              <h3 id="create-login-title" style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: 'var(--ink)' }}>
                Employee Created
              </h3>
            </div>
            <p className="muted" style={{ margin: '0 0 16px', fontSize: '13px' }}>
              <strong>{createLoginPopup.name}</strong> has been registered. The employee can use these credentials to log in to the mobile application:
            </p>
            <div className="stack" style={{ gap: 10, marginBottom: 18, background: 'var(--surface-alt)', padding: '14px', borderRadius: 8, border: '1px solid var(--line)' }}>
              <label className="field" style={{ margin: 0 }}>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>App Login Email</span>
                <input readOnly value={createLoginPopup.email} style={{ fontWeight: 700, background: 'var(--surface)' }} />
              </label>
              <label className="field" style={{ margin: 0 }}>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>App Login Password</span>
                <input readOnly value={createLoginPopup.password} style={{ fontWeight: 700, background: 'var(--surface)', color: '#008fa8' }} />
              </label>
            </div>
            <button
              type="button"
              className="btn block"
              onClick={() => setCreateLoginPopup(null)}
              style={{ background: '#00b8db', color: '#ffffff', fontWeight: 700, borderRadius: 8 }}
            >
              Done & Close
            </button>
          </div>
        </>
      ) : null}

      {/* Edit Payroll / Compensation Modal */}
      {showPayrollModal ? (
        <>
          <div
            className="backdrop show"
            onClick={() => setShowPayrollModal(false)}
            aria-hidden="true"
            style={{ zIndex: 60 }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="payroll-modal-title"
            style={{
              position: 'fixed',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 70,
              width: 'min(560px, calc(100vw - 32px))',
              maxHeight: 'calc(100vh - 60px)',
              overflowY: 'auto',
              background: 'var(--surface, #ffffff)',
              borderRadius: 12,
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.25)',
              padding: '24px 28px',
              border: '1px solid var(--line, #e2e8f0)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid var(--line, #e2e8f0)' }}>
              <div>
                <h3 id="payroll-modal-title" style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                  Edit Compensation & WPS Details
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--muted, #64748b)', marginTop: 2 }}>
                  {v(selected, 'fullName', 'full_name')} ({v(selected, 'empCode', 'emp_code')})
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPayrollModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  color: 'var(--muted, #94a3b8)',
                  cursor: 'pointer',
                  padding: '4px',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={savePayrollDetails} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted, #475569)' }}>
                  Basic Salary (AED) <span style={{ color: '#ef4444' }}>*</span>
                </span>
                <input
                  required
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 5000"
                  value={payrollForm.basicSalary}
                  onChange={(e) => {
                    const basic = e.target.value;
                    setPayrollForm((prev) => ({
                      ...prev,
                      basicSalary: basic,
                      grossSalary: String((Number(basic) || 0) + (Number(prev.allowances) || 0)),
                    }));
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--line, #cbd5e1)',
                    fontSize: '13px',
                    color: 'var(--ink, #0f172a)',
                    background: 'var(--input-bg, #ffffff)',
                  }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted, #475569)' }}>
                  Housing & Transport Allowance (AED)
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 2500"
                  value={payrollForm.allowances}
                  onChange={(e) => {
                    const allow = e.target.value;
                    setPayrollForm((prev) => ({
                      ...prev,
                      allowances: allow,
                      grossSalary: String((Number(prev.basicSalary) || 0) + (Number(allow) || 0)),
                    }));
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--line, #cbd5e1)',
                    fontSize: '13px',
                    color: 'var(--ink, #0f172a)',
                    background: 'var(--input-bg, #ffffff)',
                  }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted, #475569)' }}>
                  Gross Monthly Remuneration (AED)
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 7500"
                  value={payrollForm.grossSalary}
                  onChange={(e) => setPayrollForm((prev) => ({ ...prev, grossSalary: e.target.value }))}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--line, #cbd5e1)',
                    fontSize: '13px',
                    color: '#008fa8',
                    fontWeight: 700,
                    background: 'var(--surface-alt, #f8fafc)',
                  }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted, #475569)' }}>
                  Payment Method
                </span>
                <select
                  value={payrollForm.paymentMethod}
                  onChange={(e) => setPayrollForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--line, #cbd5e1)',
                    fontSize: '13px',
                    color: 'var(--ink, #0f172a)',
                    background: 'var(--input-bg, #ffffff)',
                  }}
                >
                  <option value="WPS (SIF File Generation)">WPS (SIF File Generation)</option>
                  <option value="Direct Bank Transfer">Direct Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted, #475569)' }}>
                  Operating Bank
                </span>
                <input
                  type="text"
                  placeholder="e.g. Emirates NBD / ADCB / FAB"
                  value={payrollForm.bankName}
                  onChange={(e) => setPayrollForm((prev) => ({ ...prev, bankName: e.target.value }))}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--line, #cbd5e1)',
                    fontSize: '13px',
                    color: 'var(--ink, #0f172a)',
                    background: 'var(--input-bg, #ffffff)',
                  }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted, #475569)' }}>
                  IBAN / Account Number
                </span>
                <input
                  type="text"
                  placeholder="e.g. AE07033123456789012"
                  value={payrollForm.iban}
                  onChange={(e) => setPayrollForm((prev) => ({ ...prev, iban: e.target.value }))}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--line, #cbd5e1)',
                    fontSize: '13px',
                    color: 'var(--ink, #0f172a)',
                    background: 'var(--input-bg, #ffffff)',
                  }}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12, paddingTop: 14, borderTop: '1px solid var(--line, #e2e8f0)' }}>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setShowPayrollModal(false)}
                  style={{ fontSize: '12.5px', padding: '7px 16px', borderRadius: '6px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPayroll}
                  className="btn"
                  style={{
                    background: '#00b8db',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '12.5px',
                    padding: '7px 18px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: savingPayroll ? 'wait' : 'pointer',
                  }}
                >
                  {savingPayroll ? 'Saving...' : 'Save Compensation Details'}
                </button>
              </div>
            </form>
          </div>
        </>
      ) : null}

      {/* =========================================================================
          1. ALL EMPLOYEES LIST TABLE (Ultra-Clean, Filters & Search - NO AVATARS)
         ========================================================================= */}
      <div id="all-employees" className="card" style={{ marginBottom: 20, padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>All Employees {loadingEmps && !filteredRows.length ? '' : `(${filteredRows.length})`}</span>
              {loadingEmps && !filteredRows.length ? (
                <span
                  style={{
                    display: 'inline-block',
                    width: 13,
                    height: 13,
                    border: '2px solid rgba(0, 184, 219, 0.3)',
                    borderTopColor: '#00b8db',
                    borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                  }}
                  title="Loading..."
                />
              ) : null}
            </h3>
            <p className="muted" style={{ fontSize: '12px', margin: '2px 0 0' }}>
              Click any employee row to open their profile details & edit credentials
            </p>
          </div>

          {/* Quick Filters */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search code, name, email…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                fontSize: '12.5px',
                padding: '6px 12px',
                borderRadius: 6,
                minWidth: 220,
                border: '1px solid var(--line-strong, #d0d5dd)',
                background: 'var(--surface, #ffffff)',
                color: 'var(--ink)',
                outline: 'none',
              }}
            />

            <select
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
              style={{
                fontSize: '12px',
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid var(--line-strong, #d0d5dd)',
                background: 'var(--surface, #ffffff)',
                color: 'var(--ink)',
                outline: 'none',
              }}
            >
              <option value="">All Companies</option>
              {divisions.map((d) => (
                <option key={v(d, 'id')} value={v(d, 'id')}>
                  {v(d, 'name')}
                </option>
              ))}
            </select>

            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              style={{
                fontSize: '12px',
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid var(--line-strong, #d0d5dd)',
                background: 'var(--surface, #ffffff)',
                color: 'var(--ink)',
                outline: 'none',
              }}
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={v(d, 'id')} value={v(d, 'id')}>
                  {v(d, 'name')}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                fontSize: '12px',
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid var(--line-strong, #d0d5dd)',
                background: 'var(--surface, #ffffff)',
                color: 'var(--ink)',
                outline: 'none',
              }}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="onboarding">Onboarding</option>
              <option value="exited">Exited</option>
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: '85px' }}>Code</th>
                <th>Employee Name</th>
                <th>Company</th>
                <th>Department</th>
                <th>Job Title</th>
                <th>Manager</th>
                <th>Join Date</th>
                <th>Passport Exp</th>
                <th>Visa Exp</th>
                <th style={{ textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEmployees.map((e) => {
                const isSelected = selected && String(v(selected, 'id')) === String(v(e, 'id'));

                return (
                  <tr
                    key={v(e, 'id')}
                    style={{
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(0, 184, 219, 0.08)' : 'transparent',
                      transition: 'background 0.15s ease',
                    }}
                    onClick={() => openDetail(e)}
                  >
                    <td>
                      <strong style={{ color: '#008fa8' }}>{v(e, 'empCode', 'emp_code')}</strong>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{v(e, 'fullName', 'full_name')}</div>
                      <div className="muted" style={{ fontSize: '11.5px' }}>{v(e, 'email')}</div>
                    </td>
                    <td>{v(e, 'divisionName', 'division_name') || '-'}</td>
                    <td>{v(e, 'departmentName', 'department_name') || '-'}</td>
                    <td>{v(e, 'jobTitle', 'job_title') || '-'}</td>
                    <td>{v(e, 'managerName', 'manager_name') || '—'}</td>
                    <td>{formatDate(v(e, 'joinDate', 'join_date', 'hireDate', 'hire_date')) || '-'}</td>
                    <td>{formatDate(v(e, 'passportExpiry', 'passport_expiry')) || '-'}</td>
                    <td>{formatDate(v(e, 'visaExpiry', 'visa_expiry')) || '-'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <Badge status={v(e, 'status')} />
                    </td>
                  </tr>
                );
              })}
              {loadingEmps && !filteredRows.length ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '36px 16px' }} className="muted">
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          border: '2.5px solid rgba(0, 184, 219, 0.25)',
                          borderTopColor: '#00b8db',
                          borderRadius: '50%',
                          animation: 'spin 0.8s linear infinite',
                        }}
                      />
                      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ink)' }}>Loading employees...</span>
                    </div>
                  </td>
                </tr>
              ) : !filteredRows.length ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '24px' }} className="muted">
                    No employees matching current filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Employees Pagination Bar (< 1, 2, 3... >) */}
        {filteredRows.length > 0 ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
              marginTop: 14,
              paddingTop: 12,
              borderTop: '1px solid var(--line, #e2e8f0)',
            }}
          >
            <div className="muted" style={{ fontSize: '12px' }}>
              Showing {(empPage - 1) * EMP_PAGE_SIZE + 1}–{Math.min(empPage * EMP_PAGE_SIZE, filteredRows.length)} of {filteredRows.length} employees
            </div>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {/* Previous < Chevron Button */}
              <button
                type="button"
                disabled={empPage <= 1}
                onClick={() => setEmpPage((p) => Math.max(1, p - 1))}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: '1px solid var(--line, #cbd5e1)',
                  background: 'var(--surface, #ffffff)',
                  color: empPage <= 1 ? 'var(--muted, #94a3b8)' : 'var(--ink, #0f172a)',
                  cursor: empPage <= 1 ? 'not-allowed' : 'pointer',
                  opacity: empPage <= 1 ? 0.45 : 1,
                  transition: 'all 0.15s ease',
                }}
                title="Previous page"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>

              {/* Page Numbers */}
              {Array.from({ length: totalEmpPages }, (_, i) => i + 1).map((p) => {
                const isActive = p === empPage;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setEmpPage(p)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 28,
                      height: 28,
                      padding: '0 6px',
                      borderRadius: 6,
                      border: isActive ? '1px solid #00b8db' : '1px solid var(--line, #cbd5e1)',
                      background: isActive ? '#00b8db' : 'var(--surface, #ffffff)',
                      color: isActive ? '#ffffff' : 'var(--ink, #0f172a)',
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {p}
                  </button>
                );
              })}

              {/* Next > Chevron Button */}
              <button
                type="button"
                disabled={empPage >= totalEmpPages}
                onClick={() => setEmpPage((p) => Math.min(totalEmpPages, p + 1))}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: '1px solid var(--line, #cbd5e1)',
                  background: 'var(--surface, #ffffff)',
                  color: empPage >= totalEmpPages ? 'var(--muted, #94a3b8)' : 'var(--ink, #0f172a)',
                  cursor: empPage >= totalEmpPages ? 'not-allowed' : 'pointer',
                  opacity: empPage >= totalEmpPages ? 0.45 : 1,
                  transition: 'all 0.15s ease',
                }}
                title="Next page"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* =========================================================================
          5. EMPLOYEE PROFILE DETAIL VIEW (Exact Image 3 Reference Matching Design)
         ========================================================================= */}
      {selected ? (
        <div id="employee-profile-detail" className="emp-profile-wrapper" style={{ marginTop: 28, width: '100%' }}>
          {/* Top Header Card (White in light mode, Dark in dark mode) */}
          <div className="emp-topbar-card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 16,
                paddingBottom: 16,
              }}
            >
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: 'var(--ink, #0f172a)' }}>
                  Employee
                </h2>
                <div style={{ fontSize: '13px', color: 'var(--muted, #64748b)', marginTop: 3 }}>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelected(null)}
                    onKeyDown={(e) => e.key === 'Enter' && setSelected(null)}
                    style={{ cursor: 'pointer', color: '#008fa8', fontWeight: 600 }}
                    title="Back to Employee List"
                  >
                    Employee
                  </span>
                  <span style={{ color: 'var(--muted, #94a3b8)', margin: '0 6px' }}>/</span>
                  <span style={{ color: 'var(--muted, #475569)' }}>Employee Detail</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {/* Employee Switcher Dropdown Pill */}
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    className="emp-switcher-btn"
                    onClick={() => setEmpSwitcherOpen(!empSwitcherOpen)}
                    title="Click to switch employee"
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: selectedPhotoUrl
                          ? `url(${selectedPhotoUrl}) center/cover no-repeat`
                          : 'linear-gradient(135deg, #00b8db 0%, #008fa8 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        fontSize: '11px',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {!selectedPhotoUrl
                        ? getInitials(v(selected, 'fullName', 'full_name'))
                        : null}
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, lineHeight: 1.2 }}>
                        {v(selected, 'fullName', 'full_name')}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted, #64748b)' }}>
                        {v(selected, 'position') || selectedMd?.position || v(selected, 'jobTitle', 'job_title') || 'Employee'}
                      </div>
                    </div>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        color: 'var(--muted, #64748b)',
                        transition: 'transform 0.15s ease',
                        transform: empSwitcherOpen ? 'rotate(180deg)' : 'none',
                        marginLeft: 4,
                      }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {empSwitcherOpen ? (
                    <>
                      <div
                        onClick={() => setEmpSwitcherOpen(false)}
                        style={{ position: 'fixed', inset: 0, zIndex: 90 }}
                      />
                      <div className="emp-switcher-dropdown">
                        <div style={{ padding: '6px 12px 10px', borderBottom: '1px solid var(--line, #e2e8f0)' }}>
                          <input
                            type="text"
                            placeholder="Search employee..."
                            value={empSearch}
                            onChange={(e) => setEmpSearch(e.target.value)}
                            autoFocus
                            style={{
                              width: '100%',
                              padding: '6px 10px',
                              fontSize: '12.5px',
                              borderRadius: '6px',
                              border: '1px solid var(--line, #cbd5e1)',
                              background: 'var(--input-bg, #ffffff)',
                              color: 'var(--ink, #0f172a)',
                              outline: 'none',
                            }}
                          />
                        </div>
                        <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                          {rows
                            .filter((r) => {
                              if (!empSearch.trim()) return true;
                              const q = empSearch.toLowerCase();
                              return (
                                String(v(r, 'fullName', 'full_name') || '').toLowerCase().includes(q) ||
                                String(v(r, 'empCode', 'emp_code') || '').toLowerCase().includes(q) ||
                                String(v(r, 'jobTitle', 'job_title') || '').toLowerCase().includes(q)
                              );
                            })
                            .map((emp) => {
                              const isCur = String(v(emp, 'id')) === String(v(selected, 'id'));
                              const photo = getEmployeePhotoUrl(emp);
                              return (
                                <button
                                  key={v(emp, 'id')}
                                  type="button"
                                  className="emp-switcher-item"
                                  onClick={() => {
                                    openDetail(emp);
                                    setEmpSwitcherOpen(false);
                                    setEmpSearch('');
                                  }}
                                  style={{
                                    background: isCur ? 'rgba(0, 184, 219, 0.12)' : 'transparent',
                                    fontWeight: isCur ? 700 : 500,
                                  }}
                                >
                                  <div
                                    style={{
                                      width: 28,
                                      height: 28,
                                      borderRadius: '50%',
                                      background: photo
                                        ? `url(${photo}) center/cover no-repeat`
                                        : 'linear-gradient(135deg, #00b8db 0%, #008fa8 100%)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: '#ffffff',
                                      fontSize: '10.5px',
                                      fontWeight: 700,
                                      flexShrink: 0,
                                    }}
                                  >
                                    {!photo
                                      ? getInitials(v(emp, 'fullName', 'full_name'))
                                      : null}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '12.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {v(emp, 'fullName', 'full_name')}
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--muted, #64748b)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {v(emp, 'position') || (emp.masterData && emp.masterData.position) || (emp.master_data && emp.master_data.position) || v(emp, 'jobTitle', 'job_title') || v(emp, 'empCode', 'emp_code') || 'Employee'}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>

                {/* Close Button matching Reference */}
                <button
                  type="button"
                  className="emp-close-btn"
                  onClick={() => setSelected(null)}
                  title="Close Profile"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Horizontal Tabs Navigation Bar inside Topbar Card */}
            <div
              style={{
                display: 'flex',
                gap: '26px',
                borderTop: '1px solid var(--line, #f1f5f9)',
                overflowX: 'auto',
              }}
            >
              {[
                { id: 'Personal info', label: 'Personal info' },
                { id: 'Employee details', label: 'Employee details' },
                { id: 'Payroll', label: 'Payroll' },
                { id: 'Documents', label: 'Documents' },
                { id: 'Leave history', label: 'Leave history' },
                { id: 'Attendance', label: 'Attendance' },
              ].map((tab) => {
                const isActive = selectedTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setSelectedTab(tab.id);
                      setIsEditingProfile(false);
                    }}
                    className={`emp-tab-btn ${isActive ? 'active' : ''}`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subheader section title matching Image 3 */}
          <div style={{ marginBottom: '18px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--ink, #0f172a)' }}>
              {isEditingProfile ? `Edit ${selectedTab}` : selectedTab}
            </h3>
          </div>

          {/* EDIT MODE: Render full editable form matching Image 3 cards */}
          {isEditingProfile ? (
            <div className="emp-card" style={{ marginBottom: 20 }}>
              <div style={{ marginBottom: 14 }}>
                <h3 className="emp-card-title">
                  Editing Profile: {v(selected, 'fullName', 'full_name')}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--muted, #64748b)', margin: '2px 0 0' }}>
                  Update employee attributes, job specifications, and travel credentials. Click &quot;Save Changes&quot; to apply.
                </p>
              </div>

              <EmployeeMasterForm
                mode="edit"
                form={masterForm}
                setForm={setMasterForm}
                departments={departments}
                divisions={divisions}
                designations={designations}
                employmentTypes={employmentTypes}
                managers={rows.filter((r) => String(v(r, 'id')) !== String(v(selected, 'id')))}
                saving={savingEdit}
                onSubmit={saveEmployeeEdit}
                onCancel={() => setIsEditingProfile(false)}
              />
            </div>
          ) : (
            /* VIEW MODE: Exact Reference Screenshot Layout (Cards sitting on background) */
            <div>
              {/* =========================================================================
                  TAB 1: Personal info (Basic info, Address, Work experience, Education)
                 ========================================================================= */}
              {selectedTab === 'Personal info' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Card 1: Basic Information (Matching Image 3 & Reference Dividers) */}
                  <div className="emp-card">
                    <div className="emp-card-header">
                      <h4 className="emp-card-title">
                        Basic information
                      </h4>
                      {isAdmin ? (
                        <button
                          type="button"
                          className="card-edit-pencil"
                          onClick={() => setIsEditingProfile(true)}
                          title="Edit Basic information"
                        >
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                            <path d="m15 5 4 4" />
                          </svg>
                        </button>
                      ) : null}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '28px', alignItems: 'center' }}>
                      {/* Left Column: Avatar & Core Identity with Clear 18px Outline Icons */}
                      <div style={{ display: 'flex', gap: '22px', alignItems: 'center' }}>
                        <div
                          style={{
                            width: 100,
                            height: 100,
                            borderRadius: '50%',
                            background: selectedPhotoUrl
                              ? `url(${selectedPhotoUrl}) center/cover no-repeat`
                              : 'linear-gradient(135deg, #00b8db 0%, #008fa8 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '28px',
                            fontWeight: 700,
                            color: '#ffffff',
                            flexShrink: 0,
                            boxShadow: '0 4px 14px rgba(0, 184, 219, 0.25)',
                          }}
                        >
                          {!selectedPhotoUrl
                            ? getInitials(v(selected, 'fullName', 'full_name'))
                            : null}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                            {v(selected, 'fullName', 'full_name')}
                          </h3>
                          <div style={{ fontSize: '13px', color: 'var(--muted, #64748b)', fontWeight: 500, marginTop: 2 }}>
                            {v(selected, 'empCode', 'emp_code') || 'DD-1007'}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 12 }}>
                            {/* Gender with 18px Outline SVG */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: '13px', color: 'var(--muted, #475569)' }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="4" />
                                <path d="M16 8l5-5m0 0h-4m4 0v4M12 16v6m-3-3h6" />
                              </svg>
                              <span>{selectedMd.personal?.gender || selectedMd.gender || 'Not specified'}</span>
                            </div>

                            {/* Phone (Clean 18px Outline SVG - NOT RED) */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: '13px', color: 'var(--muted, #475569)' }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                              </svg>
                              <span>{v(selected, 'phone') || selectedMd.mobilePhone || '—'}</span>
                            </div>

                            {/* Work Email with 18px Outline SVG */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: '13px', color: 'var(--muted, #475569)' }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect width="20" height="16" x="2" y="4" rx="2" />
                                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                              </svg>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {v(selected, 'email') || '—'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Key-Values (Nationality, App Login Email, Designation, Status) with Vertical Divider */}
                      <div
                        className="emp-v-divider"
                        style={{
                          borderLeft: '2px solid var(--line, #cbd5e1)',
                          paddingLeft: '36px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                        }}
                      >
                        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '12px', padding: '9px 0', alignItems: 'center' }}>
                          <div className="emp-row-label">Nationality</div>
                          <div className="emp-row-val" style={{ fontWeight: 600 }}>
                            {selectedMd.nationality || selectedMd.personal?.nationality || 'Not specified'}
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '12px', padding: '9px 0', alignItems: 'center' }}>
                          <div className="emp-row-label">App Login Email</div>
                          <div className="emp-row-val" style={{ color: '#008fa8', fontWeight: 600 }}>
                            {v(selected, 'email') || '—'}
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '12px', padding: '9px 0', alignItems: 'center' }}>
                          <div className="emp-row-label">App Password</div>
                          <div className="emp-row-val" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontFamily: showProfilePassword ? 'inherit' : 'monospace', fontSize: showProfilePassword ? '13px' : '15px', fontWeight: 600, color: 'var(--ink, #0f172a)', letterSpacing: showProfilePassword ? 'normal' : '2px' }}>
                              {showProfilePassword ? (v(selected, 'password') || selectedMd.password || 'demo123') : '••••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowProfilePassword(!showProfilePassword)}
                              title={showProfilePassword ? 'Hide password' : 'Show password'}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '2px 4px',
                                color: 'var(--muted, #64748b)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {showProfilePassword ? (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                  <line x1="1" y1="1" x2="23" y2="23" />
                                </svg>
                              ) : (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '12px', padding: '9px 0', alignItems: 'center' }}>
                          <div className="emp-row-label">Designation</div>
                          <div className="emp-row-val">
                            {v(selected, 'jobTitle', 'job_title') || '—'}
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '12px', padding: '9px 0', alignItems: 'center' }}>
                          <div className="emp-row-label">Status</div>
                          <div><Badge status={v(selected, 'status')} /></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2-Column Cards Grid: Address & Work Experience (Exact Image 3 Layout) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
                    {/* Card 2: Address (Label on Left, Value on Right) */}
                    <div className="emp-card">
                      <div className="emp-card-header">
                        <h4 className="emp-card-title">
                          Address
                        </h4>
                        {isAdmin ? (
                          <button
                            type="button"
                            className="card-edit-pencil"
                            onClick={() => setIsEditingProfile(true)}
                            title="Edit Address"
                          >
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              <path d="m15 5 4 4" />
                            </svg>
                          </button>
                        ) : null}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '14px', padding: '10px 0', alignItems: 'flex-start' }}>
                          <div className="emp-row-label">Citizen ID address</div>
                          <div className="emp-row-val" style={{ lineHeight: 1.5 }}>{selectedMd.homeCountryAddress || '—'}</div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '14px', padding: '10px 0', alignItems: 'flex-start' }}>
                          <div className="emp-row-label">Residential address</div>
                          <div className="emp-row-val" style={{ lineHeight: 1.5 }}>{selectedMd.addressInUae || '—'}</div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '14px', padding: '10px 0', alignItems: 'flex-start' }}>
                          <div className="emp-row-label">Current address</div>
                          <div className="emp-row-val" style={{ lineHeight: 1.5 }}>{selectedMd.currentAddress || '—'}</div>
                        </div>
                      </div>
                    </div>

                    {/* Card 3: Work Experience (Multiple support, Latest on Top) */}
                    <div className="emp-card">
                      <div className="emp-card-header">
                        <h4 className="emp-card-title">
                          Work experience
                        </h4>
                        {isAdmin ? (
                          <button
                            type="button"
                            className="card-edit-pencil"
                            onClick={() => setIsEditingProfile(true)}
                            title="Edit Work Experience"
                          >
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              <path d="m15 5 4 4" />
                            </svg>
                          </button>
                        ) : null}
                      </div>

                      {(() => {
                        const profileExps = Array.isArray(selectedMd.workExperiences) && selectedMd.workExperiences.length > 0
                          ? selectedMd.workExperiences
                          : (selectedMd.workExperience && (selectedMd.workExperience.previousCompany || selectedMd.workExperience.position))
                            ? [selectedMd.workExperience]
                            : [];

                        if (!profileExps.length) {
                          return (
                            <div className="muted" style={{ padding: '12px 0', fontSize: '13px' }}>
                              No previous work experience recorded.
                            </div>
                          );
                        }

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {profileExps.map((exp, expIdx) => (
                              <div
                                key={expIdx}
                                style={{
                                  padding: '10px 12px',
                                  background: 'var(--surface, #ffffff)',
                                  borderRadius: 8,
                                  border: '1px solid var(--line, #e2e8f0)',
                                }}
                              >
                                {profileExps.length > 1 ? (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted, #64748b)', textTransform: 'uppercase' }}>
                                      {expIdx === 0 ? 'Latest Experience' : `Previous Company #${expIdx + 1}`}
                                    </span>
                                  </div>
                                ) : null}

                                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '10px', padding: '4px 0', alignItems: 'flex-start' }}>
                                  <div className="emp-row-label">Previous company</div>
                                  <div className="emp-row-val" style={{ lineHeight: 1.4, fontWeight: 600 }}>{exp.previousCompany || '—'}</div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '10px', padding: '4px 0', alignItems: 'flex-start' }}>
                                  <div className="emp-row-label">Position / Role</div>
                                  <div className="emp-row-val" style={{ lineHeight: 1.4 }}>{exp.position || '—'}</div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '10px', padding: '4px 0', alignItems: 'flex-start' }}>
                                  <div className="emp-row-label">Field of work</div>
                                  <div className="emp-row-val" style={{ lineHeight: 1.4 }}>{exp.fieldOfWork || '—'}</div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '10px', padding: '4px 0', alignItems: 'flex-start' }}>
                                  <div className="emp-row-label">Duration in years</div>
                                  <div className="emp-row-val" style={{ lineHeight: 1.4 }}>{exp.duration || '—'}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Card 4: Education (Matching Timeline Dots from Image 3) */}
                  <div className="emp-card">
                    <div className="emp-card-header">
                      <h4 className="emp-card-title">
                        Education
                      </h4>
                      {isAdmin ? (
                        <button
                          type="button"
                          className="card-edit-pencil"
                          onClick={() => setIsEditingProfile(true)}
                          title="Edit Education"
                        >
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                            <path d="m15 5 4 4" />
                          </svg>
                        </button>
                      ) : null}
                    </div>

                    {selectedMd.education && typeof selectedMd.education === 'object' && (selectedMd.education.degreeMajor || selectedMd.education.educationLevel) ? (
                      <div style={{ position: 'relative', paddingLeft: 22, borderLeft: '2px solid var(--line, #e5e7eb)', marginLeft: 6 }}>
                        <div
                          style={{
                            position: 'absolute',
                            left: -6,
                            top: 2,
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: '#94a3b8',
                          }}
                        />
                        <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--ink, #0f172a)' }}>
                          {selectedMd.education.degreeMajor || selectedMd.education.educationLevel}
                          {selectedMd.education.universityName ? ` – ${selectedMd.education.universityName}` : ''}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--muted, #475569)', marginTop: 2 }}>
                          {selectedMd.education.degreeMajor || 'Business'}
                        </div>
                        {selectedMd.education.gradeGpa ? (
                          <div style={{ fontSize: '12.5px', color: 'var(--muted, #64748b)', marginTop: 2 }}>
                            GPA ({selectedMd.education.gradeGpa})
                          </div>
                        ) : null}
                        <div style={{ fontSize: '12px', color: 'var(--muted, #94a3b8)', marginTop: 2 }}>
                          {selectedMd.education.graduationYear || '2021'}
                        </div>
                        {selectedMd.education.attestationStatus ? (
                          <div style={{ marginTop: 6 }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: 'var(--chip-bg, #f1f5f9)',
                                color: 'var(--ink, #475569)',
                              }}
                            >
                              {selectedMd.education.attestationStatus}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div style={{ fontSize: '13px', color: 'var(--muted, #94a3b8)', padding: '8px 0' }}>
                        No formal education credentials recorded.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* =========================================================================
                  TAB 2: Employee details (Organization & App Credentials - NO Internal History)
                 ========================================================================= */}
              {selectedTab === 'Employee details' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Card 1: Organization Profile (Label on Left, Value on Right) */}
                  <div className="emp-card">
                    <div className="emp-card-header">
                      <h4 className="emp-card-title">
                        Job & Organization Profile
                      </h4>
                      {isAdmin ? (
                        <button
                          type="button"
                          className="card-edit-pencil"
                          onClick={() => setIsEditingProfile(true)}
                          title="Edit Job Details"
                        >
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                            <path d="m15 5 4 4" />
                          </svg>
                        </button>
                      ) : null}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: '14px', padding: '10px 0', alignItems: 'center' }}>
                        <div className="emp-row-label">Operating Company</div>
                        <div className="emp-row-val">{v(selected, 'divisionName', 'division_name') || '—'}</div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: '14px', padding: '10px 0', alignItems: 'center' }}>
                        <div className="emp-row-label">Department</div>
                        <div className="emp-row-val">{v(selected, 'departmentName', 'department_name') || '—'}</div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: '14px', padding: '10px 0', alignItems: 'center' }}>
                        <div className="emp-row-label">Designation / Job Title</div>
                        <div className="emp-row-val">{v(selected, 'jobTitle', 'job_title') || '—'}</div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: '14px', padding: '10px 0', alignItems: 'center' }}>
                        <div className="emp-row-label">Position / Role Level</div>
                        <div className="emp-row-val">{v(selected, 'position') || selectedMd.position || '—'}</div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: '14px', padding: '10px 0', alignItems: 'center' }}>
                        <div className="emp-row-label">Reporting Manager</div>
                        <div className="emp-row-val">
                          {(() => {
                            const direct = v(selected, 'managerName', 'manager_name');
                            if (direct && String(direct).trim()) return direct;
                            const mgrId = v(selected, 'managerId', 'manager_id') || selectedMd?.managerId;
                            if (mgrId) {
                              const found = rows.find((r) => String(v(r, 'id')) === String(mgrId));
                              if (found) {
                                const name = v(found, 'fullName', 'full_name');
                                const role = v(found, 'position') || (found.masterData && found.masterData.position) || v(found, 'jobTitle', 'job_title');
                                return role ? `${name} (${role})` : name;
                              }
                            }
                            return '—';
                          })()}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: '14px', padding: '10px 0', alignItems: 'center' }}>
                        <div className="emp-row-label">Employment Type</div>
                        <div className="emp-row-val">{v(selected, 'employmentTypeName', 'employment_type_name') || 'Full-time'}</div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: '14px', padding: '10px 0', alignItems: 'center' }}>
                        <div className="emp-row-label">Joining Date</div>
                        <div className="emp-row-val">{formatDate(v(selected, 'joinDate', 'join_date')) || '—'}</div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: '14px', padding: '10px 0', alignItems: 'center' }}>
                        <div className="emp-row-label">Employment Status</div>
                        <div><Badge status={v(selected, 'status')} /></div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: App Login & Password Reset */}
                  {isAdmin ? (
                    <div className="emp-card">
                      <h4 className="emp-card-title" style={{ margin: '0 0 6px' }}>
                        Mobile App Security & Password Reset
                      </h4>
                      <p style={{ fontSize: '12.5px', color: 'var(--muted, #64748b)', margin: '0 0 16px' }}>
                        Reset mobile app password for <strong>{v(selected, 'email')}</strong>:
                      </p>
                      <form onSubmit={resetAppPassword} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          required
                          type="password"
                          placeholder="Enter new app password (min 6 characters)"
                          minLength={6}
                          value={resetPassword}
                          onChange={(e) => setResetPassword(e.target.value)}
                          style={{
                            minWidth: 280,
                            padding: '8.5px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--line, #cbd5e1)',
                            background: 'var(--input-bg, #ffffff)',
                            color: 'var(--ink, #0f172a)',
                            fontSize: '13px',
                          }}
                        />
                        <button
                          className="btn"
                          type="submit"
                          disabled={resetting || !resetPassword.trim()}
                          style={{
                            background: '#00b8db',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '12.5px',
                            padding: '9px 18px',
                            borderRadius: '8px',
                            border: 'none',
                            cursor: resetting ? 'wait' : 'pointer',
                          }}
                        >
                          {resetting ? 'Updating…' : 'Update App Password'}
                        </button>
                      </form>
                    </div>
                  ) : null}
                </div>
              )}

              {/* =========================================================================
                  TAB 3: Payroll (Single Combined Details + Payslip History Tab)
                 ========================================================================= */}
              {selectedTab === 'Payroll' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Card 1: Current Compensation & WPS Details */}
                  <div className="emp-card">
                    <div className="emp-card-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <h4 className="emp-card-title" style={{ margin: 0 }}>
                          Current Compensation & WPS Details
                        </h4>
                        {isAdmin ? (
                          <button
                            type="button"
                            className="card-edit-pencil"
                            onClick={openPayrollModal}
                            title="Edit Compensation & WPS Details"
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '2px 4px',
                              color: 'var(--muted, #94a3b8)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '4px',
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              <path d="m15 5 4 4" />
                            </svg>
                          </button>
                        ) : null}
                      </div>
                      <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#008fa8', background: 'rgba(0, 184, 219, 0.12)', padding: '3px 10px', borderRadius: '12px' }}>
                        WPS Compliant
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: '14px', padding: '10px 0', alignItems: 'center' }}>
                        <div className="emp-row-label">Basic Salary</div>
                        <div className="emp-row-val" style={{ fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                          {selectedMd.finance?.basicSalary ? `AED ${Number(selectedMd.finance.basicSalary).toLocaleString()}` : '—'}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: '14px', padding: '10px 0', alignItems: 'center' }}>
                        <div className="emp-row-label">Housing & Transport Allowance</div>
                        <div className="emp-row-val" style={{ fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                          {selectedMd.finance?.allowances ? `AED ${Number(selectedMd.finance.allowances).toLocaleString()}` : '—'}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: '14px', padding: '10px 0', alignItems: 'center' }}>
                        <div className="emp-row-label">Gross Monthly Remuneration</div>
                        <div className="emp-row-val" style={{ fontWeight: 700, color: '#008fa8' }}>
                          {selectedMd.finance?.grossSalary
                            ? `AED ${Number(selectedMd.finance.grossSalary).toLocaleString()}`
                            : (selectedMd.finance?.basicSalary ? `AED ${(Number(selectedMd.finance?.basicSalary || 0) + Number(selectedMd.finance?.allowances || 0)).toLocaleString()}` : '—')}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: '14px', padding: '10px 0', alignItems: 'center' }}>
                        <div className="emp-row-label">Payment Method</div>
                        <div className="emp-row-val">
                          {selectedMd.finance?.paymentMethod || '—'}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: '14px', padding: '10px 0', alignItems: 'center' }}>
                        <div className="emp-row-label">Operating Bank</div>
                        <div className="emp-row-val">
                          {selectedMd.finance?.bankName || '—'}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: '14px', padding: '10px 0', alignItems: 'center' }}>
                        <div className="emp-row-label">IBAN / Account Number</div>
                        <div className="emp-row-val">
                          {selectedMd.finance?.iban || selectedMd.finance?.accountNo || '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Payroll History (Payslips) */}
                  <div className="emp-card">
                    <h4 className="emp-card-title" style={{ margin: '0 0 14px' }}>
                      Payroll & Payslip History
                    </h4>

                    {empPayslips.length > 0 ? (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Period / Month</th>
                              <th>Basic Salary</th>
                              <th>Allowances</th>
                              <th>Deductions</th>
                              <th>Net Salary</th>
                              <th>Method</th>
                              <th style={{ textAlign: 'center' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {empPayslips.map((p, idx) => (
                              <tr key={v(p, 'id') || idx}>
                                <td style={{ fontWeight: 700, color: '#008fa8' }}>
                                  {v(p, 'periodLabel', 'period_label') || 'Current Period'}
                                </td>
                                <td>AED {Number(v(p, 'basicSalary', 'basic_salary') || 0).toLocaleString()}</td>
                                <td>AED {Number(v(p, 'allowances') || 0).toLocaleString()}</td>
                                <td>AED {Number(v(p, 'deductions') || 0).toLocaleString()}</td>
                                <td style={{ fontWeight: 700 }}>AED {Number(v(p, 'netSalary', 'net_salary') || 0).toLocaleString()}</td>
                                <td>{v(p, 'paymentMethod', 'payment_method') || 'WPS'}</td>
                                <td style={{ textAlign: 'center' }}>
                                  <Badge status={v(p, 'status') || 'paid'} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: '32px 16px',
                          textAlign: 'center',
                          color: '#94a3b8',
                          fontSize: '13px',
                          background: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px dashed #cbd5e1',
                        }}
                      >
                        No payroll history found for this employee.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* =========================================================================
                  TAB 4: Documents (Passport, Emirates ID & Uploaded Attachments)
                 ========================================================================= */}
              {selectedTab === 'Documents' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Card 1: Legal Identity & Travel Documents */}
                  <div className="emp-card">
                    <div className="emp-card-header">
                      <h4 className="emp-card-title">
                        Passport & Emirates ID Credentials
                      </h4>
                      {isAdmin ? (
                        <button
                          type="button"
                          className="card-edit-pencil"
                          onClick={() => setIsEditingProfile(true)}
                          title="Edit Credentials"
                        >
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                            <path d="m15 5 4 4" />
                          </svg>
                        </button>
                      ) : null}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div  style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: '14px', padding: '10px 0', alignItems: 'center' }}>
                        <div className="emp-row-label">Passport Number</div>
                        <div className="emp-row-val">{selectedMd.passportNumber || v(selected, 'passportNo', 'passport_no') || '—'}</div>
                      </div>

                      <div  style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: '14px', padding: '10px 0', alignItems: 'center' }}>
                        <div className="emp-row-label">Passport Issue Date</div>
                        <div className="emp-row-val">{formatDate(selectedMd.passportStartDate) || '—'}</div>
                      </div>

                      <div  style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: '14px', padding: '10px 0', alignItems: 'center' }}>
                        <div className="emp-row-label">Passport Expiry Date</div>
                        <div className="emp-row-val">{formatDate(selectedMd.passportExpiryDate || v(selected, 'passportExpiry', 'passport_expiry')) || '—'}</div>
                      </div>

                      <div  style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: '14px', padding: '10px 0', alignItems: 'center' }}>
                        <div className="emp-row-label">Emirates ID Number</div>
                        <div className="emp-row-val">{selectedMd.emiratesIdNumber || '—'}</div>
                      </div>

                      <div  style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: '14px', padding: '10px 0', alignItems: 'center' }}>
                        <div className="emp-row-label">Emirates ID Issue Date</div>
                        <div className="emp-row-val">{formatDate(selectedMd.emiratesIdStartDate) || '—'}</div>
                      </div>

                      <div  style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: '14px', padding: '10px 0', alignItems: 'center' }}>
                        <div className="emp-row-label">Emirates ID Expiry Date</div>
                        <div className="emp-row-val">{formatDate(selectedMd.emiratesIdExpiryDate) || '—'}</div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: '14px', padding: '10px 0', alignItems: 'center' }}>
                        <div className="emp-row-label">Previous Visa Type</div>
                        <div className="emp-row-val">{selectedMd.previousVisaType || 'N/A'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Uploaded Documents & Custom Attachments */}
                  <div className="emp-card">
                    <div className="emp-card-header">
                      <h4 className="emp-card-title">
                        Uploaded Documents & Custom Attachments
                      </h4>
                      {isAdmin ? (
                        <button
                          type="button"
                          className="card-edit-pencil"
                          onClick={() => setIsEditingProfile(true)}
                          title="Manage Documents"
                        >
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                            <path d="m15 5 4 4" />
                          </svg>
                        </button>
                      ) : null}
                    </div>

                    {((Array.isArray(selectedMd.customDocuments) && selectedMd.customDocuments.length > 0) || empDocuments.length > 0) ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                        {(Array.isArray(selectedMd.customDocuments) ? selectedMd.customDocuments : []).map((doc, idx) => (
                          <div key={doc.id || idx} className="emp-doc-tile" style={{ justifyContent: 'space-between', padding: '12px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <span style={{ fontSize: '24px' }}>
                                {doc.type === 'Passport' ? '📘' : doc.type === 'Visa' ? '🎫' : doc.type === 'Emirates ID' || doc.type?.includes('ID') ? '🪪' : '📄'}
                              </span>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'rgba(0, 184, 219, 0.12)', color: '#008fa8' }}>
                                    {doc.type}
                                  </span>
                                </div>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink, #0f172a)', marginTop: 2 }}>
                                  {doc.title || doc.type}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--muted, #64748b)' }}>
                                  {doc.fileName} {doc.fileSize ? `• ${doc.fileSize}` : ''}
                                </div>
                              </div>
                            </div>
                            {doc.fileUrl ? (
                              <a
                                href={doc.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="btn secondary"
                                style={{ fontSize: '11.5px', padding: '4px 10px', textDecoration: 'none' }}
                              >
                                View ↗
                              </a>
                            ) : null}
                          </div>
                        ))}

                        {empDocuments.map((doc, idx) => (
                          <div key={v(doc, 'id') || idx} className="emp-doc-tile" style={{ justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <span style={{ fontSize: '22px' }}>📁</span>
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                                  {v(doc, 'documentType', 'document_type', 'title') || 'Official Document'}
                                </div>
                                <div style={{ fontSize: '11.5px', color: 'var(--muted, #64748b)' }}>
                                  {v(doc, 'fileName', 'file_name') || `File #${v(doc, 'id')}`}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="btn secondary"
                              onClick={async () => {
                                try {
                                  const blob = await apiBlob(`/documents/${v(doc, 'id')}/file`);
                                  const url = window.URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = v(doc, 'fileName', 'file_name') || 'document.pdf';
                                  document.body.appendChild(a);
                                  a.click();
                                  a.remove();
                                  window.URL.revokeObjectURL(url);
                                } catch (err) {
                                  setError(err.message);
                                }
                              }}
                              style={{ fontSize: '11.5px', padding: '4px 10px' }}
                            >
                              Download
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="emp-empty-box">
                        No official documents uploaded for this employee.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* =========================================================================
                  TAB 5: Leave history (Live Leave Quotas & Requests)
                 ========================================================================= */}
              {selectedTab === 'Leave history' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="emp-card">
                    <h4 className="emp-card-title" style={{ margin: '0 0 16px' }}>
                      Annual Leave Balances & Entitlements
                    </h4>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                      <div className="emp-metric-box">
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: '#008fa8' }}>Annual Leave</div>
                        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--ink, #0f172a)', margin: '4px 0' }}>
                          {empBalances[0] ? (v(empBalances[0], 'annualTotal', 'annual_total') - v(empBalances[0], 'annualUsed', 'annual_used')) : 30} Days
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--muted, #64748b)' }}>
                          Used: {empBalances[0] ? v(empBalances[0], 'annualUsed', 'annual_used') : 0} of {empBalances[0] ? v(empBalances[0], 'annualTotal', 'annual_total') : 30}
                        </div>
                      </div>

                      <div className="emp-metric-box">
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: '#10b981' }}>Sick Leave</div>
                        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--ink, #0f172a)', margin: '4px 0' }}>
                          {empBalances[0] ? (v(empBalances[0], 'sickTotal', 'sick_total') - v(empBalances[0], 'sickUsed', 'sick_used')) : 15} Days
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--muted, #64748b)' }}>
                          Used: {empBalances[0] ? v(empBalances[0], 'sickUsed', 'sick_used') : 0} of {empBalances[0] ? v(empBalances[0], 'sickTotal', 'sick_total') : 15}
                        </div>
                      </div>

                      <div className="emp-metric-box">
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: '#f59e0b' }}>Casual / Emergency</div>
                        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--ink, #0f172a)', margin: '4px 0' }}>
                          {empBalances[0] ? (v(empBalances[0], 'casualTotal', 'casual_total') - v(empBalances[0], 'casualUsed', 'casual_used')) : 5} Days
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--muted, #64748b)' }}>
                          Used: {empBalances[0] ? v(empBalances[0], 'casualUsed', 'casual_used') : 0} of {empBalances[0] ? v(empBalances[0], 'casualTotal', 'casual_total') : 5}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="emp-card">
                    <h4 className="emp-card-title" style={{ margin: '0 0 14px' }}>
                      Leave Requests & Approval History
                    </h4>

                    {empLeaves.length > 0 ? (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Type</th>
                              <th>Start Date</th>
                              <th>End Date</th>
                              <th>Duration</th>
                              <th>Reason</th>
                              <th style={{ textAlign: 'center' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {empLeaves.map((l, idx) => (
                              <tr key={v(l, 'id') || idx}>
                                <td style={{ fontWeight: 700, color: '#008fa8' }}>
                                  {v(l, 'leaveType', 'leave_type') || 'Annual'}
                                </td>
                                <td>{formatDate(v(l, 'startDate', 'start_date'))}</td>
                                <td>{formatDate(v(l, 'endDate', 'end_date'))}</td>
                                <td>{v(l, 'days') || 1} Day(s)</td>
                                <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {v(l, 'reason') || '—'}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <Badge status={v(l, 'status')} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="emp-empty-box">
                        No leave requests found for this employee.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* =========================================================================
                  TAB 6: Attendance (Live Clock-in & Working Hours Records)
                 ========================================================================= */}
              {selectedTab === 'Attendance' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="emp-card">
                    <h4 className="emp-card-title" style={{ margin: '0 0 16px' }}>
                      Attendance Summary Overview
                    </h4>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
                      <div className="emp-metric-box">
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--muted, #64748b)' }}>Total Logged Days</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink, #0f172a)', marginTop: 4 }}>
                          {empAttendance.length}
                        </div>
                      </div>

                      <div style={{ padding: '14px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: '#10b981' }}>Present</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#10b981', marginTop: 4 }}>
                          {empAttendance.filter((a) => String(v(a, 'status')).toLowerCase() === 'present').length || empAttendance.length}
                        </div>
                      </div>

                      <div style={{ padding: '14px', background: 'rgba(245, 158, 11, 0.08)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: '#f59e0b' }}>Late / Half-Day</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#f59e0b', marginTop: 4 }}>
                          {empAttendance.filter((a) => String(v(a, 'status')).toLowerCase().includes('late')).length}
                        </div>
                      </div>

                      <div style={{ padding: '14px', background: 'rgba(0, 184, 219, 0.08)', borderRadius: '8px', border: '1px solid rgba(0, 184, 219, 0.2)' }}>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: '#008fa8' }}>Assigned Shift</div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#008fa8', marginTop: 8 }}>
                          General (09:00 - 18:00)
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="emp-card">
                    <h4 className="emp-card-title" style={{ margin: '0 0 14px' }}>
                      Recent Clock-In / Attendance Records
                    </h4>

                    {empAttendance.length > 0 ? (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Check-In</th>
                              <th>Check-Out</th>
                              <th>Shift</th>
                              <th>Overtime</th>
                              <th style={{ textAlign: 'center' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {empAttendance.map((a, idx) => (
                              <tr key={v(a, 'id') || idx}>
                                <td style={{ fontWeight: 600 }}>{formatDate(v(a, 'date'))}</td>
                                <td>{v(a, 'checkIn', 'check_in') || '09:00'}</td>
                                <td>{v(a, 'checkOut', 'check_out') || '18:00'}</td>
                                <td>{v(a, 'shiftName', 'shift_name') || 'General'}</td>
                                <td>{v(a, 'overtimeHours', 'overtime_hours') ? `${v(a, 'overtimeHours', 'overtime_hours')} hrs` : '0 hrs'}</td>
                                <td style={{ textAlign: 'center' }}>
                                  <Badge status={v(a, 'status') || 'present'} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="emp-empty-box">
                        No attendance records found for this employee.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}


    </AppShell>
  );
}

export default function EmployeesPage() {
  return (
    <Suspense fallback={<div className="app-shell" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><div className="muted">Loading…</div></div>}>
      <EmployeesContent />
    </Suspense>
  );
}
