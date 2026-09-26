/** Keep company list caches in sync after create/update (dashboard + divisions pages). */
export function writeCompaniesCache(companies) {
  const list = Array.isArray(companies) ? companies : [];
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
    next = [...base, company];
  } else {
    const without = base.filter((c) => String(c?.id ?? c?.Id) !== id);
    next = [company, ...without];
  }
  writeCompaniesCache(next);
  return next;
}
