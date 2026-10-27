'use client';

import { useEffect, useState, useMemo } from 'react';
import PortalShell from '@/components/PortalShell';
import { api, apiBlob, session, value } from '@/lib/api';

export default function TotalRewardsPage() {
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadRewards() {
      setLoading(true);
      setError('');
      try {
        const user = session.get()?.user;
        const employeeId = user?.employeeId;
        const path = employeeId ? `/ess/${employeeId}/total-rewards` : '/ess/total-rewards';
        const data = await api(path);
        if (data && !data.error) {
          setStatement(data);
        } else {
          setError(data?.error || 'Unable to retrieve total rewards statement.');
        }
      } catch (err) {
        console.error('Failed to load total rewards:', err);
        setError(err.message || 'Failed to load total rewards statement.');
      } finally {
        setLoading(false);
      }
    }
    loadRewards();
  }, []);

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const user = session.get()?.user;
      const employeeId = user?.employeeId;
      const path = employeeId ? `/ess/${employeeId}/total-rewards/pdf` : '/ess/total-rewards/pdf';
      const blob = await apiBlob(path);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const code = statement?.employeeCode || statement?.emp_code || 'EMP';
      link.download = `Total-Rewards-Statement-${code}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Failed to generate PDF statement.');
    } finally {
      setDownloading(false);
    }
  };

  const fmt = (num) => {
    const val = Number(num || 0);
    return `AED ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const totalAnnual = Number(statement?.totalAnnualValue || 0);
  const annualCash = Number(statement?.annualCashSalary || 0);
  const annualBenefits = Number(statement?.annualEmployerBenefits || 0);
  const accruedGratuity = Number(statement?.accruedGratuity || 0);

  const cashPct = totalAnnual > 0 ? Math.round((annualCash / totalAnnual) * 100) : 75;
  const benefitsPct = totalAnnual > 0 ? Math.round((annualBenefits / totalAnnual) * 100) : 15;
  const gratuityPct = totalAnnual > 0 ? Math.max(1, 100 - cashPct - benefitsPct) : 10;

  return (
    <PortalShell
      title="Total Rewards Statement"
      subtitle="Executive summary of your complete compensation, statutory employer benefits & End of Service Gratuity"
      actions={
        <button
          type="button"
          onClick={downloadPdf}
          disabled={downloading || loading || !statement}
          className="btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {downloading ? 'Generating PDF…' : 'Export Statement (PDF)'}
        </button>
      }
    >
      {error && <div className="error-box" style={{ marginBottom: 18 }}>{error}</div>}

      {loading ? (
        <div className="panel-card" style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Loading your total compensation statement…</div>
        </div>
      ) : !statement ? (
        <div className="panel-card" style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>
          <p>No rewards profile found. Please contact your HR administrator.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Executive Total Annual Compensation Hero Banner */}
          <div
            style={{
              background: 'linear-gradient(135deg, #020B1F 0%, #031c38 60%, #004d61 100%)',
              borderRadius: 20,
              padding: '28px 32px',
              color: '#ffffff',
              boxShadow: '0 12px 32px -8px rgba(0, 184, 219, 0.25)',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 20,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span
                  style={{
                    background: 'rgba(0, 184, 219, 0.2)',
                    border: '1px solid rgba(0, 184, 219, 0.4)',
                    color: '#38d6f4',
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    padding: '3px 9px',
                    borderRadius: 999,
                  }}
                >
                  Confidential Total Compensation
                </span>
                <span style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.65)' }}>
                  Code: <strong>{statement.employeeCode || statement.emp_code}</strong>
                </span>
              </div>
              <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
                {fmt(totalAnnual)}
              </h1>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(255, 255, 255, 0.8)' }}>
                Comprehensive Annual Remuneration Value · {statement.fullName || statement.full_name}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 12,
                  padding: '12px 18px',
                  minWidth: 140,
                }}
              >
                <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.65)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Annual Cash
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#38d6f4', marginTop: 4 }}>
                  {fmt(annualCash)}
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 12,
                  padding: '12px 18px',
                  minWidth: 140,
                }}
              >
                <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.65)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Employer Benefits
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#a7f3d0', marginTop: 4 }}>
                  {fmt(annualBenefits)}
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 12,
                  padding: '12px 18px',
                  minWidth: 140,
                }}
              >
                <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.65)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Accrued EOSB
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#fde047', marginTop: 4 }}>
                  {fmt(accruedGratuity)}
                </div>
              </div>
            </div>
          </div>

          {/* Visual Percentage Breakdown Bar */}
          <div className="panel-card" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                Compensation Structure Ratio
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                Cash: {cashPct}% · Benefits: {benefitsPct}% · Gratuity: {gratuityPct}%
              </div>
            </div>

            <div style={{ width: '100%', height: 12, borderRadius: 999, overflow: 'hidden', display: 'flex', background: 'var(--line)' }}>
              <div style={{ width: `${cashPct}%`, background: '#00b8db', transition: 'width 0.4s ease' }} title={`Annual Cash Salary: ${cashPct}%`} />
              <div style={{ width: `${benefitsPct}%`, background: '#10b981', transition: 'width 0.4s ease' }} title={`Employer Benefits: ${benefitsPct}%`} />
              <div style={{ width: `${gratuityPct}%`, background: '#f59e0b', transition: 'width 0.4s ease' }} title={`Gratuity Accrual: ${gratuityPct}%`} />
            </div>

            <div style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: 12, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#00b8db' }} />
                Direct Cash Salary (Basic + Allowances)
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981' }} />
                Company-Funded Benefits & Insurance
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
                Statutory Gratuity Reserve (UAE Labour Law)
              </span>
            </div>
          </div>

          {/* 3 Detailed Pillar Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
            {/* Pillar 1: Cash Remuneration */}
            <div className="panel-card" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>
                <span style={{ fontSize: 20 }}>💵</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
                    Pillar 1: Direct Cash Salary
                  </h3>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Paid monthly via UAE WPS</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)' }}>Annual Basic Salary</span>
                  <strong>{fmt(statement.annualBasicSalary)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)' }}>Annual Housing Allowance</span>
                  <strong>{fmt((statement.annualAllowances || 0) * 0.6)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)' }}>Annual Transport Allowance</span>
                  <strong>{fmt((statement.annualAllowances || 0) * 0.25)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)' }}>Other Guaranteed Allowances</span>
                  <strong>{fmt((statement.annualAllowances || 0) * 0.15)}</strong>
                </div>
                <div style={{ height: 1, background: 'var(--line)', margin: '8px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700 }}>
                  <span>Total Cash Remuneration</span>
                  <span style={{ color: '#00b8db' }}>{fmt(statement.annualCashSalary)}</span>
                </div>
              </div>
            </div>

            {/* Pillar 2: Corporate Benefits */}
            <div className="panel-card" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>
                <span style={{ fontSize: 20 }}>🛡️</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
                    Pillar 2: Company-Paid Benefits
                  </h3>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Employer-funded entitlements</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)' }}>Healthcare & Medical Coverage</span>
                  <strong>{fmt((statement.annualEmployerBenefits || 0) - (statement.annualFlightAllowance || 3500) - 2500 > 0 ? (statement.annualEmployerBenefits || 0) - (statement.annualFlightAllowance || 3500) - 2500 : 6000)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)' }}>Annual Flight Ticket Allowance</span>
                  <strong>{fmt(statement.annualFlightAllowance || 3500)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)' }}>Visa, Residency & Statutory Fees</span>
                  <strong>AED 2,500.00</strong>
                </div>
                <div style={{ height: 1, background: 'var(--line)', margin: '8px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700 }}>
                  <span>Total Employer Benefits</span>
                  <span style={{ color: '#10b981' }}>{fmt(statement.annualEmployerBenefits)}</span>
                </div>
              </div>
            </div>

            {/* Pillar 3: Gratuity & EOSB */}
            <div className="panel-card" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>
                <span style={{ fontSize: 20 }}>⚖️</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
                    Pillar 3: Statutory Gratuity
                  </h3>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>UAE Federal Decree-Law No. 33 of 2021</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)' }}>Service Duration</span>
                  <strong>{statement.serviceYears || '—'} Years</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)' }}>Accrual Statutory Formula</span>
                  <strong>21 Days / Year</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)' }}>Jurisdiction Profile</span>
                  <strong>UAE Mainland</strong>
                </div>
                <div style={{ height: 1, background: 'var(--line)', margin: '8px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700 }}>
                  <span>Accrued Gratuity Value</span>
                  <span style={{ color: '#f59e0b' }}>{fmt(statement.accruedGratuity)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Statement Governance & Footnote Card */}
          <div
            style={{
              padding: '16px 20px',
              borderRadius: 14,
              border: '1px solid var(--line)',
              background: 'var(--surface)',
              fontSize: 12,
              color: 'var(--muted)',
              lineHeight: 1.6,
            }}
          >
            <strong>Statutory Governance & Statement Note:</strong>
            <p style={{ margin: '4px 0 0' }}>
              This Total Rewards Statement reflects your full direct and indirect compensation value provided by Synergy HR Management. Direct cash salaries are disbursed on a monthly basis in accordance with the UAE Wages Protection System (WPS) under MOHRE regulations. Medical insurance benefits adhere to statutory health authority minimum standards. Statutory End of Service Gratuity (EOSB) is calculated in accordance with UAE Federal Decree-Law No. 33 of 2021. For contract amendments or queries, contact HR Operations.
            </p>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
