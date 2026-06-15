namespace BackendApi.Contracts;

public record AuditoriaPontoResumoRequest(
    DateOnly De,
    DateOnly Ate,
    int? FilialId,
    int? DeptoId,
    string? Status,
    string? Severidade
);

public record AuditoriaPontoResumoResponse(
    int TotalAnomalias,
    int Criticas,
    int Altas,
    int Medias,
    int Baixas,
    int Pendentes,
    int EmAnalise,
    int Justificadas,
    int AjustesFolha,
    int Resolvidas,
    int Ignoradas,
    decimal PercentualTratado,
    AuditoriaPontoMaiorRiscoDto MaiorRisco,
    IReadOnlyCollection<AuditoriaPontoRankingDto> DepartamentosCriticos,
    IReadOnlyCollection<AuditoriaPontoRankingDto> ColaboradoresCriticos,
    IReadOnlyCollection<AuditoriaPontoRankingDto> RegrasCriticas,
    AuditoriaPontoImpactoFinanceiroDto ImpactoFinanceiro
);

public record AuditoriaPontoAnomaliasRequest(
    DateOnly De,
    DateOnly Ate,
    int? FilialId,
    int? DeptoId,
    string? Matricula,
    string? Colaborador,
    string? Regra,
    string? Severidade,
    string? Status,
    bool SomentePendentesCriticas,
    int Page,
    int PageSize
);

public record AuditoriaPontoAnomaliaDto(
    string Id,
    DateOnly Data,
    string Matricula,
    string Colaborador,
    string Departamento,
    string Cargo,
    string EventoCodigo,
    string EventoDescricao,
    string HorarioPlanejado,
    string Marcacoes,
    string HorasEvento,
    string HorasMarcacoes,
    string RegraCodigo,
    string RegraAplicada,
    string VersaoRegra,
    string Severidade,
    string Status,
    string Mensagem,
    string Detalhe,
    string Responsavel,
    DateTimeOffset? AtualizadoEm,
    string VersaoMotor,
    string HashRegrasAtivas
);

public record AuditoriaPontoMemoriaResponse(
    string AnomaliaId,
    string VersaoMotor,
    string HashRegrasAtivas,
    string StatusFechamento,
    string StatusJornada,
    DateTimeOffset ProcessadoEm,
    AuditoriaPontoParametrosDto ParametrosSnapshot,
    IReadOnlyCollection<AuditoriaPontoRegraMemoriaDto> RegrasAcionadas
);

public record AuditoriaPontoRegraMemoriaDto(
    string Codigo,
    string Severidade,
    string Mensagem,
    string Detalhe,
    string RegraAplicada,
    string VersaoRegra,
    IReadOnlyCollection<string> Memoria,
    IReadOnlyCollection<string> HorarioPrevisto,
    IReadOnlyCollection<string> MarcacoesUsadas
);

public record AuditoriaPontoTratamentoRequest(
    string AnomaliaId,
    string Status,
    string Justificativa,
    string Responsavel,
    string Origem
);

public record AuditoriaPontoTratamentoResponse(
    string AnomaliaId,
    string Status,
    string Justificativa,
    string Responsavel,
    DateTimeOffset AtualizadoEm
);

public record AuditoriaPontoHistoricoTratamentoResponse(
    string AnomaliaId,
    IReadOnlyCollection<AuditoriaPontoHistoricoTratamentoDto> Items
);

public record AuditoriaPontoHistoricoTratamentoDto(
    DateTimeOffset Em,
    string Responsavel,
    string StatusAnterior,
    string StatusNovo,
    string Justificativa,
    string Origem
);

public record AuditoriaPontoParametrosRequest(
    int? ClienteId,
    int? FilialId,
    int? DeptoId,
    string? CctId
);

public record AuditoriaPontoParametrosDto(
    int ToleranciaMinutos,
    int ToleranciaDuplicidadeMinutos,
    int JanelaPareamentoMaxMinutos,
    int IntervaloIntrajornadaMinutos,
    int JornadaIntrajornadaMinutos,
    int IntervaloInterjornadaMinutos,
    int PontoBritanicoDias,
    int MinutosResiduaisMinutos,
    int LimiteHoraExtraDiariaMinutos,
    int IntervaloIntrajornadaMaxMinutos,
    int DiasConsecutivosLimite,
    int LimiteBancoHorasPositivoMinutos,
    int LimiteBancoHorasNegativoMinutos,
    int RecorrenciaRiscoLimite,
    string Escopo,
    string Versao,
    DateTimeOffset? AtualizadoEm,
    string AtualizadoPor
);

public record AuditoriaPontoSalvarParametrosRequest(
    int? ClienteId,
    int? FilialId,
    int? DeptoId,
    string? CctId,
    int ToleranciaMinutos,
    int ToleranciaDuplicidadeMinutos,
    int JanelaPareamentoMaxMinutos,
    int IntervaloIntrajornadaMinutos,
    int JornadaIntrajornadaMinutos,
    int IntervaloInterjornadaMinutos,
    int PontoBritanicoDias,
    int MinutosResiduaisMinutos,
    int LimiteHoraExtraDiariaMinutos,
    int IntervaloIntrajornadaMaxMinutos,
    int DiasConsecutivosLimite,
    int LimiteBancoHorasPositivoMinutos,
    int LimiteBancoHorasNegativoMinutos,
    int RecorrenciaRiscoLimite,
    string Responsavel
);

public record AuditoriaPontoReprocessarRequest(
    DateOnly De,
    DateOnly Ate,
    int? FilialId,
    int? DeptoId,
    bool PreservarTratamentos,
    string Responsavel
);

public record AuditoriaPontoReprocessarResponse(
    string JobId,
    string Status,
    int EventosNaFila
);

public record AuditoriaPontoMaiorRiscoDto(
    string AnomaliaId,
    string Severidade,
    string Mensagem,
    string Departamento,
    string Colaborador
);

public record AuditoriaPontoRankingDto(
    string Id,
    string Label,
    int Total,
    int Pendentes,
    int Criticas,
    int Altas
);

public record AuditoriaPontoImpactoFinanceiroDto(
    decimal TotalEstimado,
    decimal AbsenteismoEstimado,
    decimal ExtrasEstimado,
    decimal AjustesFolhaEstimado,
    int DepartamentosComCusto,
    string Memoria
);
