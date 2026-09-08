'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getApiBase } from '../../../lib/auth';
import { BRAND } from '../../../lib/brand';
import { formatDate, v } from '../../../lib/format';

function VerifyInner() {
  const params = useSearchParams();
  const id = params.get('id');
  const emp = params.get('emp') || '';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setError('Missing certificate id.');
      setLoading(false);
      return;
    }
    const base = getApiBase();
    const q = new URLSearchParams({ id: String(id) });
    if (emp) q.set('emp', emp);
    fetch(`${base}/api/certificates/verify?${q}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `Verify failed (${res.status})`);
        setData(json);
      })
      .catch((e) => setError(e.message || 'Verification failed'))
      .finally(() => setLoading(false));
  }, [id, emp]);

  const valid = Boolean(data?.valid);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #f0f7fb 0%, #e8eef5 45%, #f7fafc 100%)',
      padding: '48px 16px',
      fontFamily: 'Georgia, "Times New Roman", serif',
    }}>
      <div style={{
        maxWidth: 520,
        margin: '0 auto',
        background: '#fff',
        borderRadius: 16,
        padding: '32px 28px',
        boxShadow: '0 12px 40px rgba(15, 23, 42, 0.08)',
        border: '1px solid rgba(13, 79, 139, 0.12)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src={BRAND.logoSrc} alt="" style={{ height: 48, marginBottom: 10 }} />
          <div style={{ fontSize: 13, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Certificate verification
          </div>
          <h1 style={{ margin: '8px 0 0', fontSize: 22, color: '#0d4f8b' }}>{BRAND.clientName}</h1>
        </div>

        {loading ? <p style={{ textAlign: 'center', color: '#64748b' }}>Checking authenticity…</p> : null}
        {error ? (
          <div style={{
            padding: 14, borderRadius: 10, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca',
          }}>
            {error}
          </div>
        ) : null}

        {!loading && data ? (
          <>
            <div style={{
              textAlign: 'center',
              padding: '14px 12px',
              borderRadius: 10,
              marginBottom: 20,
              background: valid ? '#ecfdf5' : '#fff7ed',
              color: valid ? '#065f46' : '#9a3412',
              fontWeight: 700,
              border: `1px solid ${valid ? '#a7f3d0' : '#fed7aa'}`,
            }}>
              {v(data, 'status') || (valid ? 'Valid & Authenticated' : 'Not valid')}
            </div>
            <dl style={{ margin: 0, display: 'grid', gap: 12, fontSize: 15 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
                <dt style={{ color: '#64748b' }}>Employee</dt>
                <dd style={{ margin: 0, fontWeight: 700 }}>{v(data, 'employeeName') || '—'}</dd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
                <dt style={{ color: '#64748b' }}>Employee code</dt>
                <dd style={{ margin: 0, fontWeight: 700 }}>{v(data, 'empCode') || emp || '—'}</dd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
                <dt style={{ color: '#64748b' }}>Issuing entity</dt>
                <dd style={{ margin: 0, fontWeight: 700 }}>{v(data, 'legalEntity') || '—'}</dd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
                <dt style={{ color: '#64748b' }}>Issued</dt>
                <dd style={{ margin: 0, fontWeight: 700 }}>{formatDate(v(data, 'issuedAt')) || '—'}</dd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <dt style={{ color: '#64748b' }}>Certificate #</dt>
                <dd style={{ margin: 0, fontWeight: 700 }}>{v(data, 'certificateId') || id}</dd>
              </div>
            </dl>
            {v(data, 'message') ? (
              <p style={{ marginTop: 20, fontSize: 13, color: '#64748b', textAlign: 'center' }}>{v(data, 'message')}</p>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function VerifyCertificatePage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Loading…</div>}>
      <VerifyInner />
    </Suspense>
  );
}
