using BackendApi.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackendApi.Controllers;

[ApiController]
[Authorize]
[Route("api/abonos")]
public class AbonosController : ControllerBase
{
    [HttpGet("resumo")]
    public ActionResult<AbonosResumoResponse> GetResumo([FromQuery] AbonosResumoRequest request)
    {
        return Ok(new AbonosResumoResponse(
            Pendentes: 0,
            Efetuados: 0,
            Colaboradores: 0,
            Departamentos: 0
        ));
    }

    [HttpGet("departamentos")]
    public ActionResult<IReadOnlyCollection<AbonosDepartamentoResponse>> GetDepartamentos([FromQuery] AbonosDepartamentosRequest request)
    {
        return Ok(Array.Empty<AbonosDepartamentoResponse>());
    }

    [HttpGet("colaboradores")]
    public ActionResult<PagedResponse<AbonosColaboradorResponse>> GetColaboradores([FromQuery] AbonosColaboradoresRequest request)
    {
        return Ok(new PagedResponse<AbonosColaboradorResponse>(
            Items: Array.Empty<AbonosColaboradorResponse>(),
            Total: 0,
            Page: request.Page ?? 1,
            PageSize: request.PageSize ?? 50
        ));
    }
}

