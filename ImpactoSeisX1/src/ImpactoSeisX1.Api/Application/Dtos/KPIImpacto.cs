using System.Text.Json.Serialization;

namespace ImpactoSeisX1.Api.Application.Dtos;

public sealed record KPIImpacto
{
    public required int TotalFuncionarios { get; init; }

    [JsonPropertyName("afetadosPEC")]
    public required int AfetadosPec { get; init; }

    public required int NaoAfetados { get; init; }
    public required decimal PercentualAfetados { get; init; }

    public required decimal ImpactoFinanceiroMensalFase1 { get; init; }
    public required decimal ImpactoFinanceiroMensalFase2 { get; init; }

    public required decimal HeadcountNecessarioFase1 { get; init; }
    public required decimal HeadcountNecessarioFase2 { get; init; }

    public required IReadOnlyList<DepartamentoImpactoDto> PorDepartamento { get; init; }
}

public sealed record DepartamentoImpactoDto
{
    public required string Departamento { get; init; }
    public required int Funcionarios { get; init; }
    public required int Afetados { get; init; }
    public required decimal PercentualAfetados { get; init; }
    public required decimal CustoAdicionalMensalFase1 { get; init; }
    public required decimal CustoAdicionalMensalFase2 { get; init; }
    public required decimal HeadcountGap { get; init; }
    public required string NivelRisco { get; init; }
}
