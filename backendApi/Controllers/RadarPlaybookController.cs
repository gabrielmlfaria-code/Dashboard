using BackendApi.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackendApi.Controllers;

[ApiController]
[Authorize]
[Route("api/radar-trabalhista/playbook")]
public class RadarPlaybookController : ControllerBase
{
    [HttpGet("notas")]
    public ActionResult<RadarPlaybookNotasResponse> GetNotas([FromQuery] RadarPlaybookNotasRequest request)
    {
        return Ok(new RadarPlaybookNotasResponse(
            EventKey: request.EventKey ?? string.Empty,
            Juridico: string.Empty,
            Rh: string.Empty,
            ClausulaCct: string.Empty,
            UpdatedAt: null,
            UpdatedBy: string.Empty
        ));
    }

    [HttpPost("notas")]
    public ActionResult<RadarPlaybookNotasResponse> SalvarNota([FromBody] RadarPlaybookSalvarNotaRequest request)
    {
        return Ok(new RadarPlaybookNotasResponse(
            EventKey: request.EventKey,
            Juridico: string.Empty,
            Rh: string.Empty,
            ClausulaCct: string.Empty,
            UpdatedAt: null,
            UpdatedBy: string.Empty
        ));
    }

    [HttpGet("auditoria")]
    public ActionResult<RadarPlaybookAuditPageResponse> GetAuditoria([FromQuery] RadarPlaybookAuditoriaRequest request)
    {
        return Ok(new RadarPlaybookAuditPageResponse(
            Items: Array.Empty<RadarPlaybookAuditItemDto>()
        ));
    }
}

