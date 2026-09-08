using System.Data;
using System.Data.Common;
using DigitalDive.Hr.Api.Data;
using DigitalDive.Hr.Api.Models;
using Npgsql;

namespace DigitalDive.Hr.Api.Services;

public sealed class OrgFoundationService
{
    private readonly Db _db;
    public OrgFoundationService(Db db) => _db = db;

    private async Task<NpgsqlConnection> OpenAsync(CancellationToken ct)
    {
        var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);
        return conn;
    }

    private static async Task<List<Dictionary<string, object?>>> ReadAllAsync(NpgsqlCommand cmd, CancellationToken ct)
    {
        var list = new List<Dictionary<string, object?>>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
            list.Add(Row(reader));
        return list;
    }

    private static async Task<Dictionary<string, object?>?> ReadOneAsync(NpgsqlCommand cmd, CancellationToken ct)
    {
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        return Row(reader);
    }

    private static Dictionary<string, object?> Row(DbDataReader reader)
    {
        var dict = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < reader.FieldCount; i++)
            dict[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i);
        return dict;
    }

    private async Task<List<Dictionary<string, object?>>> QueryAsync(string sql, CancellationToken ct, params (string, object?)[] args)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(sql, conn);
        foreach (var (n, v) in args)
            cmd.Parameters.AddWithValue(n, v ?? DBNull.Value);
        return await ReadAllAsync(cmd, ct);
    }

    public Task<List<Dictionary<string, object?>>> LegalEntitiesAsync(CancellationToken ct) =>
        QueryAsync("SELECT * FROM legal_entities ORDER BY name", ct);

    public async Task<(Dictionary<string, object?>? Row, string? Error)> CreateLegalEntityAsync(LegalEntityCreateRequest body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Code) || string.IsNullOrWhiteSpace(body.Name))
            return (null, "code and name required");
        var jurisdiction = string.IsNullOrWhiteSpace(body.JurisdictionProfile) ? "uae_mainland" : body.JurisdictionProfile.Trim();
        await using var conn = await OpenAsync(ct);
        try
        {
            await using var cmd = new NpgsqlCommand(
                """
                INSERT INTO legal_entities
                  (code, name, trade_licence, mohre_establishment_no, wps_employer_id, emirate, free_zone_authority, jurisdiction_profile, bank_name)
                VALUES
                  (@code, @name, @tl, @mohre, @wps, @emirate, @fz, @jur, @bank)
                RETURNING *
                """, conn);
            cmd.Parameters.AddWithValue("code", body.Code.Trim().ToUpperInvariant());
            cmd.Parameters.AddWithValue("name", body.Name.Trim());
            cmd.Parameters.AddWithValue("tl", (object?)body.TradeLicence ?? DBNull.Value);
            cmd.Parameters.AddWithValue("mohre", (object?)body.MohreEstablishmentNo ?? DBNull.Value);
            cmd.Parameters.AddWithValue("wps", (object?)body.WpsEmployerId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("emirate", (object?)body.Emirate ?? DBNull.Value);
            cmd.Parameters.AddWithValue("fz", (object?)body.FreeZoneAuthority ?? DBNull.Value);
            cmd.Parameters.AddWithValue("jur", jurisdiction);
            cmd.Parameters.AddWithValue("bank", (object?)body.BankName ?? DBNull.Value);
            return (await ReadOneAsync(cmd, ct), null);
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            return (null, "Legal entity code already exists");
        }
    }

    public Task<List<Dictionary<string, object?>>> BranchesAsync(int? legalEntityId, CancellationToken ct) =>
        legalEntityId is > 0
            ? QueryAsync("SELECT * FROM branches WHERE legal_entity_id = @eid ORDER BY name", ct, ("eid", legalEntityId.Value))
            : QueryAsync("SELECT * FROM branches ORDER BY name", ct);

    public async Task<(Dictionary<string, object?>? Row, string? Error)> CreateBranchAsync(BranchCreateRequest body, CancellationToken ct)
    {
        if (body.LegalEntityId <= 0 || string.IsNullOrWhiteSpace(body.Code) || string.IsNullOrWhiteSpace(body.Name))
            return (null, "legalEntityId, code and name required");
        await using var conn = await OpenAsync(ct);
        try
        {
            await using var cmd = new NpgsqlCommand(
                """
                INSERT INTO branches (legal_entity_id, code, name, emirate, is_remote)
                VALUES (@eid, @code, @name, @emirate, @remote)
                RETURNING *
                """, conn);
            cmd.Parameters.AddWithValue("eid", body.LegalEntityId);
            cmd.Parameters.AddWithValue("code", body.Code.Trim().ToUpperInvariant());
            cmd.Parameters.AddWithValue("name", body.Name.Trim());
            cmd.Parameters.AddWithValue("emirate", (object?)body.Emirate ?? DBNull.Value);
            cmd.Parameters.AddWithValue("remote", body.IsRemote);
            return (await ReadOneAsync(cmd, ct), null);
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            return (null, "Branch code already exists for this entity");
        }
    }

    public Task<List<Dictionary<string, object?>>> PositionsAsync(int? legalEntityId, string? status, CancellationToken ct)
    {
        var sql = """
            SELECT p.*,
                   le.name AS legal_entity_name,
                   b.name AS branch_name,
                   d.name AS department_name,
                   dg.name AS designation_name,
                   e.id AS occupant_employee_id,
                   e.full_name AS occupant_name,
                   e.emp_code AS occupant_emp_code
            FROM positions p
            LEFT JOIN legal_entities le ON le.id = p.legal_entity_id
            LEFT JOIN branches b ON b.id = p.branch_id
            LEFT JOIN departments d ON d.id = p.department_id
            LEFT JOIN designations dg ON dg.id = p.designation_id
            LEFT JOIN position_assignments pa
              ON pa.position_id = p.id AND pa.is_primary = TRUE AND pa.effective_to IS NULL
            LEFT JOIN employees e ON e.id = pa.employee_id
            WHERE 1=1
            """;
        var args = new List<(string, object?)>();
        if (legalEntityId is > 0)
        {
            sql += " AND p.legal_entity_id = @eid";
            args.Add(("eid", legalEntityId.Value));
        }
        if (!string.IsNullOrWhiteSpace(status))
        {
            sql += " AND p.status = @status";
            args.Add(("status", status.Trim()));
        }
        sql += " ORDER BY p.code";
        return QueryAsync(sql, ct, args.ToArray());
    }

    public async Task<bool> WouldCreateReportingLoopAsync(int positionId, int? reportsToPositionId, CancellationToken ct)
    {
        if (reportsToPositionId is null or <= 0) return false;
        if (reportsToPositionId == positionId) return true;
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            WITH RECURSIVE chain AS (
              SELECT id, reports_to_position_id, 1 AS depth
              FROM positions WHERE id = @start
              UNION ALL
              SELECT p.id, p.reports_to_position_id, chain.depth + 1
              FROM positions p
              INNER JOIN chain ON p.id = chain.reports_to_position_id
              WHERE chain.depth < 50
            )
            SELECT 1 FROM chain WHERE id = @self LIMIT 1
            """, conn);
        cmd.Parameters.AddWithValue("start", reportsToPositionId.Value);
        cmd.Parameters.AddWithValue("self", positionId);
        var result = await cmd.ExecuteScalarAsync(ct);
        return result is not null && result is not DBNull;
    }

    public async Task<(Dictionary<string, object?>? Row, string? Error)> CreatePositionAsync(PositionCreateRequest body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Code) || string.IsNullOrWhiteSpace(body.Title) || body.LegalEntityId <= 0)
            return (null, "code, title and legalEntityId required");
        if (body.ReportsToPositionId is > 0)
        {
            // temp id 0 — loop check only after insert for self; for create check ancestor of reportsTo isn't circular via new node later
        }
        var status = string.IsNullOrWhiteSpace(body.Status) ? "vacant" : body.Status.Trim();
        await using var conn = await OpenAsync(ct);
        try
        {
            await using var cmd = new NpgsqlCommand(
                """
                INSERT INTO positions
                  (code, legal_entity_id, branch_id, department_id, division_id, designation_id,
                   title, reports_to_position_id, budget_min, budget_max, status, effective_from)
                VALUES
                  (@code, @eid, @bid, @did, @divid, @desig, @title, @reports, @bmin, @bmax, @status, COALESCE(@from::date, CURRENT_DATE))
                RETURNING *
                """, conn);
            cmd.Parameters.AddWithValue("code", body.Code.Trim().ToUpperInvariant());
            cmd.Parameters.AddWithValue("eid", body.LegalEntityId);
            cmd.Parameters.AddWithValue("bid", (object?)body.BranchId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("did", (object?)body.DepartmentId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("divid", (object?)body.DivisionId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("desig", (object?)body.DesignationId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("title", body.Title.Trim());
            cmd.Parameters.AddWithValue("reports", (object?)body.ReportsToPositionId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("bmin", (object?)body.BudgetMin ?? DBNull.Value);
            cmd.Parameters.AddWithValue("bmax", (object?)body.BudgetMax ?? DBNull.Value);
            cmd.Parameters.AddWithValue("status", status);
            cmd.Parameters.AddWithValue("from", (object?)body.EffectiveFrom ?? DBNull.Value);
            var row = await ReadOneAsync(cmd, ct);
            if (row is not null && body.ReportsToPositionId is > 0)
            {
                var id = Convert.ToInt32(row["id"]);
                if (await WouldCreateReportingLoopAsync(id, body.ReportsToPositionId, ct))
                {
                    await using var del = new NpgsqlCommand("DELETE FROM positions WHERE id = @id", conn);
                    del.Parameters.AddWithValue("id", id);
                    await del.ExecuteNonQueryAsync(ct);
                    return (null, "Reporting line would create a loop");
                }
            }
            return (row, null);
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            return (null, "Position code already exists");
        }
    }

    public async Task<(Dictionary<string, object?>? Row, string? Error)> UpdatePositionAsync(int id, PositionUpdateRequest body, CancellationToken ct)
    {
        if (body.ReportsToPositionId is > 0 && await WouldCreateReportingLoopAsync(id, body.ReportsToPositionId, ct))
            return (null, "Reporting line would create a loop");

        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            UPDATE positions SET
              title = COALESCE(@title, title),
              branch_id = COALESCE(@bid, branch_id),
              department_id = COALESCE(@did, department_id),
              division_id = COALESCE(@divid, division_id),
              designation_id = COALESCE(@desig, designation_id),
              reports_to_position_id = CASE WHEN @reports_set THEN @reports ELSE reports_to_position_id END,
              budget_min = COALESCE(@bmin, budget_min),
              budget_max = COALESCE(@bmax, budget_max),
              status = COALESCE(@status, status),
              effective_to = COALESCE(@eto::date, effective_to)
            WHERE id = @id
            RETURNING *
            """, conn);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("title", (object?)body.Title?.Trim() ?? DBNull.Value);
        cmd.Parameters.AddWithValue("bid", (object?)body.BranchId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("did", (object?)body.DepartmentId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("divid", (object?)body.DivisionId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("desig", (object?)body.DesignationId ?? DBNull.Value);
        var reportsSet = body.ReportsToPositionId.HasValue;
        cmd.Parameters.AddWithValue("reports_set", reportsSet);
        cmd.Parameters.AddWithValue("reports", body.ReportsToPositionId is > 0 ? body.ReportsToPositionId.Value : DBNull.Value);
        cmd.Parameters.AddWithValue("bmin", (object?)body.BudgetMin ?? DBNull.Value);
        cmd.Parameters.AddWithValue("bmax", (object?)body.BudgetMax ?? DBNull.Value);
        cmd.Parameters.AddWithValue("status", (object?)body.Status ?? DBNull.Value);
        cmd.Parameters.AddWithValue("eto", (object?)body.EffectiveTo ?? DBNull.Value);
        var row = await ReadOneAsync(cmd, ct);
        return row is null ? (null, "Position not found") : (row, null);
    }

    public async Task<(Dictionary<string, object?>? Row, string? Error)> CreateAssignmentAsync(AssignmentCreateRequest body, CancellationToken ct)
    {
        if (body.PositionId <= 0 || body.EmployeeId <= 0)
            return (null, "positionId and employeeId required");
        var type = string.IsNullOrWhiteSpace(body.AssignmentType) ? "primary" : body.AssignmentType.Trim();
        await using var conn = await OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        try
        {
            if (body.IsPrimary)
            {
                await using var close = new NpgsqlCommand(
                    """
                    UPDATE position_assignments
                    SET effective_to = CURRENT_DATE
                    WHERE employee_id = @eid AND is_primary = TRUE AND effective_to IS NULL
                    """, conn, (NpgsqlTransaction)tx);
                close.Parameters.AddWithValue("eid", body.EmployeeId);
                await close.ExecuteNonQueryAsync(ct);

                await using var closePos = new NpgsqlCommand(
                    """
                    UPDATE position_assignments
                    SET effective_to = CURRENT_DATE
                    WHERE position_id = @pid AND is_primary = TRUE AND effective_to IS NULL
                    """, conn, (NpgsqlTransaction)tx);
                closePos.Parameters.AddWithValue("pid", body.PositionId);
                await closePos.ExecuteNonQueryAsync(ct);
            }

            await using var cmd = new NpgsqlCommand(
                """
                INSERT INTO position_assignments
                  (position_id, employee_id, assignment_type, is_primary, effective_from, temporary_manager_employee_id, notes)
                VALUES
                  (@pid, @eid, @type, @primary, COALESCE(@from::date, CURRENT_DATE), @tmp, @notes)
                RETURNING *
                """, conn, (NpgsqlTransaction)tx);
            cmd.Parameters.AddWithValue("pid", body.PositionId);
            cmd.Parameters.AddWithValue("eid", body.EmployeeId);
            cmd.Parameters.AddWithValue("type", type);
            cmd.Parameters.AddWithValue("primary", body.IsPrimary);
            cmd.Parameters.AddWithValue("from", (object?)body.EffectiveFrom ?? DBNull.Value);
            cmd.Parameters.AddWithValue("tmp", (object?)body.TemporaryManagerEmployeeId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("notes", (object?)body.Notes ?? DBNull.Value);
            var row = await ReadOneAsync(cmd, ct);

            await using var occ = new NpgsqlCommand(
                """
                UPDATE positions SET status = 'occupied'
                WHERE id = @pid AND status <> 'frozen'
                """, conn, (NpgsqlTransaction)tx);
            occ.Parameters.AddWithValue("pid", body.PositionId);
            await occ.ExecuteNonQueryAsync(ct);

            // Sync legacy manager_id from reporting position incumbent
            await using var sync = new NpgsqlCommand(
                """
                UPDATE employees e
                SET manager_id = rm.manager_employee_id
                FROM v_employee_reporting_manager rm
                WHERE e.id = @eid AND rm.employee_id = @eid
                """, conn, (NpgsqlTransaction)tx);
            sync.Parameters.AddWithValue("eid", body.EmployeeId);
            await sync.ExecuteNonQueryAsync(ct);

            await tx.CommitAsync(ct);
            return (row, null);
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }

    public Task<List<Dictionary<string, object?>>> PositionChartAsync(CancellationToken ct) =>
        QueryAsync(
            """
            SELECT p.id,
                   p.code,
                   p.title AS job_title,
                   p.reports_to_position_id AS manager_id,
                   p.status,
                   d.name AS department_name,
                   le.name AS legal_entity_name,
                   e.id AS employee_id,
                   e.full_name,
                   e.emp_code,
                   CASE WHEN e.id IS NULL THEN TRUE ELSE FALSE END AS is_vacant
            FROM positions p
            LEFT JOIN departments d ON d.id = p.department_id
            LEFT JOIN legal_entities le ON le.id = p.legal_entity_id
            LEFT JOIN position_assignments pa
              ON pa.position_id = p.id AND pa.is_primary = TRUE AND pa.effective_to IS NULL
            LEFT JOIN employees e ON e.id = pa.employee_id
            WHERE p.status <> 'frozen'
              AND (p.effective_to IS NULL OR p.effective_to >= CURRENT_DATE)
            ORDER BY p.code
            """, ct);

    public Task<List<Dictionary<string, object?>>> HeadcountAsync(CancellationToken ct) =>
        QueryAsync(
            """
            SELECT
              le.id AS legal_entity_id,
              le.name AS legal_entity_name,
              d.id AS department_id,
              d.name AS department_name,
              COUNT(*) FILTER (WHERE p.status IN ('approved','vacant','occupied','frozen')) AS approved,
              COUNT(*) FILTER (WHERE p.status = 'occupied'
                OR EXISTS (
                  SELECT 1 FROM position_assignments pa
                  WHERE pa.position_id = p.id AND pa.effective_to IS NULL
                )) AS occupied,
              COUNT(*) FILTER (WHERE p.status = 'vacant'
                AND NOT EXISTS (
                  SELECT 1 FROM position_assignments pa
                  WHERE pa.position_id = p.id AND pa.effective_to IS NULL
                )) AS vacant,
              COUNT(*) FILTER (WHERE p.status = 'frozen') AS frozen
            FROM positions p
            LEFT JOIN legal_entities le ON le.id = p.legal_entity_id
            LEFT JOIN departments d ON d.id = p.department_id
            GROUP BY le.id, le.name, d.id, d.name
            ORDER BY le.name NULLS LAST, d.name NULLS LAST
            """, ct);
}
