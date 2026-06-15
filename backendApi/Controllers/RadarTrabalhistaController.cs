using BackendApi.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackendApi.Controllers;

[ApiController]
[Authorize]
[Route("api/radar-trabalhista")]
public class RadarTrabalhistaController : ControllerBase
{
    [HttpGet("resumo")]
    public ActionResult<RadarTrabalhistaResumoResponse> GetResumo([FromQuery] RadarTrabalhistaResumoRequest request)
    {
        return Ok(new RadarTrabalhistaResumoResponse(
            Ocorrencias: 0,
            Colaboradores: 0,
            PrincipalEvento: new RadarPrincipalEventoDto(
                Label: string.Empty,
                Count: 0
            )
        ));
    }
}

