'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api, getUser, normalizeRole } from '../../lib/auth';
import { formatDate, todayISO, v } from '../../lib/format';

export default function TrainingPage() {
  const role = normalizeRole(getUser());
  const isAdmin = role === 'admin';

  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [certs, setCerts] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [skills, setSkills] = useState([]);
  const [employeeSkills, setEmployeeSkills] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const [courseForm, setCourseForm] = useState({
    title: '',
    category: 'Compliance',
    durationHours: 4,
    description: '',
  });
  const [enrollForm, setEnrollForm] = useState({
    courseId: '',
    employeeId: '',
    dueDate: todayISO(),
  });
  const [certForm, setCertForm] = useState({
    employeeId: '',
    name: '',
    issuer: '',
    issuedOn: todayISO(),
    expiresOn: '',
  });
  const [skillForm, setSkillForm] = useState({ employeeId: '', skillId: '', level: 'intermediate' });

  const load = useCallback(() => {
    setError('');
    Promise.all([
      api('/training/courses'),
      api('/training/enrollments'),
      api('/training/certifications'),
      api('/training/calendar'),
      api('/org/skills'),
      api('/org/employee-skills'),
      api('/employees'),
    ])
      .then(([c, e, cert, cal, sk, esk, emps]) => {
        setCourses(c || []);
        setEnrollments(e || []);
        setCerts(cert || []);
        setCalendar(cal || []);
        setSkills(sk || []);
        setEmployeeSkills(esk || []);
        setEmployees(emps || []);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createCourse(e) {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      await api('/training/courses', {
        method: 'POST',
        body: JSON.stringify({
          ...courseForm,
          durationHours: Number(courseForm.durationHours) || 0,
        }),
      });
      setMsg('Course created.');
      setCourseForm({ title: '', category: 'Compliance', durationHours: 4, description: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createEnrollment(e) {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      await api('/training/enrollments', {
        method: 'POST',
        body: JSON.stringify({
          courseId: Number(enrollForm.courseId),
          employeeId: Number(enrollForm.employeeId),
          dueDate: enrollForm.dueDate || null,
        }),
      });
      setMsg('Enrollment assigned.');
      setEnrollForm({ courseId: '', employeeId: '', dueDate: todayISO() });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createCert(e) {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      await api('/training/certifications', {
        method: 'POST',
        body: JSON.stringify({
          ...certForm,
          employeeId: Number(certForm.employeeId),
          expiresOn: certForm.expiresOn || null,
        }),
      });
      setMsg('Certification saved.');
      setCertForm({ employeeId: '', name: '', issuer: '', issuedOn: todayISO(), expiresOn: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function setEnrollmentStatus(id, status) {
    try {
      await api(`/training/enrollments/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AppShell title="Training & Learning" subtitle="Courses, enrollments and certifications">
      {error ? <div className="error">{error}</div> : null}
      {msg ? <div className="muted" style={{ marginBottom: 12, color: 'var(--ok)', fontWeight: 600 }}>{msg}</div> : null}

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="panel-title">
          <h3>Training calendar</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Course</th>
                <th>Category</th>
                <th>Start</th>
                <th>End</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {calendar.map((c) => (
                <tr key={v(c, 'id')}>
                  <td>{v(c, 'title')}</td>
                  <td>{v(c, 'category') || '-'}</td>
                  <td>{formatDate(v(c, 'scheduledStart', 'scheduled_start'))}</td>
                  <td>{formatDate(v(c, 'scheduledEnd', 'scheduled_end'))}</td>
                  <td>
                    <Badge status={v(c, 'status')} />
                  </td>
                </tr>
              ))}
              {!calendar.length ? (
                <tr>
                  <td colSpan={5}>No scheduled courses yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="panel-title">
          <h3>Skills matrix</h3>
        </div>
        {isAdmin ? (
          <form
            className="stack"
            style={{ marginBottom: 12 }}
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api('/org/employee-skills', {
                  method: 'POST',
                  body: JSON.stringify({
                    employeeId: Number(skillForm.employeeId),
                    skillId: Number(skillForm.skillId),
                    level: skillForm.level,
                  }),
                });
                setMsg('Skill assigned.');
                load();
              } catch (err) {
                setError(err.message);
              }
            }}
          >
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <label className="field">
                Employee
                <select required value={skillForm.employeeId} onChange={(e) => setSkillForm({ ...skillForm, employeeId: e.target.value })}>
                  <option value="">Select…</option>
                  {employees.map((emp) => (
                    <option key={v(emp, 'id')} value={v(emp, 'id')}>
                      {v(emp, 'fullName', 'full_name')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Skill
                <select required value={skillForm.skillId} onChange={(e) => setSkillForm({ ...skillForm, skillId: e.target.value })}>
                  <option value="">Select…</option>
                  {skills.map((s) => (
                    <option key={v(s, 'id')} value={v(s, 'id')}>
                      {v(s, 'name')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Level
                <select value={skillForm.level} onChange={(e) => setSkillForm({ ...skillForm, level: e.target.value })}>
                  <option value="beginner">beginner</option>
                  <option value="intermediate">intermediate</option>
                  <option value="advanced">advanced</option>
                  <option value="expert">expert</option>
                </select>
              </label>
            </div>
            <button className="btn" type="submit">
              Assign skill
            </button>
          </form>
        ) : null}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Skill</th>
                <th>Category</th>
                <th>Level</th>
              </tr>
            </thead>
            <tbody>
              {employeeSkills.map((s, i) => (
                <tr key={`${v(s, 'employeeId', 'employee_id')}-${v(s, 'skillId', 'skill_id')}-${i}`}>
                  <td>{v(s, 'fullName', 'full_name')}</td>
                  <td>{v(s, 'skillName', 'skill_name')}</td>
                  <td>{v(s, 'category')}</td>
                  <td>{v(s, 'level')}</td>
                </tr>
              ))}
              {!employeeSkills.length ? (
                <tr>
                  <td colSpan={4}>No skills assigned.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {isAdmin ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="panel-title">
            <h3>Add course</h3>
          </div>
          <form className="stack" onSubmit={createCourse}>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <label className="field">
                Title
                <input required value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} />
              </label>
              <label className="field">
                Category
                <input value={courseForm.category} onChange={(e) => setCourseForm({ ...courseForm, category: e.target.value })} />
              </label>
              <label className="field">
                Duration (hours)
                <input type="number" min="0" step="0.5" value={courseForm.durationHours} onChange={(e) => setCourseForm({ ...courseForm, durationHours: e.target.value })} />
              </label>
            </div>
            <label className="field">
              Description
              <textarea rows={2} value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} />
            </label>
            <button className="btn" type="submit">
              Create course
            </button>
          </form>
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="panel-title">
          <h3>Courses</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Hours</th>
                <th>Enrolled</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={v(c, 'id')}>
                  <td>
                    {v(c, 'title')}
                    {v(c, 'description') ? <div className="muted">{v(c, 'description')}</div> : null}
                  </td>
                  <td>{v(c, 'category') || '—'}</td>
                  <td>{v(c, 'durationHours', 'duration_hours') || 0}</td>
                  <td>{v(c, 'enrollmentCount', 'enrollment_count') || 0}</td>
                  <td>
                    <Badge status={v(c, 'status')} />
                  </td>
                </tr>
              ))}
              {!courses.length ? (
                <tr>
                  <td colSpan={5}>No courses yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {isAdmin ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="panel-title">
            <h3>Assign enrollment</h3>
          </div>
          <form className="stack" onSubmit={createEnrollment}>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <label className="field">
                Course
                <select required value={enrollForm.courseId} onChange={(e) => setEnrollForm({ ...enrollForm, courseId: e.target.value })}>
                  <option value="">Select…</option>
                  {courses.map((c) => (
                    <option key={v(c, 'id')} value={v(c, 'id')}>
                      {v(c, 'title')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Employee
                <select required value={enrollForm.employeeId} onChange={(e) => setEnrollForm({ ...enrollForm, employeeId: e.target.value })}>
                  <option value="">Select…</option>
                  {employees.map((e) => (
                    <option key={v(e, 'id')} value={v(e, 'id')}>
                      {v(e, 'fullName', 'full_name')} ({v(e, 'empCode', 'emp_code')})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Due date
                <input type="date" value={enrollForm.dueDate} onChange={(e) => setEnrollForm({ ...enrollForm, dueDate: e.target.value })} />
              </label>
            </div>
            <button className="btn" type="submit">
              Assign
            </button>
          </form>
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="panel-title">
          <h3>Enrollments</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Course</th>
                <th>Due</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((row) => {
                const status = String(v(row, 'status') || '');
                return (
                  <tr key={v(row, 'id')}>
                    <td>
                      {v(row, 'fullName', 'full_name')}
                      <div className="muted">{v(row, 'empCode', 'emp_code')}</div>
                    </td>
                    <td>{v(row, 'courseTitle', 'course_title')}</td>
                    <td>{formatDate(v(row, 'dueDate', 'due_date'))}</td>
                    <td>
                      <Badge status={status} />
                    </td>
                    <td>
                      {isAdmin && status !== 'completed' && status !== 'cancelled' ? (
                        <div className="row-actions">
                          {status === 'assigned' ? (
                            <button type="button" className="btn secondary" onClick={() => setEnrollmentStatus(v(row, 'id'), 'in_progress')}>
                              Start
                            </button>
                          ) : null}
                          <button type="button" className="btn ok" onClick={() => setEnrollmentStatus(v(row, 'id'), 'completed')}>
                            Complete
                          </button>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                );
              })}
              {!enrollments.length ? (
                <tr>
                  <td colSpan={5}>No enrollments yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {isAdmin ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="panel-title">
            <h3>Add certification</h3>
          </div>
          <form className="stack" onSubmit={createCert}>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <label className="field">
                Employee
                <select required value={certForm.employeeId} onChange={(e) => setCertForm({ ...certForm, employeeId: e.target.value })}>
                  <option value="">Select…</option>
                  {employees.map((e) => (
                    <option key={v(e, 'id')} value={v(e, 'id')}>
                      {v(e, 'fullName', 'full_name')} ({v(e, 'empCode', 'emp_code')})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Name
                <input required value={certForm.name} onChange={(e) => setCertForm({ ...certForm, name: e.target.value })} />
              </label>
              <label className="field">
                Issuer
                <input value={certForm.issuer} onChange={(e) => setCertForm({ ...certForm, issuer: e.target.value })} />
              </label>
              <label className="field">
                Issued on
                <input type="date" value={certForm.issuedOn} onChange={(e) => setCertForm({ ...certForm, issuedOn: e.target.value })} />
              </label>
              <label className="field">
                Expires on
                <input type="date" value={certForm.expiresOn} onChange={(e) => setCertForm({ ...certForm, expiresOn: e.target.value })} />
              </label>
            </div>
            <button className="btn" type="submit">
              Save certification
            </button>
          </form>
        </div>
      ) : null}

      <div className="card">
        <div className="panel-title">
          <h3>Certifications</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Name</th>
                <th>Issuer</th>
                <th>Issued</th>
                <th>Expires</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {certs.map((c) => (
                <tr key={v(c, 'id')}>
                  <td>
                    {v(c, 'fullName', 'full_name')}
                    <div className="muted">{v(c, 'empCode', 'emp_code')}</div>
                  </td>
                  <td>{v(c, 'name')}</td>
                  <td>{v(c, 'issuer') || '—'}</td>
                  <td>{formatDate(v(c, 'issuedOn', 'issued_on'))}</td>
                  <td>{formatDate(v(c, 'expiresOn', 'expires_on'))}</td>
                  <td>
                    <Badge status={v(c, 'status')} />
                  </td>
                </tr>
              ))}
              {!certs.length ? (
                <tr>
                  <td colSpan={6}>No certifications yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
