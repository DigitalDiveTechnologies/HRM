'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../../../components/AppShell';
import { api } from '../../../lib/auth';
import { v } from '../../../lib/format';

export default function CompanyStructurePage() {
  const router = useRouter();
  const [chart, setChart] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('gocs_cached_org');
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return [];
  });
  const [headcount, setHeadcount] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api('/org/chart'),
      api('/org/headcount').catch(() => []),
    ])
      .then(([org, hc]) => {
        const o = org || [];
        setChart(o);
        setHeadcount(hc || []);
        setLoading(false);
        try {
          localStorage.setItem('gocs_cached_org', JSON.stringify(o));
        } catch {}
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const childrenOf = useCallback(
    (id) => chart.filter((c) => String(v(c, 'managerId', 'manager_id')) === String(id)),
    [chart]
  );

  // Leadership roots: nodes with direct reports whose manager is null or not found in chart
  const leadershipRoots = useMemo(() => {
    const withKids = chart.filter((c) => childrenOf(v(c, 'id')).length > 0);
    const rootsWithKids = withKids.filter((c) => {
      const mId = v(c, 'managerId', 'manager_id');
      return !mId || !chart.some((other) => String(v(other, 'id')) === String(mId));
    });
    if (rootsWithKids.length) return rootsWithKids;
    const anyRoots = chart.filter((c) => !v(c, 'managerId', 'manager_id'));
    return anyRoots.length ? anyRoots : chart.slice(0, 1);
  }, [chart, childrenOf]);

  // Individual contributors: employees with no manager and 0 direct reports
  const individualStaff = useMemo(() => {
    return chart.filter((c) => {
      const mId = v(c, 'managerId', 'manager_id');
      const hasKids = childrenOf(v(c, 'id')).length > 0;
      return !mId && !hasKids;
    });
  }, [chart, childrenOf]);

  const chartContainerRef = useRef(null);
  const [connectorLines, setConnectorLines] = useState([]);

  const updateConnectorLines = useCallback(() => {
    if (!chartContainerRef.current) return;
    const contRect = chartContainerRef.current.getBoundingClientRect();
    const lines = [];

    chart.forEach((node) => {
      const nodeId = v(node, 'id');
      const textEl = document.getElementById(`org-text-${nodeId}`);
      if (!textEl) return;

      const kids = childrenOf(nodeId);
      kids.forEach((child) => {
        const childId = v(child, 'id');
        const childAvatarEl = document.getElementById(`org-avatar-${childId}`);
        if (!childAvatarEl) return;

        const pRect = textEl.getBoundingClientRect();
        const cRect = childAvatarEl.getBoundingClientRect();

        const x1 = pRect.left + pRect.width / 2 - contRect.left;
        const y1 = pRect.bottom - contRect.top + 4;
        const x2 = cRect.left + cRect.width / 2 - contRect.left;
        const y2 = cRect.top - contRect.top - 2;

        lines.push({ x1, y1, x2, y2, key: `${nodeId}-${childId}` });
      });
    });

    setConnectorLines(lines);
  }, [chart, childrenOf]);

  useEffect(() => {
    updateConnectorLines();
    const t1 = setTimeout(updateConnectorLines, 100);
    const t2 = setTimeout(updateConnectorLines, 400);
    window.addEventListener('resize', updateConnectorLines);

    let ro;
    if (typeof ResizeObserver !== 'undefined' && chartContainerRef.current) {
      ro = new ResizeObserver(updateConnectorLines);
      ro.observe(chartContainerRef.current);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', updateConnectorLines);
      if (ro) ro.disconnect();
    };
  }, [updateConnectorLines]);

  function handleNodeClick(node) {
    if (!node) return;
    const empId = v(node, 'employeeId', 'employee_id') || (!v(node, 'isVacant', 'is_vacant') ? v(node, 'id') : null);
    // Position chart: id is position id; only navigate when occupied
    if (empId && String(v(node, 'isVacant', 'is_vacant')) !== 'true') {
      router.push(`/employees?id=${empId}`);
    }
  }

  function OrgNodeView({ node }) {
    const kids = childrenOf(v(node, 'id'));
    const vacant = v(node, 'isVacant', 'is_vacant') === true || String(v(node, 'isVacant', 'is_vacant')) === 'true';
    const title = v(node, 'jobTitle', 'job_title') || v(node, 'fullName', 'full_name') || 'Position';
    const name = vacant ? 'Vacant' : v(node, 'fullName', 'full_name');
    const dept = v(node, 'departmentName', 'department_name');
    const code = v(node, 'code');

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
        {/* Concentric Dual-Ring Avatar Node */}
        <div
          onClick={() => handleNodeClick(node)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: vacant ? 'default' : 'pointer',
            zIndex: 3,
          }}
          title={vacant ? `${title} (vacant)` : `Click to view profile of ${name || title}`}
        >
          {/* Outer Concentric Ring */}
          <div
            id={`org-avatar-${v(node, 'id')}`}
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              border: vacant ? '1.5px dashed rgba(100, 116, 139, 0.55)' : '1.5px solid rgba(0, 184, 219, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 3,
              boxSizing: 'border-box',
              transition: 'all 0.2s ease',
              background: 'transparent',
              opacity: vacant ? 0.75 : 1,
            }}
            onMouseEnter={(e) => {
              if (vacant) return;
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.borderColor = '#00b8db';
              e.currentTarget.style.boxShadow = '0 0 14px rgba(0, 184, 219, 0.45)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.borderColor = vacant ? 'rgba(100, 116, 139, 0.55)' : 'rgba(0, 184, 219, 0.45)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {/* Inner Circle with Solid Silhouette Persona Icon */}
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: vacant
                  ? 'linear-gradient(145deg, #94a3b8 0%, #64748b 100%)'
                  : 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
                border: vacant ? '2px solid #94a3b8' : '2px solid #00b8db',
                boxShadow: '0 4px 10px rgba(15, 23, 42, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
          </div>

          {/* Designation & Department beneath Circle */}
          <div id={`org-text-${v(node, 'id')}`} style={{ textAlign: 'center', marginTop: 8, maxWidth: 140 }}>
            <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--ink, #0f172a)', lineHeight: 1.25 }}>
              {title}
            </div>
            {code ? (
              <div style={{ fontSize: '9px', color: '#64748b', marginTop: 2 }}>{code}</div>
            ) : null}
            {vacant ? (
              <div style={{ fontSize: '10px', color: '#b45309', fontWeight: 700, marginTop: 3 }}>Vacant</div>
            ) : name ? (
              <div style={{ fontSize: '10px', color: '#334155', marginTop: 3 }}>{name}</div>
            ) : null}
            {dept ? (
              <div style={{ fontSize: '10px', color: '#008fa8', fontWeight: 600, marginTop: 3 }}>{dept}</div>
            ) : null}
          </div>
        </div>

        {/* Children Row with Natural Angled Branches */}
        {kids.length > 0 ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 48,
              marginTop: 38,
              zIndex: 2,
              position: 'relative',
            }}
          >
            {kids.map((child) => (
              <OrgNodeView key={v(child, 'id')} node={child} />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <AppShell title="Company Structure" subtitle="Position-based organization chart (occupied + vacant seats)">
      {error ? <div className="error" style={{ marginBottom: 16 }}>{error}</div> : null}

      {headcount.length ? (
        <div className="card" style={{ marginBottom: 14, padding: '12px 16px' }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
            {(() => {
              const totals = headcount.reduce(
                (acc, r) => ({
                  approved: acc.approved + Number(v(r, 'approved') || 0),
                  occupied: acc.occupied + Number(v(r, 'occupied') || 0),
                  vacant: acc.vacant + Number(v(r, 'vacant') || 0),
                  frozen: acc.frozen + Number(v(r, 'frozen') || 0),
                }),
                { approved: 0, occupied: 0, vacant: 0, frozen: 0 }
              );
              return (
                <>
                  <span><strong>Approved seats:</strong> {totals.approved}</span>
                  <span><strong>Occupied:</strong> {totals.occupied}</span>
                  <span><strong>Vacant:</strong> {totals.vacant}</span>
                  <span><strong>Frozen:</strong> {totals.frozen}</span>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}

      <div className="card" style={{ padding: '24px 20px', overflowX: 'auto' }}>
        <div className="panel-title" style={{ marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Organization Chart</h3>
            <p className="muted" style={{ fontSize: '12px', margin: '2px 0 0' }}>
              Position reporting tree — vacant seats shown; click occupied nodes for employee profile
            </p>
          </div>
        </div>

        <div
          ref={chartContainerRef}
          style={{
            position: 'relative',
            display: 'flex',
            justifyContent: 'center',
            padding: '24px 16px',
            minWidth: 'max-content',
            margin: '0 auto',
            minHeight: 280,
          }}
        >
          {/* Dynamic SVG Dotted Connector Arrows Overlay */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          >
            <defs>
              <marker
                id="cyan-arrow"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="5.5"
                markerHeight="5.5"
                orient="auto"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#00b8db" />
              </marker>
            </defs>
            {connectorLines.map((line) => (
              <line
                key={line.key}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke="#00b8db"
                strokeWidth="1.6"
                strokeDasharray="3 3"
                markerEnd="url(#cyan-arrow)"
              />
            ))}
          </svg>

          {loading && !chart.length ? (
            <div className="muted" style={{ padding: '32px 0', textAlign: 'center' }}>
              Loading organizational chart…
            </div>
          ) : leadershipRoots.length ? (
            <div style={{ display: 'flex', gap: 56, justifyContent: 'center', zIndex: 2 }}>
              {leadershipRoots.map((r) => (
                <OrgNodeView key={v(r, 'id')} node={r} />
              ))}
            </div>
          ) : (
            <div className="muted" style={{ padding: '16px 0' }}>No hierarchy relationships configured yet.</div>
          )}
        </div>

        {/* Individual Contributors / Direct Staff */}
        {individualStaff.length ? (
          <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px dashed var(--line, #e2e8f0)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, justifyContent: 'center' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00b8db', display: 'inline-block' }}></span>
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)' }}>
                Direct Staff / Individual Contributors ({individualStaff.length})
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 36 }}>
              {individualStaff.map((staff) => {
                const title = v(staff, 'jobTitle', 'job_title') || v(staff, 'fullName', 'full_name') || 'Staff';
                const name = v(staff, 'fullName', 'full_name');
                const dept = v(staff, 'departmentName', 'department_name');
                return (
                  <div
                    key={v(staff, 'id')}
                    onClick={() => handleNodeClick(staff)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      cursor: 'pointer',
                      padding: '8px 12px',
                      transition: 'all 0.15s ease',
                      maxWidth: 140,
                    }}
                    title="Click to view employee profile"
                  >
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        border: '1.5px solid rgba(0, 184, 219, 0.45)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 3,
                        boxSizing: 'border-box',
                        marginBottom: 6,
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.08)';
                        e.currentTarget.style.borderColor = '#00b8db';
                        e.currentTarget.style.boxShadow = '0 0 14px rgba(0, 184, 219, 0.45)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.borderColor = 'rgba(0, 184, 219, 0.45)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: '50%',
                          background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
                          border: '2px solid #00b8db',
                          boxShadow: '0 4px 10px rgba(15, 23, 42, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                        }}
                      >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', maxWidth: 130 }}>
                      <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--ink, #0f172a)', lineHeight: 1.25 }}>
                        {title}
                      </div>
                      {dept ? (
                        <div style={{ fontSize: '10px', color: '#008fa8', fontWeight: 600, marginTop: 3 }}>{dept}</div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
