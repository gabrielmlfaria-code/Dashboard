namespace BackendApi.Contracts;

public record AbonosResumoRequest(
    DateOnly De,
    DateOnly Ate,
    string? Status,
    int? FilialId,
    int? DeptoId
);

public record AbonosResumoResponse(
    int Pendentes,
    int Efetuados,
    int? Colaboradores,
    int? Departamentos
);

public record AbonosDepartamentosRequest(
    DateOnly De,
    DateOnly Ate,
    string? Status,
    int? Top
);

public record AbonosDepartamentoResponse(
    string Departamento,
    int Pendentes,
    int Efetuados,
    decimal? Sla
);

public record AbonosColaboradoresRequest(
    DateOnly De,
    DateOnly Ate,
    string? Status,
    string? Departamento,
    int? Page,
    int? PageSize
);

public record AbonosColaboradorResponse(
    string Matricula,
    string Nome,
    string Filial,
    string Departamento,
    string Cargo,
    string Status,
    int Pendentes,
    int Efetuados
);

