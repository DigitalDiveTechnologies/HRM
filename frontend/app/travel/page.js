'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api, getUser, normalizeRole } from '../../lib/auth';
import { formatDate, money, currencyCode, todayISO, v } from '../../lib/format';

export default function TravelPage() {
  const role = normalizeRole(getUser());
  const isAdmin = role === 'admin';

  const [travel, setTravel] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [travelForm, setTravelForm] = useState({
    employeeId: '',
    destination: '',
    purpose: '',
    startDate: todayISO(),
    endDate: todayISO(),
    estimatedCost: 0,
  });
  const [expenseForm, setExpenseForm] = useState({
    employeeId: '',
    title: '',
    category: 'general',
    amount: '',
    expenseDate: todayISO(),
    notes: '',
  });

  const [busyKey, setBusyKey] = useState('');

  const load = useCallback(() => {
    setError('');
    Promise.all([api('/travel/requests'), api('/travel/expenses'), api('/employees')])
      .then(([t, x, e]) => {
        setTravel(t || []);
        setExpenses(x || []);
        setEmployees(e || []);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createTravel(e) {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      await api('/travel/requests', {
        method: 'POST',
        body: JSON.stringify({
          ...travelForm,
          employeeId: Number(travelForm.employeeId),
          estimatedCost: Number(travelForm.estimatedCost) || 0,
          currency: currencyCode(),
        }),
      });
      setMsg('Travel request created.');
      setTravelForm({
        employeeId: '',
        destination: '',
        purpose: '',
        startDate: todayISO(),
        endDate: todayISO(),
        estimatedCost: 0,
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createExpense(e) {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      await api('/travel/expenses', {
        method: 'POST',
        body: JSON.stringify({
          ...expenseForm,
          employeeId: Number(expenseForm.employeeId),
          amount: Number(expenseForm.amount),
          currency: currencyCode(),
        }),
      });
      setMsg('Expense claim created.');
      setExpenseForm({
        employeeId: '',
        title: '',
        category: 'general',
        amount: '',
        expenseDate: todayISO(),
        notes: '',
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function setTravelStatus(id, status) {
    const tid = Number(id);
    if (!tid) return;
    const key = `travel-${tid}-${status}`;
    if (busyKey) return;
    setBusyKey(key);
    setMsg('');
    setError('');
    try {
      await api(`/travel/requests/${tid}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setMsg(`Travel request #${tid} marked ${status}.`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyKey('');
    }
  }

  async function setExpenseStatus(id, status) {
    const eid = Number(id);
    if (!eid) return;
    const key = `expense-${eid}-${status}`;
    if (busyKey) return;
    setBusyKey(key);
    setMsg('');
    setError('');
    try {
      await api(`/travel/expenses/${eid}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setMsg(`Expense #${eid} marked ${status}.`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyKey('');
    }
  }

  return (
    <AppShell title="Travel & Expense" subtitle="Trips, estimates and expense claims">
      {error ? <div className="error">{error}</div> : null}
      {msg ? <div className="muted" style={{ marginBottom: 12, color: 'var(--ok)', fontWeight: 600 }}>{msg}</div> : null}

      {isAdmin ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="panel-title">
            <h3>New travel request</h3>
          </div>
          <form className="stack" onSubmit={createTravel}>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <label className="field">
                Employee
                <select required value={travelForm.employeeId} onChange={(e) => setTravelForm({ ...travelForm, employeeId: e.target.value })}>
                  <option value="">Select…</option>
                  {employees.map((e) => (
                    <option key={v(e, 'id')} value={v(e, 'id')}>
                      {v(e, 'fullName', 'full_name')} ({v(e, 'empCode', 'emp_code')})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Destination
                <input required value={travelForm.destination} onChange={(e) => setTravelForm({ ...travelForm, destination: e.target.value })} />
              </label>
              <label className="field">
                Start
                <input type="date" required value={travelForm.startDate} onChange={(e) => setTravelForm({ ...travelForm, startDate: e.target.value })} />
              </label>
              <label className="field">
                End
                <input type="date" required value={travelForm.endDate} onChange={(e) => setTravelForm({ ...travelForm, endDate: e.target.value })} />
              </label>
              <label className="field">
                Estimated cost
                <input type="number" min="0" step="0.01" value={travelForm.estimatedCost} onChange={(e) => setTravelForm({ ...travelForm, estimatedCost: e.target.value })} />
              </label>
              <label className="field">
                Purpose
                <input value={travelForm.purpose} onChange={(e) => setTravelForm({ ...travelForm, purpose: e.target.value })} />
              </label>
            </div>
            <button className="btn" type="submit">
              Create travel
            </button>
          </form>
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="panel-title">
          <h3>Travel requests</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Destination</th>
                <th>Dates</th>
                <th>Estimate</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {travel.map((t) => {
                const id = Number(v(t, 'id'));
                const status = String(v(t, 'status') || '').toLowerCase();
                return (
                  <tr key={id}>
                    <td>{v(t, 'fullName', 'full_name')}</td>
                    <td>
                      {v(t, 'destination')}
                      {v(t, 'purpose') ? <div className="muted">{v(t, 'purpose')}</div> : null}
                    </td>
                    <td>
                      {formatDate(v(t, 'startDate', 'start_date'))} → {formatDate(v(t, 'endDate', 'end_date'))}
                    </td>
                    <td>{money(v(t, 'estimatedCost', 'estimated_cost'))}</td>
                    <td>
                      <Badge status={status} />
                    </td>
                    <td>
                      {isAdmin && status === 'pending' ? (
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn ok"
                            disabled={!!busyKey}
                            onClick={() => setTravelStatus(id, 'approved')}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn danger"
                            disabled={!!busyKey}
                            onClick={() => setTravelStatus(id, 'rejected')}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                );
              })}
              {!travel.length ? (
                <tr>
                  <td colSpan={6}>No travel requests.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {isAdmin ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="panel-title">
            <h3>New expense claim</h3>
          </div>
          <form className="stack" onSubmit={createExpense}>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <label className="field">
                Employee
                <select required value={expenseForm.employeeId} onChange={(e) => setExpenseForm({ ...expenseForm, employeeId: e.target.value })}>
                  <option value="">Select…</option>
                  {employees.map((e) => (
                    <option key={v(e, 'id')} value={v(e, 'id')}>
                      {v(e, 'fullName', 'full_name')} ({v(e, 'empCode', 'emp_code')})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Title
                <input required value={expenseForm.title} onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })} />
              </label>
              <label className="field">
                Category
                <input value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })} />
              </label>
              <label className="field">
                Amount
                <input type="number" required min="0.01" step="0.01" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
              </label>
              <label className="field">
                Date
                <input type="date" value={expenseForm.expenseDate} onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })} />
              </label>
            </div>
            <label className="field">
              Notes
              <input value={expenseForm.notes} onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })} />
            </label>
            <button className="btn" type="submit">
              Create expense
            </button>
          </form>
        </div>
      ) : null}

      <div className="card">
        <div className="panel-title">
          <h3>Expense claims</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Title</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((x) => {
                const id = Number(v(x, 'id'));
                const status = String(v(x, 'status') || '').toLowerCase();
                return (
                  <tr key={id}>
                    <td>{v(x, 'fullName', 'full_name')}</td>
                    <td>{v(x, 'title')}</td>
                    <td>{v(x, 'category')}</td>
                    <td>{money(v(x, 'amount'))}</td>
                    <td>{formatDate(v(x, 'expenseDate', 'expense_date'))}</td>
                    <td>
                      <Badge status={status} />
                    </td>
                    <td>
                      {isAdmin && status === 'pending' ? (
                        <div className="row-actions">
                          <button type="button" className="btn ok" disabled={!!busyKey} onClick={() => setExpenseStatus(id, 'approved')}>
                            Approve
                          </button>
                          <button type="button" className="btn danger" disabled={!!busyKey} onClick={() => setExpenseStatus(id, 'rejected')}>
                            Reject
                          </button>
                          <button type="button" className="btn secondary" disabled={!!busyKey} onClick={() => setExpenseStatus(id, 'paid')}>
                            Mark paid
                          </button>
                        </div>
                      ) : isAdmin && status === 'approved' ? (
                        <button type="button" className="btn secondary" disabled={!!busyKey} onClick={() => setExpenseStatus(id, 'paid')}>
                          Mark paid
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                );
              })}
              {!expenses.length ? (
                <tr>
                  <td colSpan={7}>No expense claims.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
