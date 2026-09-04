'use client';

import AppShell, { Badge } from '../../components/AppShell';
import { BRAND } from '../../lib/brand';

const PHASE9 = [
  { id: '9.1', task: 'Employee CRUD + app login create', path: '/employees', status: 'done' },
  { id: '9.2', task: 'Leave approve/reject (HR final)', path: '/leave', status: 'done' },
  { id: '9.3', task: 'Attendance manage', path: '/attendance', status: 'done' },
  { id: '9.4', task: 'Payroll + WPS + Bank export', path: '/payroll', status: 'done' },
  { id: '9.5', task: 'Company master CRUD', path: '/divisions', status: 'done' },
  { id: '9.6', task: 'HR Masters — Designation & Employment type soft delete', path: '/masters', status: 'done' },
  { id: '9.7', task: 'Bulk employee import', path: '/employees', status: 'done' },
  { id: '9.8', task: 'Reports (attendance, payroll, headcount)', path: '/reports', status: 'done' },
  { id: '9.9', task: 'Loan module', path: null, status: 'na' },
];

const MANUALS = [
  {
    title: 'Core HR & Workforce',
    desc: 'Employees, bulk import, companies, leave, certificates, payroll exports.',
    section: '10.1 – 10.5 (portal side)',
  },
  {
    title: 'Employee Mobile App',
    desc: 'ESS, leave apply, team approvals, payslips, certificates, alerts.',
    section: '10.5 (employee / team lead side)',
  },
  {
    title: 'Printable combined manual (PDF)',
    desc: 'Open in new tab → Print → Save as PDF for client handover.',
    href: '/manuals/index.html',
    primary: true,
  },
];

export default function HelpPage() {
  return (
    <AppShell title="Help & Manuals" subtitle="Phase 9 portal checklist · Phase 10 user documentation">
      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>Phase 9 — Portal HR Admin (complete)</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          All PDF-required administrator functions are available in this portal.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Task</th>
                <th>Status</th>
                <th>Go to</th>
              </tr>
            </thead>
            <tbody>
              {PHASE9.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.task}</td>
                  <td>
                    {row.status === 'done' ? (
                      <Badge status="approved" />
                    ) : row.status === 'na' ? (
                      <span className="muted">N/A — client declined</span>
                    ) : (
                      <Badge status="pending" />
                    )}
                  </td>
                  <td>
                    {row.path ? (
                      <a href={row.path}>{row.path}</a>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>Phase 10 — User manuals</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Professional guides for {BRAND.clientName} handover. Demo logins: see{' '}
          <code>Seed-Logins.txt</code> in the repository.
        </p>
        <div style={{ display: 'grid', gap: 12 }}>
          {MANUALS.map((m) => (
            <div
              key={m.title}
              style={{
                padding: 14,
                border: '1px solid var(--border)',
                borderRadius: 10,
                background: m.primary ? 'var(--surface)' : 'transparent',
              }}
            >
              <strong>{m.title}</strong>
              {m.section ? (
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  {m.section}
                </div>
              ) : null}
              <p style={{ margin: '8px 0 10px', fontSize: 14 }}>{m.desc}</p>
              {m.href ? (
                <a
                  className={m.primary ? 'btn' : 'btn secondary'}
                  href={m.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-block', textDecoration: 'none' }}
                >
                  Open printable manual
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Quick demo flow</h3>
        <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
          <li>
            <strong>Employee</strong> (app): <code>fatima@digitaldive.demo</code> — apply leave or certificate
          </li>
          <li>
            <strong>Team lead</strong> (app): <code>ahmed@digitaldive.demo</code> — Team approvals
          </li>
          <li>
            <strong>HR</strong> (portal): <code>admin@digitaldive.demo</code> — final leave, certificates, payroll
          </li>
        </ol>
        <p className="muted" style={{ marginBottom: 0, marginTop: 12, fontSize: 13 }}>
          Client assets still pending: logo, SMTP, certificate Word templates, real employee Excel (Phase 1B).
        </p>
      </div>
    </AppShell>
  );
}
