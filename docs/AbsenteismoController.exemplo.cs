// Exemplo .NET 10 — copiar/adaptar no backend do sistema de ponto.
// Pacotes: Microsoft.AspNetCore.*, Dapper ou EF Core

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MacPonto.Api.Controllers;

[ApiController]
[Route("api/absenteismo")]
[Authorize]
public sealed class AbsenteismoController : ControllerBase
{
    private readonly IAbsenteismoQueryService _queries;

    public AbsenteismoController(IAbsenteismoQueryService queries) => _queries = queries;

    [HttpGet("resumo")]
    public Task<ResumoAbsenteismoDto> GetResumo(
        [FromQuery] DateOnly de,
        [FromQuery] DateOnly ate,
        [FromQuery] int? filialId,
        [FromQuery] int? deptoId,
        CancellationToken ct)
        => _queries.GetResumoAsync(de, ate, filialId, deptoId, ct);

    [HttpGet("colaboradores")]
    public Task<PagedResult<ColaboradorAggDto>> GetColaboradores(
        [FromQuery] AbsenteismoFiltroDto filtro,
        CancellationToken ct)
        => _queries.GetColaboradoresAsync(filtro, ct);

    [HttpGet("eventos")]
    public Task<PagedResult<EventoDto>> GetEventos(
        [FromQuery] AbsenteismoFiltroDto filtro,
        CancellationToken ct)
        => _queries.GetEventosAsync(filtro, ct);

    [HttpGet("grupos")]
    public Task<GruposResultDto> GetGrupos(
        [FromQuery] AbsenteismoFiltroDto filtro,
        [FromQuery] string groupBy,
        CancellationToken ct)
        => _queries.GetGruposAsync(filtro, groupBy, ct);
}

public sealed record PagedResult<T>(
    IReadOnlyList<T> Items,
    int Total,
    int Page,
    int PageSize,
    TotaisEventosDto? Totais = null);

public sealed record EventoDto(
    string Matricula,
    string Nome,
    string Filial,
    string Departamento,
    string Cargo,
    DateOnly Data,
    string Horario,
    string Marcacao,
    string Codigo,
    string Evento,
    int Minutos,
    string Categoria);

public sealed record AbsenteismoFiltroDto
{
    public DateOnly De { get; init; }
    public DateOnly Ate { get; init; }
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 200;
    public string? Sort { get; init; }
    public string? Dir { get; init; } = "asc";
    public string? Search { get; init; }
    public string? Categoria { get; init; }
    public int? FilialId { get; init; }
    public string? Filial { get; init; }
    public int? DeptoId { get; init; }
    public string? Matricula { get; init; }
    public string? GroupBy { get; init; }
    public string? GroupKey { get; init; }
}

public interface IAbsenteismoQueryService
{
    Task<ResumoAbsenteismoDto> GetResumoAsync(DateOnly de, DateOnly ate, int? filialId, int? deptoId, CancellationToken ct);
    Task<PagedResult<ColaboradorAggDto>> GetColaboradoresAsync(AbsenteismoFiltroDto filtro, CancellationToken ct);
    Task<PagedResult<EventoDto>> GetEventosAsync(AbsenteismoFiltroDto filtro, CancellationToken ct);
    Task<GruposResultDto> GetGruposAsync(AbsenteismoFiltroDto filtro, string groupBy, CancellationToken ct);
}
