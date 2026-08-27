using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Documents")]
[Route("api/documents")]
[Authorize(Roles = "admin,manager")]
public sealed class DocumentsController : ControllerBase
{
    private readonly HrQueryService _hr;

    public DocumentsController(HrQueryService hr) => _hr = hr;

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct) => Ok(await _hr.DocumentsAsync(ct));
}
