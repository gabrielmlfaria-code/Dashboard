using BackendApi.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackendApi.Controllers;

[ApiController]
[Authorize]
[Route("api/auditoria-ponto")]
public class AuditoriaPontoController : ControllerBase
{
    [HttpGet("resumo")]
    public ActionResult<AuditoriaPontoResumoResponse> GetResumo([FromQuery] AuditoriaPontoResumoRequest request)
    {
        return Ok(new AuditoriaPontoResumoResponse(
            TotalAnomalias: 0,
            Criticas: 0,
            Altas: 0,
            Medias: 0,
            Baixas: 0,
            Pendentes: 0,
            EmAnalise: 0,
            Justificadas: 0,
            AjustesFolha: 0,
            Resolvidas: 0,
            Ignoradas: 0,
            PercentualTratado: 0,
            MaiorRisco: new AuditoriaPontoMaiorRiscoDto(
                AnomaliaId: string.Empty,
                Severidade: string.Empty,
                Mensagem: string.Empty,
                Departamento: string.Empty,
                Colaborador: string.Empty
            ),
            DepartamentosCriticos: Array.Empty<AuditoriaPontoRankingDto>(),
            ColaboradoresCriticos: Array.Empty<AuditoriaPontoRankingDto>(),
            RegrasCriticas: Array.Empty<AuditoriaPontoRankingDto>(),
            ImpactoFinanceiro: new AuditoriaPontoImpactoFinanceiroDto(
                TotalEstimado: 0,
                AbsenteismoEstimado: 0,
                ExtrasEstimado: 0,
                AjustesFolhaEstimado: 0,
                DepartamentosComCusto: 0,
                Memoria: string.Empty
            )
        ));
    }

    [HttpGet("anomalias")]
    public ActionResult<PagedResponse<AuditoriaPontoAnomaliaDto>> GetAnomalias([FromQuery] AuditoriaPontoAnomaliasRequest request)
    {
        return Ok(new PagedResponse<AuditoriaPontoAnomaliaDto>(
            Items: Array.Empty<AuditoriaPontoAnomaliaDto>(),
            Total: 0,
            Page: request.Page,
            PageSize: request.PageSize
        ));
    }

    [HttpGet("anomalias/{anomaliaId}/memoria")]
    public ActionResult<AuditoriaPontoMemoriaResponse> GetMemoria([FromRoute] string anomaliaId)
    {
        return Ok(new AuditoriaPontoMemoriaResponse(
            AnomaliaId: anomaliaId,
            VersaoMotor: string.Empty,
            HashRegrasAtivas: string.Empty,
            StatusFechamento: string.Empty,
            StatusJornada: string.Empty,
            ProcessadoEm: DateTimeOffset.MinValue,
            ParametrosSnapshot: EmptyParametros(),
            RegrasAcionadas: Array.Empty<AuditoriaPontoRegraMemoriaDto>()
        ));
    }

    [HttpPost("tratamentos")]
    public ActionResult<AuditoriaPontoTratamentoResponse> SalvarTratamento([FromBody] AuditoriaPontoTratamentoRequest request)
    {
        return Ok(new AuditoriaPontoTratamentoResponse(
            AnomaliaId: request.AnomaliaId,
            Status: request.Status,
            Justificativa: request.Justificativa,
            Responsavel: request.Responsavel,
            AtualizadoEm: DateTimeOffset.MinValue
        ));
    }

    [HttpGet("tratamentos/{anomaliaId}/historico")]
    public ActionResult<AuditoriaPontoHistoricoTratamentoResponse> GetHistoricoTratamento([FromRoute] string anomaliaId)
    {
        return Ok(new AuditoriaPontoHistoricoTratamentoResponse(
            AnomaliaId: anomaliaId,
            Items: Array.Empty<AuditoriaPontoHistoricoTratamentoDto>()
        ));
    }

    [HttpGet("parametros")]
    public ActionResult<AuditoriaPontoParametrosDto> GetParametros([FromQuery] AuditoriaPontoParametrosRequest request)
    {
        return Ok(EmptyParametros());
    }

    [HttpPut("parametros")]
    public ActionResult<AuditoriaPontoParametrosDto> SalvarParametros([FromBody] AuditoriaPontoSalvarParametrosRequest request)
    {
        return Ok(new AuditoriaPontoParametrosDto(
            ToleranciaMinutos: request.ToleranciaMinutos,
            ToleranciaDuplicidadeMinutos: request.ToleranciaDuplicidadeMinutos,
            JanelaPareamentoMaxMinutos: request.JanelaPareamentoMaxMinutos,
            IntervaloIntrajornadaMinutos: request.IntervaloIntrajornadaMinutos,
            JornadaIntrajornadaMinutos: request.JornadaIntrajornadaMinutos,
            IntervaloInterjornadaMinutos: request.IntervaloInterjornadaMinutos,
            PontoBritanicoDias: request.PontoBritanicoDias,
            MinutosResiduaisMinutos: request.MinutosResiduaisMinutos,
            LimiteHoraExtraDiariaMinutos: request.LimiteHoraExtraDiariaMinutos,
            IntervaloIntrajornadaMaxMinutos: request.IntervaloIntrajornadaMaxMinutos,
            DiasConsecutivosLimite: request.DiasConsecutivosLimite,
            LimiteBancoHorasPositivoMinutos: request.LimiteBancoHorasPositivoMinutos,
            LimiteBancoHorasNegativoMinutos: request.LimiteBancoHorasNegativoMinutos,
            RecorrenciaRiscoLimite: request.RecorrenciaRiscoLimite,
            Escopo: string.Empty,
            Versao: string.Empty,
            AtualizadoEm: DateTimeOffset.MinValue,
            AtualizadoPor: request.Responsavel
        ));
    }

    [HttpPost("reprocessamentos")]
    public ActionResult<AuditoriaPontoReprocessarResponse> Reprocessar([FromBody] AuditoriaPontoReprocessarRequest request)
    {
        return Ok(new AuditoriaPontoReprocessarResponse(
            JobId: string.Empty,
            Status: string.Empty,
            EventosNaFila: 0
        ));
    }

    private static AuditoriaPontoParametrosDto EmptyParametros()
    {
        return new AuditoriaPontoParametrosDto(
            ToleranciaMinutos: 0,
            ToleranciaDuplicidadeMinutos: 0,
            JanelaPareamentoMaxMinutos: 0,
            IntervaloIntrajornadaMinutos: 0,
            JornadaIntrajornadaMinutos: 0,
            IntervaloInterjornadaMinutos: 0,
            PontoBritanicoDias: 0,
            MinutosResiduaisMinutos: 0,
            LimiteHoraExtraDiariaMinutos: 0,
            IntervaloIntrajornadaMaxMinutos: 0,
            DiasConsecutivosLimite: 0,
            LimiteBancoHorasPositivoMinutos: 0,
            LimiteBancoHorasNegativoMinutos: 0,
            RecorrenciaRiscoLimite: 0,
            Escopo: string.Empty,
            Versao: string.Empty,
            AtualizadoEm: null,
            AtualizadoPor: string.Empty
        );
    }
}
