'use client';

import { useEffect, useState } from 'react';
import { v } from './format';

const KEY = 'gocs_selected_company_id';

/**
 * Reads the company selected on the dashboard (from sessionStorage)
 * and returns the set of employee IDs + emp_codes that belong to that company.
 *
 * Safe rules:
 *   - If no company selected (All Companies) → filteredEmpIds = null, filteredEmpCodes = null  (no filter, show all)
 *   - If company selected but employee cache empty → null, null (safe fallback, show all)
 *   - If company selected AND cache exists → Set of matching employee IDs + emp_codes
 */
export function setGlobalCompanyId(id) {
  try {
    if (id) {
      sessionStorage.setItem(KEY, String(id));
    } else {
      sessionStorage.removeItem(KEY);
    }
    window.dispatchEvent(new Event('gocs_company_changed'));
  } catch {}
}

export function useCompanyFilter() {
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [filteredEmpIds, setFilteredEmpIds] = useState(null);
  const [filteredEmpCodes, setFilteredEmpCodes] = useState(null);

  useEffect(() => {
    let active = true;

    function computeFilter() {
      let id = '';
      try { id = sessionStorage.getItem(KEY) || ''; } catch {}

      if (active) setSelectedCompanyId(id);

      // Read caches
      let employees = [];
      let compList = [];
      try {
        const ec = localStorage.getItem('gocs_cached_employees');
        if (ec) {
          const parsed = JSON.parse(ec);
          if (Array.isArray(parsed)) employees = parsed;
        }
      } catch {}
      try {
        const dc = localStorage.getItem('gocs_cached_dashboard');
        if (dc) {
          const p = JSON.parse(dc);
          if (Array.isArray(p?.companies)) compList = p.companies;
          if (!employees.length && Array.isArray(p?.employees)) employees = p.employees;
        }
      } catch {}
      try {
        if (!compList.length) {
          const divs = localStorage.getItem('gocs_cached_divisions');
          if (divs) {
            const parsed = JSON.parse(divs);
            if (Array.isArray(parsed)) compList = parsed;
          }
        }
      } catch {}

      if (active) setCompanies(compList);

      const foundComp = id && compList.length
        ? compList.find((c) => String(v(c, 'id')) === id) || null
        : null;
      if (active) setSelectedCompany(foundComp);

      // If company selected but caches empty, attempt background fetch
      if (id && (!employees.length || !compList.length) && typeof window !== 'undefined') {
        import('./auth').then(({ api }) => {
          Promise.allSettled([
            api('/divisions?activeOnly=true'),
            api('/employees'),
          ]).then(([divRes, empRes]) => {
            if (!active) return;
            let updatedComp = compList;
            let updatedEmp = employees;
            if (divRes.status === 'fulfilled' && Array.isArray(divRes.value)) {
              updatedComp = divRes.value;
              setCompanies(updatedComp);
              try { localStorage.setItem('gocs_cached_divisions', JSON.stringify(updatedComp)); } catch {}
            }
            if (empRes.status === 'fulfilled' && Array.isArray(empRes.value)) {
              updatedEmp = empRes.value;
              try { localStorage.setItem('gocs_cached_employees', JSON.stringify(updatedEmp)); } catch {}
            }
            // Recompute with fresh data
            if (updatedComp.length || updatedEmp.length) {
              const fc = id ? updatedComp.find((c) => String(v(c, 'id')) === id) || null : null;
              setSelectedCompany(fc);
              if (id && updatedEmp.length) {
                const targetCode = fc ? String(v(fc, 'code') || '').toLowerCase().trim() : '';
                const targetName = fc ? String(v(fc, 'name') || '').toLowerCase().trim() : '';
                const matched = updatedEmp.filter((emp) => {
                  if (!emp) return false;
                  let md = {};
                  try { md = typeof emp.masterData === 'string' ? JSON.parse(emp.masterData || '{}') : emp.masterData || {}; } catch {}
                  const empDivId = String(v(emp, 'divisionId', 'division_id') || emp.companyId || emp.company_id || md.divisionId || (md.companyIds && md.companyIds[0]) || '').trim();
                  const empDivCode = String(v(emp, 'divisionCode', 'division_code') || md.divisionCode || '').toLowerCase().trim();
                  const empDivName = String(v(emp, 'divisionName', 'division_name') || md.divisionName || '').toLowerCase().trim();
                  return (empDivId && empDivId === id) ||
                    (targetCode && empDivCode && empDivCode === targetCode) ||
                    (targetName && empDivName && empDivName === targetName);
                });
                setFilteredEmpIds(new Set(matched.map((e) => String(v(e, 'id'))).filter(Boolean)));
                setFilteredEmpCodes(new Set(matched.map((e) => String(v(e, 'empCode', 'emp_code') || '')).filter(Boolean)));
              }
            }
          }).catch(() => {});
        }).catch(() => {});
      }

      // No company selected = All Companies = no filter
      if (!id) {
        if (active) {
          setFilteredEmpIds(null);
          setFilteredEmpCodes(null);
        }
        return;
      }

      // If no employee cache available yet, show all until hydrated
      if (!employees.length) {
        if (active) {
          setFilteredEmpIds(null);
          setFilteredEmpCodes(null);
        }
        return;
      }

      const targetCode = foundComp ? String(v(foundComp, 'code') || '').toLowerCase().trim() : '';
      const targetName = foundComp ? String(v(foundComp, 'name') || '').toLowerCase().trim() : '';

      const matchingEmps = employees.filter((emp) => {
        if (!emp) return false;
        let md = {};
        try {
          md = typeof emp.masterData === 'string'
            ? JSON.parse(emp.masterData || '{}')
            : emp.masterData || {};
        } catch { md = {}; }

        const empDivId = String(
          v(emp, 'divisionId', 'division_id') ||
          emp.companyId || emp.company_id ||
          md.divisionId ||
          (md.companyIds && md.companyIds[0]) ||
          ''
        ).trim();
        const empDivCode = String(v(emp, 'divisionCode', 'division_code') || md.divisionCode || '').toLowerCase().trim();
        const empDivName = String(v(emp, 'divisionName', 'division_name') || md.divisionName || '').toLowerCase().trim();

        return (empDivId && empDivId === id) ||
          (targetCode && empDivCode && empDivCode === targetCode) ||
          (targetName && empDivName && empDivName === targetName);
      });

      const ids = new Set(
        matchingEmps.map((emp) => String(v(emp, 'id'))).filter(Boolean)
      );
      const codes = new Set(
        matchingEmps.map((emp) => String(v(emp, 'empCode', 'emp_code') || '')).filter(Boolean)
      );

      if (active) {
        setFilteredEmpIds(ids);
        setFilteredEmpCodes(codes);
      }
    }

    computeFilter();

    window.addEventListener('gocs_company_changed', computeFilter);
    window.addEventListener('storage', computeFilter);

    return () => {
      active = false;
      window.removeEventListener('gocs_company_changed', computeFilter);
      window.removeEventListener('storage', computeFilter);
    };
  }, []);

  return {
    selectedCompanyId,
    selectedCompany,
    companies,
    filteredEmpIds,
    filteredEmpCodes,
    setCompanyId: setGlobalCompanyId,
  };
}

/**
 * Helper: filter any rows array by the filtered employee IDs.
 * Safe: if filteredEmpIds is null, returns rows unchanged.
 */
export function applyEmpFilter(rows, filteredEmpIds) {
  if (!filteredEmpIds) return rows;
  return (rows || []).filter((r) => {
    const eid = String(r['employeeId'] || r['employee_id'] || '');
    return eid && filteredEmpIds.has(eid);
  });
}

/**
 * Helper: filter rows by emp_code (for tables that don't have employee_id).
 * Safe: if filteredEmpCodes is null, returns rows unchanged.
 */
export function applyEmpCodeFilter(rows, empCodeKey, filteredEmpCodes) {
  if (!filteredEmpCodes) return rows;
  return (rows || []).filter((r) => {
    const code = String(r[empCodeKey] || r['empCode'] || r['emp_code'] || '');
    return code && filteredEmpCodes.has(code);
  });
}

/**
 * Build a reliable filteredEmpIds Set from the page's own locally-loaded employees.
 * Use this in pages that load their own employees array from the API —
 * more reliable than the cache-based approach.
 *
 * Returns null  → no filter (show all)
 * Returns Set   → filter by those IDs (may be empty if company has no employees)
 */
export function buildLocalEmpIds(employees, selectedCompanyId) {
  if (!selectedCompanyId) return null;
  if (!employees || !employees.length) return null;

  const id = String(selectedCompanyId);
  const ids = new Set(
    employees
      .filter((emp) => {
        if (!emp) return false;
        let md = {};
        try {
          md = typeof emp.masterData === 'string' ? JSON.parse(emp.masterData || '{}') : (emp.masterData || {});
        } catch { md = {}; }
        const divId = String(
          emp.division_id ?? emp.divisionId ?? emp.company_id ?? emp.companyId ?? md.divisionId ?? (md.companyIds && md.companyIds[0]) ?? ''
        ).trim();
        return divId === id;
      })
      .map((emp) => String(emp.id || emp.Id || ''))
      .filter(Boolean)
  );
  return ids;
}
