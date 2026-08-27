export function v(row, ...keys) {
  for (const k of keys) {
    if (row && row[k] != null && row[k] !== '') return row[k];
  }
  return null;
}

export function formatDate(value) {
  if (!value) return '-';
  return String(value).slice(0, 10);
}

export function money(n) {
  const num = Number(n || 0);
  return `AED ${num.toLocaleString('en-AE', { maximumFractionDigits: 2 })}`;
}

export function formatLate(minutes) {
  const m = Math.max(0, Number(minutes) || 0);
  if (m <= 0) return '0m';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

export function badgeClass(status) {
  const s = String(status || '').toLowerCase();
  if (['approved', 'done', 'present', 'valid', 'active', 'ok', 'true'].includes(s)) return 'ok';
  if (['pending', 'onboarding', 'late', 'false'].includes(s)) return 'pending';
  if (['expiring', 'warn'].includes(s)) return 'warn';
  if (['rejected', 'danger', 'leave', 'exited'].includes(s)) return 'danger';
  return '';
}

export function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function downloadDocumentFile(doc) {
  const lines = [
    'Digital Dive Technologies — HR Document',
    '=====================================',
    `Title: ${v(doc, 'title') || '-'}`,
    `Type: ${v(doc, 'docType', 'doc_type') || '-'}`,
    `Employee: ${v(doc, 'fullName', 'full_name') || '-'}`,
    `Employee code: ${v(doc, 'empCode', 'emp_code') || '-'}`,
    `Issue date: ${formatDate(v(doc, 'issueDate', 'issue_date'))}`,
    `Expiry date: ${formatDate(v(doc, 'expiryDate', 'expiry_date'))}`,
    `Status: ${v(doc, 'status') || '-'}`,
    `File ref: ${v(doc, 'fileRef', 'file_ref') || '-'}`,
    '',
    'Generated from Digital Dive HR Portal.',
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = String(v(doc, 'fileRef', 'file_ref') || 'document').replace(/[^\w.\-]+/g, '_') + '.txt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
