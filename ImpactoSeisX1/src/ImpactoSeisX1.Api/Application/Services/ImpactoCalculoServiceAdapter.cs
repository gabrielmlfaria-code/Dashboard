using ImpactoSeisX1.Api.Application.Dtos;
using ImpactoSeisX1.Api.Application.Interfaces;
using ImpactoSeisX1.Api.Domain.Calculo;
using ImpactoSeisX1.Api.Domain.Entities;

namespace ImpactoSeisX1.Api.Application.Services;

public sealed class ImpactoCalculoServiceAdapter(ImpactoCalculoService calculo) : IImpactoCalculoService
{
    public KPIImpacto Calcular(IReadOnlyList<Funcionario> funcionarios) =>
        calculo.Calcular(funcionarios);
}
