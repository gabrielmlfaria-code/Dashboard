using ImpactoSeisX1.Api.Domain.Enums;

namespace ImpactoSeisX1.Api.Domain;

public static class TipoEscalaParser
{
    public static bool TryParse(string? valor, out TipoEscala tipo)
    {
        tipo = TipoEscala.CincoPorDois;
        if (string.IsNullOrWhiteSpace(valor))
            return false;

        var normalizado = valor.Trim().Replace(" ", "", StringComparison.Ordinal)
            .ToLowerInvariant();

        switch (normalizado)
        {
            case "6x1":
                tipo = TipoEscala.SeisPorUm;
                return true;
            case "12x36":
                tipo = TipoEscala.DozePorTrintaSeis;
                return true;
            case "5x2":
                tipo = TipoEscala.CincoPorDois;
                return true;
            default:
                return false;
        }
    }

    public static string ParaTexto(TipoEscala tipo) => tipo switch
    {
        TipoEscala.SeisPorUm => "6x1",
        TipoEscala.DozePorTrintaSeis => "12x36",
        TipoEscala.CincoPorDois => "5x2",
        _ => "5x2"
    };

    public static bool EhAfetado(TipoEscala tipo) => tipo == TipoEscala.SeisPorUm;
}
