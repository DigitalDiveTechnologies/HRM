# GOCs HR — Complete Testing Guide (Portal + App)

**Purpose:** End-to-end UAT so every sidebar item on **Admin Portal** and **Employee App** can be tested.  
**Date:** September 2026  

---

## 1. Access & logins

### URLs

| Item | Link |
|------|------|
| **Admin Portal (primary)** | https://hrdemo.digitaldive-stage.digital |
| Portal backup | https://gocs-hr-portal.vercel.app |
| API (backend) | https://digitaldivetech-001-site4.gtempurl.com/HRMDevelopment |

### Demo accounts (password for all: `demo123`)

| Who | Email | Use where |
|-----|--------|-----------|
| HR Admin (Sara) | `admin@digitaldive.demo` | **Portal only** |
| Team Lead (Ahmed) | `ahmed@digitaldive.demo` | **Mobile app** |
| Employee (Fatima) | `fatima@digitaldive.demo` | **Mobile app** |

### Notes

- Admin = web portal. Employees / team leads = Android app.  
- Portal: after deploy use **Ctrl + Shift + R**.  
- App: install latest **release APK**.  

---

## 2. Critical cross-flows (test first)

### A. Leave (full chain)

| Step | Who | Where | Action | Pass? |
|------|-----|--------|--------|-------|
| 1 | Fatima / Ahmed | App → My Leaves | Apply leave | ☐ |
| 2 | Admin | Portal | Sidebar **Leave** and/or **Approvals** show number + top toast (~5s) | ☐ |
| 3 | Ahmed | App → Team approvals | Approve as team lead | ☐ |
| 4 | Admin | Portal → Approvals / Leave | Final approve | ☐ |
| 5 | Employee | App → Notifications | Sees approval update | ☐ |
| 6 | Admin | Portal → Notifications | Message shows **employee name** (not “Your…”) | ☐ |

### B. Certificate

| Step | Who | Where | Action | Pass? |
|------|-----|--------|--------|-------|
| 1 | Employee | App → Certificates | Request certificate | ☐ |
| 2 | Admin | Portal | **Certificates** badge + toast | ☐ |
| 3 | Admin | Portal → Certificates | Approve / issue | ☐ |
| 4 | Employee | App | Sees issued / downloadable result | ☐ |

### C. Documents & employee master

| Step | Who | Where | Action | Pass? |
|------|-----|--------|--------|-------|
| 1 | Admin | Portal → Documents | Upload passport / Emirates ID / visa | ☐ |
| 2 | Admin | Portal → Employees | Add employee (master form + photo) | ☐ |
| 3 | Admin | Portal → Employees | Edit existing + save master tabs | ☐ |

---

## 3. Portal — full sidebar checklist

Login: `admin@digitaldive.demo` / `demo123`  
URL: https://hrdemo.digitaldive-stage.digital  

### OVERVIEW

| # | Sidebar tab | What to test | Pass? |
|---|-------------|--------------|-------|
| 1 | **Dashboard** | Opens; headcount / pending leave / docs / recent attendance show | ☐ |
| 2 | **Manager Self-Service** | Team roster / leave / attendance / approvals view loads | ☐ |
| 3 | **Reports & Analytics** | Reports / widgets load without error | ☐ |
| 4 | **Notifications** | List loads; employee **name** in message (not “Your”); Mark all read; Run alert generator | ☐ |
| 5 | **Approvals** | Pending leave/other show Approve/Reject; badge number when pending; list refreshes | ☐ |
| 6 | **Help & Manuals** | Manuals / help page opens | ☐ |

### CORE HR

| # | Sidebar tab | What to test | Pass? |
|---|-------------|--------------|-------|
| 7 | **Employees** | List + org chart + bulk upload; **Employee Master Data** add/edit (2 cols); profile **photo** upload; tabs Address/Personal/Finance etc. save | ☐ |
| 8 | **HR Masters** | Designations / employment types add or list | ☐ |
| 9 | **Divisions** | List divisions; add/edit if available | ☐ |
| 10 | **Onboarding** | Checklist / onboarding rows load | ☐ |
| 11 | **Recruitment & ATS** | Jobs / candidates screens load; create if UI allows | ☐ |
| 12 | **Employee Exit** | Exit requests list / create | ☐ |
| 13 | **Compliance** | Compliance items load | ☐ |
| 14 | **Performance** | Reviews / goals load | ☐ |
| 15 | **Training** | Training list / assign | ☐ |
| 16 | **Assets** | Assets list / assign | ☐ |
| 17 | **Travel & Expense** | Travel / expense requests load | ☐ |
| 18 | **Attendance** | List loads; save attendance; **auto-refresh** (~5s) | ☐ |
| 19 | **Leave** | Leave requests list; pending badge when new leave applied | ☐ |
| 20 | **Certificates** | Pending / issued list; badge when new request | ☐ |
| 21 | **Payroll** | Run / view payroll; division-aware export if shown | ☐ |

### SELF SERVICE (admin view)

| # | Sidebar tab | What to test | Pass? |
|---|-------------|--------------|-------|
| 22 | **ESS Portal** | ESS overview loads | ☐ |
| 23 | **Documents** | Upload + table (passport, Emirates ID, visa, contract) | ☐ |

### Portal alerts (overall)

| Check | Pass? |
|-------|-------|
| New leave → badge on **Leave** and/or **Approvals** + toast | ☐ |
| New certificate → badge on **Certificates** + toast | ☐ |
| Unread / generated alerts → **Notifications** badge | ☐ |
| Expiring docs → **Documents** badge (if due soon) | ☐ |
| Toast text names the type (leave / certificate / attendance / approval) | ☐ |
| Badge stays until count is 0 (not cleared only by opening tab) | ☐ |

---

## 4. Mobile app — full sidebar checklist

Install latest APK.  
Logins: `fatima@digitaldive.demo` or `ahmed@digitaldive.demo` / `demo123`

### Login & chrome

| # | Item | What to test | Pass? |
|---|------|--------------|-------|
| 1 | **Login** | Email/password; keyboard does **not** keep flickering open | ☐ |
| 2 | **Theme toggle** | Light/dark works; fields stay usable | ☐ |
| 3 | **Menu badge** | Number of sections with alerts | ☐ |
| 4 | **Top toast** | New leave / certificate / attendance shows popup; tap opens that tab | ☐ |

### SELF SERVICE menu (all roles)

| # | Sidebar tab | What to test | Pass? |
|---|-------------|--------------|-------|
| 5 | **ESS / Home** | Tiles / shortcuts open correct screens | ☐ |
| 6 | **Team approvals** | **Ahmed only** — pending leave for team; approve/reject | ☐ |
| 7 | **My Leaves** | Balance / history; apply leave; status updates | ☐ |
| 8 | **Certificates** | Request certificate; see status | ☐ |
| 9 | **My Attendance** | Own attendance rows load | ☐ |
| 10 | **My Payslips** | Payslips list / open | ☐ |
| 11 | **Notifications** | List; mark read; badges clear for that area when handled | ☐ |
| 12 | **My Documents** | Own docs list | ☐ |
| 13 | **Directory** | Colleague directory (no salary fields) | ☐ |
| 14 | **Profile** | Own profile info | ☐ |

### App ↔ Portal connection

| Check | Pass? |
|-------|-------|
| Leave applied in app appears on portal Approvals/Leave | ☐ |
| Certificate requested in app appears on portal Certificates | ☐ |
| Portal HR approve leave → employee sees update in app | ☐ |
| Portal issue certificate → employee sees in app | ☐ |

---

## 5. Suggested test order (1–2 hours)

1. Portal login (admin) — Dashboard + Help  
2. Portal Employees — open one profile + photo  
3. Portal Documents — one upload  
4. App login (Fatima) — ESS + apply leave  
5. Portal — confirm Approvals/Leave badge + toast  
6. App (Ahmed) — Team approvals  
7. Portal — final leave approve + Notifications name check  
8. App (Fatima) — certificate request  
9. Portal — Certificates approve/issue  
10. Portal — Attendance + Payroll smoke  
11. Portal — remaining Core HR tabs open (no crash)  
12. App — remaining menu tabs open (no crash)  

---

## 6. Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| Tester | | | Pass / Fail / Partial |
| Notes | | | |

---

## 7. Quick reference

| System | Stack |
|--------|--------|
| Portal | Next.js |
| App | Flutter (Android) |
| API | .NET |
| DB | PostgreSQL (Neon) |

**Leave flow:** Employee (app) → Team lead (app) → HR (portal)  

**Support tip:** If portal looks old, hard refresh. If app missing toast/keyboard fix, reinstall latest APK.
