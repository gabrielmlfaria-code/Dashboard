using BackendApi.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackendApi.Controllers;

[ApiController]
[Authorize]
[Route("api/saude-preventiva")]
public class SaudePreventivaController : ControllerBase
{
    [HttpGet("registros")]
    public ActionResult<SaudePreventivaRegistrosResponse> GetRegistros([FromQuery] SaudePreventivaRegistrosRequest request)
    {
        return Ok(new SaudePreventivaRegistrosResponse(
            Registros: Array.Empty<SaudePreventivaRegistroDto>(),
            UpdatedAt: null
        ));
    }

    [HttpPost("registros")]
    public ActionResult<SaudePreventivaRegistrosResponse> SalvarRegistros([FromBody] SaudePreventivaSalvarRegistrosRequest request)
    {
        return Ok(new SaudePreventivaRegistrosResponse(
            Registros: Array.Empty<SaudePreventivaRegistroDto>(),
            UpdatedAt: null
        ));
    }
}

