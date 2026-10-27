# GOCs HRM Mobile App — 3 Dedicated Development Chats Roadmap

**Target Directory:** `c:\Users\itsei\Documents\Projects\HRM\mobile`  
**Purpose:** Incremental rollout plan for all Portal features into the Flutter Mobile App across 3 isolated, zero-regression chat sessions.  
**Strict Directive:** **MOBILE ONLY**. Do not touch `.cs` (backend), `.sql` (database), or `frontend/` / `employee-portal/` (web).

---

## Chat Overview & Sequencing

```
  ┌────────────────────────────────────────────────────────────────────────┐
  │ MOBILE CHAT 1: Daily ESS Core & Compensation                          │
  │ • Total Rewards & Gratuity Statement (`rewards_screen.dart`)           │
  │ • Digital Medical Insurance Card (Daman/AXA policy info)               │
  │ • Company Announcements with Compliance Read Receipts (`Acknowledge`)   │
  │ • Corporate Quick Links Hub (MOHRE, UAE PASS, Webmail tiles)           │
  └────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │ MOBILE CHAT 2: Employee Engagement, Culture & Wellbeing               │
  │ • Wellbeing & eNPS Pulse Surveys (0-10 rating, questions, comments)    │
  │ • Corporate Social Wall & Kudos Feed (posts, likes, comments)          │
  │ • Interactive Pulse Polls (real-time voting & percentage bars)         │
  │ • Corporate Social Events & RSVP Tracker (Going/Maybe/Declined)        │
  └────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │ MOBILE CHAT 3: Workflows, Expenses & Team Hub                          │
  │ • Expense Claims & Reimbursements (`expenses_screen.dart`)             │
  │ • Interactive Team Absence Calendar & Overlap Warnings                 │
  │ • 360-Degree Peer Feedback Nomination & Evaluation Workflow            │
  │ • Hierarchical Goal OKRs & Nested Sub-Goals with Progress Rollups      │
  └────────────────────────────────────────────────────────────────────────┘
```

---

## 📱 Mobile Chat 1: Daily ESS Core & Compensation
* **Focus Files:** `mobile/lib/screens/rewards_screen.dart`, `mobile/lib/screens/ess_screen.dart`, `mobile/lib/widgets/quick_links_sheet.dart`.
* **APIs Used:** `GET /api/ess/total-rewards`, `GET /api/ess/my-benefits`, `GET /api/announcements`, `POST /api/announcements/{id}/acknowledge`, `GET /api/company-links`.
* **Prompt to Start Chat 1:**
```text
I am starting Mobile Chat 1 for the GOCs HRM mobile app.
Target strictly mobile/:
1. Create `mobile/lib/screens/rewards_screen.dart` displaying Total Annual Rewards (Base + Allowances + Insurance + EOSB Gratuity) from `GET /api/ess/total-rewards` and digital medical insurance card from `GET /api/ess/my-benefits`.
2. On `EssScreen`, add a Company Announcements banner for unacknowledged announcements from `GET /api/announcements` with an "Acknowledge" button calling `POST /api/announcements/{id}/acknowledge`.
3. Add a "Corporate Quick Links" button/sheet loading bookmarks from `GET /api/company-links`.
4. Wire navigation in `app_nav.dart` and `app_shell.dart`.
Zero regression: do not touch backend or web portals.
```

---

## 📱 Mobile Chat 2: Employee Engagement, Culture & Wellbeing
* **Focus Files:** `mobile/lib/screens/community_screen.dart`, `mobile/lib/screens/surveys_screen.dart`, `mobile/lib/widgets/pulse_poll_card.dart`.
* **APIs Used:** `GET /api/surveys`, `POST /api/surveys/{id}/respond`, `GET /api/community/feed`, `POST /api/community/posts`, `POST /api/community/posts/{id}/like`, `GET /api/community/polls`, `POST /api/community/polls/{id}/vote`, `GET /api/community/events`, `POST /api/community/events/{id}/rsvp`.
* **Prompt to Start Chat 2:**
```text
I am starting Mobile Chat 2 for the GOCs HRM mobile app.
Target strictly mobile/:
1. Create `mobile/lib/screens/surveys_screen.dart` allowing employees to complete active pulse surveys: 0-10 eNPS score selector, 1-5 scale rating chips, feedback textarea, and submit to `POST /api/surveys/{id}/respond`.
2. Create `mobile/lib/screens/community_screen.dart` with 3 segmented tabs:
   - Tab 1: Social Wall (view posts, Kudos/Celebration chips, likes counter, comment dialog).
   - Tab 2: Pulse Polls (active polls, option voting, live percentage bars).
   - Tab 3: Corporate Events (event card, date badge, location, attendee count, Going/Maybe/Declined RSVP).
3. Connect `Surveys` and `Community` in `app_nav.dart` and `app_shell.dart`.
Zero regression: do not touch backend or web portals.
```

---

## 📱 Mobile Chat 3: Workflows, Expenses & Team Hub
* **Reference Document:** `MOBILE-APP-CHAT-3.md`
* **Focus Files:** `mobile/lib/screens/expenses_screen.dart`, `mobile/lib/screens/leave_screen.dart`, `mobile/lib/screens/performance_screen.dart`.
* **APIs Used:** `GET/POST /api/expenses`, `GET /api/leave/calendar`, `GET/POST /api/performance/reviews/360-pending`.
* **Prompt to Start Chat 3:**
```text
I am starting Mobile Chat 3 for the GOCs HRM mobile app.
Please read MOBILE-APP-CHAT-3.md in the project root.
Follow the Non-Negotiable Guardrails (Strict Zero Regression: only modify files in mobile/, do not touch backend or web portals).
Execute Task 3.1 (Expenses & Claims screen with receipt upload), Task 3.2 (Team Absence Calendar & Overlap Warnings in leave_screen.dart), Task 3.3 (360 Peer Reviews & Sub-goals in performance_screen.dart), and Task 3.4 (Navigation & ESS Quick Tile).
Run `flutter analyze` or verify Flutter syntax when done.
```
