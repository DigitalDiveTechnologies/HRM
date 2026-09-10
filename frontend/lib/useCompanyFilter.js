'use client';

import { useEffect, useState } from 'react';
import { v } from './format';

/**
 * Reads the company selected on the dashboard (from sessionStorage)
 * and returns the set of employee IDs that belong to that company.
 *
 * Returns:
 *   selectedCompanyId — the raw ID string ('' = All Companies)
 *   filteredEmpIds    — Set<string> of matching emp IDs, or null if no filter
 */
export function useCompanyFilter() {
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [filteredEmpIds, setFilteredEmpIds] = useState(null); // null = no filter

  useEffect(() => {
    try {
      const id = sessionStorage.getItem('gocs_selected_company_id') || '';
      setSelectedCompanyId(id);
      if (!id) {
        setFilteredEmpIds(null);
        return;
      }

      // Pull employee + company lists from localStorage cache
      let employees = [];
      let companies = [];
      try {
        const ec = localStorage.getItem('gocs_cached_employees');
        if (ec) employees = JSON.parse(ec) || [];
      } catch {}
      try {
        const dc = localStorage.getItem('gocs_cached_dashboard');
        if (dc) {
          const p = JSON.parse(dc);
          if (Array.isArray(p.companies)) companies = p.companies;
          if (!employees.length && Array.isArray(p.employees)) employees = p.employees;
        }
      } catch {}

      const company = companies.find((c) => String(v(c, 'id')) === id);
      const targetCode = company ? String(v(company, 'code') || '').toLowerCase().trim() : '';
      const targetName = company ? String(v(company, 'name') || '').toLowerCase().trim() : '';

      const ids = new Set(
        employees
          .filter((emp) => {
            if (!emp) return false;
            let md = {};
            try {
              md = typeof emp.masterData === 'string'
                ? JSON.parse(emp.masterData || '{}')
                : emp.masterData || {};
            } catch { md = {}; }

            const empDivId = String(v(emp, 'divisionId', 'division_id') || md.divisionId || (md.companyIds && md.companyIds[0]) || '').trim();
            const empDivCode = String(v(emp, 'divisionCode', 'division_code') || md.divisionCode || '').toLowerCase().trim();
            const empDivName = String(v(emp, 'divisionName', 'division_name') || md.divisionName || '').toLowerCase().trim();

            return (empDivId && empDivId === id) ||
              (targetCode && empDivCode && empDivCode === targetCode) ||
              (targetName && empDivName && empDivName === targetName);
          })
          .map((emp) => String(v(emp, 'id')))
          .filter(Boolean)
      );

      setFilteredEmpIds(ids);
    } catch {
      setFilteredEmpIds(null);
    }
  }, []);

  return { selectedCompanyId, filteredEmpIds };
}

/**
 * Helper: filter any rows array by the filtered employee IDs.
 */
export function applyEmpFilter(rows, filteredEmpIds) {
  if (!filteredEmpIds) return rows;
  return (rows || []).filter((r) => {
    const eid = String(r['employeeId'] || r['employee_id'] || '');
    return eid && filteredEmpIds.has(eid);
  });
}
