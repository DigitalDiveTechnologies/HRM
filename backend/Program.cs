using System.Net;
using System.Text;
using System.Text.Json;
using DigitalDive.Hr.Api.Data;
using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 20_000_000;
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Digital Dive HR API",
        Version = "v1",
        Description =
            """
            Backend for Digital Dive HR Portal (.NET 10 + JWT + Neon PostgreSQL).

            **How to authenticate:**
            1. Open `POST /api/auth/login`
            2. Use a seed account (e.g. `admin@digitaldive.demo` / `demo123`) — see repo `Seed-Logins.txt`
            3. Copy `token` from response
            4. Click **Authorize**, paste token, Authorize
            5. Call any protected module API

            **Security:** passwords stored as **BCrypt** hashes. JWT required on all module APIs.
            """
    });

    options.TagActionsBy(api =>
    {
        var tag = api.GroupName ?? api.ActionDescriptor.RouteValues["controller"];
        return new[] { tag ?? "API" };
    });
    options.DocInclusionPredicate((_, __) => true);

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Paste JWT only (no need to type Bearer)."
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

var connectionString =
    builder.Configuration.GetConnectionString("Neon")
    ?? Environment.GetEnvironmentVariable("DATABASE_URL")
    ?? string.Empty;

builder.Services.AddSingleton(new Db(connectionString));
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<JwtTokenService>();
builder.Services.AddScoped<HrQueryService>();
builder.Services.AddScoped<EmployeeBulkService>();
builder.Services.AddScoped<EmailService>();
builder.Services.Configure<SmtpOptions>(builder.Configuration.GetSection(SmtpOptions.SectionName));

var jwtSection = builder.Configuration.GetSection("Jwt");
var jwtKey = jwtSection["Key"] ?? "DigitalDive-HR-Dev-Key-Change-In-Production-Min-32-Chars";
var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // Keep JWT claim types as issued ("role", "sub") so [Authorize(Roles=...)] matches reliably.
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSection["Issuer"] ?? "DigitalDive.Hr",
            ValidAudience = jwtSection["Audience"] ?? "DigitalDive.Hr.Clients",
            IssuerSigningKey = signingKey,
            ClockSkew = TimeSpan.FromMinutes(5),
            NameClaimType = "name",
            RoleClaimType = "role"
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
{
    var extraOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();

    options.AddPolicy("PortalClients", policy =>
        policy
            .SetIsOriginAllowed(origin =>
            {
                if (string.IsNullOrWhiteSpace(origin)) return false;
                if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri)) return false;

                var host = uri.Host;

                if (host.Equals("localhost", StringComparison.OrdinalIgnoreCase)
                    || host.Equals("127.0.0.1", StringComparison.OrdinalIgnoreCase))
                    return true;

                if (host.Equals("digitaldivetech-001-site4.gtempurl.com", StringComparison.OrdinalIgnoreCase))
                    return true;

                if (host.EndsWith(".vercel.app", StringComparison.OrdinalIgnoreCase))
                    return true;

                if (host.EndsWith(".digitaldive-stage.digital", StringComparison.OrdinalIgnoreCase))
                    return true;

                foreach (var allowed in extraOrigins)
                {
                    if (string.Equals(origin.TrimEnd('/'), allowed.TrimEnd('/'), StringComparison.OrdinalIgnoreCase))
                        return true;
                }

                return false;
            })
            .AllowAnyHeader()
            .AllowAnyMethod());
});

var app = builder.Build();

// One-shot: dotnet run -- --hash-passwords
if (args.Contains("--hash-passwords", StringComparer.OrdinalIgnoreCase))
{
    using var scope = app.Services.CreateScope();
    var auth = scope.ServiceProvider.GetRequiredService<AuthService>();
    var n = await auth.HashAllPlaintextPasswordsAsync();
    Console.WriteLine(n == 0
        ? "All passwords already BCrypt-hashed."
        : $"Hashed {n} plaintext password(s) with BCrypt.");
    return;
}

app.Use(async (ctx, next) =>
{
    try
    {
        await next();
    }
    catch (Exception ex)
    {
        var logger = ctx.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("Unhandled");
        logger.LogError(ex, "Unhandled exception on {Method} {Path}", ctx.Request.Method, ctx.Request.Path);

        if (ctx.Response.HasStarted) throw;

        ctx.Response.Clear();
        ctx.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
        ctx.Response.ContentType = "application/json";

        var payload = JsonSerializer.Serialize(new
        {
            error = app.Environment.IsDevelopment() ? ex.Message : "Server error."
        });
        await ctx.Response.WriteAsync(payload);
    }
});

app.UseSwagger();
app.UseSwaggerUI(options =>
{
    // Relative path — works when API is hosted under /HRMDevelopment (IIS sub-app).
    options.SwaggerEndpoint("v1/swagger.json", "Digital Dive HR API v1");
    options.RoutePrefix = "swagger";
    options.DocumentTitle = "Digital Dive HR API — Swagger";
    options.DisplayRequestDuration();
    options.EnablePersistAuthorization();
    options.DefaultModelsExpandDepth(0);
    options.InjectStylesheet("custom.css");
});

app.UseDefaultFiles();
app.UseStaticFiles();

Directory.CreateDirectory(Path.Combine(app.Environment.ContentRootPath, "wwwroot", "uploads", "documents"));
Directory.CreateDirectory(Path.Combine(app.Environment.ContentRootPath, "wwwroot", "uploads", "certificates"));
Directory.CreateDirectory(Path.Combine(app.Environment.ContentRootPath, "wwwroot", "uploads", "photos"));

app.UseCors("PortalClients");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Friendly root → Swagger
app.MapGet("/", () => Results.Redirect("/swagger"));

app.Run();
