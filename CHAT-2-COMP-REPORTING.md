# CHAT 2: Time, Total Compensation, Custom Fields & Reporting Intelligence

**Target Workspace:** `c:\Users\itsei\Documents\Projects\HRM`  
**Assigned Development Chat:** Chat Session #2  
**Scope:** Leave Calendar, Benefits Management, Total Rewards, Custom Metadata, and Ad-Hoc Report Builder.  
**Strict Policy:** **ZERO REGRESSION**. Do not alter existing working APIs, tables, or client states.

---

## 1. Non-Negotiable Guardrails for Chat 2

1. **Additive Migrations Only:** Only create new tables or add nullable columns (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`). Never drop or rename columns.
2. **Backwards Compatibility:** Do not modify existing leave accrual formulas, payroll calculation logic, or the standard CSV export routes in `/api/reports/export/{reportKey}`.
3. **Decoupled Development:** This chat handles **Time, Compensation & Reporting**. Do NOT touch Announcements, Welcome Emails, or Onboarding tasks (assigned to Chat 1).

---

## 2. Feature Roadmap & Technical Specifications

```
                     CHAT 2 EXECUTION SEQUENCE
                     
  [Task 2.1: Interactive Team Time-Off Calendar]
          │
          ▼
  [Task 2.2: Benefits & Medical Insurance Tracking]
          │
          ▼
  [Task 2.3: Unified Total Rewards Statement (Base + Benefits + EOSB)]
          │
          ▼
  [Task 2.4: Dynamic Custom Fields & Attributes (JSONB Engine)]
          │
          ▼
  [Task 2.5: Self-Service Dynamic CSV/Excel Report Builder]
```

---

### Task 2.1: Interactive Team Time-Off Calendar & Conflict Warnings
* **Objective:** Enable HR and department leads to visually review overlapping leaves across teams before approving requests.
* **Backend Endpoint (`LeaveController.cs` & `HrQueryService.cs`):**
  * `GET /api/leave/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD&departmentId=&divisionId=`
  * Query approved records from `leave_requests` joined with `employees` and `departments`.
* **Frontend Implementation (`frontend/app/leave/page.js`):**
  * Replace the static holiday table with a responsive interactive month/week calendar grid.
  * Render approved leaves as colored event pills tagged with employee name, department, and leave type.
  * **Absence Overlap Alert:** Highlight in amber/red if two or more staff members in the same department are on leave on the same date.

---

### Task 2.2: Benefits & Medical Insurance Tracking
* **Objective:** Manage corporate health insurance tiers, policy numbers, dependent coverage, and premium contributions.
* **Database Migration (`backend/db/schema-benefits.sql`):**
  ```sql
  CREATE TABLE IF NOT EXISTS benefit_plans (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL, -- e.g. "Daman Enhanced Gold", "AXA Silver"
      benefit_type VARCHAR(50) NOT NULL DEFAULT 'medical_insurance',
      provider_name VARCHAR(100) NOT NULL,
      policy_number VARCHAR(100) NOT NULL,
      coverage_summary TEXT,
      annual_premium_employer NUMERIC(12,2) NOT NULL DEFAULT 0.00,
      annual_premium_employee NUMERIC(12,2) NOT NULL DEFAULT 0.00,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS employee_benefits (
      id SERIAL PRIMARY KEY,
      employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      benefit_plan_id INT NOT NULL REFERENCES benefit_plans(id) ON DELETE RESTRICT,
      member_id VARCHAR(100),
      coverage_tier VARCHAR(50) NOT NULL DEFAULT 'employee_only', -- 'employee_only', 'family'
      dependents_count INT NOT NULL DEFAULT 0,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_emp_benefits ON employee_benefits(employee_id, status);
  ```
* **API Controller (`backend/Controllers/BenefitsController.cs`):**
  * `GET /api/benefits/plans`: Returns corporate benefit schemes.
  * `POST /api/benefits/plans`: Admin creates a new plan.
  * `POST /api/benefits/assign`: Assigns insurance plan to an employee.
  * `GET /api/ess/my-benefits`: Returns digital insurance card details for the signed-in employee.

---

### Task 2.3: Unified Total Rewards Statement
* **Objective:** Aggregate all cash and non-cash elements into a single executive dashboard and printable statement.
* **Calculation Engine:**
  $$\text{Total Annual Value} = (12 \times \text{Gross Monthly Salary}) + \text{Annual Employer Benefits} + \text{Accrued EOSB Gratuity} + \text{Flight Allowance}$$
* **Backend Endpoint (`backend/Controllers/EssController.cs`):**
  * `GET /api/ess/total-rewards`: Combines base salary and allowances from `employees`, employer benefits premium from `employee_benefits`, and live gratuity from `EosbCalculatorService`.
* **UI Implementation:**
  * Add a **"Total Rewards"** tab in `employee-portal/app/page.js` displaying the compensation distribution pie/bar chart and a **"Download Rewards Statement (PDF)"** button.

---

### Task 2.4: Dynamic Custom Fields & Attributes (JSONB Engine)
* **Objective:** Allow HR to define custom attributes (e.g. "Sea Crew ID", "Uniform Size", "Offshore Clearance") without altering core database tables.
* **Database Schema (`backend/db/schema-custom-fields.sql`):**
  ```sql
  CREATE TABLE IF NOT EXISTS custom_field_definitions (
      id SERIAL PRIMARY KEY,
      tab_group VARCHAR(50) NOT NULL DEFAULT 'custom',
      field_key VARCHAR(50) NOT NULL UNIQUE,
      label VARCHAR(100) NOT NULL,
      field_type VARCHAR(20) NOT NULL, -- 'text', 'number', 'date', 'select'
      options_json JSONB,             -- e.g. ["Small", "Medium", "Large"]
      is_required BOOLEAN NOT NULL DEFAULT FALSE,
      sort_order INT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE
  );
  ```
* **Integration:**
  * Store custom values directly inside the existing `employees.master_data` JSONB column.
  * In `frontend/components/EmployeeMasterForm.js`, dynamically query `/api/custom-fields` and render the appropriate input controls.

---

### Task 2.5: Self-Service Dynamic CSV/Excel Report Builder
* **Objective:** Empower HR managers to pick custom combinations of standard and custom fields, apply filters, and stream instant CSV downloads.
* **Backend Endpoint (`ReportsController.cs`):**
  * `POST /api/reports/export-custom`
  * Validates selected columns against an injection-proof whitelist.
  * Dynamically projects SQL query across `employees`, `departments`, `divisions`, and `master_data`.
* **Frontend UI (`frontend/app/reports/builder/page.js`):**
  * Checkbox grid grouped by category: *Identity, Job Details, Compensation, Document Expirations, Custom Attributes*.
  * Filter criteria builder (e.g., `Division = "Marine"` AND `JoinDate < "2025-01-01"`).
  * One-click **"Export Custom CSV"** button.

---

## 3. Initial Prompt to Start Chat 2

Copy and paste this exact prompt into your **Chat 2** window:

```text
I am starting Chat 2: Time, Total Compensation, Custom Fields & Reporting Intelligence.
Please read CHAT-2-COMP-REPORTING.md in the project root.
Follow the Non-Negotiable Guardrails (Zero Regression Policy).
Begin immediately with Task 2.1 (Interactive Team Time-Off Calendar) and Task 2.2 (Benefits & Medical Insurance Tracking).
Ensure all existing endpoints and features remain 100% operational.
```
