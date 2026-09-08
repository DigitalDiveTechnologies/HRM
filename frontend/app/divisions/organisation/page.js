'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell from '../../../components/AppShell';
import { api } from '../../../lib/auth';
import { v } from '../../../lib/format';

export default function OrganisationAdminPage() {
  const [tab, setTab] = useState('entities');
  const [entities, setEntities] = useState([]);
  const [branches, setBranches] = useState([]);
  const [positions, setPositions] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [headcount, setHeadcount] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const [entityForm, setEntityForm] = useState({ code: '', name: '', emirate: 'Dubai', jurisdictionProfile: 'uae_mainland' });
  const [branchForm, setBranchForm] = useState({ legalEntityId: '', code: '', name: '', emirate: 'Dubai' });
  const [posForm, setPosForm] = useState({
    code: '', title: '', legalEntityId: '', branchId: '', departmentId: '', designationId: '', reportsToPositionId: '', status: 'vacant',
  });
  const [asgForm, setAsgForm] = useState({ positionId: '', employeeId: '' });

  const load = useCallback(() => {
    setError('');
    Promise.all([
      api('/org/legal-entities'),
      api('/org/branches'),
      api('/org/positions'),
      api('/org/assignments?openOnly=true'),
      api('/org/headcount'),
      api('/employees/departments').catch(() => []),
      api('/designations?activeOnly=true').catch(() => []),
      api('/employees').catch(() => []),
    ])
      .then(([e, b, p, a, h, d, des, emp]) => {
        setEntities(e || []);
        setBranches(b || []);
        setPositions(p || []);
        setAssignments(a || []);
        setHeadcount(h || []);
        setDepartments(d || []);
        setDesignations(des || []);
        setEmployees(emp || []);
        if (!branchForm.legalEntityId && e?.[0]) {
          setBranchForm((f) => ({ ...f, legalEntityId: String(v(e[0], 'id')) }));
        }
        if (!posForm.legalEntityId && e?.[0]) {
          setPosForm((f) => ({ ...f, legalEntityId: String(v(e[0], 'id')) }));
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createEntity(ev) {
    ev.preventDefault();
    setMsg('');
    setError('');
    try {
      await api('/org/legal-entities', {
        method: 'POST',
        body: JSON.stringify({
          code: entityForm.code.trim(),
          name: entityForm.name.trim(),
          emirate: entityForm.emirate.trim() || null,
          jurisdictionProfile: entityForm.jurisdictionProfile,
        }),
      });
      setMsg('Legal entity created.');
      setEntityForm({ code: '', name: '', emirate: 'Dubai', jurisdictionProfile: 'uae_mainland' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createBranch(ev) {
    ev.preventDefault();
    setMsg('');
    setError('');
    try {
      await api('/org/branches', {
        method: 'POST',
        body: JSON.stringify({
          legalEntityId: Number(branchForm.legalEntityId),
          code: branchForm.code.trim(),
          name: branchForm.name.trim(),
          emirate: branchForm.emirate.trim() || null,
        }),
      });
      setMsg('Branch created.');
      setBranchForm((f) => ({ ...f, code: '', name: '' }));
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createPosition(ev) {
    ev.preventDefault();
    setMsg('');
    setError('');
    try {
      await api('/org/positions', {
        method: 'POST',
        body: JSON.stringify({
          code: posForm.code.trim(),
          title: posForm.title.trim(),
          legalEntityId: Number(posForm.legalEntityId),
          branchId: posForm.branchId ? Number(posForm.branchId) : null,
          departmentId: posForm.departmentId ? Number(posForm.departmentId) : null,
          designationId: posForm.designationId ? Number(posForm.designationId) : null,
          reportsToPositionId: posForm.reportsToPositionId ? Number(posForm.reportsToPositionId) : null,
          status: posForm.status || 'vacant',
        }),
      });
      setMsg('Position created.');
      setPosForm((f) => ({ ...f, code: '', title: '', reportsToPositionId: '' }));
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createAssignment(ev) {
    ev.preventDefault();
    setMsg('');
    setError('');
    try {
      await api('/org/assignments', {
        method: 'POST',
        body: JSON.stringify({
          positionId: Number(asgForm.positionId),
          employeeId: Number(asgForm.employeeId),
          isPrimary: true,
        }),
      });
      setMsg('Assignment created.');
      setAsgForm({ positionId: '', employeeId: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function endAssignment(id) {
    setMsg('');
    setError('');
    try {
      await api(`/org/assignments/${id}/end`, { method: 'POST', body: '{}' });
      setMsg('Assignment ended; seat set vacant if empty.');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function freezePosition(id) {
    try {
      await api(`/org/positions/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'frozen' }) });
      setMsg('Position frozen.');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const vacantPositions = positions.filter((p) => {
    const st = String(v(p, 'status') || '').toLowerCase();
    const occ = v(p, 'occupantEmployeeId', 'occupant_employee_id');
    return st === 'vacant' || st === 'approved' || !occ;
  });

  return (
    <AppShell title="Organisation" subtitle="Legal entities, branches, positions and assignments (Blueprint Phase 1)">
      {error ? <div className="error" style={{ marginBottom: 12 }}>{error}</div> : null}
      {msg ? <div className="muted" style={{ marginBottom: 12, color: 'var(--ok)', fontWeight: 600 }}>{msg}</div> : null}

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            ['entities', 'Legal entities'],
            ['branches', 'Branches'],
            ['positions', 'Positions'],
            ['assignments', 'Assignments'],
            ['headcount', 'Headcount'],
          ].map(([key, label]) => (
            <button key={key} type="button" className={`btn${tab === key ? '' : ' secondary'}`} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'entities' ? (
        <>
          <div className="card" style={{ marginBottom: 14 }}>
            <h3 style={{ marginTop: 0 }}>Add legal entity</h3>
            <form className="stack" onSubmit={createEntity}>
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="field">Code<input required value={entityForm.code} onChange={(e) => setEntityForm({ ...entityForm, code: e.target.value.toUpperCase() })} /></label>
                <label className="field">Name<input required value={entityForm.name} onChange={(e) => setEntityForm({ ...entityForm, name: e.target.value })} /></label>
                <label className="field">Emirate<input value={entityForm.emirate} onChange={(e) => setEntityForm({ ...entityForm, emirate: e.target.value })} /></label>
                <label className="field">
                  Jurisdiction
                  <select value={entityForm.jurisdictionProfile} onChange={(e) => setEntityForm({ ...entityForm, jurisdictionProfile: e.target.value })}>
                    <option value="uae_mainland">UAE Mainland</option>
                    <option value="free_zone">Free Zone</option>
                    <option value="difc">DIFC</option>
                    <option value="adgm">ADGM</option>
                    <option value="other">Other</option>
                  </select>
                </label>
              </div>
              <button className="btn" type="submit">Create entity</button>
            </form>
          </div>
          <div className="card table-wrap">
            <table>
              <thead><tr><th>Code</th><th>Name</th><th>Emirate</th><th>Jurisdiction</th><th>Status</th></tr></thead>
              <tbody>
                {entities.map((r) => (
                  <tr key={v(r, 'id')}>
                    <td>{v(r, 'code')}</td>
                    <td>{v(r, 'name')}</td>
                    <td>{v(r, 'emirate') || '—'}</td>
                    <td>{v(r, 'jurisdictionProfile', 'jurisdiction_profile')}</td>
                    <td>{v(r, 'status')}</td>
                  </tr>
                ))}
                {!entities.length ? <tr><td colSpan={5}>No legal entities yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {tab === 'branches' ? (
        <>
          <div className="card" style={{ marginBottom: 14 }}>
            <h3 style={{ marginTop: 0 }}>Add branch</h3>
            <form className="stack" onSubmit={createBranch}>
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="field">
                  Legal entity
                  <select required value={branchForm.legalEntityId} onChange={(e) => setBranchForm({ ...branchForm, legalEntityId: e.target.value })}>
                    <option value="">Select…</option>
                    {entities.map((e) => <option key={v(e, 'id')} value={v(e, 'id')}>{v(e, 'code')} — {v(e, 'name')}</option>)}
                  </select>
                </label>
                <label className="field">Code<input required value={branchForm.code} onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value.toUpperCase() })} /></label>
                <label className="field">Name<input required value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} /></label>
                <label className="field">Emirate<input value={branchForm.emirate} onChange={(e) => setBranchForm({ ...branchForm, emirate: e.target.value })} /></label>
              </div>
              <button className="btn" type="submit">Create branch</button>
            </form>
          </div>
          <div className="card table-wrap">
            <table>
              <thead><tr><th>Code</th><th>Name</th><th>Entity ID</th><th>Emirate</th><th>Status</th></tr></thead>
              <tbody>
                {branches.map((r) => (
                  <tr key={v(r, 'id')}>
                    <td>{v(r, 'code')}</td>
                    <td>{v(r, 'name')}</td>
                    <td>{v(r, 'legalEntityId', 'legal_entity_id')}</td>
                    <td>{v(r, 'emirate') || '—'}</td>
                    <td>{v(r, 'status')}</td>
                  </tr>
                ))}
                {!branches.length ? <tr><td colSpan={5}>No branches yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {tab === 'positions' ? (
        <>
          <div className="card" style={{ marginBottom: 14 }}>
            <h3 style={{ marginTop: 0 }}>Add position (seat)</h3>
            <form className="stack" onSubmit={createPosition}>
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="field">Code<input required value={posForm.code} onChange={(e) => setPosForm({ ...posForm, code: e.target.value.toUpperCase() })} /></label>
                <label className="field">Title<input required value={posForm.title} onChange={(e) => setPosForm({ ...posForm, title: e.target.value })} /></label>
                <label className="field">
                  Legal entity
                  <select required value={posForm.legalEntityId} onChange={(e) => setPosForm({ ...posForm, legalEntityId: e.target.value })}>
                    <option value="">Select…</option>
                    {entities.map((e) => <option key={v(e, 'id')} value={v(e, 'id')}>{v(e, 'name')}</option>)}
                  </select>
                </label>
                <label className="field">
                  Branch
                  <select value={posForm.branchId} onChange={(e) => setPosForm({ ...posForm, branchId: e.target.value })}>
                    <option value="">—</option>
                    {branches.map((b) => <option key={v(b, 'id')} value={v(b, 'id')}>{v(b, 'name')}</option>)}
                  </select>
                </label>
                <label className="field">
                  Department
                  <select value={posForm.departmentId} onChange={(e) => setPosForm({ ...posForm, departmentId: e.target.value })}>
                    <option value="">—</option>
                    {departments.map((d) => <option key={v(d, 'id')} value={v(d, 'id')}>{v(d, 'name')}</option>)}
                  </select>
                </label>
                <label className="field">
                  Designation
                  <select value={posForm.designationId} onChange={(e) => setPosForm({ ...posForm, designationId: e.target.value })}>
                    <option value="">—</option>
                    {designations.map((d) => <option key={v(d, 'id')} value={v(d, 'id')}>{v(d, 'name')}</option>)}
                  </select>
                </label>
                <label className="field">
                  Reports to position
                  <select value={posForm.reportsToPositionId} onChange={(e) => setPosForm({ ...posForm, reportsToPositionId: e.target.value })}>
                    <option value="">— None —</option>
                    {positions.map((p) => <option key={v(p, 'id')} value={v(p, 'id')}>{v(p, 'code')} — {v(p, 'title')}</option>)}
                  </select>
                </label>
                <label className="field">
                  Status
                  <select value={posForm.status} onChange={(e) => setPosForm({ ...posForm, status: e.target.value })}>
                    <option value="vacant">Vacant</option>
                    <option value="approved">Approved</option>
                    <option value="occupied">Occupied</option>
                    <option value="frozen">Frozen</option>
                  </select>
                </label>
              </div>
              <button className="btn" type="submit">Create position</button>
            </form>
          </div>
          <div className="card table-wrap">
            <table>
              <thead><tr><th>Code</th><th>Title</th><th>Status</th><th>Occupant</th><th>Reports to</th><th></th></tr></thead>
              <tbody>
                {positions.map((r) => (
                  <tr key={v(r, 'id')}>
                    <td>{v(r, 'code')}</td>
                    <td>{v(r, 'title')}</td>
                    <td>{v(r, 'status')}</td>
                    <td>{v(r, 'occupantName', 'occupant_name') || '—'}</td>
                    <td>{v(r, 'reportsToPositionId', 'reports_to_position_id') || '—'}</td>
                    <td>
                      {String(v(r, 'status')).toLowerCase() !== 'frozen' ? (
                        <button type="button" className="btn secondary" onClick={() => freezePosition(v(r, 'id'))}>Freeze</button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {!positions.length ? <tr><td colSpan={6}>No positions yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {tab === 'assignments' ? (
        <>
          <div className="card" style={{ marginBottom: 14 }}>
            <h3 style={{ marginTop: 0 }}>Assign employee to position</h3>
            <form className="stack" onSubmit={createAssignment}>
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="field">
                  Position
                  <select required value={asgForm.positionId} onChange={(e) => setAsgForm({ ...asgForm, positionId: e.target.value })}>
                    <option value="">Select…</option>
                    {vacantPositions.map((p) => (
                      <option key={v(p, 'id')} value={v(p, 'id')}>{v(p, 'code')} — {v(p, 'title')} ({v(p, 'status')})</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Employee
                  <select required value={asgForm.employeeId} onChange={(e) => setAsgForm({ ...asgForm, employeeId: e.target.value })}>
                    <option value="">Select…</option>
                    {employees.map((e) => (
                      <option key={v(e, 'id')} value={v(e, 'id')}>{v(e, 'empCode', 'emp_code')} — {v(e, 'fullName', 'full_name')}</option>
                    ))}
                  </select>
                </label>
              </div>
              <button className="btn" type="submit">Assign</button>
            </form>
          </div>
          <div className="card table-wrap">
            <table>
              <thead><tr><th>Employee</th><th>Position</th><th>From</th><th>Type</th><th></th></tr></thead>
              <tbody>
                {assignments.map((r) => (
                  <tr key={v(r, 'id')}>
                    <td>{v(r, 'fullName', 'full_name')} ({v(r, 'empCode', 'emp_code')})</td>
                    <td>{v(r, 'positionCode', 'position_code')} — {v(r, 'positionTitle', 'position_title')}</td>
                    <td>{String(v(r, 'effectiveFrom', 'effective_from') || '').slice(0, 10)}</td>
                    <td>{v(r, 'assignmentType', 'assignment_type')}</td>
                    <td>
                      <button type="button" className="btn secondary" onClick={() => endAssignment(v(r, 'id'))}>End</button>
                    </td>
                  </tr>
                ))}
                {!assignments.length ? <tr><td colSpan={5}>No open assignments.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {tab === 'headcount' ? (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Entity</th><th>Department</th><th>Approved</th><th>Occupied</th><th>Vacant</th><th>Frozen</th></tr></thead>
            <tbody>
              {headcount.map((r, i) => (
                <tr key={i}>
                  <td>{v(r, 'legalEntityName', 'legal_entity_name') || '—'}</td>
                  <td>{v(r, 'departmentName', 'department_name') || '—'}</td>
                  <td>{v(r, 'approved')}</td>
                  <td>{v(r, 'occupied')}</td>
                  <td>{v(r, 'vacant')}</td>
                  <td>{v(r, 'frozen')}</td>
                </tr>
              ))}
              {!headcount.length ? <tr><td colSpan={6}>No headcount rows yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </AppShell>
  );
}
