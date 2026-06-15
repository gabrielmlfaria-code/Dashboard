using BackendApi.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackendApi.Controllers;

[ApiController]
[Authorize]
[Route("api/nr1")]
public class Nr1Controller : ControllerBase
{
    [HttpGet("estado")]
    public ActionResult<Nr1EstadoResponse> GetEstado([FromQuery] Nr1EstadoRequest request)
    {
        return Ok(new Nr1EstadoResponse(
            Registros: Array.Empty<Nr1RegistroDto>(),
            CheckState: new Dictionary<string, bool>(),
            ChecklistMeta: new Dictionary<string, object?>(),
            CardsProg: new Dictionary<string, object?>(),
            UpdatedAt: null
        ));
    }

    [HttpPost("estado")]
    public ActionResult<Nr1EstadoResponse> SalvarEstado([FromBody] Nr1SalvarEstadoRequest request)
    {
        return Ok(new Nr1EstadoResponse(
            Registros: Array.Empty<Nr1RegistroDto>(),
            CheckState: new Dictionary<string, bool>(),
            ChecklistMeta: new Dictionary<string, object?>(),
            CardsProg: new Dictionary<string, object?>(),
            UpdatedAt: null
        ));
    }
}

