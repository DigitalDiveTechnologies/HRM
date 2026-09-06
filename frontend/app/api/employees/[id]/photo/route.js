import { NextResponse } from 'next/server';

const NEON_CONN = 'postgresql://neondb_owner:npg_PXLxeWT0qbm9@ep-winter-cloud-axz1oxj0-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';
const NEON_ENDPOINT = 'https://ep-winter-cloud-axz1oxj0.c-4.us-east-2.aws.neon.tech/sql';

export async function DELETE(request, { params }) {
  try {
    const resolvedParams = await params;
    const empId = parseInt(resolvedParams.id, 10);
    if (!empId || isNaN(empId)) {
      return NextResponse.json({ error: 'Invalid employee ID' }, { status: 400 });
    }

    const res = await fetch(NEON_ENDPOINT, {
      method: 'POST',
      headers: {
        'Neon-Connection-String': NEON_CONN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `UPDATE employees SET photo_path = NULL WHERE id = ${empId};`,
      }),
    });

    const data = await res.json();
    return NextResponse.json({ ok: true, message: 'Profile photo removed from database.', data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request, context) {
  return DELETE(request, context);
}
