export function sortCompaniesLatest(list) {
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => {
    const rawA = a?.created_at || a?.createdAt;
    const rawB = b?.created_at || b?.createdAt;
    const timeA = rawA ? new Date(rawA).getTime() : 0;
    const timeB = rawB ? new Date(rawB).getTime() : 0;
    if (timeB !== timeA) return timeB - timeA;
    return (Number(b?.id || 0) || 0) - (Number(a?.id || 0) || 0);
  });
}

/** Keep company list caches in sync after create/update (dashboard + divisions pages). */
export function writeCompaniesCache(companies) {
  const list = sortCompaniesLatest(Array.isArray(companies) ? companies : []);
  try {
    localStorage.setItem('gocs_cached_divisions', JSON.stringify(list));
  } catch {}
  try {
    const cached = localStorage.getItem('gocs_cached_dashboard');
    if (cached) {
      const parsed = JSON.parse(cached);
      parsed.companies = list;
      localStorage.setItem('gocs_cached_dashboard', JSON.stringify(parsed));
    }
  } catch {}
  try {
    window.dispatchEvent(new Event('gocs_company_changed'));
  } catch {}
}

export function upsertCompanyInCache(company, previous = null) {
  const id = String(company?.id ?? company?.Id ?? '');
  const base = Array.isArray(previous) ? previous : [];
  let next;
  if (!id) {
    next = sortCompaniesLatest([company, ...base]);
  } else {
    const without = base.filter((c) => String(c?.id ?? c?.Id) !== id);
    next = sortCompaniesLatest([company, ...without]);
  }
  writeCompaniesCache(next);
  return next;
}
