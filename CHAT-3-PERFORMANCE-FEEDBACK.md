# CHAT 3: Performance Excellence & 360 Feedback Engine

**Target Workspace:** `c:\Users\itsei\Documents\Projects\HRM`  
**Assigned Development Chat:** Chat Session #3  
**Scope:** Performance Assessment Templates, Hierarchical Goal/Sub-Goal Tracking, Peer Feedback (360 Nomination), Appraisal Deadlines & Automated Email Reminders.  
**Strict Policy:** **ZERO REGRESSION**. Do not alter existing working APIs, tables, or client states.

---

## 1. Non-Negotiable Guardrails for Chat 3

1. **Additive Migrations Only:** Only create new tables or add nullable columns (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`). Never drop or rename columns.
2. **Backwards Compatibility:** The existing `/api/performance/goals` and `/api/performance/reviews` must continue to return their exact JSON schemas.
3. **Decoupled Architecture:** Chat 3 works exclusively in the **Performance & Feedback** domain. Do NOT edit Community wall, Employee Polls, or Surveys (assigned to Chat 4).

---

## 2. Feature Roadmap & Technical Specifications

```
                     CHAT 3 EXECUTION SEQUENCE
                     
   [Task 3.1: Hierarchical Goal & Key Results (Sub-Goals) Engine]
           │
           ▼
   [Task 3.2: Dynamic Assessment Templates & Rubric Builder]
           │
           ▼
   [Task 3.3: 360-Degree Peer Feedback Nomination & Evaluation Workflow]
           │
           ▼
   [Task 3.4: Automated Appraisal Deadline Reminders & Email Notifications]
           │
           ▼
   [Task 3.5: Performance 9-Box Grid & Rating Distribution Analytics]
```

---

### Task 3.1: Hierarchical Goal & Key Results (Sub-Goals) Engine
* **Objective:** Upgrade the flat goals model to support hierarchical OKRs/sub-goals with target metrics, weightages, and progress rollups.
* **Database Migration (`backend/db/schema-performance-goals.sql`):**
  ```sql
  ALTER TABLE performance_goals ADD COLUMN IF NOT EXISTS parent_goal_id INT REFERENCES performance_goals(id) ON DELETE CASCADE;
  ALTER TABLE performance_goals ADD COLUMN IF NOT EXISTS weightage NUMERIC(5,2) DEFAULT 100.00;
  ALTER TABLE performance_goals ADD COLUMN IF NOT EXISTS target_metric VARCHAR(100);
  ALTER TABLE performance_goals ADD COLUMN IF NOT EXISTS current_metric VARCHAR(100);
  ALTER TABLE performance_goals ADD COLUMN IF NOT EXISTS due_date DATE;
  ```
* **Backend:** Update `PerformanceController.cs` to allow creating/listing child sub-goals and computing auto-calculated parent progress.
* **Frontend:** In `frontend/app/performance/page.js`, add an expandable tree view of parent goals and nested key results.

---

### Task 3.2: Dynamic Assessment Templates & Rubric Builder
* **Objective:** Allow HR to configure reusable appraisal templates with custom Likert scales, multi-section rubrics, and weightages.
* **Database Migration (`backend/db/schema-performance-templates.sql`):**
  ```sql
  CREATE TABLE IF NOT EXISTS performance_templates (
      id SERIAL PRIMARY KEY,
      title VARCHAR(150) NOT NULL,
      description TEXT,
      review_type VARCHAR(50) NOT NULL DEFAULT 'annual', -- 'annual', 'probation', 'mid_year', '360'
      sections_json JSONB NOT NULL DEFAULT '[]'::jsonb, -- sections, questions, rating scales
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  ```
* **Backend:** Add `/api/performance/templates` CRUD endpoints in `PerformanceController.cs`.
* **Frontend:** Add template selection when creating review cycles, rendering dynamic questions in the appraisal form.

---

### Task 3.3: 360-Degree Peer Feedback Nomination & Evaluation Workflow
* **Objective:** Enable managers and employees to nominate peer reviewers for 360 reviews, with blind/double-blind feedback submission.
* **Database Migration (`backend/db/schema-360-reviews.sql`):**
  ```sql
  CREATE TABLE IF NOT EXISTS performance_peer_nominations (
      id SERIAL PRIMARY KEY,
      review_id INT NOT NULL REFERENCES performance_reviews(id) ON DELETE CASCADE,
      nominee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      reviewer_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      status VARCHAR(30) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'submitted', 'declined'
      feedback_json JSONB,
      is_anonymous BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      submitted_at TIMESTAMPTZ
  );
  ```
* **Backend:** Endpoints for nominating peers, approving nominations, and submitting peer review forms.
* **Employee Portal & Admin:** Add Peer Reviews tab in `employee-portal/app` and manager view in `frontend/app/performance/page.js`.

---

### Task 3.4: Automated Appraisal Deadline Reminders & Email Notifications
* **Objective:** Dispatch email reminders for pending self-evaluations and manager sign-offs before appraisal deadlines.
* **Backend (`EmailService.cs` & `PerformanceController.cs`):**
  * `SendPerformanceReminderAsync(...)` using the existing Office 365 SMTP pipeline.
  * Add an on-demand "Send Reminders" action for HR administrators.

---

### Task 3.5: Performance 9-Box Grid & Rating Distribution Analytics
* **Objective:** Provide senior leadership with talent mapping (Potential vs. Performance 9-Box Grid).
* **Backend:** `GET /api/performance/analytics/nine-box` aggregating performance ratings vs. potential scores.
* **Frontend:** Interactive 9-Box Matrix UI in `frontend/app/performance/page.js` with drill-down employee lists per box.

---

## 3. Strict Verification & Acceptance Checklist

- [ ] `dotnet build backend` runs with 0 compilation errors.
- [ ] Existing endpoints (`/api/performance/goals`, `/api/performance/reviews`) continue functioning without breaking changes.
- [ ] All database scripts use `IF NOT EXISTS` and `ON DELETE CASCADE / SET NULL` safely.
