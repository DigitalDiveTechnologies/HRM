# CHAT 4: Employee Community, Social Feed & Wellbeing Surveys (eNPS)

**Target Workspace:** `c:\Users\itsei\Documents\Projects\HRM`  
**Assigned Development Chat:** Chat Session #4  
**Scope:** Interactive Community Feed, Employee Pulse Polls, Company Social Events, and eNPS Wellbeing Sentiment Surveys.  
**Strict Policy:** **ZERO REGRESSION**. Do not alter existing working APIs, tables, or client states.

---

## 1. Non-Negotiable Guardrails for Chat 4

1. **Additive Migrations Only:** Only create new tables or add nullable columns (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`). Never drop or rename columns.
2. **Backwards Compatibility:** Do not modify the existing `company_announcements` or `company_links` tables created in Chat 1.
3. **Decoupled Architecture:** Chat 4 works exclusively on **Community, Social & Engagement Surveys**. Do NOT modify goals, appraisal rubrics, or 360 reviews (assigned to Chat 3).

---

## 2. Feature Roadmap & Technical Specifications

```
                     CHAT 4 EXECUTION SEQUENCE
                     
   [Task 4.1: Social Community Feed & Interaction Wall (Posts, Likes, Comments)]
           │
           ▼
   [Task 4.2: Interactive Employee Pulse Polls & Real-Time Voting]
           │
           ▼
   [Task 4.3: Corporate Social Events & RSVP Management]
           │
           ▼
   [Task 4.4: Employee Wellbeing & eNPS Pulse Survey Engine]
           │
           ▼
   [Task 4.5: Departmental Engagement & Sentiment Analytics Dashboard]
```

---

### Task 4.1: Social Community Feed & Interaction Wall
* **Objective:** Enable company-wide and departmental social engagement where staff can share wins, kudos, and announcements with like & comment support.
* **Database Migration (`backend/db/schema-community-feed.sql`):**
  ```sql
  CREATE TABLE IF NOT EXISTS community_posts (
      id SERIAL PRIMARY KEY,
      author_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      post_type VARCHAR(30) NOT NULL DEFAULT 'general', -- 'general', 'kudos', 'celebration'
      content TEXT NOT NULL,
      image_url VARCHAR(500),
      likes_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS community_post_likes (
      post_id INT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
      employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (post_id, employee_id)
  );

  CREATE TABLE IF NOT EXISTS community_post_comments (
      id SERIAL PRIMARY KEY,
      post_id INT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
      employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      comment_text TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  ```
* **Backend:** `CommunityController.cs` with routes `GET /api/community/feed`, `POST /api/community/posts`, `POST /api/community/posts/{id}/like`, and comment posting.
* **Frontend:** Create an interactive Community Wall in `frontend/app/community/page.js` and in `employee-portal/app/page.js`.

---

### Task 4.2: Interactive Employee Pulse Polls & Real-Time Voting
* **Objective:** Allow HR to publish single-choice or multi-choice pulse polls (e.g. team lunches, holiday preferences) with live visual results.
* **Database Migration (`backend/db/schema-employee-polls.sql`):**
  ```sql
  CREATE TABLE IF NOT EXISTS employee_polls (
      id SERIAL PRIMARY KEY,
      question VARCHAR(300) NOT NULL,
      options_json JSONB NOT NULL, -- [{"id": 1, "text": "Option A"}, ...]
      expires_at TIMESTAMPTZ,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_by INT REFERENCES employees(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS employee_poll_votes (
      poll_id INT NOT NULL REFERENCES employee_polls(id) ON DELETE CASCADE,
      employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      selected_option_id INT NOT NULL,
      voted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (poll_id, employee_id)
  );
  ```
* **Backend:** Endpoints `GET /api/community/polls`, `POST /api/community/polls`, `POST /api/community/polls/{id}/vote`.

---

### Task 4.3: Corporate Social Events & RSVP Management
* **Objective:** Publish corporate gatherings, town halls, sports days, and celebrations with employee RSVP status (`attending`, `declined`, `maybe`).
* **Database Migration (`backend/db/schema-company-events.sql`):**
  ```sql
  CREATE TABLE IF NOT EXISTS company_events (
      id SERIAL PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      description TEXT,
      event_date TIMESTAMPTZ NOT NULL,
      location VARCHAR(200) NOT NULL,
      max_attendees INT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS company_event_rsvps (
      event_id INT NOT NULL REFERENCES company_events(id) ON DELETE CASCADE,
      employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL DEFAULT 'attending', -- 'attending', 'declined', 'maybe'
      responded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (event_id, employee_id)
  );
  ```

---

### Task 4.4: Employee Wellbeing & eNPS Pulse Survey Engine
* **Objective:** Gather anonymous employee satisfaction and eNPS ("How likely are you to recommend working here? 0-10") with category sentiment tags.
* **Database Migration (`backend/db/schema-wellbeing-surveys.sql`):**
  ```sql
  CREATE TABLE IF NOT EXISTS wellbeing_surveys (
      id SERIAL PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      description TEXT,
      is_anonymous BOOLEAN NOT NULL DEFAULT TRUE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      questions_json JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS wellbeing_survey_responses (
      id SERIAL PRIMARY KEY,
      survey_id INT NOT NULL REFERENCES wellbeing_surveys(id) ON DELETE CASCADE,
      department_id INT REFERENCES departments(id) ON DELETE SET NULL,
      nps_score INT CHECK (nps_score >= 0 AND nps_score <= 10),
      answers_json JSONB NOT NULL,
      feedback_text TEXT,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  ```
* **Backend:** `SurveysController.cs` providing survey responses and calculation of corporate eNPS: `% Promoters (9-10) - % Detractors (0-6)`.

---

### Task 4.5: Departmental Engagement & Sentiment Analytics Dashboard
* **Objective:** Give HR leaders a high-level analytics dashboard visualizing eNPS scores, poll turnout, and participation rates by department.
* **Frontend:** Interactive dashboard in `frontend/app/surveys/page.js` with eNPS gauge and breakdown charts.

---

## 3. Strict Verification & Acceptance Checklist

- [ ] `dotnet build backend` runs with 0 compilation errors.
- [ ] No regression or table conflicts with existing `company_announcements` or `company_links`.
- [ ] Safe anonymous voting & surveys ensuring individual employee privacy where flagged.
