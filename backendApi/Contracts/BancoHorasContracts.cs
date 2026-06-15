namespace BackendApi.Contracts;

public record BancoHorasResumoRequest(
    DateOnly De,
    DateOnly Ate
);

public record BancoHorasResumoResponse(
    PeriodoDto Periodo,
    int? SaldoAnteriorMinutos,
    int CreditoMinutos,
    int DebitoMinutos,
    int SaldoProximoMinutos
);

public record BancoHorasDepartamentosRequest(
    DateOnly De,
    DateOnly Ate,
    int? Top
);

public record BancoHorasDepartamentoResponse(
    string Departamento,
    int? SaldoAnteriorMinutos,
    int CreditoMinutos,
    int DebitoMinutos,
    int SaldoProximoMinutos,
    int? Colaboradores
);

public record BancoHorasColaboradoresRequest(
    DateOnly De,
    DateOnly Ate,
    string? Departamento,
    int? Page,
    int? PageSize,
    string? SortBy,
    string? SortDir
);

public record BancoHorasColaboradorResponse(
    string Matricula,
    string Nome,
    string Filial,
    string Departamento,
    string Cargo,
    string Atividade,
    DateOnly? PeriodoInicial,
    DateOnly? PeriodoFinal,
    int? SaldoAnteriorMinutos,
    int CreditoMinutos,
    int DebitoMinutos,
    int SaldoProximoMinutos
);

