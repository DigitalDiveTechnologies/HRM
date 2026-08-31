# Phase 1 — GOCs setup & deploy

Demo data and logins unchanged (`admin@digitaldive.demo` / `demo123`, etc.).

## What Phase 1 includes

- GOCs placeholder branding (portal + app)
- Backend CORS for Vercel + current FTP portal origin
- Vercel-ready Next.js config
- Backend stays on FTP: `https://digitaldivetech-001-site4.gtempurl.com/HRMDevelopment`

## Portal on Vercel

1. Push repo to GitHub (or import folder).
2. [vercel.com](https://vercel.com) → New Project → import `frontend` folder (root directory = `frontend`).
3. Environment variable:
   - `NEXT_PUBLIC_API_URL` = `https://digitaldivetech-001-site4.gtempurl.com/HRMDevelopment`
4. Deploy. Note the URL (e.g. `https://gocs-hr.vercel.app`).
5. After deploy, add that exact origin to backend `Cors:AllowedOrigins` in `appsettings.Production.json` and redeploy API if needed.

## Backend (FTP)

```powershell
cd backend
dotnet publish -c Release -o publish
cd ..\tools
powershell -ExecutionPolicy Bypass -File .\ftp-upload-api.ps1
```

If DLL upload fails (550), at minimum upload `appsettings.Production.json`.

## Phase 1B (later — client assets)

Replace in `frontend/lib/brand.js` and `mobile/lib/brand.dart`:

- `logoSrc` / app `assets/logo.webp`
- Brand colors in `globals.css` / `app_theme.dart`
- Login background image
