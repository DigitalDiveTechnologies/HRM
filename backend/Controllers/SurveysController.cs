using System.Data.Common;
using System.Text.Json;
using DigitalDive.Hr.Api.Data;
using DigitalDive.Hr.Api.Helpers;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Surveys")]
[Route("api/surveys")]
[Authorize]
public sealed class SurveysController : ControllerBase
{
    private readonly Db _db;
    private readonly RbacService _rbac;
    private readonly ILogger<SurveysController> _logger;

    public SurveysController(Db db, RbacService rbac, ILogger<SurveysController> logger)
    {
        _db = db;
        _rbac = rbac;
        _logger = logger;
    }

    private async Task<bool> IsAdminOrManagerAsync(CancellationToken ct)
    {
        var role = CurrentUser.Role(User);
        if (string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase)
            || string.Equals(role, "super_admin", StringComparison.OrdinalIgnoreCase)
            || string.Equals(role, "manager", StringComparison.OrdinalIgnoreCase))
            return true;

        var perms = await _rbac.GetPermissionCodesForRoleAsync(role, ct);
        return perms.Any(p => string.Equals(p, "surveys.manage", StringComparison.OrdinalIgnoreCase)
                              || string.Equals(p, "dashboard.view", StringComparison.OrdinalIgnoreCase));
    }

    private async Task<(int? EmployeeId, int? DepartmentId)> ResolveCallerContextAsync(NpgsqlConnection conn, CancellationToken ct)
    {
        var empId = CurrentUser.EmployeeId(User);
        var email = CurrentUser.Email(User);

        if (empId is > 0)
        {
            await using var cmd = new NpgsqlCommand("SELECT id, department_id FROM employees WHERE id = @id;", conn);
            cmd.Parameters.AddWithValue("id", empId.Value);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                return (
                    reader.GetInt32(0),
                    reader.IsDBNull(1) ? null : reader.GetInt32(1)
                );
            }
        }

        if (!string.IsNullOrWhiteSpace(email))
        {
            await using var cmd = new NpgsqlCommand("SELECT id, department_id FROM employees WHERE LOWER(email) = LOWER(@email) LIMIT 1;", conn);
            cmd.Parameters.AddWithValue("email", email);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                return (
                    reader.GetInt32(0),
                    reader.IsDBNull(1) ? null : reader.GetInt32(1)
                );
            }
        }

        return (null, null);
    }

    // ==========================================
    // SURVEYS LIST & DETAILS
    // ==========================================

    [HttpGet]
    public async Task<IActionResult> ListSurveys(CancellationToken ct)
    {
        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);
        var callerContext = await ResolveCallerContextAsync(conn, ct);
        var currentEmpId = callerContext.EmployeeId ?? -1;
        var list = new List<WellbeingSurveyDto>();

        await using var cmd = new NpgsqlCommand(
            """
            SELECT s.id, s.title, s.description, s.is_anonymous, s.is_active, s.questions_json::text, s.created_at,
                   (SELECT COUNT(*) FROM wellbeing_survey_responses r WHERE r.survey_id = s.id) AS response_count,
                   EXISTS (SELECT 1 FROM wellbeing_survey_responses r WHERE r.survey_id = s.id AND r.employee_id = @empId) AS has_responded
            FROM wellbeing_surveys s
            ORDER BY s.created_at DESC;
            """,
            conn);
        cmd.Parameters.AddWithValue("empId", currentEmpId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var rawJson = reader.GetString(5);
            var questions = new List<SurveyQuestionItem>();
            try
            {
                questions = JsonSerializer.Deserialize<List<SurveyQuestionItem>>(rawJson,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
            }
            catch { }

            list.Add(new WellbeingSurveyDto
            {
                Id = reader.GetInt32(0),
                Title = reader.GetString(1),
                Description = reader.IsDBNull(2) ? null : reader.GetString(2),
                IsAnonymous = reader.GetBoolean(3),
                IsActive = reader.GetBoolean(4),
                Questions = questions,
                CreatedAt = reader.GetDateTime(6),
                ResponseCount = (int)reader.GetInt64(7),
                HasResponded = reader.GetBoolean(8)
            });
        }

        return Ok(list);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetSurvey(int id, CancellationToken ct)
    {
        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);
        var callerContext = await ResolveCallerContextAsync(conn, ct);
        var currentEmpId = callerContext.EmployeeId ?? -1;

        await using var cmd = new NpgsqlCommand(
            """
            SELECT s.id, s.title, s.description, s.is_anonymous, s.is_active, s.questions_json::text, s.created_at,
                   (SELECT COUNT(*) FROM wellbeing_survey_responses r WHERE r.survey_id = s.id) AS response_count,
                   EXISTS (SELECT 1 FROM wellbeing_survey_responses r WHERE r.survey_id = s.id AND r.employee_id = @empId) AS has_responded
            FROM wellbeing_surveys s
            WHERE s.id = @id;
            """,
            conn);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("empId", currentEmpId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
            return NotFound(new { error = "Survey not found" });

        var rawJson = reader.GetString(5);
        var questions = new List<SurveyQuestionItem>();
        try
        {
            questions = JsonSerializer.Deserialize<List<SurveyQuestionItem>>(rawJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
        }
        catch { }

        return Ok(new WellbeingSurveyDto
        {
            Id = reader.GetInt32(0),
            Title = reader.GetString(1),
            Description = reader.IsDBNull(2) ? null : reader.GetString(2),
            IsAnonymous = reader.GetBoolean(3),
            IsActive = reader.GetBoolean(4),
            Questions = questions,
            CreatedAt = reader.GetDateTime(6),
            ResponseCount = (int)reader.GetInt64(7),
            HasResponded = reader.GetBoolean(8)
        });
    }

    [HttpPost]
    public async Task<IActionResult> CreateSurvey([FromBody] CreateSurveyRequest request, CancellationToken ct)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Title))
            return BadRequest(new { error = "Survey title is required." });

        if (!await IsAdminOrManagerAsync(ct))
            return Forbid();

        var questionsJson = JsonSerializer.Serialize(request.Questions ?? new List<SurveyQuestionItem>());

        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);
        int surveyId;
        DateTime createdAt;

        await using (var cmd = new NpgsqlCommand(
            """
            INSERT INTO wellbeing_surveys (title, description, is_anonymous, is_active, questions_json, created_at)
            VALUES (@title, @desc, @anon, true, @q::jsonb, CURRENT_TIMESTAMP)
            RETURNING id, created_at;
            """,
            conn))
        {
            cmd.Parameters.AddWithValue("title", request.Title.Trim());
            cmd.Parameters.AddWithValue("desc", (object?)request.Description?.Trim() ?? DBNull.Value);
            cmd.Parameters.AddWithValue("anon", request.IsAnonymous);
            cmd.Parameters.AddWithValue("q", questionsJson);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct))
                return StatusCode(500, new { error = "Failed to create survey" });

            surveyId = reader.GetInt32(0);
            createdAt = reader.GetDateTime(1);
        }

        return Ok(new
        {
            id = surveyId,
            title = request.Title.Trim(),
            is_anonymous = request.IsAnonymous,
            created_at = createdAt,
            message = "Survey created successfully"
        });
    }

    // ==========================================
    // ANONYMOUS RESPONSE SUBMISSION (TASK 4.4)
    // ==========================================

    [HttpPost("{id:int}/respond")]
    public async Task<IActionResult> SubmitResponse(int id, [FromBody] SubmitSurveyResponseRequest request, CancellationToken ct)
    {
        if (request == null)
            return BadRequest(new { error = "Invalid response body." });

        if (request.NpsScore is < 0 or > 10)
            return BadRequest(new { error = "eNPS score must be between 0 and 10." });

        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);

        // Verify survey is active
        await using (var checkCmd = new NpgsqlCommand("SELECT is_active, is_anonymous FROM wellbeing_surveys WHERE id = @id;", conn))
        {
            checkCmd.Parameters.AddWithValue("id", id);
            await using var cr = await checkCmd.ExecuteReaderAsync(ct);
            if (!await cr.ReadAsync(ct))
                return NotFound(new { error = "Survey not found" });

            if (!cr.GetBoolean(0))
                return BadRequest(new { error = "This survey is currently closed." });
        }

        var callerContext = await ResolveCallerContextAsync(conn, ct);
        var inferredDeptId = callerContext.DepartmentId;
        var finalDeptId = request.DepartmentId ?? inferredDeptId;
        var answersJson = JsonSerializer.Serialize(request.Answers ?? new Dictionary<string, object>());

        if (callerContext.EmployeeId.HasValue)
        {
            await using var dupCmd = new NpgsqlCommand(
                "SELECT 1 FROM wellbeing_survey_responses WHERE survey_id = @sid AND employee_id = @empid LIMIT 1;", conn);
            dupCmd.Parameters.AddWithValue("sid", id);
            dupCmd.Parameters.AddWithValue("empid", callerContext.EmployeeId.Value);
            var exists = await dupCmd.ExecuteScalarAsync(ct);
            if (exists != null)
            {
                return BadRequest(new { error = "You have already completed this survey. Thank you for your feedback!" });
            }
        }

        await using (var insCmd = new NpgsqlCommand(
            """
            INSERT INTO wellbeing_survey_responses (survey_id, employee_id, department_id, nps_score, answers_json, feedback_text, submitted_at)
            VALUES (@sid, @empid, @did, @nps, @ans::jsonb, @fb, CURRENT_TIMESTAMP);
            """,
            conn))
        {
            insCmd.Parameters.AddWithValue("sid", id);
            insCmd.Parameters.AddWithValue("empid", (object?)callerContext.EmployeeId ?? DBNull.Value);
            insCmd.Parameters.AddWithValue("did", (object?)finalDeptId ?? DBNull.Value);
            insCmd.Parameters.AddWithValue("nps", (object?)request.NpsScore ?? DBNull.Value);
            insCmd.Parameters.AddWithValue("ans", answersJson);
            insCmd.Parameters.AddWithValue("fb", (object?)request.FeedbackText?.Trim() ?? DBNull.Value);

            await insCmd.ExecuteNonQueryAsync(ct);
        }

        return Ok(new
        {
            survey_id = id,
            submitted = true,
            message = "Thank you! Your feedback has been recorded anonymously."
        });
    }

    // ==========================================
    // SENTIMENT & eNPS ANALYTICS (TASK 4.5)
    // ==========================================

    [HttpGet("{id:int}/analytics")]
    public async Task<IActionResult> GetAnalytics(int id, CancellationToken ct)
    {
        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);

        string surveyTitle;
        await using (var sCmd = new NpgsqlCommand("SELECT title FROM wellbeing_surveys WHERE id = @id;", conn))
        {
            sCmd.Parameters.AddWithValue("id", id);
            var titleObj = await sCmd.ExecuteScalarAsync(ct);
            if (titleObj == null)
                return NotFound(new { error = "Survey not found" });
            surveyTitle = titleObj.ToString() ?? "Survey";
        }

        int totalResponses = 0;
        int promoters = 0;  // 9-10
        int passives = 0;   // 7-8
        int detractors = 0; // 0-6
        var scoreDistribution = Enumerable.Range(0, 11).ToDictionary(s => s, _ => 0);
        var feedbackQuotes = new List<string>();

        await using (var rCmd = new NpgsqlCommand(
            """
            SELECT nps_score, feedback_text
            FROM wellbeing_survey_responses
            WHERE survey_id = @id;
            """,
            conn))
        {
            rCmd.Parameters.AddWithValue("id", id);
            await using var reader = await rCmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                totalResponses++;
                if (!reader.IsDBNull(0))
                {
                    var score = reader.GetInt32(0);
                    if (score >= 0 && score <= 10)
                    {
                        scoreDistribution[score]++;
                        if (score >= 9) promoters++;
                        else if (score >= 7) passives++;
                        else detractors++;
                    }
                }

                if (!reader.IsDBNull(1))
                {
                    var fb = reader.GetString(1).Trim();
                    if (!string.IsNullOrWhiteSpace(fb))
                    {
                        feedbackQuotes.Add(fb);
                    }
                }
            }
        }

        // eNPS = % Promoters - % Detractors
        var enpsScore = 0;
        double promoterPct = 0;
        double passivePct = 0;
        double detractorPct = 0;

        if (totalResponses > 0)
        {
            promoterPct = Math.Round(((double)promoters / totalResponses) * 100, 1);
            passivePct = Math.Round(((double)passives / totalResponses) * 100, 1);
            detractorPct = Math.Round(((double)detractors / totalResponses) * 100, 1);
            enpsScore = (int)Math.Round(promoterPct - detractorPct);
        }

        // Departmental Breakdown
        var deptBreakdowns = new List<DepartmentSentimentDto>();
        await using (var dCmd = new NpgsqlCommand(
            """
            SELECT COALESCE(d.name, 'Unassigned / General') AS dept_name,
                   COUNT(r.id) AS resp_count,
                   AVG(r.nps_score) AS avg_score,
                   COUNT(CASE WHEN r.nps_score >= 9 THEN 1 END) AS prom_cnt,
                   COUNT(CASE WHEN r.nps_score >= 7 AND r.nps_score <= 8 THEN 1 END) AS pass_cnt,
                   COUNT(CASE WHEN r.nps_score <= 6 THEN 1 END) AS det_cnt
            FROM wellbeing_survey_responses r
            LEFT JOIN departments d ON d.id = r.department_id
            WHERE r.survey_id = @id
            GROUP BY COALESCE(d.name, 'Unassigned / General')
            ORDER BY resp_count DESC;
            """,
            conn))
        {
            dCmd.Parameters.AddWithValue("id", id);
            await using var dReader = await dCmd.ExecuteReaderAsync(ct);
            while (await dReader.ReadAsync(ct))
            {
                var rCount = (int)dReader.GetInt64(1);
                var avg = dReader.IsDBNull(2) ? 0.0 : Math.Round(Convert.ToDouble(dReader.GetValue(2)), 1);
                var dProm = (int)dReader.GetInt64(3);
                var dPass = (int)dReader.GetInt64(4);
                var dDet = (int)dReader.GetInt64(5);

                var dEnps = rCount > 0 ? (int)Math.Round((((double)dProm - dDet) / rCount) * 100) : 0;

                deptBreakdowns.Add(new DepartmentSentimentDto
                {
                    DepartmentName = dReader.GetString(0),
                    ResponseCount = rCount,
                    AverageScore = avg,
                    Promoters = dProm,
                    Passives = dPass,
                    Detractors = dDet,
                    Enps = dEnps
                });
            }
        }

        return Ok(new
        {
            survey_id = id,
            survey_title = surveyTitle,
            total_responses = totalResponses,
            enps_score = enpsScore,
            promoters_count = promoters,
            promoters_percentage = promoterPct,
            passives_count = passives,
            passives_percentage = passivePct,
            detractors_count = detractors,
            detractors_percentage = detractorPct,
            score_distribution = scoreDistribution.Select(kv => new { score = kv.Key, count = kv.Value }),
            department_breakdown = deptBreakdowns,
            feedback_quotes = feedbackQuotes.Take(50)
        });
    }

    [HttpGet("{id:int}/responses")]
    public async Task<IActionResult> GetSurveyResponses(int id, CancellationToken ct)
    {
        if (!await IsAdminOrManagerAsync(ct))
            return Forbid();

        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);

        bool isAnonymous = true;
        string surveyTitle = "Survey";
        await using (var sCmd = new NpgsqlCommand("SELECT title, is_anonymous FROM wellbeing_surveys WHERE id = @id;", conn))
        {
            sCmd.Parameters.AddWithValue("id", id);
            await using var sReader = await sCmd.ExecuteReaderAsync(ct);
            if (!await sReader.ReadAsync(ct))
                return NotFound(new { error = "Survey not found" });
            surveyTitle = sReader.GetString(0);
            isAnonymous = sReader.GetBoolean(1);
        }

        var responses = new List<object>();
        await using (var cmd = new NpgsqlCommand(
            """
            SELECT r.id, r.submitted_at, r.nps_score, r.feedback_text, r.answers_json::text,
                   COALESCE(d.name, 'General Organization') AS department_name,
                   e.full_name, e.emp_code
            FROM wellbeing_survey_responses r
            LEFT JOIN departments d ON d.id = r.department_id
            LEFT JOIN employees e ON e.id = r.employee_id
            WHERE r.survey_id = @id
            ORDER BY r.submitted_at DESC;
            """,
            conn))
        {
            cmd.Parameters.AddWithValue("id", id);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var rid = reader.GetInt32(0);
                var subAt = reader.GetDateTime(1);
                var nps = reader.IsDBNull(2) ? (int?)null : reader.GetInt32(2);
                var fb = reader.IsDBNull(3) ? null : reader.GetString(3);
                var ansRaw = reader.GetString(4);
                var dept = reader.GetString(5);

                string respondentName;
                string respondentCode;

                if (isAnonymous)
                {
                    respondentName = "🔒 Anonymous Employee";
                    respondentCode = "CONFIDENTIAL";
                }
                else
                {
                    var fn = reader.IsDBNull(6) ? "Employee" : reader.GetString(6);
                    var ec = reader.IsDBNull(7) ? "EMP" : reader.GetString(7);
                    respondentName = string.IsNullOrWhiteSpace(fn) ? "Employee" : fn.Trim();
                    respondentCode = ec;
                }

                object? answers = null;
                try
                {
                    answers = JsonSerializer.Deserialize<Dictionary<string, object>>(ansRaw);
                }
                catch { }

                responses.Add(new
                {
                    id = rid,
                    submitted_at = subAt,
                    nps_score = nps,
                    feedback_text = fb,
                    department_name = dept,
                    respondent_name = respondentName,
                    respondent_code = respondentCode,
                    is_anonymous = isAnonymous,
                    answers = answers
                });
            }
        }

        return Ok(new
        {
            survey_id = id,
            survey_title = surveyTitle,
            is_anonymous = isAnonymous,
            total_count = responses.Count,
            responses
        });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteSurvey(int id, CancellationToken ct)
    {
        if (!await IsAdminOrManagerAsync(ct))
            return Forbid();

        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand("DELETE FROM wellbeing_surveys WHERE id = @id;", conn);
        cmd.Parameters.AddWithValue("id", id);
        var rows = await cmd.ExecuteNonQueryAsync(ct);
        if (rows == 0) return NotFound(new { error = "Survey not found" });

        return Ok(new { message = "Survey deleted successfully" });
    }

    // ==========================================
    // Task 5.4: Research-Validated Psychological & Wellbeing Question Sets
    // ==========================================

    [HttpGet("template-questions")]
    public IActionResult GetTemplateQuestionPacks()
    {
        var packs = new[]
        {
            new
            {
                id = "gallup_q12",
                name = "Gallup Q12 Engagement Index",
                category = "Engagement",
                description = "Measures team engagement, clarity of expectations, tools, and recognition.",
                questions = new[]
                {
                    new { id = "q1", type = "rating", question = "I know what is expected of me at work." },
                    new { id = "q2", type = "rating", question = "I have the materials and equipment I need to do my work right." },
                    new { id = "q3", type = "rating", question = "At work, I have the opportunity to do what I do best every day." },
                    new { id = "q4", type = "rating", question = "In the last seven days, I have received recognition or praise for doing good work." },
                    new { id = "q5", type = "rating", question = "My supervisor, or someone at work, seems to care about me as a person." },
                    new { id = "q6", type = "rating", question = "There is someone at work who encourages my development." },
                    new { id = "q7", type = "rating", question = "At work, my opinions seem to count." },
                    new { id = "q8", type = "rating", question = "The mission or purpose of our company makes me feel my job is important." },
                    new { id = "q9", type = "rating", question = "My colleagues and teammates are committed to doing quality work." },
                    new { id = "q10", type = "rating", question = "I have a trusted peer or best friend at work." },
                    new { id = "q11", type = "rating", question = "In the last six months, someone has talked to me about my progress." },
                    new { id = "q12", type = "rating", question = "This past year, I have had opportunities to learn and grow professionally." }
                }
            },
            new
            {
                id = "uae_wellbeing",
                name = "UAE National Wellbeing Framework",
                category = "Wellbeing & Quality of Life",
                description = "Aligned with UAE National Quality of Life Strategy covering mental health, balance & trust.",
                questions = new[]
                {
                    new { id = "w1", type = "rating", question = "I feel supported by leadership in balancing work demands with my personal and family life." },
                    new { id = "w2", type = "rating", question = "The physical and emotional workplace environment actively promotes positive wellbeing." },
                    new { id = "w3", type = "rating", question = "I have high trust and confidence in the integrity and vision of our executive leaders." },
                    new { id = "w4", type = "rating", question = "Workplace safety, health standards, and ergonomics meet or exceed regional expectations." },
                    new { id = "w5", type = "rating", question = "I feel a profound sense of pride and community purpose in the work our organization delivers." },
                    new { id = "w6", type = "text", question = "What specific wellness or flexible workplace initiative would make the greatest impact for you?" }
                }
            },
            new
            {
                id = "burnout_sentiment",
                name = "Burnout & Workload Sentiment",
                category = "Workload & Resilience",
                description = "Evaluates cognitive load, deadline pressure, and recovery time to protect sustainable performance.",
                questions = new[]
                {
                    new { id = "b1", type = "rating", question = "My daily workload and project targets are realistic and manageable within standard hours." },
                    new { id = "b2", type = "rating", question = "I rarely experience emotional fatigue or physical exhaustion at the end of the workday." },
                    new { id = "b3", type = "rating", question = "I have adequate time during weekends and annual leave to completely disconnect and recharge." },
                    new { id = "b4", type = "rating", question = "Unrealistic turnaround times or conflicting managerial requests are rare in my team." },
                    new { id = "b5", type = "text", question = "What operational bottlenecks or recurring tasks currently pose the largest stress for you?" }
                }
            }
        };

        return Ok(packs);
    }
}

// -------------------------------------------------------------
// DTOs & Models for SurveysController
// -------------------------------------------------------------

public sealed class WellbeingSurveyDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsAnonymous { get; set; }
    public bool IsActive { get; set; }
    public List<SurveyQuestionItem> Questions { get; set; } = new();
    public DateTime CreatedAt { get; set; }
    public int ResponseCount { get; set; }
    public bool HasResponded { get; set; }
}

public sealed class SurveyQuestionItem
{
    public string Id { get; set; } = string.Empty;
    public string Type { get; set; } = "rating"; // 'nps', 'rating', 'text'
    public string Question { get; set; } = string.Empty;
}

public sealed class CreateSurveyRequest
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsAnonymous { get; set; } = true;
    public List<SurveyQuestionItem>? Questions { get; set; }
}

public sealed class SubmitSurveyResponseRequest
{
    public int? NpsScore { get; set; }
    public Dictionary<string, object>? Answers { get; set; }
    public string? FeedbackText { get; set; }
    public int? DepartmentId { get; set; }
}

public sealed class DepartmentSentimentDto
{
    public string DepartmentName { get; set; } = string.Empty;
    public int ResponseCount { get; set; }
    public double AverageScore { get; set; }
    public int Promoters { get; set; }
    public int Passives { get; set; }
    public int Detractors { get; set; }
    public int Enps { get; set; }
}
