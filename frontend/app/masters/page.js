'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api } from '../../lib/auth';
import { v } from '../../lib/format';

const emptyMaster = () => ({ name: '' });

export default function MastersPage() {
  const [tab, setTab] = useState('designations');
  const [designations, setDesignations] = useState([]);
  const [employmentTypes, setEmploymentTypes] = useState([]);
  const [desForm, setDesForm] = useState(emptyMaster());
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
      await api('/designations', { method: 'POST', body: JSON.stringify({ name: desForm.name.trim() }) });
      setMsg('Designation added.');
      setDesForm(emptyMaster());
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

  function MasterTable({ rows, kind }) {
    return (
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
            {rows.map((r) => (
              <tr key={v(r, 'id')}>
                <td>{v(r, 'name')}</td>
                <td>
                  <Badge status={v(r, 'status')} />
                </td>
                <td>
                  {String(v(r, 'status')).toLowerCase() === 'active' ? (
                    <button type="button" className="btn secondary" onClick={() => setMasterStatus(kind, v(r, 'id'), 'inactive')}>
                      Deactivate
                    </button>
                  ) : (
                    <button type="button" className="btn secondary" onClick={() => setMasterStatus(kind, v(r, 'id'), 'active')}>
                      Reactivate
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={3}>No rows yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <AppShell title="HR Masters" subtitle="Designations & employment types — soft delete only">
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
              <label className="field">
                Name
                <input required value={desForm.name} onChange={(e) => setDesForm({ name: e.target.value })} placeholder="e.g. Software Engineer" />
              </label>
              <button className="btn" type="submit">
                Add designation
              </button>
            </form>
          </div>
          <div className="card">
            <div className="panel-title">
              <h3>All designations</h3>
            </div>
            <MasterTable rows={designations} kind="des" />
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
            <MasterTable rows={employmentTypes} kind="emp" />
          </div>
        </>
      )}
    </AppShell>
  );
}
