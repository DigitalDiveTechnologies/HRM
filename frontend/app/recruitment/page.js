'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api, normalizeRole, getUser } from '../../lib/auth';
import { formatDate, money, v } from '../../lib/format';

export default function RecruitmentPage() {
  const role = normalizeRole(getUser());
  const isAdmin = role === 'admin';

  const [jobs, setJobs] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [offers, setOffers] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const [interviewForm, setInterviewForm] = useState({
    candidateId: '',
    scheduledAt: '',
    interviewer: '',
    mode: 'Online',
  });
  const [offerForm, setOfferForm] = useState({
    candidateId: '',
    salary: '',
    currency: 'AED',
    joinDate: '',
    letterRef: '',
  });

  const load = useCallback(() => {
    setError('');
    Promise.all([
      api('/recruitment/jobs'),
      api('/recruitment/candidates'),
      api('/recruitment/interviews'),
      api('/recruitment/offers'),
    ])
      .then(([j, c, i, o]) => {
        setJobs(j || []);
        setCandidates(c || []);
        setInterviews(i || []);
        setOffers(o || []);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setStage(id, stage) {
    setMsg('');
    setError('');
    try {
      await api(`/recruitment/candidates/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ stage }),
      });
      setMsg(`Stage updated to "${stage}".`);
      load();
    } catch (err) {
      setError(err.message || 'Failed to update stage. Please try again.');
    }
  }

  async function setJobStatus(id, status) {
    try {
      await api(`/recruitment/jobs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createOffer(e) {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      await api('/recruitment/offers', {
        method: 'POST',
        body: JSON.stringify({
          candidateId: Number(offerForm.candidateId),
          salary: Number(offerForm.salary) || 0,
          currency: offerForm.currency,
          joinDate: offerForm.joinDate,
          status: 'pending',
          letterRef: offerForm.letterRef || null,
        }),
      });
      setMsg('Offer created.');
      setOfferForm({ candidateId: '', salary: '', currency: 'AED', joinDate: '', letterRef: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createInterview(e) {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      await api('/recruitment/interviews', {
        method: 'POST',
        body: JSON.stringify({
          candidateId: Number(interviewForm.candidateId),
          scheduledAt: interviewForm.scheduledAt ? new Date(interviewForm.scheduledAt).toISOString() : '',
          interviewer: interviewForm.interviewer,
          mode: interviewForm.mode,
        }),
      });
      setMsg('Interview scheduled.');
      setInterviewForm({ candidateId: '', scheduledAt: '', interviewer: '', mode: 'Online' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function screenCandidate(id) {
    try {
      const res = await api(`/recruitment/candidates/${id}/screen`, { method: 'POST', body: '{}' });
      setMsg(`Screen score ${res.score}: ${res.recommendation} (${(res.hits || []).join(', ') || 'no keyword hits'})`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AppShell title="Recruitment & ATS" subtitle="Job postings, candidates, interviews, offers">
      {error ? <div className="error">{error}</div> : null}
      {msg ? <div className="muted" style={{ marginBottom: 12, color: 'var(--ok)', fontWeight: 600 }}>{msg}</div> : null}

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="panel-title">
          <h3>Open roles</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Department</th>
                <th>Location</th>
                <th>Candidates</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={v(j, 'id')}>
                  <td>{v(j, 'title')}</td>
                  <td>{v(j, 'department') || '-'}</td>
                  <td>{v(j, 'location') || '-'}</td>
                  <td>{v(j, 'candidateCount', 'candidate_count') || 0}</td>
                  <td>
                    <Badge status={v(j, 'status')} />
                  </td>
                  <td>
                    {isAdmin && String(v(j, 'status')).toLowerCase() === 'open' ? (
                      <button type="button" className="btn secondary" onClick={() => setJobStatus(v(j, 'id'), 'closed')}>
                        Close
                      </button>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
              {!jobs.length ? (
                <tr>
                  <td colSpan={6}>No job postings yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="panel-title">
          <h3>Pipeline</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Job</th>
                <th>Source</th>
                <th>Stage</th>
                <th>Resume</th>
                <th>Move to</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={v(c, 'id')}>
                  <td>
                    {v(c, 'fullName', 'full_name')}
                    <div className="muted">{v(c, 'email')}</div>
                  </td>
                  <td>{v(c, 'jobTitle', 'job_title') || '-'}</td>
                  <td>{v(c, 'source') || '-'}</td>
                  <td>
                    <Badge status={v(c, 'stage')} />
                  </td>
                  <td>
                    <div className="muted">{v(c, 'resumeRef', 'resume_ref') || '-'}</div>
                    <button type="button" className="btn secondary" onClick={() => screenCandidate(v(c, 'id'))}>
                      Auto-screen
                    </button>
                  </td>
                  <td>
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) setStage(v(c, 'id'), e.target.value);
                        e.target.value = '';
                      }}
                    >
                      <option value="">Update…</option>
                      <option value="applied">Applied</option>
                      <option value="screening">Screening</option>
                      <option value="interview">Interview</option>
                      <option value="offer">Offer</option>
                      <option value="hired">Hired</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </td>
                </tr>
              ))}
              {!candidates.length ? (
                <tr>
                  <td colSpan={5}>No candidates yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 14 }}>
        <div className="card">
          <div className="panel-title">
            <h3>Schedule interview</h3>
          </div>
          <form className="stack" onSubmit={createInterview}>
            <label className="field">
              Candidate
              <select required value={interviewForm.candidateId} onChange={(e) => setInterviewForm({ ...interviewForm, candidateId: e.target.value })}>
                <option value="">Select…</option>
                {candidates.map((c) => (
                  <option key={v(c, 'id')} value={v(c, 'id')}>
                    {v(c, 'fullName', 'full_name')}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              When (ISO)
              <input required type="datetime-local" value={interviewForm.scheduledAt} onChange={(e) => setInterviewForm({ ...interviewForm, scheduledAt: e.target.value })} />
            </label>
            <label className="field">
              Interviewer
              <input value={interviewForm.interviewer} onChange={(e) => setInterviewForm({ ...interviewForm, interviewer: e.target.value })} />
            </label>
            <label className="field">
              Mode
              <select value={interviewForm.mode} onChange={(e) => setInterviewForm({ ...interviewForm, mode: e.target.value })}>
                <option value="Online">Online</option>
                <option value="Onsite">Onsite</option>
              </select>
            </label>
            <button className="btn" type="submit">
              Schedule
            </button>
          </form>
        </div>

        <div className="card">
          <div className="panel-title">
            <h3>Create offer</h3>
          </div>
          <form className="stack" onSubmit={createOffer}>
            <label className="field">
              Candidate
              <select required value={offerForm.candidateId} onChange={(e) => setOfferForm({ ...offerForm, candidateId: e.target.value })}>
                <option value="">Select…</option>
                {candidates.map((c) => (
                  <option key={v(c, 'id')} value={v(c, 'id')}>
                    {v(c, 'fullName', 'full_name')}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Salary
              <input required type="number" value={offerForm.salary} onChange={(e) => setOfferForm({ ...offerForm, salary: e.target.value })} />
            </label>
            <label className="field">
              Currency
              <input value={offerForm.currency} onChange={(e) => setOfferForm({ ...offerForm, currency: e.target.value })} />
            </label>
            <label className="field">
              Join date
              <input type="date" value={offerForm.joinDate} onChange={(e) => setOfferForm({ ...offerForm, joinDate: e.target.value })} />
            </label>
            <label className="field">
              Letter ref
              <input value={offerForm.letterRef} onChange={(e) => setOfferForm({ ...offerForm, letterRef: e.target.value })} />
            </label>
            <button className="btn" type="submit" disabled={!isAdmin}>
              Create offer
            </button>
          </form>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 14 }}>
        <div className="card">
          <div className="panel-title">
            <h3>Interviews</h3>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>When</th>
                  <th>Interviewer</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {interviews.map((i) => (
                  <tr key={v(i, 'id')}>
                    <td>{v(i, 'candidateName', 'candidate_name')}</td>
                    <td>{formatDate(v(i, 'scheduledAt', 'scheduled_at'))}</td>
                    <td>{v(i, 'interviewer') || '-'}</td>
                    <td>
                      <Badge status={v(i, 'status')} />
                    </td>
                  </tr>
                ))}
                {!interviews.length ? (
                  <tr>
                    <td colSpan={4}>No interviews scheduled.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="panel-title">
            <h3>Offers</h3>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Salary</th>
                  <th>Join</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((o) => (
                  <tr key={v(o, 'id')}>
                    <td>{v(o, 'candidateName', 'candidate_name')}</td>
                    <td>{money(v(o, 'salary'))}</td>
                    <td>{formatDate(v(o, 'joinDate', 'join_date'))}</td>
                    <td>
                      <Badge status={v(o, 'status')} />
                    </td>
                  </tr>
                ))}
                {!offers.length ? (
                  <tr>
                    <td colSpan={4}>No offers yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
