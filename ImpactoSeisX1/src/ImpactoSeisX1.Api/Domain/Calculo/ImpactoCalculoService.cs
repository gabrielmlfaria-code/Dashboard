using ImpactoSeisX1.Api.Application.Dtos;
using ImpactoSeisX1.Api.Domain.Entities;

namespace ImpactoSeisX1.Api.Domain.Calculo;

public sealed class ImpactoCalculoService
{
    public KPIImpacto Calcular(IReadOnlyList<Funcionario> funcionarios)
    {
        if (funcionarios.Count == 0)
            throw new ArgumentException("A lista de funcionários não pode ser vazia.", nameof(funcionarios));

        var afetados = funcionarios.Where(f => f.Afetado).ToList();
        var total = funcionarios.Count;
        var totalAfetados = afetados.Count;

        var impactoFase1 = SomarImpactoMensal(afetados, ImpactoConstantes.HorasFase1);
        var impactoFase2 = SomarImpactoMensal(afetados, ImpactoConstantes.HorasFase2);

        var horasPerdidasFase1 = SomarHorasPerdidasMensais(afetados, ImpactoConstantes.HorasFase1);
        var horasPerdidasFase2 = SomarHorasPerdidasMensais(afetados, ImpactoConstantes.HorasFase2);

        return new KPIImpacto
        {
            TotalFuncionarios = total,
            AfetadosPec = totalAfetados,
            NaoAfetados = total - totalAfetados,
            PercentualAfetados = total == 0 ? 0 : Math.Round((decimal)totalAfetados / total * 100, 2),
            ImpactoFinanceiroMensalFase1 = Math.Round(impactoFase1, 2),
            ImpactoFinanceiroMensalFase2 = Math.Round(impactoFase2, 2),
            HeadcountNecessarioFase1 = CalcularHeadcountGap(horasPerdidasFase1, ImpactoConstantes.HorasFase1),
            HeadcountNecessarioFase2 = CalcularHeadcountGap(horasPerdidasFase2, ImpactoConstantes.HorasFase2),
            PorDepartamento = CalcularPorDepartamento(funcionarios)
        };
    }

    private static decimal SomarImpactoMensal(IEnumerable<Funcionario> afetados, decimal novoLimite)
    {
        var horasReduzidas = ImpactoConstantes.HorasAtuais - novoLimite;
        return afetados.Sum(f =>
            horasReduzidas * f.CustoHora * ImpactoConstantes.SemanasMes);
    }

    private static decimal SomarHorasPerdidasMensais(IEnumerable<Funcionario> afetados, decimal novoLimite)
    {
        var horasReduzidasSemanais = ImpactoConstantes.HorasAtuais - novoLimite;
        return afetados.Sum(_ => horasReduzidasSemanais * ImpactoConstantes.SemanasMes);
    }

    private static decimal CalcularHeadcountGap(decimal totalHorasPerdidas, decimal novoLimite)
    {
        if (totalHorasPerdidas <= 0)
            return 0m;

        var divisor = novoLimite * ImpactoConstantes.SemanasMes;
        if (divisor <= 0)
            return 0m;

        return Math.Round(totalHorasPerdidas / divisor, 1);
    }

    private static IReadOnlyList<DepartamentoImpactoDto> CalcularPorDepartamento(
        IReadOnlyList<Funcionario> funcionarios)
    {
        return funcionarios
            .GroupBy(f => f.Departamento.Trim(), StringComparer.OrdinalIgnoreCase)
            .Select(g =>
            {
                var lista = g.ToList();
                var total = lista.Count;
                var afetadosDept = lista.Where(f => f.Afetado).ToList();
                var afetados = afetadosDept.Count;
                var percentual = total == 0 ? 0m : (decimal)afetados / total;
                var horasPerdidasFase1 = SomarHorasPerdidasMensais(afetadosDept, ImpactoConstantes.HorasFase1);

                return new DepartamentoImpactoDto
                {
                    Departamento = g.Key,
                    Funcionarios = total,
                    Afetados = afetados,
                    PercentualAfetados = Math.Round(percentual * 100, 2),
                    CustoAdicionalMensalFase1 = Math.Round(
                        SomarImpactoMensal(afetadosDept, ImpactoConstantes.HorasFase1), 2),
                    CustoAdicionalMensalFase2 = Math.Round(
                        SomarImpactoMensal(afetadosDept, ImpactoConstantes.HorasFase2), 2),
                    HeadcountGap = CalcularHeadcountGap(horasPerdidasFase1, ImpactoConstantes.HorasFase1),
                    NivelRisco = ClassificarRisco(percentual)
                };
            })
            .OrderByDescending(d => d.PercentualAfetados)
            .ThenBy(d => d.Departamento)
            .ToList();
    }

    internal static string ClassificarRisco(decimal percentualAfetados)
    {
        if (percentualAfetados >= ImpactoConstantes.LimiteRiscoAlto)
            return "Alto";
        if (percentualAfetados >= ImpactoConstantes.LimiteRiscoMedio)
            return "Médio";
        return "Baixo";
    }
}
