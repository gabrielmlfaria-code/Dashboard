export const ApiRoutes = Object.freeze({
  health: "/health",
  auth: {
    login: "/auth/login",
    refresh: "/auth/refresh",
    me: "/auth/me",
    exchange: "/auth/exchange",
  },
  posicao: {
    dia: "/posicao/dia",
    historico: "/posicao/historico",
    filiais: "/posicao/filiais",
    forcaPrevista: {
      departamentos: "/posicao/forca-prevista/departamentos",
      salvar: "/posicao/forca-prevista/salvar",
      excluir: (idDepartamento) => `/posicao/forca-prevista/excluir/${idDepartamento}`,
      limpar: "/posicao/forca-prevista/limpar",
    },
  },
  absenteismo: {
    resumo: "/absenteismo/resumo",
    colaboradores: "/absenteismo/colaboradores",
    eventos: "/absenteismo/eventos",
    grupos: "/absenteismo/grupos",
    export: "/absenteismo/export",
  },
  bancoHoras: {
    resumo: "/banco-horas/resumo",
    departamentos: "/banco-horas/departamentos",
    colaboradores: "/banco-horas/colaboradores",
  },
  abonos: {
    resumo: "/abonos/resumo",
    departamentos: "/abonos/departamentos",
    colaboradores: "/abonos/colaboradores",
  },
  fechamentoMensal: {
    eventos: "/fechamento-mensal/eventos",
  },
  turnover: {
    resumo: "/turnover/resumo",
  },
  radarTrabalhista: {
    resumo: "/radar-trabalhista/resumo",
  },
  saudePreventiva: {
    registros: "/saude-preventiva/registros",
    anexos: "/saude-preventiva/anexos",
  },
  nr1: {
    estado: "/nr1/estado",
    anexos: "/nr1/anexos",
  },
  cct: {
    documentos: "/cct/documentos",
    upload: "/cct/documentos/upload",
  },
  radarPlaybook: {
    notas: "/radar-trabalhista/playbook/notas",
    auditoria: "/radar-trabalhista/playbook/auditoria",
  },
  auditoriaPonto: {
    resumo: "/auditoria-ponto/resumo",
    anomalias: "/auditoria-ponto/anomalias",
    memoria: "/auditoria-ponto/anomalias/:anomaliaId/memoria",
    tratamentos: "/auditoria-ponto/tratamentos",
    historicoTratamento: "/auditoria-ponto/tratamentos/:anomaliaId/historico",
    parametros: "/auditoria-ponto/parametros",
    reprocessamentos: "/auditoria-ponto/reprocessamentos",
  },
});
