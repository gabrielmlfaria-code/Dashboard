namespace BackendApi.Contracts;

public record Nr1EstadoRequest();

public record Nr1EstadoResponse(
    IReadOnlyCollection<Nr1RegistroDto> Registros,
    IReadOnlyDictionary<string, bool> CheckState,
    IReadOnlyDictionary<string, object?> ChecklistMeta,
    IReadOnlyDictionary<string, object?> CardsProg,
    DateTimeOffset? UpdatedAt
);

public record Nr1SalvarEstadoRequest(
    IReadOnlyCollection<Nr1RegistroDto> Registros,
    IReadOnlyDictionary<string, bool> CheckState,
    IReadOnlyDictionary<string, object?> ChecklistMeta,
    IReadOnlyDictionary<string, object?> CardsProg
);

public record Nr1RegistroDto(
    string Id,
    DateOnly Data,
    string Tipo,
    string? Setor,
    string Resp,
    int? Part,
    string Status,
    string? Risco,
    DateOnly? Prazo,
    string? Desc,
    IReadOnlyCollection<AnexoDto>? Anexos
);

