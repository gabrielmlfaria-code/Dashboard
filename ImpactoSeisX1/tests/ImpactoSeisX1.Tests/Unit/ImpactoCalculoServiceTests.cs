using ImpactoSeisX1.Api.Domain.Calculo;
using ImpactoSeisX1.Api.Domain.Entities;
using ImpactoSeisX1.Api.Domain.Enums;

namespace ImpactoSeisX1.Tests.Unit;

public class ImpactoCalculoServiceTests
{
    private readonly ImpactoCalculoService _sut = new();

    [Fact]
    public void Calcular_IdentificaAfetadosSomenteEscala6x1()
    {
        var lista = CriarLista(
            ("Ana", "Ops", TipoEscala.SeisPorUm, 3200m),
            ("Bruno", "RH", TipoEscala.CincoPorDois, 4000m),
            ("Carla", "Ops", TipoEscala.DozePorTrintaSeis, 3800m));

        var kpi = _sut.Calcular(lista);

        Assert.Equal(3, kpi.TotalFuncionarios);
        Assert.Equal(1, kpi.AfetadosPec);
        Assert.Equal(2, kpi.NaoAfetados);
    }

    [Fact]
    public void Calcular_ImpactoMensalFase1_UsaFormulaComConstantes()
    {
        var salario = 2200m;
        var lista = CriarLista(("Ana", "Ops", TipoEscala.SeisPorUm, salario));
        var custoHora = salario / 220m;
        var esperado = (44m - 42m) * custoHora * 4.33m;

        var kpi = _sut.Calcular(lista);

        Assert.Equal(Math.Round(esperado, 2), kpi.ImpactoFinanceiroMensalFase1);
    }

    [Fact]
    public void Calcular_HeadcountGapFase1_UmaCasaDecimal()
    {
        var lista = CriarLista(
            ("Ana", "Ops", TipoEscala.SeisPorUm, 3000m),
            ("Bruno", "Ops", TipoEscala.SeisPorUm, 3000m));

        var kpi = _sut.Calcular(lista);
        var horasPerdidas = 2m * (44m - 42m) * 4.33m;
        var esperado = Math.Round(horasPerdidas / (42m * 4.33m), 1);

        Assert.Equal(esperado, kpi.HeadcountNecessarioFase1);
    }

    [Theory]
    [InlineData(0.70, "Alto")]
    [InlineData(0.50, "Médio")]
    [InlineData(0.39, "Baixo")]
    public void ClassificarRisco_RespeitaLimites(decimal percentual, string esperado)
    {
        Assert.Equal(esperado, ImpactoCalculoService.ClassificarRisco(percentual));
    }

    [Fact]
    public void Calcular_RiscoDepartamento_OperacoesMedioComDoisDeTresAfetados()
    {
        var lista = CriarLista(
            ("Ana", "Operações", TipoEscala.SeisPorUm, 3000m),
            ("Bruno", "Operações", TipoEscala.SeisPorUm, 3000m),
            ("Carla", "Operações", TipoEscala.CincoPorDois, 3000m));

        var kpi = _sut.Calcular(lista);
        var ops = Assert.Single(kpi.PorDepartamento, d => d.Departamento == "Operações");

        Assert.Equal("Médio", ops.NivelRisco);
        Assert.Equal(66.67m, ops.PercentualAfetados);
    }

    [Fact]
    public void Calcular_RiscoDepartamento_AltoQuandoSetentaPorCentoOuMais()
    {
        var lista = CriarLista(
            ("Ana", "Ops", TipoEscala.SeisPorUm, 3000m),
            ("Bruno", "Ops", TipoEscala.SeisPorUm, 3000m),
            ("Carla", "Ops", TipoEscala.SeisPorUm, 3000m),
            ("Diego", "Ops", TipoEscala.CincoPorDois, 3000m));

        var kpi = _sut.Calcular(lista);
        var ops = Assert.Single(kpi.PorDepartamento);

        Assert.Equal("Alto", ops.NivelRisco);
        Assert.Equal(75m, ops.PercentualAfetados);
    }

    private static List<Funcionario> CriarLista(params (string Nome, string Depto, TipoEscala Escala, decimal Salario)[] itens)
    {
        return itens.Select(i => new Funcionario
        {
            Nome = i.Nome,
            Departamento = i.Depto,
            TipoEscala = i.Escala,
            HorasSemanais = 44m,
            SalarioMensal = i.Salario
        }).ToList();
    }
}
