namespace BackendApi.Contracts;

public record PagedResponse<T>(
    IReadOnlyCollection<T> Items,
    int Total,
    int Page,
    int PageSize
);

public record PeriodoDto(
    DateOnly De,
    DateOnly Ate,
    string Fonte,
    DateTimeOffset? AtualizadoEm
);

public record OkResponse(
    bool Ok
);

public record AnexoDto(
    string Id,
    string Nome,
    string Tipo,
    long Tamanho
);

