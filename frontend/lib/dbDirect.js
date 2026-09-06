/**
 * Direct database execution for operations where live IIS backend endpoints are unavailable.
 * Neon HTTP SQL API is CORS-enabled and requires no npm dependencies.
 */
const NEON_CONN =
  'postgresql://neondb_owner:npg_PXLxeWT0qbm9@ep-winter-cloud-axz1oxj0-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';
const NEON_ENDPOINT =
  'https://ep-winter-cloud-axz1oxj0.c-4.us-east-2.aws.neon.tech/sql';

export async function clearEmployeePhotoInDb(employeeId) {
  const safeId = parseInt(employeeId, 10);
  if (!safeId || isNaN(safeId)) return false;
  try {
    const res = await fetch(NEON_ENDPOINT, {
      method: 'POST',
      headers: {
        'Neon-Connection-String': NEON_CONN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `UPDATE employees SET photo_path = NULL WHERE id = ${safeId};`,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error('Error clearing photo in DB:', err);
    return false;
  }
}
