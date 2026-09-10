'use client';

import { useEffect, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { api, value } from '@/lib/api';
const date = (v) => v ? new Date(v).toLocaleDateString() : '—';
export default function Onboarding() { const [rows, setRows] = useState([]); const [error, setError] = useState(''); useEffect(() => { api('/onboarding/my').then(setRows).catch((e) => setError(e.message)); }, []); return <PortalShell title="Onboarding" subtitle="Items and handovers assigned to you"><>{error && <div className="error">{error}</div>}<section className="task-list">{rows.map((r) => <article className="task" key={value(r, 'id')}><div><span className="status">{value(r, 'status')}</span><h2>{value(r, 'title')}</h2><p>{value(r, 'category') || 'Onboarding item'}{value(r, 'tagNo', 'tag_no') ? ` · Tag: ${value(r, 'tagNo', 'tag_no')}` : ''}</p></div><dl><div><dt>Assigned</dt><dd>{date(value(r, 'createdAt', 'created_at'))}</dd></div><div><dt>Due date</dt><dd>{date(value(r, 'dueDate', 'due_date'))}</dd></div><div><dt>Handover signed</dt><dd>{date(value(r, 'signedAt', 'signed_at'))}</dd></div></dl>{value(r, 'notes') && <p className="notes">{value(r, 'notes')}</p>}</article>)}{!rows.length && <section className="panel">No onboarding items are assigned to you.</section>}</section></></PortalShell>; }
