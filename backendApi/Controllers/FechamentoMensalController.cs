using BackendApi.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackendApi.Controllers;

[ApiController]
[Authorize]
[Route("api/fechamento-mensal")]
public class FechamentoMensalController : ControllerBase
{
    [HttpGet("eventos")]
    public ActionResult<IReadOnlyCollection<FechamentoMensalEventoResponse>> GetEventos([FromQuery] FechamentoMensalEventosRequest request)
    {
        return Ok(Array.Empty<FechamentoMensalEventoResponse>());
    }
}

