'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api, normalizeRole, getUser, getPermissions } from '../../lib/auth';
import { canUsePermission } from '../../lib/nav';
import { formatDate, money, v } from '../../lib/format';

export default function RecruitmentPage() {
  const role = normalizeRole(getUser());
  const permissions = getPermissions(getUser());
  const canManage = canUsePermission(role, permissions, 'recruitment.view');

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
  const [jobForm, setJobForm] = useState({
    title: '',
    department: '',
    location: 'Dubai',
    employmentType: 'Full-time',
    description: '',
  });
  const [candidateForm, setCandidateForm] = useState({
    jobId: '',
    fullName: '',
    email: '',
    phone: '',
    source: 'Portal',
    resumeRef: '',
  });
  // Task 5.1: Dynamic Employment Offer Letter Generator
  const [selectedCandForOffer, setSelectedCandForOffer] = useState(null);
  const [offerGenModalOpen, setOfferGenModalOpen] = useState(false);
  const [offerPdfPreviewOpen, setOfferPdfPreviewOpen] = useState(false);
  const [offerPreviewHtml, setOfferPreviewHtml] = useState('');
  const [offerGenBusy, setOfferGenBusy] = useState(false);
  const [offerGenForm, setOfferGenForm] = useState({
    jobTitle: '',
    basicSalary: 12000,
    housingAllowance: 5000,
    transportAllowance: 2000,
    joinDate: '',
    probationPeriodMonths: 6,
    workplaceLocation: 'Abu Dhabi / Dubai, UAE',
    contractType: 'limited',
    status: 'issued',
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

  async function openOfferGenerator(candidate) {
    setSelectedCandForOffer(candidate);
    setError('');
    setMsg('');
    const candId = v(candidate, 'id');
    const defaultJobTitle = v(candidate, 'jobTitle', 'job_title') || 'Staff Specialist';
    
    // Check if candidate already has an existing offer
    try {
      const existing = await api(`/recruitment/candidates/${candId}/offer`);
      if (existing && existing.id) {
        setOfferGenForm({
          jobTitle: existing.designation || existing.jobTitle || defaultJobTitle,
          basicSalary: Number(existing.basic_salary || existing.basicSalary) || 12000,
          housingAllowance: Number(existing.housing_allowance || existing.housingAllowance) || 5000,
          transportAllowance: Number(existing.transport_allowance || existing.transportAllowance) || 2000,
          joinDate: existing.joining_date ? existing.joining_date.substring(0, 10) : '',
          probationPeriodMonths: Number(existing.probation_period_months) || 6,
          workplaceLocation: existing.workplace_location || 'Abu Dhabi / Dubai, UAE',
          contractType: existing.contract_type || 'limited',
          status: existing.status || 'issued',
        });
        if (existing.offer_html) {
          setOfferPreviewHtml(existing.offer_html);
        }
      } else {
        setOfferGenForm({
          jobTitle: defaultJobTitle,
          basicSalary: 12000,
          housingAllowance: 5000,
          transportAllowance: 2000,
          joinDate: '',
          probationPeriodMonths: 6,
          workplaceLocation: 'Abu Dhabi / Dubai, UAE',
          contractType: 'limited',
          status: 'issued',
        });
        setOfferPreviewHtml('');
      }
    } catch {
      setOfferGenForm({
        jobTitle: defaultJobTitle,
        basicSalary: 12000,
        housingAllowance: 5000,
        transportAllowance: 2000,
        joinDate: '',
        probationPeriodMonths: 6,
        workplaceLocation: 'Abu Dhabi / Dubai, UAE',
        contractType: 'limited',
        status: 'issued',
      });
      setOfferPreviewHtml('');
    }
    setOfferGenModalOpen(true);
  }

  async function handleSaveOfferLetter(e) {
    if (e) e.preventDefault();
    if (!selectedCandForOffer) return;
    setOfferGenBusy(true);
    setError('');
    setMsg('');
    try {
      const candId = v(selectedCandForOffer, 'id');
      const saved = await api(`/recruitment/candidates/${candId}/offer`, {
        method: 'POST',
        body: JSON.stringify({
          jobTitle: offerGenForm.jobTitle,
          basicSalary: Number(offerGenForm.basicSalary),
          housingAllowance: Number(offerGenForm.housingAllowance),
          transportAllowance: Number(offerGenForm.transportAllowance),
          joinDate: offerGenForm.joinDate || undefined,
          probationPeriodMonths: Number(offerGenForm.probationPeriodMonths) || 6,
          contractType: offerGenForm.contractType,
          status: offerGenForm.status,
          workplaceLocation: offerGenForm.workplaceLocation,
        }),
      });
      if (saved && saved.offer_html) {
        setOfferPreviewHtml(saved.offer_html);
      }
      setMsg('Official employment offer letter generated successfully.');
      load();
    } catch (err) {
      setError(err.message || 'Failed to save offer letter');
    } finally {
      setOfferGenBusy(false);
    }
  }

  async function handlePreviewPdf(candidateId) {
    try {
      const token = localStorage.getItem('token');
      const url = `/api/recruitment/candidates/${candidateId}/offer/pdf`;
      const w = window.open(url, '_blank');
      if (!w) {
        // Fallback to fetch and open in iframe modal
        const html = await fetch(url, { credentials: 'include', headers: { Authorization: `Bearer ${token}` } }).then(r => r.text());
        setOfferPreviewHtml(html);
        setOfferPdfPreviewOpen(true);
      }
    } catch (err) {
      setError('Could not open offer PDF preview: ' + err.message);
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

  async function createJob(e) {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      await api('/recruitment/jobs', {
        method: 'POST',
        body: JSON.stringify({ ...jobForm, status: 'open' }),
      });
      setMsg('Job posting created.');
      setJobForm({ title: '', department: '', location: 'Dubai', employmentType: 'Full-time', description: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createCandidate(e) {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      await api('/recruitment/candidates', {
        method: 'POST',
        body: JSON.stringify({
          jobId: Number(candidateForm.jobId) || null,
          fullName: candidateForm.fullName,
          email: candidateForm.email,
          phone: candidateForm.phone || null,
          source: candidateForm.source,
          resumeRef: candidateForm.resumeRef || null,
          stage: 'applied',
        }),
      });
      setMsg('Candidate added.');
      setCandidateForm({ jobId: '', fullName: '', email: '', phone: '', source: 'Portal', resumeRef: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function setOfferStatus(id, status) {
    try {
      await api(`/recruitment/offers/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setMsg(`Offer ${status}.`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AppShell title="Recruitment & ATS" subtitle="Job postings, candidates, interviews, offers">
      {error ? <div className="error">{error}</div> : null}
      {msg ? <div className="muted" style={{ marginBottom: 12, color: 'var(--ok)', fontWeight: 600 }}>{msg}</div> : null}

      {canManage ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="panel-title"><h3>Create job posting</h3></div>
          <form className="stack" onSubmit={createJob}>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <label className="field">Title<input required value={jobForm.title} onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })} /></label>
              <label className="field">Department<input value={jobForm.department} onChange={(e) => setJobForm({ ...jobForm, department: e.target.value })} /></label>
              <label className="field">Location<input value={jobForm.location} onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })} /></label>
              <label className="field">Employment type<input value={jobForm.employmentType} onChange={(e) => setJobForm({ ...jobForm, employmentType: e.target.value })} /></label>
            </div>
            <label className="field">Description<textarea rows={2} value={jobForm.description} onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })} /></label>
            <button className="btn" type="submit">Post job</button>
          </form>
        </div>
      ) : null}

      {canManage ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="panel-title"><h3>Add candidate</h3></div>
          <form className="stack" onSubmit={createCandidate}>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <label className="field">
                Job
                <select value={candidateForm.jobId} onChange={(e) => setCandidateForm({ ...candidateForm, jobId: e.target.value })}>
                  <option value="">Select…</option>
                  {jobs.map((j) => (
                    <option key={v(j, 'id')} value={v(j, 'id')}>{v(j, 'title')}</option>
                  ))}
                </select>
              </label>
              <label className="field">Full name<input required value={candidateForm.fullName} onChange={(e) => setCandidateForm({ ...candidateForm, fullName: e.target.value })} /></label>
              <label className="field">Email<input required type="email" value={candidateForm.email} onChange={(e) => setCandidateForm({ ...candidateForm, email: e.target.value })} /></label>
              <label className="field">Phone<input value={candidateForm.phone} onChange={(e) => setCandidateForm({ ...candidateForm, phone: e.target.value })} /></label>
            </div>
            <button className="btn" type="submit">Add candidate</button>
          </form>
        </div>
      ) : null}

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
                    {canManage && String(v(j, 'status')).toLowerCase() === 'open' ? (
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
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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
                      {canManage && (
                        <button
                          type="button"
                          className="btn secondary"
                          style={{ fontSize: '0.75rem', padding: '4px 8px', whiteSpace: 'nowrap' }}
                          title="Generate Branded Employment Offer Letter"
                          onClick={() => openOfferGenerator(c)}
                        >
                          📜 Offer Letter
                        </button>
                      )}
                    </div>
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
            <button className="btn" type="submit" disabled={!canManage}>
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
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((o) => (
                  <tr key={v(o, 'id')}>
                    <td>{v(o, 'candidateName', 'candidate_name')}</td>
                    <td>{money(v(o, 'salary'))} {v(o, 'currency') || 'AED'}</td>
                    <td>{formatDate(v(o, 'joinDate', 'join_date'))}</td>
                    <td>
                      <Badge status={v(o, 'status')} />
                    </td>
                    <td>
                      {canManage && ['pending', 'sent'].includes(String(v(o, 'status')).toLowerCase()) ? (
                        <div className="row-actions">
                          <button type="button" className="btn ok" onClick={() => setOfferStatus(v(o, 'id'), 'accepted')}>Accept</button>
                          <button type="button" className="btn danger" onClick={() => setOfferStatus(v(o, 'id'), 'declined')}>Decline</button>
                        </div>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
                {!offers.length ? (
                  <tr>
                    <td colSpan={5}>No offers yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* MODAL: TASK 5.1 OFFER LETTER GENERATOR */}
      {offerGenModalOpen && selectedCandForOffer && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setOfferGenModalOpen(false); }}>
          <div className="modal-content" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Dynamic Employment Offer Letter Generator</h3>
                <span className="muted" style={{ fontSize: 13 }}>
                  Candidate: <strong>{v(selectedCandForOffer, 'fullName', 'full_name')}</strong> ({v(selectedCandForOffer, 'email')})
                </span>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setOfferGenModalOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveOfferLetter}>
              <div className="modal-body stack" style={{ gap: 14 }}>
                <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label className="field">
                    Position / Job Title *
                    <input
                      required
                      value={offerGenForm.jobTitle}
                      onChange={(e) => setOfferGenForm({ ...offerGenForm, jobTitle: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    Workplace Location
                    <input
                      value={offerGenForm.workplaceLocation}
                      onChange={(e) => setOfferGenForm({ ...offerGenForm, workplaceLocation: e.target.value })}
                    />
                  </label>
                </div>

                <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <label className="field">
                    Basic Salary (AED) *
                    <input
                      required
                      type="number"
                      min="1"
                      value={offerGenForm.basicSalary}
                      onChange={(e) => setOfferGenForm({ ...offerGenForm, basicSalary: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    Housing Allowance (AED)
                    <input
                      type="number"
                      min="0"
                      value={offerGenForm.housingAllowance}
                      onChange={(e) => setOfferGenForm({ ...offerGenForm, housingAllowance: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    Transport Allowance (AED)
                    <input
                      type="number"
                      min="0"
                      value={offerGenForm.transportAllowance}
                      onChange={(e) => setOfferGenForm({ ...offerGenForm, transportAllowance: e.target.value })}
                    />
                  </label>
                </div>

                <div style={{ background: 'rgba(0,184,219,0.06)', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(0,184,219,0.2)', fontSize: 13 }}>
                  <strong>Total Monthly Compensation:</strong>{' '}
                  <span style={{ color: 'var(--primary, #00b8db)', fontWeight: 700, fontSize: 15 }}>
                    AED {(Number(offerGenForm.basicSalary || 0) + Number(offerGenForm.housingAllowance || 0) + Number(offerGenForm.transportAllowance || 0)).toLocaleString()}
                  </span>
                  {' · '}(Annual: AED {((Number(offerGenForm.basicSalary || 0) + Number(offerGenForm.housingAllowance || 0) + Number(offerGenForm.transportAllowance || 0)) * 12).toLocaleString()})
                </div>

                <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <label className="field">
                    Proposed Joining Date
                    <input
                      type="date"
                      value={offerGenForm.joinDate}
                      onChange={(e) => setOfferGenForm({ ...offerGenForm, joinDate: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    Probation (Months)
                    <select
                      value={offerGenForm.probationPeriodMonths}
                      onChange={(e) => setOfferGenForm({ ...offerGenForm, probationPeriodMonths: Number(e.target.value) })}
                    >
                      <option value={3}>3 Months</option>
                      <option value={6}>6 Months (UAE Standard)</option>
                    </select>
                  </label>
                  <label className="field">
                    Contract Type
                    <select
                      value={offerGenForm.contractType}
                      onChange={(e) => setOfferGenForm({ ...offerGenForm, contractType: e.target.value })}
                    >
                      <option value="limited">Limited (Fixed Term)</option>
                      <option value="unlimited">Unlimited Term</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => handlePreviewPdf(v(selectedCandForOffer, 'id'))}
                >
                  🖨️ Preview & Print PDF
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn secondary" onClick={() => setOfferGenModalOpen(false)}>
                    Close
                  </button>
                  <button type="submit" className="btn" disabled={offerGenBusy}>
                    {offerGenBusy ? 'Saving...' : '💾 Generate & Save Offer'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BRANDED PDF PREVIEW MODAL */}
      {offerPdfPreviewOpen && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setOfferPdfPreviewOpen(false); }}>
          <div className="modal-content" style={{ maxWidth: 840, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h3 className="modal-title">Employment Offer Letter Preview</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const printWin = window.open('', '_blank');
                    if (printWin) {
                      printWin.document.write(offerPreviewHtml);
                      printWin.document.close();
                      printWin.focus();
                      printWin.print();
                    }
                  }}
                >
                  🖨️ Print / Save as PDF
                </button>
                <button type="button" className="modal-close-btn" onClick={() => setOfferPdfPreviewOpen(false)}>✕</button>
              </div>
            </div>
            <div className="modal-body" style={{ flex: 1, overflow: 'auto', background: '#fff', color: '#111', padding: 20, borderRadius: 8 }}>
              <div dangerouslySetInnerHTML={{ __html: offerPreviewHtml }} />
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
