using System.Data.Common;
using DigitalDive.Hr.Api.Data;
using Npgsql;

namespace DigitalDive.Hr.Api.Services;

/// <summary>Phase 2 document renewal task engine — sync from expiring documents + employee ID/visa fields.</summary>
public sealed class DocumentRenewalService
{
    private readonly Db _db;
    public DocumentRenewalService(Db db) => _db = db;

    private async Task<NpgsqlConnection> OpenAsync(CancellationToken ct)
    {
        var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);
        return conn;
    }

    private static Dictionary<string, object?> Row(DbDataReader reader)
    {
        var dict = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < reader.FieldCount; i++)
            dict[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i);
        return dict;
    }

    private static async Task<List<Dictionary<string, object?>>> ReadAllAsync(NpgsqlCommand cmd, CancellationToken ct)
    {
        var list = new List<Dictionary<string, object?>>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
            list.Add(Row(reader));
        return list;
    }

    public async Task<object> SyncRenewalsAsync(CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        var created = 0;

        // From documents table
        await using (var docs = new NpgsqlCommand(
                         """
                         SELECT d.id, d.employee_id, d.doc_type, d.title, d.expiry_date
                         FROM documents d
                         JOIN employees e ON e.id = d.employee_id
                         WHERE d.expiry_date IS NOT NULL
                           AND d.expiry_date <= CURRENT_DATE + INTERVAL '90 days'
                           AND e.in_hr_ops = TRUE AND e.status <> 'exited'
                         """, conn))
        await using (var r = await docs.ExecuteReaderAsync(ct))
        {
            var rows = new List<(int DocId, int EmpId, string Type, string Title, DateTime Due)>();
            while (await r.ReadAsync(ct))
            {
                rows.Add((
                    r.GetInt32(0),
                    r.GetInt32(1),
                    r.IsDBNull(2) ? "document" : r.GetString(2),
                    r.IsDBNull(3) ? "Document renewal" : r.GetString(3),
                    r.GetDateTime(4)));
            }
            await r.CloseAsync();

            foreach (var row in rows)
            {
                await using var ins = new NpgsqlCommand(
                    """
                    INSERT INTO document_renewal_tasks (employee_id, document_id, doc_type, title, due_date, status, notes)
                    SELECT @eid, @did, @dtype, @title, @due, 'open', 'Auto-synced from documents'
                    WHERE NOT EXISTS (
                      SELECT 1 FROM document_renewal_tasks t
                      WHERE t.document_id = @did AND t.status IN ('open','in_progress')
                    )
                    """, conn);
                ins.Parameters.AddWithValue("eid", row.EmpId);
                ins.Parameters.AddWithValue("did", row.DocId);
                ins.Parameters.AddWithValue("dtype", row.Type);
                ins.Parameters.AddWithValue("title", $"Renew: {row.Title}");
                ins.Parameters.AddWithValue("due", row.Due);
                created += await ins.ExecuteNonQueryAsync(ct);
            }
        }

        // From employee master expiry fields
        var fieldMap = new (string Col, string Type, string Title)[]
        {
            ("visa_expiry", "visa", "Residence visa renewal"),
            ("emirates_id_expiry", "emirates_id", "Emirates ID renewal"),
            ("passport_expiry", "passport", "Passport renewal"),
            ("contract_end", "contract", "Labour contract renewal"),
        };

        foreach (var (col, type, title) in fieldMap)
        {
            // Column may not exist on older DBs — try/catch per field
            try
            {
                await using var cmd = new NpgsqlCommand(
                    $"""
                     INSERT INTO document_renewal_tasks (employee_id, document_id, doc_type, title, due_date, status, notes)
                     SELECT e.id, NULL, @dtype, @title, e.{col}, 'open', 'Auto-synced from employee master'
                     FROM employees e
                     WHERE e.{col} IS NOT NULL
                       AND e.{col} <= CURRENT_DATE + INTERVAL '90 days'
                       AND e.in_hr_ops = TRUE AND e.status <> 'exited'
                       AND NOT EXISTS (
                         SELECT 1 FROM document_renewal_tasks t
                         WHERE t.employee_id = e.id AND t.doc_type = @dtype
                           AND t.status IN ('open','in_progress')
                           AND t.document_id IS NULL
                       )
                     """, conn);
                cmd.Parameters.AddWithValue("dtype", type);
                cmd.Parameters.AddWithValue("title", title);
                created += await cmd.ExecuteNonQueryAsync(ct);
            }
            catch (PostgresException)
            {
                // skip missing columns
            }
        }

        // Mirror into compliance_items for existing Compliance UI
        await using var mirror = new NpgsqlCommand(
            """
            INSERT INTO compliance_items (employee_id, title, category, due_date, status, notes)
            SELECT t.employee_id, t.title, 'document', t.due_date,
                   CASE WHEN t.due_date < CURRENT_DATE THEN 'overdue'
                        WHEN t.due_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'due_soon'
                        ELSE 'open' END,
                   'From document_renewal_tasks #' || t.id
            FROM document_renewal_tasks t
            WHERE t.status IN ('open','in_progress')
              AND NOT EXISTS (
                SELECT 1 FROM compliance_items c
                WHERE c.employee_id = t.employee_id AND c.title = t.title
                  AND c.status NOT IN ('done','closed','completed')
              )
            """, conn);
        var mirrored = await mirror.ExecuteNonQueryAsync(ct);

        return new { created, mirrored, isPreview = false };
    }

    public async Task<List<Dictionary<string, object?>>> ListAsync(CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            SELECT t.*, e.emp_code, e.full_name
            FROM document_renewal_tasks t
            JOIN employees e ON e.id = t.employee_id
            ORDER BY t.due_date NULLS LAST, t.id DESC
            LIMIT 500
            """, conn);
        return await ReadAllAsync(cmd, ct);
    }

    public async Task<Dictionary<string, object?>?> UpdateStatusAsync(int id, string status, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            UPDATE document_renewal_tasks
            SET status = @s,
                completed_at = CASE WHEN @s IN ('done','cancelled') THEN NOW() ELSE completed_at END
            WHERE id = @id
            RETURNING *
            """, conn);
        cmd.Parameters.AddWithValue("s", status.Trim().ToLowerInvariant());
        cmd.Parameters.AddWithValue("id", id);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        return Row(reader);
    }
}
