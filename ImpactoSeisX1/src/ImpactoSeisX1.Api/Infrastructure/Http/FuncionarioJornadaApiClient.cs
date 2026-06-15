using System.Net.Http.Json;
using ImpactoSeisX1.Api.Application.Dtos;
using ImpactoSeisX1.Api.Application.Interfaces;
using ImpactoSeisX1.Api.Application.Services;
using ImpactoSeisX1.Api.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace ImpactoSeisX1.Api.Infrastructure.Http;

public sealed class FuncionarioJornadaApiClient(
    HttpClient httpClient,
    ILogger<FuncionarioJornadaApiClient> logger) : IFuncionarioJornadaApiClient
{
    public async Task<IReadOnlyList<Funcionario>> ObterJornadasAsync(
        string baseUrl,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(baseUrl))
            throw new ArgumentException("baseUrl é obrigatória.", nameof(baseUrl));

        var urlBase = baseUrl.TrimEnd('/');
        var url = $"{urlBase}/api/funcionarios/jornadas";

        var resposta = await httpClient.GetAsync(url, cancellationToken);
        resposta.EnsureSuccessStatusCode();

        var dados = await resposta.Content.ReadFromJsonAsync<List<FuncionarioJornadaApiDto>>(
            cancellationToken: cancellationToken);

        if (dados is null || dados.Count == 0)
            return [];

        var funcionarios = new List<Funcionario>();
        for (var i = 0; i < dados.Count; i++)
        {
            var item = dados[i];
            var linha = i + 1;
            var funcionario = FuncionarioMapper.TentarMapear(
                item.Nome,
                item.Departamento,
                item.TipoEscala,
                item.HorasSemanais,
                item.SalarioMensal,
                linha,
                logger);

            if (funcionario is not null)
                funcionarios.Add(funcionario);
        }

        return funcionarios;
    }
}
