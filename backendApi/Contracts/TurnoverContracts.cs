namespace BackendApi.Contracts;

public record TurnoverResumoRequest(
    DateOnly De,
    DateOnly Ate,
    int? FilialId,
    string? CompetenciaInicial,
    string? CompetenciaFinal
);

public record TurnoverResumoResponse(
    IReadOnlyCollection<TurnoverMesDto> Meses
);

public record TurnoverMesDto(
    string Competencia,
    int Desligados,
    int Admitidos,
    int TotalColaboradores,
    int Horistas,
    int Mensalistas,
    int Estagiarios
);

