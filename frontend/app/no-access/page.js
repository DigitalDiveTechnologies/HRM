'use client';

import AppShell from '../../components/AppShell';

/** Shown when a role has zero Permissions ticks — no Dashboard or other pages. */
export default function NoAccessPage() {
  return (
    <AppShell title="No access" subtitle="This role has no portal pages yet.">
      <div className="card" style={{ padding: '28px 24px', maxWidth: 560 }}>
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          No portal pages are assigned to your role. Ask Super Admin to open{' '}
          <strong>Settings → Permissions</strong>, tick the pages this role should see, Save, then sign in again.
        </p>
      </div>
    </AppShell>
  );
}
