# Phase 5 — Ops, Analytics & Resilience Runbook

**Product:** GOCs HR / Digital Dive HR  
**Blueprint:** Scale — Operational resilience  
**Status:** Engineering complete (portal + API)

---

## 1. Health & readiness

| Probe | URL | Auth |
|-------|-----|------|
| Liveness | `GET /api/health` | Anonymous |
| Readiness | `GET /api/health/ready` or `GET /api/ops/ready` | Anonymous |

Ready checks: database connectivity + presence of `notifications`, `audit_logs`, `system_config`.

---

## 2. Disaster recovery (Neon)

1. Neon console → project → **Branches / Backends** → confirm PITR window.
2. For restore drill: create a **time-travel branch** (or restore to new branch), update a staging `DATABASE_URL`, run `tools/db-apply` against staging only.
3. **Never** point production FTP app at a restore branch without a planned cutover.
4. After schema changes: always apply via `dotnet run --project tools/db-apply -- schema-….sql` (versioned list in `Program.cs`).

---

## 3. Deploy map

| Layer | Action |
|-------|--------|
| Frontend | GitHub `main` → `npx vercel --prod` (gocs-hr-portal) |
| Backend | `dotnet publish` → `tools/ftp-upload-api.ps1` → `/HRMDevelopment` |
| DB | `db-apply` with user-secrets / `DATABASE_URL` |

---

## 4. Support tooling (portal)

- **Ops & Scale** (`/ops`): readiness, system config, job runs, CSV exports, WPS gaps, Emiratisation preview.
- **Reports** (`/reports`): workforce analytics + export buttons.
- **Notifications**: admin “generate” writes a `job_runs` row (`notifications.generate`).

---

## 5. Config keys (`system_config`)

| Key | Purpose |
|-----|---------|
| `org.display_name` | Display name |
| `ops.alert_window_days` | Expiry alert window |
| `ops.notifications_auto` | `manual` / `scheduled` (scheduled = external cron calling generate) |
| `analytics.currency` | Analytics label |
| `support.contact_email` | Support contact |

---

## 6. Production service objectives (demo checklist)

- [ ] `/api/health` returns `ok: true`
- [ ] `/api/health/ready` returns `ready: true`
- [ ] CSV export `headcount` downloads
- [ ] Alert generator inserts or no-ops without error; job appears in `/ops`
- [ ] Employee can open Performance / Training self views

---

## 7. Still preview / policy-gated

- Emiratisation % and GPSSA rates remain **preview** until business sign-off.
- Exit EOSB settlements remain **preview** until golden scenarios signed (Phase 0/2).
