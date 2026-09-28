'use client';

import { useEffect, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { api, session, value } from '@/lib/api';
import { useLocale } from '@/lib/LocaleContext';

const formatDate = (v) => (v ? new Date(v).toLocaleDateString() : '—');
const formatCurrency = (amt) => {
  const n = Number(amt) || 0;
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function formatPeriod(period) {
  if (!period) return 'Current';
  const parts = String(period).split('-');
  if (parts.length === 2) {
    const year = parts[0];
    const monthIndex = parseInt(parts[1], 10) - 1;
    const date = new Date(year, monthIndex, 1);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  }
  return period;
}

export default function Payslips() {
  const { t, locale } = useLocale();
  const [data, setData] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = session.get()?.user?.employeeId;
    if (!id) {
      api('/auth/me')
        .then((me) => {
          if (me?.employeeId) {
            return api(`/ess/${me.employeeId}`);
          }
          throw new Error('Employee account not found.');
        })
        .then((ess) => setData(ess))
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
      return;
    }

    api(`/ess/${id}`)
      .then((ess) => setData(ess))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const payslips = data?.payslips || [];
  const profile = data?.profile || {};
  const currentSlip = payslips[selectedIdx] || payslips[0] || null;

  const totalSlips = payslips.length;
  const latestNet = payslips.length ? Number(value(payslips[0], 'netPay', 'net_pay') || 0) : 0;
  const preferredPaymentMethod = currentSlip ? (value(currentSlip, 'paymentMethod', 'payment_method') || 'WPS').toUpperCase() : 'WPS';

  function handlePrint() {
    window.print();
  }

  return (
    <PortalShell
      title={locale === 'ar' ? 'قسائم الراتب والتعويضات' : 'Payslips & Compensation'}
      subtitle={locale === 'ar' ? 'سجل الرواتب الشهرية، البدلات، الاستقطاعات وتفاصيل تحويل الأجور' : 'Monthly salary breakdown, allowances, deductions, and payment details'}
      actions={
        currentSlip ? (
          <button
            type="button"
            onClick={handlePrint}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              borderRadius: 8,
              border: '1px solid var(--line)',
              background: 'var(--surface)',
              color: 'var(--ink)',
              fontWeight: 700,
              fontSize: '13.5px',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            <span>{locale === 'ar' ? 'طباعة القسيمة' : 'Print Payslip'}</span>
          </button>
        ) : null
      }
    >
      {error ? <div className="error-box" style={{ marginBottom: 16 }}>{error}</div> : null}

      {/* KPI Top Cards */}
      <div className="dash-kpi-grid">
        <div className="kpi-card green">
          <div className="kpi-info">
            <span className="kpi-title">{locale === 'ar' ? 'آخر صافي راتب' : 'Latest Net Salary'}</span>
            <span className="kpi-val" style={{ fontSize: '24px' }}>
              AED {formatCurrency(latestNet)}
            </span>
            <span className="kpi-badge">{payslips.length ? formatPeriod(value(payslips[0], 'periodLabel', 'period_label')) : 'N/A'}</span>
          </div>
          <div className="kpi-ring" style={{ fontSize: '11px', fontWeight: 700 }}>
            {payslips.length ? 'AED' : '0'}
          </div>
        </div>

        <div className="kpi-card blue">
          <div className="kpi-info">
            <span className="kpi-title">{locale === 'ar' ? 'إجمالي القسائم' : 'Total Payslips'}</span>
            <span className="kpi-val">{totalSlips}</span>
            <span className="kpi-badge">{locale === 'ar' ? 'الأشهر المصروفة' : 'Issued Months'}</span>
          </div>
          <div className="kpi-ring">{totalSlips}</div>
        </div>

        <div className="kpi-card amber">
          <div className="kpi-info">
            <span className="kpi-title">{locale === 'ar' ? 'نظام التحويل' : 'Disbursement Method'}</span>
            <span className="kpi-val" style={{ fontSize: '20px' }}>
              {preferredPaymentMethod}
            </span>
            <span className="kpi-badge">{preferredPaymentMethod === 'WPS' ? 'CBUAE / MoHRE' : 'Direct Bank'}</span>
          </div>
          <div className="kpi-ring">✓</div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
          {locale === 'ar' ? 'جاري تحميل قسائم الراتب…' : 'Loading payslips records…'}
        </div>
      ) : payslips.length === 0 ? (
        <div className="panel-card" style={{ padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ maxWidth: 360, margin: '0 auto' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" style={{ margin: '0 auto 16px', display: 'block', opacity: 0.7 }}>
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>
              {locale === 'ar' ? 'لا توجد قسائم رواتب صادرة بعد' : 'No payslips generated yet'}
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
              {locale === 'ar'
                ? 'ستظهر قسائم الراتب تلقائياً هنا بمجرد اعتماد مسير الرواتب الشهري من قِبل إدارة الموارد البشرية.'
                : 'Your monthly salary slips will appear here once finalized by HR & Finance.'}
            </p>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(240px, 320px) 1fr',
            gap: 20,
            alignItems: 'start',
          }}
        >
          {/* Left Column: Period Selector List */}
          <div className="panel-card" style={{ padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 700, color: 'var(--ink)' }}>
              {locale === 'ar' ? 'اختر الفترة الشهرية' : 'Select Salary Period'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {payslips.map((slip, idx) => {
                const isSelected = idx === selectedIdx;
                const period = value(slip, 'periodLabel', 'period_label');
                const net = Number(value(slip, 'netPay', 'net_pay') || 0);

                return (
                  <div
                    key={value(slip, 'id') || idx}
                    onClick={() => setSelectedIdx(idx)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 10,
                      border: isSelected ? '1.5px solid #00b8db' : '1px solid var(--line)',
                      background: isSelected ? 'rgba(0, 184, 219, 0.08)' : 'var(--surface-alt)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: isSelected ? '#008fa8' : 'var(--ink)' }}>
                        {formatPeriod(period)}
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: 2 }}>
                        Ref: {value(slip, 'wpsRef', 'wps_ref') || `PAY-${value(slip, 'id')}`}
                      </div>
                    </div>
                    <div style={{ textAlign: locale === 'ar' ? 'left' : 'right' }}>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 700,
                          color: '#10b981',
                        }}
                      >
                        AED {formatCurrency(net)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Detailed Payslip Card */}
          {currentSlip ? (
            <div
              className="panel-card print-target"
              style={{
                padding: '32px',
                background: 'var(--surface)',
                borderRadius: 14,
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
              }}
            >
              {/* Slip Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  paddingBottom: 24,
                  borderBottom: '2px solid var(--line)',
                  marginBottom: 24,
                  flexWrap: 'wrap',
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: '#00b8db',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: '18px',
                      }}
                    >
                      G
                    </div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--ink)' }}>
                        {value(profile, 'divisionName', 'division_name') || 'GOCs HR'}
                      </h2>
                      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                        Official Salary Statement
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: locale === 'ar' ? 'left' : 'right' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '4px 12px',
                      borderRadius: 9999,
                      background: 'rgba(0, 184, 219, 0.12)',
                      color: '#008fa8',
                      fontWeight: 700,
                      fontSize: '12px',
                      marginBottom: 4,
                    }}
                  >
                    {formatPeriod(value(currentSlip, 'periodLabel', 'period_label'))}
                  </span>
                  <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                    Generated: {formatDate(value(currentSlip, 'createdAt', 'created_at'))}
                  </div>
                </div>
              </div>

              {/* Employee Information Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 16,
                  padding: '16px 20px',
                  background: 'var(--surface-alt)',
                  borderRadius: 10,
                  marginBottom: 24,
                }}
              >
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {locale === 'ar' ? 'اسم الموظف' : 'Employee Name'}
                  </span>
                  <strong style={{ fontSize: '13.5px', color: 'var(--ink)', marginTop: 2, display: 'block' }}>
                    {value(profile, 'fullName', 'full_name') || session.get()?.user?.fullName || 'Employee'}
                  </strong>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {locale === 'ar' ? 'الرقم الوظيفي' : 'Employee ID / Code'}
                  </span>
                  <strong style={{ fontSize: '13.5px', color: 'var(--ink)', marginTop: 2, display: 'block' }}>
                    {value(profile, 'empCode', 'emp_code') || '—'}
                  </strong>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {locale === 'ar' ? 'المسمى الوظيفي' : 'Job Title'}
                  </span>
                  <strong style={{ fontSize: '13.5px', color: 'var(--ink)', marginTop: 2, display: 'block' }}>
                    {value(profile, 'jobTitle', 'job_title') || '—'}
                  </strong>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {locale === 'ar' ? 'القسم / الإدارة' : 'Department'}
                  </span>
                  <strong style={{ fontSize: '13.5px', color: 'var(--ink)', marginTop: 2, display: 'block' }}>
                    {value(profile, 'departmentName', 'department_name') || 'Operations'}
                  </strong>
                </div>
              </div>

              {/* Earnings & Deductions Tables (2 Columns) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: 20,
                  marginBottom: 24,
                }}
              >
                {/* Earnings */}
                <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
                  <div
                    style={{
                      background: 'rgba(16, 185, 129, 0.1)',
                      padding: '10px 16px',
                      fontWeight: 700,
                      fontSize: '13px',
                      color: '#065f46',
                      borderBottom: '1px solid var(--line)',
                    }}
                  >
                    {locale === 'ar' ? 'الاستحقاقات (Earnings)' : 'Earnings & Allowances'}
                  </div>
                  <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'var(--muted)' }}>{locale === 'ar' ? 'الراتب الأساسي' : 'Basic Salary'}</span>
                      <strong style={{ color: 'var(--ink)' }}>AED {formatCurrency(value(currentSlip, 'basicSalary', 'basic_salary'))}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'var(--muted)' }}>{locale === 'ar' ? 'البدلات' : 'Allowances'}</span>
                      <strong style={{ color: 'var(--ink)' }}>AED {formatCurrency(value(currentSlip, 'allowances'))}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'var(--muted)' }}>{locale === 'ar' ? 'ساعات إضافية' : 'Overtime Pay'}</span>
                      <strong style={{ color: 'var(--ink)' }}>AED {formatCurrency(value(currentSlip, 'overtimePay', 'overtime_pay'))}</strong>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '13.5px',
                        paddingTop: 10,
                        borderTop: '1px dashed var(--line)',
                        fontWeight: 700,
                      }}
                    >
                      <span style={{ color: 'var(--ink)' }}>{locale === 'ar' ? 'إجمالي الاستحقاقات' : 'Gross Earnings'}</span>
                      <span style={{ color: '#10b981' }}>
                        AED {formatCurrency(
                          Number(value(currentSlip, 'basicSalary', 'basic_salary') || 0) +
                          Number(value(currentSlip, 'allowances') || 0) +
                          Number(value(currentSlip, 'overtimePay', 'overtime_pay') || 0)
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Deductions */}
                <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
                  <div
                    style={{
                      background: 'rgba(239, 68, 68, 0.08)',
                      padding: '10px 16px',
                      fontWeight: 700,
                      fontSize: '13px',
                      color: '#991b1b',
                      borderBottom: '1px solid var(--line)',
                    }}
                  >
                    {locale === 'ar' ? 'الاستقطاعات (Deductions)' : 'Deductions & Adjustments'}
                  </div>
                  <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'var(--muted)' }}>{locale === 'ar' ? 'خصم إجازات / غياب' : 'Unpaid Leaves / Absence'}</span>
                      <strong style={{ color: 'var(--ink)' }}>AED {formatCurrency(value(currentSlip, 'deductions'))}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'var(--muted)' }}>{locale === 'ar' ? 'أخرى' : 'Other Deductions'}</span>
                      <strong style={{ color: 'var(--ink)' }}>AED 0.00</strong>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '13.5px',
                        paddingTop: 10,
                        marginTop: 18,
                        borderTop: '1px dashed var(--line)',
                        fontWeight: 700,
                      }}
                    >
                      <span style={{ color: 'var(--ink)' }}>{locale === 'ar' ? 'إجمالي الاستقطاعات' : 'Total Deductions'}</span>
                      <span style={{ color: '#ef4444' }}>AED {formatCurrency(value(currentSlip, 'deductions'))}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Net Pay Callout */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(0, 184, 219, 0.10) 100%)',
                  border: '1.5px solid #10b981',
                  borderRadius: 12,
                  padding: '20px 24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 16,
                  marginBottom: 20,
                }}
              >
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#065f46', display: 'block' }}>
                    {locale === 'ar' ? 'صافي المبلغ المحول للحساب' : 'Net Take-Home Pay (Transferred)'}
                  </span>
                  <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                    Payment Method: {preferredPaymentMethod} • Ref: {value(currentSlip, 'wpsRef', 'wps_ref') || 'N/A'}
                  </span>
                </div>

                <div style={{ fontSize: '28px', fontWeight: 800, color: '#065f46', letterSpacing: '0.5px' }}>
                  AED {formatCurrency(value(currentSlip, 'netPay', 'net_pay'))}
                </div>
              </div>

              {/* Footer Note */}
              <div style={{ textAlign: 'center', fontSize: '11.5px', color: 'var(--muted)', paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                This is a computer-generated salary slip and does not require a physical signature. Issued by GOCs HR Systems.
              </div>
            </div>
          ) : null}
        </div>
      )}
    </PortalShell>
  );
}
