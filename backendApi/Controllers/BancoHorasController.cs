using BackendApi.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackendApi.Controllers;

[ApiController]
[Authorize]
[Route("api/banco-horas")]
public class BancoHorasController : ControllerBase
{
    [HttpGet("resumo")]
    public ActionResult<BancoHorasResumoResponse> GetResumo([FromQuery] BancoHorasResumoRequest request)
    {
        return Ok(new BancoHorasResumoResponse(
            Periodo: new PeriodoDto(request.De, request.Ate, string.Empty, null),
            SaldoAnteriorMinutos: 0,
            CreditoMinutos: 0,
            DebitoMinutos: 0,
            SaldoProximoMinutos: 0
        ));
    }

    [HttpGet("departamentos")]
    public ActionResult<IReadOnlyCollection<BancoHorasDepartamentoResponse>> GetDepartamentos([FromQuery] BancoHorasDepartamentosRequest request)
    {
        return Ok(Array.Empty<BancoHorasDepartamentoResponse>());
    }

    [HttpGet("colaboradores")]
    public ActionResult<PagedResponse<BancoHorasColaboradorResponse>> GetColaboradores([FromQuery] BancoHorasColaboradoresRequest request)
    {
        return Ok(new PagedResponse<BancoHorasColaboradorResponse>(
            Items: Array.Empty<BancoHorasColaboradorResponse>(),
            Total: 0,
            Page: request.Page ?? 1,
            PageSize: request.PageSize ?? 50
        ));
    }
}

