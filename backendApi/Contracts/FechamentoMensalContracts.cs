namespace BackendApi.Contracts;

public record FechamentoMensalEventosRequest(
    DateOnly De,
    DateOnly Ate,
    string? Competencia
);

public record FechamentoMensalEventoResponse(
    string CodigoEvento,
    string DescricaoEvento,
    string? Categoria,
    string Competencia,
    int HorasMinutos,
    decimal? VariacaoPercentual
);

