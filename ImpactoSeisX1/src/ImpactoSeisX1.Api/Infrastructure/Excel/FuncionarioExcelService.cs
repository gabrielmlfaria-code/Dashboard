using ClosedXML.Excel;
using ImpactoSeisX1.Api.Application.Interfaces;
using ImpactoSeisX1.Api.Application.Services;
using ImpactoSeisX1.Api.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace ImpactoSeisX1.Api.Infrastructure.Excel;

public sealed class FuncionarioExcelService(ILogger<FuncionarioExcelService> logger) : IFuncionarioExcelService
{
    private static readonly string[] Cabecalho =
    [
        "Nome",
        "Departamento",
        "TipoEscala",
        "HorasSemanais",
        "SalarioMensal"
    ];

    private static readonly (string Nome, string Depto, string Escala, decimal Horas, decimal Salario)[] Exemplos =
    [
        ("Ana Silva", "Operações", "6x1", 44m, 3200m),
        ("Bruno Costa", "Operações", "6x1", 44m, 2850m),
        ("Carla Mendes", "Administrativo", "5x2", 40m, 4500m),
        ("Diego Souza", "Logística", "12x36", 36m, 3800m),
        ("Elena Rocha", "Operações", "6x1", 44m, 3100m)
    ];

    public Task<IReadOnlyList<Funcionario>> ImportarAsync(Stream arquivo, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        using var workbook = new XLWorkbook(arquivo);
        var planilha = workbook.Worksheets.First();
        var funcionarios = new List<Funcionario>();
        var ultimaLinha = planilha.LastRowUsed()?.RowNumber() ?? 1;

        for (var linha = 2; linha <= ultimaLinha; linha++)
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (LinhaVazia(planilha, linha))
                continue;

            var nome = planilha.Cell(linha, 1).GetString();
            var departamento = planilha.Cell(linha, 2).GetString();
            var tipoEscala = planilha.Cell(linha, 3).GetString();
            var horas = ObterDecimal(planilha.Cell(linha, 4));
            var salario = ObterDecimal(planilha.Cell(linha, 5));

            var funcionario = FuncionarioMapper.TentarMapear(
                nome, departamento, tipoEscala, horas, salario, linha, logger);

            if (funcionario is not null)
                funcionarios.Add(funcionario);
        }

        return Task.FromResult<IReadOnlyList<Funcionario>>(funcionarios);
    }

    public byte[] GerarTemplate()
    {
        using var workbook = new XLWorkbook();
        var planilha = workbook.Worksheets.Add("Funcionarios");

        for (var col = 0; col < Cabecalho.Length; col++)
        {
            var celula = planilha.Cell(1, col + 1);
            celula.Value = Cabecalho[col];
            celula.Style.Font.Bold = true;
            celula.Style.Font.FontColor = XLColor.White;
            celula.Style.Fill.BackgroundColor = XLColor.FromHtml("#1F3864");
        }

        for (var i = 0; i < Exemplos.Length; i++)
        {
            var (nome, depto, escala, horas, salario) = Exemplos[i];
            var linha = i + 2;
            planilha.Cell(linha, 1).Value = nome;
            planilha.Cell(linha, 2).Value = depto;
            planilha.Cell(linha, 3).Value = escala;
            planilha.Cell(linha, 4).Value = horas;
            planilha.Cell(linha, 5).Value = salario;
        }

        planilha.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    private static bool LinhaVazia(IXLWorksheet planilha, int linha)
    {
        for (var col = 1; col <= 5; col++)
        {
            if (!planilha.Cell(linha, col).IsEmpty())
                return false;
        }
        return true;
    }

    private static decimal ObterDecimal(IXLCell celula)
    {
        if (celula.IsEmpty())
            return 0m;

        if (celula.TryGetValue(out decimal valorDecimal))
            return valorDecimal;

        if (celula.TryGetValue(out double valorDouble))
            return (decimal)valorDouble;

        var texto = celula.GetString().Replace(",", ".", StringComparison.Ordinal);
        return decimal.TryParse(texto, System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : 0m;
    }
}
