namespace BackendApi.Contracts;

public record SaudePreventivaRegistrosRequest();

public record SaudePreventivaRegistrosResponse(
    IReadOnlyCollection<SaudePreventivaRegistroDto> Registros,
    DateTimeOffset? UpdatedAt
);

public record SaudePreventivaSalvarRegistrosRequest(
    IReadOnlyCollection<SaudePreventivaRegistroDto> Registros
);

public record SaudePreventivaRegistroDto(
    string Id,
    DateOnly Data,
    string Tema,
    string Canal,
    string Responsavel,
    int? Colaboradores,
    string Status,
    IReadOnlyDictionary<string, bool>? Checklist,
    string? PublicoAlcance,
    string? Departamentos,
    string? ListaNominal,
    bool? Art473Comunicado,
    string? Obs,
    IReadOnlyCollection<AnexoDto>? Anexos
);

