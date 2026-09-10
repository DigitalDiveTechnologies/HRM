'use client';

import { useEffect, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { api, value } from '@/lib/api';
export default function Attendance() { const [rows, setRows] = useState([]); const [error, setError] = useState(''); useEffect(() => { api('/attendance').then(setRows).catch((e) => setError(e.message)); }, []); return <PortalShell title="Attendance" subtitle="Your attendance history"><>{error && <div className="error">{error}</div>}<section className="panel"><h2>Attendance History</h2><div className="table-wrap"><table><thead><tr><th>Date</th><th>Check in</th><th>Check out</th><th>Shift</th><th>Status</th><th>Late</th></tr></thead><tbody>{rows.map((r) => <tr key={value(r, 'id')}><td>{value(r, 'workDate', 'work_date')}</td><td>{value(r, 'checkIn', 'check_in') || '—'}</td><td>{value(r, 'checkOut', 'check_out') || '—'}</td><td>{value(r, 'shiftName', 'shift_name') || '—'}</td><td><span className="status">{value(r, 'status')}</span></td><td>{value(r, 'lateMinutes', 'late_minutes') || 0} min</td></tr>)}{!rows.length && <tr><td colSpan="6">No attendance records found.</td></tr>}</tbody></table></div></section></></PortalShell>; }
