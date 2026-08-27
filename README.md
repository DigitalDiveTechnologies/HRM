# Digital Dive HR

HR platform for Digital Dive — **API**, **HR portal**, and **employee mobile app**, sharing one Neon PostgreSQL database and JWT auth.

**Repository:** https://github.com/DigitalDiveTechnologies/HRM

## Stack

| Layer | Tech |
|-------|------|
| API | .NET 10, JWT, Swagger, Neon PostgreSQL |
| Portal | Next.js (App Router) |
| App | Flutter (Windows / Chrome / Android) |

## Modules

**Core:** Dashboard, Employees, Attendance, Leave, Payroll, Approvals, Documents, Notifications, Reports, Settings  

**Extended:** Recruitment, Exit & Offboarding, Compliance, Performance, Training, Manager Self-Service (MSS), Assets, Travel & Expense  

**Documents:** multipart upload to API (`wwwroot/uploads/documents`), authenticated download.

## Roles & navigation

Menus are role-based (portal + app):

| Role | Access |
|------|--------|
| **Employee** | ESS only (dashboard, attendance, leave, payslips, documents, notifications, directory) |
| **Manager** | Team MSS + approvals + own ESS |
| **HR Admin / Boss Admin** | Full HR modules |

Team scope for MSS uses `employees.manager_id`.

## Seed accounts

Password for all: `demo123`  
See [`Seed-Logins.txt`](Seed-Logins.txt).

| Email | Role |
|-------|------|
| `admin@digitaldive.demo` | HR Admin |
| `boss@digitaldive.demo` | Boss Admin |
| `omar@digitaldive.demo` | Manager |
| `fatima@digitaldive.demo` | Employee |

## Run locally

Keep API, portal, and app in **Cursor terminals** (or your IDE). Default API: `http://localhost:5088`.

### 1) Database (first time / schema updates)

```bat
cd tools\db-apply
dotnet run
```

Applies `backend/db/schema.sql`, `schema-extensions.sql`, and seed scripts when present. Requires `ConnectionStrings:Neon` in `backend/appsettings.json` (or User Secrets).

Optional password upgrade (plaintext → BCrypt):

```bat
cd backend
hash-passwords.cmd
```

### 2) API

```bat
cd backend
run.cmd
```

- Swagger: http://localhost:5088/swagger  
- Health: http://localhost:5088/api/health  

### 3) Portal

```bat
cd frontend
npm install
npm run dev
```

http://localhost:3000

### 4) Employee app

```bat
cd mobile
flutter pub get
flutter run -d chrome
```

Windows: `flutter run -d windows`  
Android emulator: `flutter run -d emulator-5554 --dart-define=API_BASE=http://10.0.2.2:5088`

## Project layout

```
backend/     .NET API + SQL scripts
frontend/    Next.js HR portal
mobile/      Flutter employee app
tools/       db-apply and helpers
```

## Notes

- Currency formatting prefers **timezone** (e.g. `Asia/Karachi` → PKR) over browser language.
- Approvals cover leave, exit, travel, and expenses.
- Leave balances: `GET /api/leave/balances`.
- Exit create appends a simple EOSB estimate into settlement notes.
