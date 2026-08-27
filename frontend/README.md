# Digital Dive HR — Portal (Next.js)

HR web portal for Digital Dive. Talks to the .NET API at `http://localhost:5088` by default.

## Run

```bat
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

Seed accounts: see root [`Seed-Logins.txt`](../Seed-Logins.txt).

Role-based navigation lives in `lib/nav.js` (employee ESS vs HR admin/manager modules).
