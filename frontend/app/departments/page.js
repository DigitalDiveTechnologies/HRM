'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api, getPermissions, getUser, isAdminRole, normalizeRole } from '../../lib/auth';
import { hasPermission } from '../../lib/nav';
import { v } from '../../lib/format';

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const perms = getPermissions(getUser());
  const role = normalizeRole(getUser());
  const canManage =
    isAdminRole(role) ||
    hasPermission(perms, 'masters.departments');

  const load = useCallback(() => {
    setError('');
    api('/departments')
      .then((d) => {
        setDepartments(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message || 'Could not load departments.');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createDepartment(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setMsg('');
    setError('');
    setSubmitting(true);
    try {
      await api('/departments', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      });
      setMsg(`Department "${name.trim()}" added successfully.`);
      setName('');
      load();
    } catch (err) {
      setError(err.message || 'Failed to add department.');
    } finally {
      setSubmitting(false);
    }
  }

  async function setDepartmentStatus(id, currentStatus) {
    setMsg('');
    setError('');
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await api(`/departments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setMsg(nextStatus === 'inactive' ? 'Department deactivated.' : 'Department reactivated.');
      load();
    } catch (err) {
      setError(err.message || 'Failed to update department status.');
    }
  }

  async function deleteDepartment(id, deptName) {
    setMsg('');
    setError('');
    try {
      await api(`/departments/${id}`, { method: 'DELETE' });
      setMsg(`Department "${deptName}" deleted.`);
      load();
    } catch (err) {
      setError(err.message || 'Failed to delete department.');
    }
  }

  return (
    <AppShell
      title="Departments"
      subtitle="Manage organizational departments for employee assignments"
    >
      {error ? <div className="error" style={{ marginBottom: 12 }}>{error}</div> : null}
      {msg ? (
        <div className="muted" style={{ marginBottom: 12, color: 'var(--ok, #10b981)', fontWeight: 600 }}>
          {msg}
        </div>
      ) : null}

      {canManage && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="panel-title" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Add New Department</h3>
          </div>
          <form onSubmit={createDepartment} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 300px', minWidth: '240px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--muted, #64748b)', marginBottom: 6 }}>
                Department Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sales, Marketing, IT, Production"
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--line, #cbd5e1)',
                  outline: 'none',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <button
              type="submit"
              className="btn"
              disabled={submitting || !name.trim()}
              style={{
                alignSelf: 'flex-end',
                height: '38px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 20px',
                fontSize: '13px',
                fontWeight: 600,
                boxSizing: 'border-box',
                margin: 0,
              }}
            >
              {submitting ? 'Adding...' : '+ Add Department'}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
            All Departments ({departments.length})
          </h3>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: '60px' }}>#</th>
                <th>Department Name</th>
                <th>Status</th>
                <th>Assigned Employees</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                    Loading departments...
                  </td>
                </tr>
              ) : departments.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '32px 16px', color: '#64748b' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                      No departments yet
                    </div>
                    <div style={{ fontSize: '13px' }}>
                      Add your first department above to assign employees in the create employee form.
                    </div>
                  </td>
                </tr>
              ) : (
                departments.map((dept, index) => {
                  const id = v(dept, 'id');
                  const deptName = v(dept, 'name');
                  const status = (v(dept, 'status') || 'active').toLowerCase();
                  const empCount = v(dept, 'employeeCount', 'employee_count') || 0;

                  return (
                    <tr key={id || index}>
                      <td style={{ color: '#94a3b8', fontSize: '12px' }}>{index + 1}</td>
                      <td style={{ fontWeight: 600, color: '#1e293b' }}>{deptName}</td>
                      <td>
                        <Badge status={status} />
                      </td>
                      <td>
                        <span style={{ fontSize: '13px', color: '#475569' }}>
                          {empCount} {empCount === 1 ? 'employee' : 'employees'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                          <button
                            type="button"
                            className="btn secondary"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            onClick={() => setDepartmentStatus(id, status)}
                          >
                            {status === 'active' ? 'Deactivate' : 'Reactivate'}
                          </button>
                          <button
                            type="button"
                            className="btn"
                            style={{
                              background: '#ef4444',
                              color: '#fff',
                              padding: '4px 10px',
                              fontSize: '12px',
                              border: 'none',
                            }}
                            onClick={() => deleteDepartment(id, deptName)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
