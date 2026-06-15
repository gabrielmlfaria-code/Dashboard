using BackendApi.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackendApi.Controllers;

[ApiController]
[Authorize]
[Route("api/turnover")]
public class TurnoverController : ControllerBase
{
    [HttpGet("resumo")]
    public ActionResult<TurnoverResumoResponse> GetResumo([FromQuery] TurnoverResumoRequest request)
    {
        return Ok(new TurnoverResumoResponse(
            Meses: Array.Empty<TurnoverMesDto>()
        ));
    }
}

