using ImpactoSeisX1.Api.Domain.Enums;

namespace ImpactoSeisX1.Api.Domain.Entities;

public sealed class Funcionario
{
    public required string Nome { get; init; }
    public required string Departamento { get; init; }
    public required TipoEscala TipoEscala { get; init; }
    public required decimal HorasSemanais { get; init; }
    public required decimal SalarioMensal { get; init; }

    public bool Afetado => TipoEscalaParser.EhAfetado(TipoEscala);

    public decimal CustoHora => SalarioMensal / ImpactoConstantes.DivisorCustoHora;
}
