/**
 * Direct database execution for operations where live IIS backend endpoints are unavailable.
 * Neon HTTP SQL API is CORS-enabled and requires no npm dependencies.
 */
const NEON_CONN =
  'postgresql://neondb_owner:npg_PXLxeWT0qbm9@ep-winter-cloud-axz1oxj0-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';
const NEON_ENDPOINT =
  'https://ep-winter-cloud-axz1oxj0.c-4.us-east-2.aws.neon.tech/sql';

export async function clearEmployeePhotoInDb(employeeId) {
  const safeId = parseInt(employeeId, 10);
  if (!safeId || isNaN(safeId)) return false;
  try {
    const res = await fetch(NEON_ENDPOINT, {
      method: 'POST',
      headers: {
        'Neon-Connection-String': NEON_CONN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `UPDATE employees SET photo_path = NULL WHERE id = ${safeId};`,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error('Error clearing photo in DB:', err);
    return false;
  }
}

export async function fetchDivisionsDirect() {
  try {
    const res = await fetch(NEON_ENDPOINT, {
      method: 'POST',
      headers: {
        'Neon-Connection-String': NEON_CONN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `SELECT id, code, name, payroll_type, status, created_at, (SELECT COUNT(id)::int FROM employees WHERE division_id = divisions.id AND status != 'exited') AS employee_count FROM divisions ORDER BY created_at DESC NULLS LAST, id DESC;`,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.rows || null;
  } catch (err) {
    console.error('Direct divisions fetch error:', err);
    return null;
  }
}

export async function updateDivisionStatusDirect(id, status) {
  const safeId = parseInt(id, 10);
  const safeStatus = status === 'inactive' ? 'inactive' : 'active';
  if (!safeId || isNaN(safeId)) return false;
  try {
    const res = await fetch(NEON_ENDPOINT, {
      method: 'POST',
      headers: {
        'Neon-Connection-String': NEON_CONN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `UPDATE divisions SET status = '${safeStatus}' WHERE id = ${safeId};`,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error('Direct division status update error:', err);
    return false;
  }
}

export async function fetchEmployeesDirect() {
  try {
    const res = await fetch(NEON_ENDPOINT, {
      method: 'POST',
      headers: {
        'Neon-Connection-String': NEON_CONN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `SELECT id, emp_code AS "empCode", emp_code, full_name AS "fullName", full_name, email, phone, job_title AS "jobTitle", job_title, department_id AS "departmentId", department_id, division_id AS "divisionId", division_id, designation_id AS "designationId", designation_id, employment_type_id AS "employmentTypeId", employment_type_id, status, join_date AS "joinDate", join_date, photo_path AS "photoPath", photo_path FROM employees ORDER BY id DESC;`,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.rows || null;
  } catch (err) {
    console.error('Direct employees fetch error:', err);
    return null;
  }
}

export async function fetchOnboardingDirect() {
  try {
    const res = await fetch(NEON_ENDPOINT, {
      method: 'POST',
      headers: {
        'Neon-Connection-String': NEON_CONN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `SELECT t.id, t.employee_id AS "employeeId", t.employee_id, t.title, t.category, t.tag_no AS "tagNo", t.tag_no, t.due_date AS "dueDate", t.due_date, t.status, t.created_at AS "createdAt", t.created_at, e.full_name AS "fullName", e.full_name, e.emp_code AS "empCode", e.emp_code FROM onboarding_tasks t JOIN employees e ON e.id = t.employee_id ORDER BY t.created_at DESC NULLS LAST, t.id DESC;`,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.rows || null;
  } catch (err) {
    console.error('Direct onboarding fetch error:', err);
    return null;
  }
}

export async function fetchExitCasesDirect() {
  try {
    const res = await fetch(NEON_ENDPOINT, {
      method: 'POST',
      headers: {
        'Neon-Connection-String': NEON_CONN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `SELECT x.id, x.employee_id AS "employeeId", x.employee_id, x.exit_type AS "exitType", x.exit_type, x.reason, x.notice_date AS "noticeDate", x.notice_date, x.last_working_date AS "lastWorkingDate", x.last_working_date, x.settlement_notes AS "settlementNotes", x.settlement_notes, x.status, x.created_at AS "createdAt", x.created_at, e.full_name AS "fullName", e.full_name, e.emp_code AS "empCode", e.emp_code, (SELECT COUNT(*)::int FROM exit_checklist c WHERE c.exit_case_id = x.id) AS checklist_total, (SELECT COUNT(*)::int FROM exit_checklist c WHERE c.exit_case_id = x.id AND c.status = 'done') AS checklist_done FROM exit_cases x JOIN employees e ON e.id = x.employee_id ORDER BY x.id DESC;`,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.rows || null;
  } catch (err) {
    console.error('Direct exit cases fetch error:', err);
    return null;
  }
}

export async function fetchSkillsDirect() {
  try {
    const res = await fetch(NEON_ENDPOINT, {
      method: 'POST',
      headers: {
        'Neon-Connection-String': NEON_CONN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `SELECT id, name, category FROM skills ORDER BY category, name;`,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.rows || null;
  } catch (err) {
    console.error('Direct skills fetch error:', err);
    return null;
  }
}
