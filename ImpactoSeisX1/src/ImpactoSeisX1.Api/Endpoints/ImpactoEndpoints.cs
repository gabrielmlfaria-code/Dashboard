using ImpactoSeisX1.Api.Application.Interfaces;

namespace ImpactoSeisX1.Api.Endpoints;

public static class ImpactoEndpoints
{
    private const long TamanhoMaximoArquivo = 10 * 1024 * 1024;

    public static IEndpointRouteBuilder MapImpactoEndpoints(this IEndpointRouteBuilder app)
    {
        var grupo = app.MapGroup("/api/impacto")
            .WithTags("Impacto PEC 6x1");

        grupo.MapPost("/importar", ImportarAsync)
            .WithName("ImportarPlanilha")
            .DisableAntiforgery()
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest);

        grupo.MapGet("/template", BaixarTemplate)
            .WithName("BaixarTemplate");

        grupo.MapGet("/from-api", ObterDaApiAsync)
            .WithName("ObterImpactoDaApi")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest);

        return app;
    }

    private static async Task<IResult> ImportarAsync(
        IFormFile? arquivo,
        IFuncionarioExcelService excelService,
        IImpactoCalculoService calculoService,
        CancellationToken cancellationToken)
    {
        var validacao = ValidarArquivoXlsx(arquivo);
        if (validacao is not null)
            return validacao;

        await using var stream = arquivo!.OpenReadStream();
        var funcionarios = await excelService.ImportarAsync(stream, cancellationToken);

        var resultadoLista = ValidarListaNaoVazia(funcionarios);
        if (resultadoLista is not null)
            return resultadoLista;

        var kpi = calculoService.Calcular(funcionarios);
        return Results.Ok(kpi);
    }

    private static IResult BaixarTemplate(IFuncionarioExcelService excelService)
    {
        var bytes = excelService.GerarTemplate();
        return Results.File(
            bytes,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "impacto-seis-x1-template.xlsx");
    }

    private static async Task<IResult> ObterDaApiAsync(
        string? baseUrl,
        IFuncionarioJornadaApiClient apiClient,
        IImpactoCalculoService calculoService,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            return Results.BadRequest(new
            {
                erro = "Informe o parâmetro baseUrl com a URL base da API de jornadas."
            });
        }

        if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            return Results.BadRequest(new
            {
                erro = "baseUrl inválida. Use uma URL absoluta http ou https."
            });
        }

        try
        {
            var funcionarios = await apiClient.ObterJornadasAsync(baseUrl, cancellationToken);

            var resultadoLista = ValidarListaNaoVazia(funcionarios);
            if (resultadoLista is not null)
                return resultadoLista;

            var kpi = calculoService.Calcular(funcionarios);
            return Results.Ok(kpi);
        }
        catch (HttpRequestException ex)
        {
            return Results.BadRequest(new
            {
                erro = $"Não foi possível obter jornadas em {baseUrl}/api/funcionarios/jornadas.",
                detalhe = ex.Message
            });
        }
    }

    private static IResult? ValidarArquivoXlsx(IFormFile? arquivo)
    {
        if (arquivo is null || arquivo.Length == 0)
        {
            return Results.BadRequest(new
            {
                erro = "Envie um arquivo .xlsx no campo 'arquivo' (multipart/form-data)."
            });
        }

        if (arquivo.Length > TamanhoMaximoArquivo)
        {
            return Results.BadRequest(new
            {
                erro = "Arquivo excede o tamanho máximo permitido (10 MB)."
            });
        }

        var extensao = Path.GetExtension(arquivo.FileName);
        if (!string.Equals(extensao, ".xlsx", StringComparison.OrdinalIgnoreCase))
        {
            return Results.BadRequest(new
            {
                erro = "Formato inválido. Envie apenas arquivos com extensão .xlsx."
            });
        }

        return null;
    }

    private static IResult? ValidarListaNaoVazia(IReadOnlyList<Domain.Entities.Funcionario> funcionarios)
    {
        if (funcionarios.Count > 0)
            return null;

        return Results.BadRequest(new
        {
            erro = "Nenhum funcionário válido encontrado após a leitura. Verifique colunas, valores positivos de salário/horas e o cabeçalho na linha 1."
        });
    }
}
