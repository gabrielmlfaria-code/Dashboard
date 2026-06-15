using ImpactoSeisX1.Api.Application.Dtos;
using ImpactoSeisX1.Api.Domain.Entities;

namespace ImpactoSeisX1.Api.Application.Interfaces;

public interface IImpactoCalculoService
{
    KPIImpacto Calcular(IReadOnlyList<Funcionario> funcionarios);
}
