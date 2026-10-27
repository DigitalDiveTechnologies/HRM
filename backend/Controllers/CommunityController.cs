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
[ApiExplorerSettings(GroupName = "Community")]
[Route("api/community")]
[Authorize]
public sealed class CommunityController : ControllerBase
{
    private readonly Db _db;
    private readonly RbacService _rbac;
    private readonly ILogger<CommunityController> _logger;
    private readonly IWebHostEnvironment _env;

    public CommunityController(Db db, RbacService rbac, ILogger<CommunityController> logger, IWebHostEnvironment env)
    {
        _db = db;
        _rbac = rbac;
        _logger = logger;
        _env = env;
    }

    private async Task<int> ResolveEmployeeIdAsync(NpgsqlConnection conn, CancellationToken ct)
    {
        var empId = CurrentUser.EmployeeId(User);
        if (empId is > 0) return empId.Value;

        var email = CurrentUser.Email(User);
        if (!string.IsNullOrWhiteSpace(email))
        {
            await using var cmd = new NpgsqlCommand(
                "SELECT id FROM employees WHERE LOWER(email) = LOWER(@email) LIMIT 1", conn);
            cmd.Parameters.AddWithValue("email", email);
            var found = await cmd.ExecuteScalarAsync(ct);
            if (found is int id) return id;
            if (found is long l) return (int)l;
        }

        await using var fallbackCmd = new NpgsqlCommand(
            "SELECT id FROM employees ORDER BY id ASC LIMIT 1", conn);
        var firstId = await fallbackCmd.ExecuteScalarAsync(ct);
        if (firstId is int fid) return fid;
        if (firstId is long fl) return (int)fl;

        return 1;
    }

    private async Task<bool> IsAdminOrManagerAsync(CancellationToken ct)
    {
        var role = CurrentUser.Role(User);
        if (string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase)
            || string.Equals(role, "super_admin", StringComparison.OrdinalIgnoreCase)
            || string.Equals(role, "manager", StringComparison.OrdinalIgnoreCase))
            return true;

        var perms = await _rbac.GetPermissionCodesForRoleAsync(role, ct);
        return perms.Any(p => string.Equals(p, "community.manage", StringComparison.OrdinalIgnoreCase)
                              || string.Equals(p, "dashboard.view", StringComparison.OrdinalIgnoreCase));
    }

    // ==========================================
    // Task 5.5: Direct Social Post Binary Image Upload
    // ==========================================

    [HttpPost("upload")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> UploadImage(IFormFile? file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "No image file provided" });

        if (file.Length > 10 * 1024 * 1024)
            return BadRequest(new { error = "Image exceeds maximum allowed size (10MB)" });

        var allowedMimes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "image/jpeg", "image/png", "image/webp", "image/gif"
        };

        if (string.IsNullOrWhiteSpace(file.ContentType) || !allowedMimes.Contains(file.ContentType))
            return BadRequest(new { error = "Invalid image type. Supported formats: JPEG, PNG, WebP, GIF." });

        var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        var uploadsDir = Path.Combine(webRoot, "uploads", "community");
        Directory.CreateDirectory(uploadsDir);

        var ext = Path.GetExtension(file.FileName);
        if (string.IsNullOrWhiteSpace(ext)) ext = ".jpg";
        var safeName = $"{Guid.NewGuid():N}{ext}";
        var filePath = Path.Combine(uploadsDir, safeName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream, ct);
        }

        var relativeUrl = $"/uploads/community/{safeName}";
        return Ok(new
        {
            url = relativeUrl,
            imageUrl = relativeUrl,
            fileName = file.FileName,
            fileSize = file.Length,
            uploadedAt = DateTime.UtcNow
        });
    }

    // ==========================================
    // 1. SOCIAL COMMUNITY FEED & INTERACTION WALL
    // ==========================================

    [HttpGet("feed")]
    public async Task<IActionResult> GetFeed(CancellationToken ct)
    {
        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);
        var currentEmpId = await ResolveEmployeeIdAsync(conn, ct);

        var posts = new List<CommunityPostDto>();
        var postIds = new List<int>();

        await using (var cmd = new NpgsqlCommand(
            """
            SELECT p.id, p.author_id, p.post_type, p.content, p.image_url, p.likes_count, p.created_at,
                   COALESCE(NULLIF(TRIM(e.full_name), ''), 'Team Member') AS author_name,
                   e.photo_path AS avatar_url,
                   e.job_title,
                   d.name AS department_name,
                   EXISTS(SELECT 1 FROM community_post_likes pl WHERE pl.post_id = p.id AND pl.employee_id = @currentEmpId) AS user_has_liked
            FROM community_posts p
            LEFT JOIN employees e ON e.id = p.author_id
            LEFT JOIN departments d ON d.id = e.department_id
            ORDER BY p.created_at DESC
            LIMIT 50;
            """,
            conn))
        {
            cmd.Parameters.AddWithValue("currentEmpId", currentEmpId);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var pid = reader.GetInt32(0);
                postIds.Add(pid);
                posts.Add(new CommunityPostDto
                {
                    Id = pid,
                    AuthorId = reader.GetInt32(1),
                    PostType = reader.GetString(2),
                    Content = reader.GetString(3),
                    ImageUrl = reader.IsDBNull(4) ? null : reader.GetString(4),
                    LikesCount = reader.GetInt32(5),
                    CreatedAt = reader.GetDateTime(6),
                    AuthorName = reader.GetString(7),
                    AvatarUrl = reader.IsDBNull(8) ? null : reader.GetString(8),
                    JobTitle = reader.IsDBNull(9) ? null : reader.GetString(9),
                    DepartmentName = reader.IsDBNull(10) ? null : reader.GetString(10),
                    UserHasLiked = reader.GetBoolean(11),
                    Comments = new List<CommunityCommentDto>()
                });
            }
        }

        if (postIds.Count > 0)
        {
            await using (var commentCmd = new NpgsqlCommand(
                """
                SELECT c.id, c.post_id, c.employee_id, c.comment_text, c.created_at,
                       COALESCE(NULLIF(TRIM(e.full_name), ''), 'Team Member') AS author_name,
                       e.photo_path AS avatar_url
                FROM community_post_comments c
                LEFT JOIN employees e ON e.id = c.employee_id
                WHERE c.post_id = ANY(@postIds)
                ORDER BY c.created_at ASC;
                """,
                conn))
            {
                commentCmd.Parameters.AddWithValue("postIds", postIds.ToArray());
                await using var cReader = await commentCmd.ExecuteReaderAsync(ct);
                var commentMap = posts.ToDictionary(p => p.Id, p => p.Comments);

                while (await cReader.ReadAsync(ct))
                {
                    var pid = cReader.GetInt32(1);
                    if (commentMap.TryGetValue(pid, out var list))
                    {
                        list.Add(new CommunityCommentDto
                        {
                            Id = cReader.GetInt32(0),
                            PostId = pid,
                            EmployeeId = cReader.GetInt32(2),
                            CommentText = cReader.GetString(3),
                            CreatedAt = cReader.GetDateTime(4),
                            AuthorName = cReader.GetString(5),
                            AvatarUrl = cReader.IsDBNull(6) ? null : cReader.GetString(6)
                        });
                    }
                }
            }
        }

        return Ok(posts);
    }

    [HttpPost("posts")]
    public async Task<IActionResult> CreatePost([FromBody] CreatePostRequest request, CancellationToken ct)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Content))
            return BadRequest(new { error = "Post content cannot be empty." });

        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);
        var authorId = await ResolveEmployeeIdAsync(conn, ct);
        var postType = string.IsNullOrWhiteSpace(request.PostType) ? "general" : request.PostType.Trim().ToLowerInvariant();

        int postId;
        DateTime createdAt;

        await using (var cmd = new NpgsqlCommand(
            """
            INSERT INTO community_posts (author_id, post_type, content, image_url, likes_count, created_at)
            VALUES (@authorId, @postType, @content, @imageUrl, 0, CURRENT_TIMESTAMP)
            RETURNING id, created_at;
            """,
            conn))
        {
            cmd.Parameters.AddWithValue("authorId", authorId);
            cmd.Parameters.AddWithValue("postType", postType);
            cmd.Parameters.AddWithValue("content", request.Content.Trim());
            cmd.Parameters.AddWithValue("imageUrl", (object?)request.ImageUrl?.Trim() ?? DBNull.Value);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct))
                return StatusCode(500, new { error = "Failed to create post" });

            postId = reader.GetInt32(0);
            createdAt = reader.GetDateTime(1);
        }

        return Ok(new
        {
            id = postId,
            author_id = authorId,
            post_type = postType,
            content = request.Content.Trim(),
            image_url = request.ImageUrl?.Trim(),
            likes_count = 0,
            created_at = createdAt,
            message = "Post created successfully"
        });
    }

    [HttpPost("posts/{id:int}/like")]
    public async Task<IActionResult> ToggleLike(int id, CancellationToken ct)
    {
        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);
        var empId = await ResolveEmployeeIdAsync(conn, ct);

        bool liked;
        int newLikesCount;

        await using (var checkCmd = new NpgsqlCommand(
            "SELECT 1 FROM community_post_likes WHERE post_id = @pid AND employee_id = @eid;", conn))
        {
            checkCmd.Parameters.AddWithValue("pid", id);
            checkCmd.Parameters.AddWithValue("eid", empId);
            var exists = await checkCmd.ExecuteScalarAsync(ct);
            liked = exists != null;
        }

        if (liked)
        {
            await using (var delCmd = new NpgsqlCommand(
                """
                DELETE FROM community_post_likes WHERE post_id = @pid AND employee_id = @eid;
                UPDATE community_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = @pid RETURNING likes_count;
                """,
                conn))
            {
                delCmd.Parameters.AddWithValue("pid", id);
                delCmd.Parameters.AddWithValue("eid", empId);
                var res = await delCmd.ExecuteScalarAsync(ct);
                newLikesCount = res is int c ? c : 0;
            }
            liked = false;
        }
        else
        {
            await using (var insCmd = new NpgsqlCommand(
                """
                INSERT INTO community_post_likes (post_id, employee_id) VALUES (@pid, @eid) ON CONFLICT DO NOTHING;
                UPDATE community_posts SET likes_count = likes_count + 1 WHERE id = @pid RETURNING likes_count;
                """,
                conn))
            {
                insCmd.Parameters.AddWithValue("pid", id);
                insCmd.Parameters.AddWithValue("eid", empId);
                var res = await insCmd.ExecuteScalarAsync(ct);
                newLikesCount = res is int c ? c : 1;
            }
            liked = true;
        }

        return Ok(new { liked, likes_count = newLikesCount });
    }

    [HttpPost("posts/{id:int}/comments")]
    public async Task<IActionResult> AddComment(int id, [FromBody] CreateCommentRequest request, CancellationToken ct)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.CommentText))
            return BadRequest(new { error = "Comment text cannot be empty." });

        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);
        var empId = await ResolveEmployeeIdAsync(conn, ct);

        int commentId;
        DateTime createdAt;
        string authorName;
        string? avatarUrl;

        await using (var cmd = new NpgsqlCommand(
            """
            INSERT INTO community_post_comments (post_id, employee_id, comment_text, created_at)
            VALUES (@pid, @eid, @txt, CURRENT_TIMESTAMP)
            RETURNING id, created_at;
            """,
            conn))
        {
            cmd.Parameters.AddWithValue("pid", id);
            cmd.Parameters.AddWithValue("eid", empId);
            cmd.Parameters.AddWithValue("txt", request.CommentText.Trim());

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct))
                return StatusCode(500, new { error = "Failed to add comment" });

            commentId = reader.GetInt32(0);
            createdAt = reader.GetDateTime(1);
        }

        await using (var empCmd = new NpgsqlCommand(
            "SELECT COALESCE(NULLIF(TRIM(full_name), ''), 'Team Member'), photo_path FROM employees WHERE id = @eid;",
            conn))
        {
            empCmd.Parameters.AddWithValue("eid", empId);
            await using var ereader = await empCmd.ExecuteReaderAsync(ct);
            if (await ereader.ReadAsync(ct))
            {
                authorName = ereader.GetString(0);
                avatarUrl = ereader.IsDBNull(1) ? null : ereader.GetString(1);
            }
            else
            {
                authorName = "Team Member";
                avatarUrl = null;
            }
        }

        return Ok(new CommunityCommentDto
        {
            Id = commentId,
            PostId = id,
            EmployeeId = empId,
            CommentText = request.CommentText.Trim(),
            CreatedAt = createdAt,
            AuthorName = authorName,
            AvatarUrl = avatarUrl
        });
    }

    [HttpDelete("posts/{id:int}")]
    public async Task<IActionResult> DeletePost(int id, CancellationToken ct)
    {
        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);
        var empId = await ResolveEmployeeIdAsync(conn, ct);
        var isAdmin = await IsAdminOrManagerAsync(ct);

        await using var checkCmd = new NpgsqlCommand(
            "SELECT author_id FROM community_posts WHERE id = @id;", conn);
        checkCmd.Parameters.AddWithValue("id", id);
        var authorIdObj = await checkCmd.ExecuteScalarAsync(ct);
        if (authorIdObj == null)
            return NotFound(new { error = "Post not found" });

        var authorId = (int)authorIdObj;
        if (!isAdmin && authorId != empId)
            return Forbid();

        await using var delCmd = new NpgsqlCommand("DELETE FROM community_posts WHERE id = @id;", conn);
        delCmd.Parameters.AddWithValue("id", id);
        await delCmd.ExecuteNonQueryAsync(ct);

        return Ok(new { message = "Post deleted successfully" });
    }

    // ==========================================
    // 2. INTERACTIVE EMPLOYEE PULSE POLLS & VOTING
    // ==========================================

    [HttpGet("polls")]
    public async Task<IActionResult> GetPolls(CancellationToken ct)
    {
        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);
        var currentEmpId = await ResolveEmployeeIdAsync(conn, ct);

        var polls = new List<EmployeePollDto>();
        var pollIds = new List<int>();

        await using (var cmd = new NpgsqlCommand(
            """
            SELECT p.id, p.question, p.options_json::text, p.expires_at, p.is_active, p.created_by, p.created_at,
                   COALESCE(NULLIF(TRIM(e.full_name), ''), 'HR Team') AS creator_name,
                   (SELECT selected_option_id FROM employee_poll_votes v WHERE v.poll_id = p.id AND v.employee_id = @empId LIMIT 1) AS user_voted_option_id
            FROM employee_polls p
            LEFT JOIN employees e ON e.id = p.created_by
            ORDER BY p.created_at DESC;
            """,
            conn))
        {
            cmd.Parameters.AddWithValue("empId", currentEmpId);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var pid = reader.GetInt32(0);
                pollIds.Add(pid);
                var rawJson = reader.GetString(2);
                var options = new List<PollOptionItem>();
                try
                {
                    options = JsonSerializer.Deserialize<List<PollOptionItem>>(rawJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
                              ?? new List<PollOptionItem>();
                }
                catch { }

                polls.Add(new EmployeePollDto
                {
                    Id = pid,
                    Question = reader.GetString(1),
                    Options = options,
                    ExpiresAt = reader.IsDBNull(3) ? null : reader.GetDateTime(3),
                    IsActive = reader.GetBoolean(4),
                    CreatedBy = reader.IsDBNull(5) ? null : reader.GetInt32(5),
                    CreatedAt = reader.GetDateTime(6),
                    CreatorName = reader.GetString(7),
                    UserVotedOptionId = reader.IsDBNull(8) ? null : reader.GetInt32(8),
                    TotalVotes = 0
                });
            }
        }

        if (pollIds.Count > 0)
        {
            await using (var votesCmd = new NpgsqlCommand(
                """
                SELECT poll_id, selected_option_id, COUNT(*) AS cnt
                FROM employee_poll_votes
                WHERE poll_id = ANY(@pollIds)
                GROUP BY poll_id, selected_option_id;
                """,
                conn))
            {
                votesCmd.Parameters.AddWithValue("pollIds", pollIds.ToArray());
                await using var vReader = await votesCmd.ExecuteReaderAsync(ct);
                var voteCounts = new Dictionary<(int PollId, int OptionId), int>();
                var pollTotals = new Dictionary<int, int>();

                while (await vReader.ReadAsync(ct))
                {
                    var pid = vReader.GetInt32(0);
                    var optId = vReader.GetInt32(1);
                    var cnt = (int)vReader.GetInt64(2);
                    voteCounts[(pid, optId)] = cnt;
                    pollTotals[pid] = pollTotals.GetValueOrDefault(pid, 0) + cnt;
                }

                foreach (var poll in polls)
                {
                    var total = pollTotals.GetValueOrDefault(poll.Id, 0);
                    poll.TotalVotes = total;
                    foreach (var opt in poll.Options)
                    {
                        opt.VotesCount = voteCounts.GetValueOrDefault((poll.Id, opt.Id), 0);
                        opt.Percentage = total > 0 ? (int)Math.Round(((double)opt.VotesCount / total) * 100) : 0;
                    }
                }
            }
        }

        return Ok(polls);
    }

    [HttpPost("polls")]
    public async Task<IActionResult> CreatePoll([FromBody] CreatePollRequest request, CancellationToken ct)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Question))
            return BadRequest(new { error = "Poll question is required." });

        if (request.Options == null || request.Options.Count < 2)
            return BadRequest(new { error = "Poll requires at least 2 voting options." });

        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);
        var creatorId = await ResolveEmployeeIdAsync(conn, ct);

        var optionItems = request.Options
            .Where(o => !string.IsNullOrWhiteSpace(o))
            .Select((text, index) => new { id = index + 1, text = text.Trim() })
            .ToList();

        var optionsJson = JsonSerializer.Serialize(optionItems);

        int pollId;
        DateTime createdAt;

        await using (var cmd = new NpgsqlCommand(
            """
            INSERT INTO employee_polls (question, options_json, expires_at, is_active, created_by, created_at)
            VALUES (@q, @opts::jsonb, @exp, true, @cb, CURRENT_TIMESTAMP)
            RETURNING id, created_at;
            """,
            conn))
        {
            cmd.Parameters.AddWithValue("q", request.Question.Trim());
            cmd.Parameters.AddWithValue("opts", optionsJson);
            cmd.Parameters.AddWithValue("exp", (object?)request.ExpiresAt ?? DBNull.Value);
            cmd.Parameters.AddWithValue("cb", creatorId);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct))
                return StatusCode(500, new { error = "Failed to create poll" });

            pollId = reader.GetInt32(0);
            createdAt = reader.GetDateTime(1);
        }

        return Ok(new
        {
            id = pollId,
            question = request.Question.Trim(),
            options = optionItems,
            created_at = createdAt,
            message = "Poll created successfully"
        });
    }

    [HttpPost("polls/{id:int}/vote")]
    public async Task<IActionResult> CastVote(int id, [FromBody] CastVoteRequest request, CancellationToken ct)
    {
        if (request == null || request.SelectedOptionId <= 0)
            return BadRequest(new { error = "Valid SelectedOptionId is required." });

        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);
        var empId = await ResolveEmployeeIdAsync(conn, ct);

        // Check if poll exists and is active
        await using (var checkCmd = new NpgsqlCommand(
            "SELECT is_active, expires_at FROM employee_polls WHERE id = @id;", conn))
        {
            checkCmd.Parameters.AddWithValue("id", id);
            await using var cr = await checkCmd.ExecuteReaderAsync(ct);
            if (!await cr.ReadAsync(ct))
                return NotFound(new { error = "Poll not found" });

            var isActive = cr.GetBoolean(0);
            var expiresAt = cr.IsDBNull(1) ? (DateTime?)null : cr.GetDateTime(1);

            if (!isActive || (expiresAt.HasValue && expiresAt.Value < DateTime.UtcNow))
                return BadRequest(new { error = "This poll has expired or is closed." });
        }

        await using (var voteCmd = new NpgsqlCommand(
            """
            INSERT INTO employee_poll_votes (poll_id, employee_id, selected_option_id, voted_at)
            VALUES (@pid, @eid, @opt, CURRENT_TIMESTAMP)
            ON CONFLICT (poll_id, employee_id)
            DO UPDATE SET selected_option_id = EXCLUDED.selected_option_id, voted_at = CURRENT_TIMESTAMP;
            """,
            conn))
        {
            voteCmd.Parameters.AddWithValue("pid", id);
            voteCmd.Parameters.AddWithValue("eid", empId);
            voteCmd.Parameters.AddWithValue("opt", request.SelectedOptionId);
            await voteCmd.ExecuteNonQueryAsync(ct);
        }

        return Ok(new
        {
            poll_id = id,
            selected_option_id = request.SelectedOptionId,
            message = "Vote recorded successfully"
        });
    }

    [HttpDelete("polls/{id:int}")]
    public async Task<IActionResult> DeletePoll(int id, CancellationToken ct)
    {
        if (!await IsAdminOrManagerAsync(ct))
            return Forbid();

        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand("DELETE FROM employee_polls WHERE id = @id;", conn);
        cmd.Parameters.AddWithValue("id", id);
        var rows = await cmd.ExecuteNonQueryAsync(ct);
        if (rows == 0) return NotFound(new { error = "Poll not found" });

        return Ok(new { message = "Poll deleted successfully" });
    }

    // ==========================================
    // 3. CORPORATE SOCIAL EVENTS & RSVP MANAGEMENT
    // ==========================================

    [HttpGet("events")]
    public async Task<IActionResult> GetEvents(CancellationToken ct)
    {
        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);
        var currentEmpId = await ResolveEmployeeIdAsync(conn, ct);

        var events = new List<CompanyEventDto>();
        var eventIds = new List<int>();

        await using (var cmd = new NpgsqlCommand(
            """
            SELECT e.id, e.title, e.description, e.event_date, e.location, e.max_attendees, e.created_at,
                   (SELECT status FROM company_event_rsvps r WHERE r.event_id = e.id AND r.employee_id = @empId LIMIT 1) AS my_rsvp
            FROM company_events e
            ORDER BY e.event_date ASC;
            """,
            conn))
        {
            cmd.Parameters.AddWithValue("empId", currentEmpId);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var eid = reader.GetInt32(0);
                eventIds.Add(eid);
                events.Add(new CompanyEventDto
                {
                    Id = eid,
                    Title = reader.GetString(1),
                    Description = reader.IsDBNull(2) ? null : reader.GetString(2),
                    EventDate = reader.GetDateTime(3),
                    Location = reader.GetString(4),
                    MaxAttendees = reader.IsDBNull(5) ? null : reader.GetInt32(5),
                    CreatedAt = reader.GetDateTime(6),
                    MyRsvp = reader.IsDBNull(7) ? null : reader.GetString(7),
                    AttendingCount = 0,
                    MaybeCount = 0,
                    DeclinedCount = 0
                });
            }
        }

        if (eventIds.Count > 0)
        {
            await using (var rsvpCmd = new NpgsqlCommand(
                """
                SELECT event_id, status, COUNT(*) AS cnt
                FROM company_event_rsvps
                WHERE event_id = ANY(@eventIds)
                GROUP BY event_id, status;
                """,
                conn))
            {
                rsvpCmd.Parameters.AddWithValue("eventIds", eventIds.ToArray());
                await using var rReader = await rsvpCmd.ExecuteReaderAsync(ct);
                var statusMap = events.ToDictionary(e => e.Id);

                while (await rReader.ReadAsync(ct))
                {
                    var eid = rReader.GetInt32(0);
                    var status = rReader.GetString(1).ToLowerInvariant();
                    var count = (int)rReader.GetInt64(2);

                    if (statusMap.TryGetValue(eid, out var ev))
                    {
                        if (status == "attending") ev.AttendingCount = count;
                        else if (status == "maybe") ev.MaybeCount = count;
                        else if (status == "declined") ev.DeclinedCount = count;
                    }
                }
            }
        }

        return Ok(events);
    }

    [HttpPost("events")]
    public async Task<IActionResult> CreateEvent([FromBody] CreateEventRequest request, CancellationToken ct)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.Location))
            return BadRequest(new { error = "Event Title and Location are required." });

        if (!await IsAdminOrManagerAsync(ct))
            return Forbid();

        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);
        int eventId;
        DateTime createdAt;

        await using (var cmd = new NpgsqlCommand(
            """
            INSERT INTO company_events (title, description, event_date, location, max_attendees, created_at)
            VALUES (@title, @desc, @date, @loc, @max, CURRENT_TIMESTAMP)
            RETURNING id, created_at;
            """,
            conn))
        {
            cmd.Parameters.AddWithValue("title", request.Title.Trim());
            cmd.Parameters.AddWithValue("desc", (object?)request.Description?.Trim() ?? DBNull.Value);
            cmd.Parameters.AddWithValue("date", request.EventDate);
            cmd.Parameters.AddWithValue("loc", request.Location.Trim());
            cmd.Parameters.AddWithValue("max", (object?)request.MaxAttendees ?? DBNull.Value);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct))
                return StatusCode(500, new { error = "Failed to create event" });

            eventId = reader.GetInt32(0);
            createdAt = reader.GetDateTime(1);
        }

        return Ok(new
        {
            id = eventId,
            title = request.Title.Trim(),
            event_date = request.EventDate,
            location = request.Location.Trim(),
            created_at = createdAt,
            message = "Event created successfully"
        });
    }

    [HttpPost("events/{id:int}/rsvp")]
    public async Task<IActionResult> SubmitRsvp(int id, [FromBody] EventRsvpRequest request, CancellationToken ct)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Status))
            return BadRequest(new { error = "RSVP status is required (attending, declined, maybe)." });

        var status = request.Status.Trim().ToLowerInvariant();
        if (status != "attending" && status != "declined" && status != "maybe")
            return BadRequest(new { error = "Invalid status. Allowed values: attending, declined, maybe." });

        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);
        var empId = await ResolveEmployeeIdAsync(conn, ct);

        // Check event max attendees if attending
        if (status == "attending")
        {
            await using (var checkCapCmd = new NpgsqlCommand(
                """
                SELECT e.max_attendees,
                       (SELECT COUNT(*) FROM company_event_rsvps r WHERE r.event_id = e.id AND r.status = 'attending') AS cur_attending
                FROM company_events e
                WHERE e.id = @id;
                """,
                conn))
            {
                checkCapCmd.Parameters.AddWithValue("id", id);
                await using var capReader = await checkCapCmd.ExecuteReaderAsync(ct);
                if (await capReader.ReadAsync(ct))
                {
                    if (!capReader.IsDBNull(0))
                    {
                        var max = capReader.GetInt32(0);
                        var cur = (int)capReader.GetInt64(1);
                        if (cur >= max)
                            return BadRequest(new { error = "This event has reached its maximum attendee capacity." });
                    }
                }
                else
                {
                    return NotFound(new { error = "Event not found." });
                }
            }
        }

        await using (var rsvpCmd = new NpgsqlCommand(
            """
            INSERT INTO company_event_rsvps (event_id, employee_id, status, responded_at)
            VALUES (@eid, @empid, @st, CURRENT_TIMESTAMP)
            ON CONFLICT (event_id, employee_id)
            DO UPDATE SET status = EXCLUDED.status, responded_at = CURRENT_TIMESTAMP;
            """,
            conn))
        {
            rsvpCmd.Parameters.AddWithValue("eid", id);
            rsvpCmd.Parameters.AddWithValue("empid", empId);
            rsvpCmd.Parameters.AddWithValue("st", status);
            await rsvpCmd.ExecuteNonQueryAsync(ct);
        }

        return Ok(new
        {
            event_id = id,
            status,
            message = "RSVP updated successfully"
        });
    }

    [HttpGet("events/{id:int}/attendees")]
    public async Task<IActionResult> GetEventAttendees(int id, CancellationToken ct)
    {
        if (!await IsAdminOrManagerAsync(ct))
            return Forbid();

        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);

        string eventTitle = "Corporate Event";
        DateTime eventDate = DateTime.UtcNow;
        string location = "";
        int? maxAttendees = null;

        await using (var evCmd = new NpgsqlCommand("SELECT title, event_date, location, max_attendees FROM company_events WHERE id = @id;", conn))
        {
            evCmd.Parameters.AddWithValue("id", id);
            await using var evReader = await evCmd.ExecuteReaderAsync(ct);
            if (!await evReader.ReadAsync(ct))
                return NotFound(new { error = "Event not found" });

            eventTitle = evReader.GetString(0);
            eventDate = evReader.GetDateTime(1);
            location = evReader.GetString(2);
            maxAttendees = evReader.IsDBNull(3) ? null : evReader.GetInt32(3);
        }

        var attendees = new List<object>();
        int attendingCount = 0;
        int maybeCount = 0;
        int declinedCount = 0;

        await using (var cmd = new NpgsqlCommand(
            """
            SELECT r.employee_id, r.status, r.responded_at,
                   e.full_name, e.emp_code, e.email,
                   COALESCE(d.name, 'General Organization') AS department_name,
                   e.job_title
            FROM company_event_rsvps r
            JOIN employees e ON e.id = r.employee_id
            LEFT JOIN departments d ON d.id = e.department_id
            WHERE r.event_id = @id
            ORDER BY r.responded_at DESC;
            """,
            conn))
        {
            cmd.Parameters.AddWithValue("id", id);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var empId = reader.GetInt32(0);
                var status = reader.GetString(1);
                var respondedAt = reader.GetDateTime(2);
                var fullName = reader.IsDBNull(3) ? "" : reader.GetString(3);
                var empCode = reader.IsDBNull(4) ? "" : reader.GetString(4);
                var email = reader.IsDBNull(5) ? "" : reader.GetString(5);
                var dept = reader.GetString(6);
                var job = reader.IsDBNull(7) ? "" : reader.GetString(7);

                fullName = fullName.Trim();
                if (string.IsNullOrWhiteSpace(fullName)) fullName = "Employee #" + empId;

                if (string.Equals(status, "attending", StringComparison.OrdinalIgnoreCase)) attendingCount++;
                else if (string.Equals(status, "maybe", StringComparison.OrdinalIgnoreCase)) maybeCount++;
                else if (string.Equals(status, "declined", StringComparison.OrdinalIgnoreCase)) declinedCount++;

                attendees.Add(new
                {
                    employee_id = empId,
                    employee_code = empCode,
                    full_name = fullName,
                    email = email,
                    department_name = dept,
                    job_title = job,
                    status = status,
                    responded_at = respondedAt
                });
            }
        }

        return Ok(new
        {
            event_id = id,
            event_title = eventTitle,
            event_date = eventDate,
            location = location,
            max_attendees = maxAttendees,
            total_rsvps = attendees.Count,
            attending_count = attendingCount,
            maybe_count = maybeCount,
            declined_count = declinedCount,
            attendees
        });
    }

    [HttpDelete("events/{id:int}")]
    public async Task<IActionResult> DeleteEvent(int id, CancellationToken ct)
    {
        if (!await IsAdminOrManagerAsync(ct))
            return Forbid();

        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand("DELETE FROM company_events WHERE id = @id;", conn);
        cmd.Parameters.AddWithValue("id", id);
        var rows = await cmd.ExecuteNonQueryAsync(ct);
        if (rows == 0) return NotFound(new { error = "Event not found" });

        return Ok(new { message = "Event deleted successfully" });
    }
}

// -------------------------------------------------------------
// DTOs & Models for CommunityController
// -------------------------------------------------------------

public sealed class CommunityPostDto
{
    public int Id { get; set; }
    public int AuthorId { get; set; }
    public string PostType { get; set; } = "general";
    public string Content { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public int LikesCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public string AuthorName { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public string? JobTitle { get; set; }
    public string? DepartmentName { get; set; }
    public bool UserHasLiked { get; set; }
    public List<CommunityCommentDto> Comments { get; set; } = new();
}

public sealed class CommunityCommentDto
{
    public int Id { get; set; }
    public int PostId { get; set; }
    public int EmployeeId { get; set; }
    public string CommentText { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public string AuthorName { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
}

public sealed class CreatePostRequest
{
    public string? PostType { get; set; }
    public string Content { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
}

public sealed class CreateCommentRequest
{
    public string CommentText { get; set; } = string.Empty;
}

public sealed class EmployeePollDto
{
    public int Id { get; set; }
    public string Question { get; set; } = string.Empty;
    public List<PollOptionItem> Options { get; set; } = new();
    public DateTime? ExpiresAt { get; set; }
    public bool IsActive { get; set; }
    public int? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public string CreatorName { get; set; } = string.Empty;
    public int? UserVotedOptionId { get; set; }
    public int TotalVotes { get; set; }
}

public sealed class PollOptionItem
{
    public int Id { get; set; }
    public string Text { get; set; } = string.Empty;
    public int VotesCount { get; set; }
    public int Percentage { get; set; }
}

public sealed class CreatePollRequest
{
    public string Question { get; set; } = string.Empty;
    public List<string> Options { get; set; } = new();
    public DateTime? ExpiresAt { get; set; }
}

public sealed class CastVoteRequest
{
    public int SelectedOptionId { get; set; }
}

public sealed class CompanyEventDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime EventDate { get; set; }
    public string Location { get; set; } = string.Empty;
    public int? MaxAttendees { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? MyRsvp { get; set; }
    public int AttendingCount { get; set; }
    public int MaybeCount { get; set; }
    public int DeclinedCount { get; set; }
}

public sealed class CreateEventRequest
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime EventDate { get; set; }
    public string Location { get; set; } = string.Empty;
    public int? MaxAttendees { get; set; }
}

public sealed class EventRsvpRequest
{
    public string Status { get; set; } = "attending";
}
