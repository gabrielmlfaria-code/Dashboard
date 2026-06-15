using ImpactoSeisX1.Api.Domain.Entities;

namespace ImpactoSeisX1.Api.Application.Interfaces;

public interface IFuncionarioExcelService
{
    Task<IReadOnlyList<Funcionario>> ImportarAsync(Stream arquivo, CancellationToken cancellationToken = default);

    byte[] GerarTemplate();
}
