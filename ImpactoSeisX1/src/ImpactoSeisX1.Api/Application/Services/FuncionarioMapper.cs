using ImpactoSeisX1.Api.Domain;
using ImpactoSeisX1.Api.Domain.Entities;
using ImpactoSeisX1.Api.Domain.Enums;
using Microsoft.Extensions.Logging;

namespace ImpactoSeisX1.Api.Application.Services;

public static class FuncionarioMapper
{
    public static Funcionario? TentarMapear(
        string? nome,
        string? departamento,
        string? tipoEscalaTexto,
        decimal horasSemanais,
        decimal salarioMensal,
        int linha,
        ILogger logger)
    {
        if (salarioMensal <= 0 || horasSemanais <= 0)
        {
            logger.LogWarning(
                "Linha {Linha} ignorada: SalarioMensal ({Salario}) ou HorasSemanais ({Horas}) inválidos.",
                linha, salarioMensal, horasSemanais);
            return null;
        }

        if (string.IsNullOrWhiteSpace(nome) || string.IsNullOrWhiteSpace(departamento))
        {
            logger.LogWarning("Linha {Linha} ignorada: Nome ou Departamento vazio.", linha);
            return null;
        }

        if (!TipoEscalaParser.TryParse(tipoEscalaTexto, out var tipo))
        {
            logger.LogWarning(
                "Linha {Linha}: TipoEscala '{TipoEscala}' inválida — assumindo 5x2.",
                linha, tipoEscalaTexto);
            tipo = TipoEscala.CincoPorDois;
        }

        return new Funcionario
        {
            Nome = nome.Trim(),
            Departamento = departamento.Trim(),
            TipoEscala = tipo,
            HorasSemanais = horasSemanais,
            SalarioMensal = salarioMensal
        };
    }
}
