'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api } from '../../lib/auth';
import { v } from '../../lib/format';

const emptyDes = () => ({ name: '', code: '', jobFamily: '', grade: '', skillLevel: '' });
const emptyMaster = () => ({ name: '' });

export default function MastersPage() {
  const [tab, setTab] = useState('designations');
  const [designations, setDesignations] = useState([]);
  const [employmentTypes, setEmploymentTypes] = useState([]);
  const [desForm, setDesForm] = useState(emptyDes());
  const [empForm, setEmpForm] = useState(emptyMaster());
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    setError('');
    Promise.all([api('/designations'), api('/employment-types')])
      .then(([d, e]) => {
        setDesignations(d || []);
        setEmploymentTypes(e || []);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createDesignation(e) {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      await api('/designations', {
        method: 'POST',
        body: JSON.stringify({
          name: desForm.name.trim(),
          code: desForm.code.trim() || null,
          jobFamily: desForm.jobFamily.trim() || null,
          grade: desForm.grade.trim() || null,
          skillLevel: desForm.skillLevel.trim() || null,
        }),
      });
      setMsg('Designation added.');
      setDesForm(emptyDes());
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createEmploymentType(e) {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      await api('/employment-types', { method: 'POST', body: JSON.stringify({ name: empForm.name.trim() }) });
      setMsg('Employment type added.');
      setEmpForm(emptyMaster());
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function setMasterStatus(kind, id, status) {
    setMsg('');
    setError('');
    const path = kind === 'des' ? `/designations/${id}` : `/employment-types/${id}`;
    try {
      await api(path, { method: 'PATCH', body: JSON.stringify({ status }) });
      setMsg(status === 'inactive' ? 'Deactivated (soft delete).' : 'Reactivated.');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AppShell title="Designations & Employment Types" subtitle="Manage job designations (with grade/family) and employment types">
      {error ? <div className="error">{error}</div> : null}
      {msg ? <div className="muted" style={{ marginBottom: 12, color: 'var(--ok)', fontWeight: 600 }}>{msg}</div> : null}

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className={`btn${tab === 'designations' ? '' : ' secondary'}`} onClick={() => setTab('designations')}>
            Designations
          </button>
          <button type="button" className={`btn${tab === 'employment' ? '' : ' secondary'}`} onClick={() => setTab('employment')}>
            Employment types
          </button>
        </div>
      </div>

      {tab === 'designations' ? (
        <>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="panel-title">
              <h3>Add designation</h3>
            </div>
            <form className="stack" onSubmit={createDesignation}>
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="field">
                  Name
                  <input required value={desForm.name} onChange={(e) => setDesForm({ ...desForm, name: e.target.value })} placeholder="e.g. Software Engineer" />
                </label>
                <label className="field">
                  Code
                  <input value={desForm.code} onChange={(e) => setDesForm({ ...desForm, code: e.target.value.toUpperCase() })} placeholder="e.g. SE" />
                </label>
                <label className="field">
                  Job family
                  <input value={desForm.jobFamily} onChange={(e) => setDesForm({ ...desForm, jobFamily: e.target.value })} placeholder="e.g. Engineering" />
                </label>
                <label className="field">
                  Grade
                  <input value={desForm.grade} onChange={(e) => setDesForm({ ...desForm, grade: e.target.value })} placeholder="e.g. G5" />
                </label>
                <label className="field">
                  Skill level
                  <input value={desForm.skillLevel} onChange={(e) => setDesForm({ ...desForm, skillLevel: e.target.value })} placeholder="e.g. Mid" />
                </label>
              </div>
              <button className="btn" type="submit">
                Add designation
              </button>
            </form>
          </div>
          <div className="card">
            <div className="panel-title">
              <h3>All designations</h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Code</th>
                    <th>Family</th>
                    <th>Grade</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {designations.map((r) => (
                    <tr key={v(r, 'id')}>
                      <td>{v(r, 'name')}</td>
                      <td>{v(r, 'code') || '—'}</td>
                      <td>{v(r, 'jobFamily', 'job_family') || '—'}</td>
                      <td>{v(r, 'grade') || '—'}</td>
                      <td>
                        <Badge status={v(r, 'status')} />
                      </td>
                      <td>
                        {String(v(r, 'status')).toLowerCase() === 'active' ? (
                          <button type="button" className="btn secondary" onClick={() => setMasterStatus('des', v(r, 'id'), 'inactive')}>
                            Deactivate
                          </button>
                        ) : (
                          <button type="button" className="btn secondary" onClick={() => setMasterStatus('des', v(r, 'id'), 'active')}>
                            Reactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!designations.length ? (
                    <tr>
                      <td colSpan={6}>No rows yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="panel-title">
              <h3>Add employment type</h3>
            </div>
            <form className="stack" onSubmit={createEmploymentType}>
              <label className="field">
                Name
                <input required value={empForm.name} onChange={(e) => setEmpForm({ name: e.target.value })} placeholder="e.g. Full-time" />
              </label>
              <button className="btn" type="submit">
                Add employment type
              </button>
            </form>
          </div>
          <div className="card">
            <div className="panel-title">
              <h3>All employment types</h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {employmentTypes.map((r) => (
                    <tr key={v(r, 'id')}>
                      <td>{v(r, 'name')}</td>
                      <td>
                        <Badge status={v(r, 'status')} />
                      </td>
                      <td>
                        {String(v(r, 'status')).toLowerCase() === 'active' ? (
                          <button type="button" className="btn secondary" onClick={() => setMasterStatus('emp', v(r, 'id'), 'inactive')}>
                            Deactivate
                          </button>
                        ) : (
                          <button type="button" className="btn secondary" onClick={() => setMasterStatus('emp', v(r, 'id'), 'active')}>
                            Reactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!employmentTypes.length ? (
                    <tr>
                      <td colSpan={3}>No rows yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
