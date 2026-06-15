namespace BackendApi.Contracts;

public record RadarTrabalhistaResumoRequest(
    DateOnly De,
    DateOnly Ate,
    int? FilialId,
    int? DeptoId
);

public record RadarTrabalhistaResumoResponse(
    int Ocorrencias,
    int Colaboradores,
    RadarPrincipalEventoDto PrincipalEvento
);

public record RadarPrincipalEventoDto(
    string Label,
    int Count
);

