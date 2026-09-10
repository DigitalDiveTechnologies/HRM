'use client';

import { useEffect, useState } from 'react';
import { v } from './format';

const KEY = 'gocs_selected_company_id';

/**
 * Reads the company selected on the dashboard (from sessionStorage)
 * and returns the set of employee IDs that belong to that company.
 *
 * Safe rules:
 *   - If no company selected (All Companies) → filteredEmpIds = null  (no filter, show all)
 *   - If company selected but employee cache empty → filteredEmpIds = null  (no filter, show all)
 *   - If company selected AND cache exists → filteredEmpIds = Set of matching employee IDs
 */
export function useCompanyFilter() {
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [filteredEmpIds, setFilteredEmpIds] = useState(null);

  useEffect(() => {
    let id = '';
    try { id = sessionStorage.getItem(KEY) || ''; } catch {}

    setSelectedCompanyId(id);

    // No company selected = All Companies = no filter
    if (!id) {
      setFilteredEmpIds(null);
      return;
    }

    // Read caches
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

    // If no employee cache available, show everything (safe fallback)
    if (!employees.length) {
      setFilteredEmpIds(null);
      return;
    }

    // Find company name/code for richer matching
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

          const empDivId = String(
            v(emp, 'divisionId', 'division_id') ||
            md.divisionId ||
            (md.companyIds && md.companyIds[0]) ||
            ''
          ).trim();
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
  }, []);

  return { selectedCompanyId, filteredEmpIds };
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
