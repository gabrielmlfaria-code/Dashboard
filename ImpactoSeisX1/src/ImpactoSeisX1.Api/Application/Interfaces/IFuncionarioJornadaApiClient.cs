using ImpactoSeisX1.Api.Domain.Entities;

namespace ImpactoSeisX1.Api.Application.Interfaces;

public interface IFuncionarioJornadaApiClient
{
    Task<IReadOnlyList<Funcionario>> ObterJornadasAsync(string baseUrl, CancellationToken cancellationToken = default);
}
