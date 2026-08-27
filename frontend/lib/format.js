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

/** Map IANA timezone → country (where the user actually is). */
function countryFromTimezone(tz) {
  const t = String(tz || '');
  const map = {
    'Asia/Karachi': 'PK',
    'Asia/Dubai': 'AE',
    'Asia/Muscat': 'OM',
    'Asia/Qatar': 'QA',
    'Asia/Bahrain': 'BH',
    'Asia/Kuwait': 'KW',
    'Asia/Riyadh': 'SA',
    'Asia/Kolkata': 'IN',
    'Asia/Calcutta': 'IN',
    'America/New_York': 'US',
    'America/Chicago': 'US',
    'America/Los_Angeles': 'US',
    'Europe/London': 'GB',
  };
  if (map[t]) return map[t];
  if (t.startsWith('America/')) return 'US';
  if (t.startsWith('Europe/London')) return 'GB';
  return '';
}

function countryFromLocale() {
  try {
    if (typeof navigator !== 'undefined' && navigator.language) {
      const parts = navigator.language.split(/[-_]/);
      if (parts.length > 1) return parts[parts.length - 1].toUpperCase();
    }
  } catch {
    /* ignore */
  }
  return '';
}

function codeForCountry(country) {
  switch (String(country || '').toUpperCase()) {
    case 'PK':
      return 'PKR';
    case 'AE':
      return 'AED';
    case 'SA':
      return 'SAR';
    case 'QA':
      return 'QAR';
    case 'KW':
      return 'KWD';
    case 'BH':
      return 'BHD';
    case 'OM':
      return 'OMR';
    case 'IN':
      return 'INR';
    case 'US':
      return 'USD';
    case 'GB':
      return 'GBP';
    default:
      return '';
  }
}

/**
 * Region currency: where you are (timezone) first, then locale country.
 * Pakistan → PKR, Dubai → AED. Override: NEXT_PUBLIC_CURRENCY=AED
 * Note: Windows often uses en-US language even in PK — timezone fixes that.
 */
export function currencyCode() {
  const forced = (process.env.NEXT_PUBLIC_CURRENCY || '').trim();
  if (forced) return forced.toUpperCase();

  let tz = '';
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    tz = '';
  }

  const fromTz = codeForCountry(countryFromTimezone(tz));
  if (fromTz) return fromTz;

  const fromLocale = codeForCountry(countryFromLocale());
  // Ignore bare en-US when timezone didn't resolve — default PKR for this product
  if (fromLocale && !(fromLocale === 'USD' && !tz.startsWith('America/'))) {
    return fromLocale;
  }

  return 'PKR';
}

export function money(n) {
  const num = Number(n || 0);
  const code = currencyCode();
  const formatted = Number.isFinite(num)
    ? num.toLocaleString('en-PK', { maximumFractionDigits: 2, minimumFractionDigits: num % 1 === 0 ? 0 : 2 })
    : '0';
  return `${code} ${formatted}`;
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
