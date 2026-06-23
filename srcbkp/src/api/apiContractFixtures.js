export const apiContractFixtures = Object.freeze({
  posicaoDiaEnvelope: {
    data: [
      {
        data: "2026-06-09",
        filial: "Matriz",
        departamento: "Produção",
        cargo: "Operador",
        genero: "F",
        presentes: 42,
        faltas: 3,
        ausentes: 3,
        atrasos: 2,
        folgas: 1,
        ferias: 4,
        afastados: 1,
        jaSairam: 0,
        entradaPrevista: 0,
        naoControlaPonto: 2,
      },
    ],
    generatedAt: "2026-06-09T12:00:00.000Z",
    traceId: "trace-posicao-1",
    fonteDados: "sqlserver",
    versaoRegra: "posicao-v1",
  },

  absenteismoResumoEnvelope: {
    data: {
      periodo: {
        de: "2026-06-01",
        ate: "2026-06-09",
        label: "jun/2026",
      },
      horasPlanejadasMinutos: 120000,
      horasTrabalhadasMinutos: 114300,
      horasAusentesMinutos: 4200,
      horasJustificadasMinutos: 1500,
      indicePercentual: 4.75,
      metaPercentual: 5,
      calculo: {
        formula: "(horasAusentesMinutos / horasPlanejadasMinutos) * 100",
        base: "horasPlanejadasMinutos",
        entradas: {
          horasAusentesMinutos: 5700,
          horasPlanejadasMinutos: 120000,
        },
        resultado: 4.75,
        versaoRegra: "abs-v1",
      },
    },
    generatedAt: "2026-06-09T12:00:00.000Z",
    traceId: "trace-abs-1",
    fonteDados: "sqlserver",
    versaoRegra: "abs-v1",
  },

  bancoHorasResumoEnvelope: {
    data: {
      periodo: {
        de: "2026-06-01",
        ate: "2026-06-09",
        label: "jun/2026",
      },
      saldoAnteriorMinutos: 900,
      creditoMinutos: 2400,
      debitoMinutos: 1200,
      saldoProximoMinutos: 2100,
    },
    generatedAt: "2026-06-09T12:00:00.000Z",
    traceId: "trace-bh-1",
    fonteDados: "sqlserver",
    versaoRegra: "bh-v1",
  },

  fechamentoMensalEnvelope: {
    data: {
      periodo: {
        de: "2026-06-01",
        ate: "2026-06-09",
        label: "jun/2026",
      },
      eventos: [
        {
          codigoEvento: "001",
          descricaoEvento: "FALTA INJUSTIFICADA",
          categoria: "ausencia",
          competencia: "2026-06",
          horasMinutos: 4200,
          variacaoPercentual: 8.2,
        },
      ],
    },
    generatedAt: "2026-06-09T12:00:00.000Z",
    traceId: "trace-mensal-1",
    fonteDados: "sqlserver",
    versaoRegra: "mensal-v1",
  },

  turnoverResumoEnvelope: {
    data: {
      periodo: {
        de: "2026-05-01",
        ate: "2026-06-30",
        label: "mai-jun/2026",
      },
      meses: [
        {
          competencia: "2026-06",
          desligados: 2,
          admitidos: 4,
          totalColaboradores: 100,
          horistas: 60,
          mensalistas: 35,
          estagiarios: 5,
          rotatividadePercentual: 3,
        },
        {
          competencia: "2026-05",
          desligados: 1,
          admitidos: 3,
          totalColaboradores: 80,
          horistas: 50,
          mensalistas: 26,
          estagiarios: 4,
          rotatividadePercentual: 2.5,
        },
      ],
    },
    generatedAt: "2026-06-09T12:00:00.000Z",
    traceId: "trace-turnover-1",
    fonteDados: "sqlserver",
    versaoRegra: "turnover-v1",
  },

  radarTrabalhistaEnvelope: {
    data: {
      periodo: {
        de: "2026-06-01",
        ate: "2026-06-09",
        label: "jun/2026",
      },
      ocorrencias: 12,
      colaboradoresImpactados: 7,
      principalEvento: {
        codigo: "REF06",
        descricao: "MAIS DE 6 HORAS SEM REFEICAO",
        ocorrencias: 5,
        colaboradores: 4,
      },
    },
    generatedAt: "2026-06-09T12:00:00.000Z",
    traceId: "trace-radar-1",
    fonteDados: "sqlserver",
    versaoRegra: "radar-v1",
  },
});
