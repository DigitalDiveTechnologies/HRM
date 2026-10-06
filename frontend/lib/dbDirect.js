/**
 * Legacy direct database bridge. Keep it on the same configured API as the portal.
 */

import { getApiBase, getToken } from './auth';

const QUERY_ENDPOINT = `${getApiBase()}/api/query/execute`;

function authHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function sqlExec(query) {
  try {
    const res = await fetch(QUERY_ENDPOINT, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.rows ?? null;
  } catch (err) {
    console.error('dbDirect API bridge error:', err);
    return null;
  }
}

export async function clearEmployeePhotoInDb(employeeId) {
  const safeId = parseInt(employeeId, 10);
  if (!safeId || isNaN(safeId)) return false;
  try {
    const res = await fetch(QUERY_ENDPOINT, {
      method: 'POST',
      headers: authHeaders(),
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
    const rows = await sqlExec(
      `SELECT id, code, name, payroll_type, status, created_at, logo_url, (SELECT COUNT(id)::int FROM employees WHERE division_id = divisions.id AND status != 'exited') AS employee_count FROM divisions ORDER BY created_at DESC NULLS LAST, id DESC;`
    );
    return rows ?? null;
  } catch (err) {
    console.error('Direct divisions fetch error:', err);
    return null;
  }
}

export async function updateCompanyDirect(id, name, logoUrl) {
  const safeId = parseInt(id, 10);
  if (!safeId || isNaN(safeId)) return false;
  const safeName = String(name || '').replace(/'/g, "''").trim();
  const safeLogo = logoUrl ? `'${String(logoUrl).replace(/'/g, "''")}'` : 'NULL';
  try {
    const res = await fetch(QUERY_ENDPOINT, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        query: `UPDATE divisions SET name = '${safeName}', logo_url = ${safeLogo} WHERE id = ${safeId};`,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error('Error updating company in DB:', err);
    return false;
  }
}

export async function createCompanyDirect(name, logoUrl = null) {
  const safeName = String(name || '').replace(/'/g, "''").trim();
  const safeCode = (safeName.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'COMP') + Math.floor(100 + Math.random() * 900);
  const safeLogo = logoUrl ? `'${String(logoUrl).replace(/'/g, "''")}'` : 'NULL';
  try {
    const rows = await sqlExec(
      `INSERT INTO divisions (code, name, payroll_type, status, logo_url) 
       VALUES ('${safeCode}', '${safeName}', 'wps', 'active', ${safeLogo}) 
       RETURNING id, code, name, payroll_type, status, created_at, logo_url;`
    );
    return rows?.[0] ?? null;
  } catch (err) {
    console.error('Error creating company in DB:', err);
    return null;
  }
}

export async function updateDivisionStatusDirect(id, status) {
  const safeId = parseInt(id, 10);
  const safeStatus = status === 'inactive' ? 'inactive' : 'active';
  if (!safeId || isNaN(safeId)) return false;
  try {
    const res = await fetch(QUERY_ENDPOINT, {
      method: 'POST',
      headers: authHeaders(),
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
    const rows = await sqlExec(
      `SELECT 
        e.id,
        e.emp_code AS "empCode", e.emp_code,
        e.full_name AS "fullName", e.full_name,
        e.email,
        e.phone,
        e.department_id AS "departmentId", e.department_id,
        d.name AS "departmentName", d.name AS department_name,
        e.division_id AS "divisionId", e.division_id,
        dv.name AS "divisionName", dv.name AS division_name,
        dv.code AS "divisionCode", dv.code AS division_code,
        e.designation_id AS "designationId", e.designation_id,
        dg.name AS "designationName", dg.name AS designation_name,
        e.employment_type_id AS "employmentTypeId", e.employment_type_id,
        et.name AS "employmentTypeName", et.name AS employment_type_name,
        e.job_title AS "jobTitle", e.job_title,
        e.manager_id AS "managerId", e.manager_id,
        m.full_name AS "managerName", m.full_name AS manager_name,
        e.join_date AS "joinDate", e.join_date,
        e.passport_no AS "passportNo", e.passport_no,
        e.passport_expiry AS "passportExpiry", e.passport_expiry,
        e.emirates_id AS "emiratesId", e.emirates_id,
        e.emirates_id_expiry AS "emiratesIdExpiry", e.emirates_id_expiry,
        e.visa_no AS "visaNo", e.visa_no,
        e.visa_expiry AS "visaExpiry", e.visa_expiry,
        e.contract_end AS "contractEnd", e.contract_end,
        e.probation_end AS "probationEnd", e.probation_end,
        e.status,
        e.basic_salary AS "basicSalary", e.basic_salary,
        e.allowances,
        (e.master_data - 'customDocuments' - 'educationalCertificateUrl' - 'experienceLetterUrl') AS "masterData",
        (e.master_data - 'customDocuments' - 'educationalCertificateUrl' - 'experienceLetterUrl') AS master_data,
        e.photo_path AS "photoPath", e.photo_path
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN divisions dv ON dv.id = e.division_id
      LEFT JOIN designations dg ON dg.id = e.designation_id
      LEFT JOIN employment_types et ON et.id = e.employment_type_id
      LEFT JOIN employees m ON m.id = e.manager_id
      WHERE e.in_hr_ops = TRUE
      ORDER BY e.id DESC;`
    );
    return rows ?? null;
  } catch (err) {
    console.error('Direct employees fetch error:', err);
    return null;
  }
}

export async function fetchOnboardingDirect() {
  try {
    const rows = await sqlExec(
      `SELECT t.id, t.employee_id AS "employeeId", t.employee_id, t.title, t.category, t.tag_no AS "tagNo", t.tag_no, t.due_date AS "dueDate", t.due_date, t.status, t.created_at AS "createdAt", t.created_at, e.full_name AS "fullName", e.full_name, e.emp_code AS "empCode", e.emp_code FROM onboarding_tasks t JOIN employees e ON e.id = t.employee_id ORDER BY t.created_at DESC NULLS LAST, t.id DESC;`
    );
    return rows ?? null;
  } catch (err) {
    console.error('Direct onboarding fetch error:', err);
    return null;
  }
}

export async function fetchExitCasesDirect() {
  try {
    const rows = await sqlExec(
      `SELECT x.id, x.employee_id AS "employeeId", x.employee_id, x.exit_type AS "exitType", x.exit_type, x.reason, x.notice_date AS "noticeDate", x.notice_date, x.last_working_date AS "lastWorkingDate", x.last_working_date, x.settlement_notes AS "settlementNotes", x.settlement_notes, x.status, x.created_at AS "createdAt", x.created_at, e.full_name AS "fullName", e.full_name, e.emp_code AS "empCode", e.emp_code, (SELECT COUNT(*)::int FROM exit_checklist c WHERE c.exit_case_id = x.id) AS checklist_total, (SELECT COUNT(*)::int FROM exit_checklist c WHERE c.exit_case_id = x.id AND c.status = 'done') AS checklist_done FROM exit_cases x JOIN employees e ON e.id = x.employee_id ORDER BY x.id DESC;`
    );
    return rows ?? null;
  } catch (err) {
    console.error('Direct exit cases fetch error:', err);
    return null;
  }
}

export async function fetchSkillsDirect() {
  try {
    const rows = await sqlExec(
      `SELECT id, name, category FROM skills ORDER BY category, name;`
    );
    return rows ?? null;
  } catch (err) {
    console.error('Direct skills fetch error:', err);
    return null;
  }
}

export async function fetchAttendanceDirect(employeeId = null) {
  try {
    const empFilter = employeeId ? `AND a.employee_id = ${parseInt(employeeId, 10)}` : '';
    const rows = await sqlExec(
      `SELECT * FROM (
        SELECT DISTINCT ON (a.employee_id, a.work_date)
          a.id, a.employee_id AS "employeeId", a.employee_id, a.work_date AS "workDate", a.work_date,
          a.check_in AS "checkIn", a.check_in, a.check_out AS "checkOut", a.check_out,
          a.shift_name AS "shiftName", a.shift_name, a.overtime_hours AS "overtimeHours", a.overtime_hours,
          a.late_minutes AS "lateMinutes", a.late_minutes, a.status,
          a.latitude, a.longitude,
          a.check_in_latitude AS "checkInLatitude", a.check_in_latitude,
          a.check_in_longitude AS "checkInLongitude", a.check_in_longitude,
          a.check_out_latitude AS "checkOutLatitude", a.check_out_latitude,
          a.check_out_longitude AS "checkOutLongitude", a.check_out_longitude,
          e.full_name AS "fullName", e.full_name, e.emp_code AS "empCode", e.emp_code,
          e.division_id AS "divisionId", e.division_id
        FROM attendance a
        JOIN employees e ON e.id = a.employee_id
        WHERE 1=1 ${empFilter}
        ORDER BY a.employee_id, a.work_date DESC, (a.check_out IS NOT NULL) DESC, a.id DESC
      ) x
      ORDER BY "workDate" DESC, id DESC
      LIMIT 300;`
    );
    return rows ?? null;
  } catch (err) {
    console.error('Direct attendance fetch error:', err);
    return null;
  }
}

export async function fetchLeavesDirect(employeeId = null) {
  try {
    const whereEmp = employeeId ? `WHERE l.employee_id = ${parseInt(employeeId, 10)}` : '';
    const rows = await sqlExec(
      `SELECT l.id, l.employee_id AS "employeeId", l.employee_id, l.leave_type AS "leaveType", l.leave_type, l.start_date AS "startDate", l.start_date, l.end_date AS "endDate", l.end_date, l.days, l.reason, l.status, l.balance_after AS "balanceAfter", l.balance_after, l.manager_note AS "managerNote", l.manager_note, e.full_name AS "fullName", e.full_name, e.emp_code AS "empCode", e.emp_code, e.division_id AS "divisionId", e.division_id FROM leave_requests l JOIN employees e ON e.id = l.employee_id ${whereEmp} ORDER BY l.id DESC LIMIT 300;`
    );
    return rows ?? null;
  } catch (err) {
    console.error('Direct leaves fetch error:', err);
    return null;
  }
}

export async function fetchLeaveBalancesDirect(employeeId = null) {
  try {
    const whereEmp = employeeId ? `AND e.id = ${parseInt(employeeId, 10)}` : '';
    const rows = await sqlExec(
      `WITH entitlements AS (
        SELECT * FROM (VALUES
          ('Annual', 30::numeric),
          ('Sick', 15::numeric),
          ('Maternity', 45::numeric),
          ('Unpaid', 0::numeric)
        ) AS t(leave_type, entitlement_days)
      )
      SELECT e.id AS "employeeId", e.id AS employee_id, e.full_name AS "fullName", e.full_name, e.emp_code AS "empCode", e.emp_code,
             ent.leave_type AS "leaveType", ent.leave_type, ent.entitlement_days AS "entitlementDays", ent.entitlement_days,
             COALESCE(SUM(l.days) FILTER (WHERE l.status = 'approved'), 0)::numeric AS "usedDays",
             COALESCE(SUM(l.days) FILTER (WHERE l.status = 'approved'), 0)::numeric AS used_days,
             GREATEST(ent.entitlement_days - COALESCE(SUM(l.days) FILTER (WHERE l.status = 'approved'), 0), 0)::numeric AS "remainingDays",
             GREATEST(ent.entitlement_days - COALESCE(SUM(l.days) FILTER (WHERE l.status = 'approved'), 0), 0)::numeric AS remaining_days
      FROM employees e
      CROSS JOIN entitlements ent
      LEFT JOIN leave_requests l
        ON l.employee_id = e.id
       AND lower(l.leave_type) = lower(ent.leave_type)
      WHERE e.in_hr_ops = TRUE AND e.status != 'exited' ${whereEmp}
      GROUP BY e.id, e.full_name, e.emp_code, ent.leave_type, ent.entitlement_days
      ORDER BY e.emp_code, ent.leave_type;`
    );
    return rows ?? null;
  } catch (err) {
    console.error('Direct leave balances fetch error:', err);
    return null;
  }
}

export async function fetchAssetsDirect() {
  try {
    const rows = await sqlExec(
      `SELECT a.id, a.asset_tag AS "assetTag", a.asset_tag, a.name, a.category, a.serial_no AS "serialNo", a.serial_no, a.status, aa.id AS "assignmentId", aa.id AS assignment_id, aa.employee_id AS "employeeId", aa.employee_id AS "assignedEmployeeId", aa.employee_id AS assigned_employee_id, e.full_name AS "employeeName", e.full_name AS "assignedTo", e.full_name AS assigned_to, e.emp_code AS "empCode", e.emp_code AS "assignedEmpCode", e.emp_code AS assigned_emp_code, e.division_id AS "divisionId", e.division_id FROM assets a LEFT JOIN asset_assignments aa ON aa.asset_id = a.id AND aa.returned_at IS NULL LEFT JOIN employees e ON e.id = aa.employee_id ORDER BY a.id DESC LIMIT 300;`
    );
    return rows ?? null;
  } catch (err) {
    console.error('Direct assets fetch error:', err);
    return null;
  }
}

export async function fetchAssetAssignmentsDirect() {
  try {
    const rows = await sqlExec(
      `SELECT aa.id, aa.asset_id AS "assetId", aa.asset_id, aa.employee_id AS "employeeId", aa.employee_id, aa.assigned_at AS "assignedAt", aa.assigned_at, aa.returned_at AS "returnedAt", aa.returned_at, aa.notes, a.asset_tag AS "assetTag", a.asset_tag, a.name AS "assetName", a.name AS asset_name, a.category, e.full_name AS "fullName", e.full_name, e.emp_code AS "empCode", e.emp_code FROM asset_assignments aa JOIN assets a ON a.id = aa.asset_id JOIN employees e ON e.id = aa.employee_id ORDER BY aa.id DESC LIMIT 300;`
    );
    return rows ?? null;
  } catch (err) {
    console.error('Direct asset assignments fetch error:', err);
    return null;
  }
}

export async function fetchDocumentsDirect() {
  try {
    const rows = await sqlExec(
      `SELECT d.id, d.employee_id AS "employeeId", d.employee_id, d.doc_type AS "docType", d.doc_type, d.title, d.file_ref AS "fileRef", d.file_ref, d.issue_date AS "issueDate", d.issue_date, d.expiry_date AS "expiryDate", d.expiry_date, d.status, e.full_name AS "fullName", e.full_name, e.emp_code AS "empCode", e.emp_code, e.division_id AS "divisionId", e.division_id FROM documents d JOIN employees e ON e.id = d.employee_id ORDER BY d.id DESC LIMIT 300;`
    );
    return rows ?? null;
  } catch (err) {
    console.error('Direct documents fetch error:', err);
    return null;
  }
}

export async function fetchComplianceDirect() {
  try {
    const rows = await sqlExec(
      `SELECT c.id, c.employee_id AS "employeeId", c.employee_id, c.title, c.category, c.due_date AS "dueDate", c.due_date, c.status, c.notes, e.full_name AS "fullName", e.full_name, e.emp_code AS "empCode", e.emp_code, e.division_id AS "divisionId", e.division_id FROM compliance_items c JOIN employees e ON e.id = c.employee_id ORDER BY c.due_date ASC, c.id DESC LIMIT 300;`
    );
    return rows ?? null;
  } catch (err) {
    console.error('Direct compliance fetch error:', err);
    return null;
  }
}

export async function fetchPerformanceGoalsDirect() {
  try {
    const rows = await sqlExec(
      `SELECT g.id, g.employee_id AS "employeeId", g.employee_id, g.title, g.kpi, g.target_value AS "targetValue", g.target_value, g.progress_pct AS "progressPct", g.progress_pct, g.period_label AS "periodLabel", g.period_label, g.status, e.full_name AS "fullName", e.full_name, e.emp_code AS "empCode", e.emp_code, e.division_id AS "divisionId", e.division_id FROM performance_goals g JOIN employees e ON e.id = g.employee_id ORDER BY g.id DESC LIMIT 300;`
    );
    return rows ?? null;
  } catch (err) {
    console.error('Direct performance goals fetch error:', err);
    return null;
  }
}

export async function fetchPerformanceReviewsDirect() {
  try {
    const rows = await sqlExec(
      `SELECT r.id, r.employee_id AS "employeeId", r.employee_id, r.reviewer_name AS "reviewerName", r.reviewer_name, r.review_type AS "reviewType", r.review_type, r.rating, r.summary, r.review_date AS "reviewDate", r.review_date, e.full_name AS "fullName", e.full_name, e.emp_code AS "empCode", e.emp_code, e.division_id AS "divisionId", e.division_id FROM performance_reviews r JOIN employees e ON e.id = r.employee_id ORDER BY r.id DESC LIMIT 300;`
    );
    return rows ?? null;
  } catch (err) {
    console.error('Direct performance reviews fetch error:', err);
    return null;
  }
}

export async function fetchCoursesDirect() {
  try {
    const rows = await sqlExec(
      `SELECT c.id, c.title, c.category, c.duration_hours AS "durationHours", c.duration_hours, c.description, c.status, c.scheduled_start AS "scheduledStart", c.scheduled_start, c.scheduled_end AS "scheduledEnd", c.scheduled_end, (SELECT COUNT(*)::int FROM course_enrollments e WHERE e.course_id = c.id) AS "enrollmentCount", (SELECT COUNT(*)::int FROM course_enrollments e WHERE e.course_id = c.id) AS enrollment_count FROM courses c ORDER BY c.id DESC LIMIT 300;`
    );
    return rows ?? null;
  } catch (err) {
    console.error('Direct courses fetch error:', err);
    return null;
  }
}

export async function fetchCourseEnrollmentsDirect() {
  try {
    const rows = await sqlExec(
      `SELECT en.id, en.course_id AS "courseId", en.course_id, en.employee_id AS "employeeId", en.employee_id, en.assigned_at AS "assignedAt", en.assigned_at, en.due_date AS "dueDate", en.due_date, en.status, en.completed_at AS "completedAt", en.completed_at, c.title AS "courseTitle", c.title AS course_title, c.category AS "courseCategory", c.category AS course_category, e.full_name AS "fullName", e.full_name, e.emp_code AS "empCode", e.emp_code FROM course_enrollments en JOIN courses c ON c.id = en.course_id JOIN employees e ON e.id = en.employee_id ORDER BY en.id DESC LIMIT 300;`
    );
    return rows ?? null;
  } catch (err) {
    console.error('Direct course enrollments fetch error:', err);
    return null;
  }
}

export async function fetchTravelDirect() {
  try {
    const rows = await sqlExec(
      `SELECT t.id, t.employee_id AS "employeeId", t.employee_id, t.destination, t.purpose, t.start_date AS "startDate", t.start_date, t.end_date AS "endDate", t.end_date, t.estimated_cost AS "estimatedCost", t.estimated_cost, t.currency, t.status, e.full_name AS "fullName", e.full_name, e.emp_code AS "empCode", e.emp_code, e.division_id AS "divisionId", e.division_id FROM travel_requests t JOIN employees e ON e.id = t.employee_id ORDER BY t.id DESC LIMIT 300;`
    );
    return rows ?? null;
  } catch (err) {
    console.error('Direct travel requests fetch error:', err);
    return null;
  }
}

export async function fetchExpensesDirect() {
  try {
    const rows = await sqlExec(
      `SELECT x.id, x.employee_id AS "employeeId", x.employee_id, x.title, x.category, x.amount, x.currency, x.expense_date AS "expenseDate", x.expense_date, x.status, x.notes, e.full_name AS "fullName", e.full_name, e.emp_code AS "empCode", e.emp_code FROM expense_claims x JOIN employees e ON e.id = x.employee_id ORDER BY x.id DESC LIMIT 300;`
    );
    return rows ?? null;
  } catch (err) {
    console.error('Direct expense claims fetch error:', err);
    return null;
  }
}

export async function updateLeaveStatusDirect(leaveId, status, note = '') {
  const safeId = parseInt(leaveId, 10);
  if (!safeId || isNaN(safeId)) return false;
  const safeStatus = String(status || '').toLowerCase().replace(/'/g, "''");
  const safeNote = String(note || '').replace(/'/g, "''");
  try {
    const res = await fetch(QUERY_ENDPOINT, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        query: `
          UPDATE leave_requests 
          SET status = '${safeStatus}', 
              manager_note = CASE WHEN '${safeNote}' <> '' THEN '${safeNote}' ELSE manager_note END
          WHERE id = ${safeId};

          UPDATE approvals 
          SET status = '${safeStatus}',
              decision_note = CASE WHEN '${safeNote}' <> '' THEN '${safeNote}' ELSE decision_note END
          WHERE request_type = 'leave' AND reference_id = ${safeId};
        `,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error('Direct update leave error:', err);
    return false;
  }
}
