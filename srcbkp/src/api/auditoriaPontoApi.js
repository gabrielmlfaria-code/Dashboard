import { z } from "zod";
import { ApiService } from "./apiService.js";
import { ApiRoutes } from "./apiRoutes.js";

function pickParams(obj) {
  const out = {};
  for (const [key, value] of Object.entries(obj || {})) {
    if (value != null && value !== "") out[key] = value;
  }
  return out;
}

function routeWithId(route, anomaliaId) {
  return route.replace(":anomaliaId", encodeURIComponent(String(anomaliaId || "")));
}

const RankingSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    total: z.number(),
    pendentes: z.number().optional(),
    criticas: z.number().optional(),
    altas: z.number().optional(),
  })
  .passthrough();

const ParametrosSchema = z
  .object({
    toleranciaMinutos: z.number(),
    toleranciaDuplicidadeMinutos: z.number(),
    janelaPareamentoMaxMinutos: z.number(),
    intervaloIntrajornadaMinutos: z.number(),
    jornadaIntrajornadaMinutos: z.number(),
    intervaloInterjornadaMinutos: z.number(),
    pontoBritanicoDias: z.number(),
    minutosResiduaisMinutos: z.number(),
    limiteHoraExtraDiariaMinutos: z.number(),
    intervaloIntrajornadaMaxMinutos: z.number(),
    diasConsecutivosLimite: z.number(),
    limiteBancoHorasPositivoMinutos: z.number(),
    limiteBancoHorasNegativoMinutos: z.number(),
    recorrenciaRiscoLimite: z.number(),
    escopo: z.string().optional(),
    versao: z.string().optional(),
    atualizadoEm: z.string().nullable().optional(),
    atualizadoPor: z.string().optional(),
  })
  .passthrough();

const ResumoSchema = z
  .object({
    totalAnomalias: z.number(),
    criticas: z.number(),
    altas: z.number(),
    medias: z.number(),
    baixas: z.number(),
    pendentes: z.number(),
    emAnalise: z.number(),
    justificadas: z.number(),
    ajustesFolha: z.number(),
    resolvidas: z.number(),
    ignoradas: z.number(),
    percentualTratado: z.number(),
    maiorRisco: z.object({}).passthrough(),
    departamentosCriticos: z.array(RankingSchema),
    colaboradoresCriticos: z.array(RankingSchema),
    regrasCriticas: z.array(RankingSchema),
    impactoFinanceiro: z.object({}).passthrough(),
  })
  .passthrough();

const AnomaliaSchema = z
  .object({
    id: z.string(),
    data: z.string(),
    matricula: z.string(),
    colaborador: z.string(),
    departamento: z.string(),
    cargo: z.string(),
    eventoCodigo: z.string(),
    eventoDescricao: z.string(),
    horarioPlanejado: z.string(),
    marcacoes: z.string(),
    horasEvento: z.string(),
    horasMarcacoes: z.string(),
    regraCodigo: z.string(),
    regraAplicada: z.string(),
    versaoRegra: z.string(),
    severidade: z.string(),
    status: z.string(),
    mensagem: z.string(),
    detalhe: z.string(),
    responsavel: z.string().optional(),
    atualizadoEm: z.string().nullable().optional(),
    versaoMotor: z.string(),
    hashRegrasAtivas: z.string(),
  })
  .passthrough();

const PagedAnomaliasSchema = z
  .object({
    items: z.array(AnomaliaSchema),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
  })
  .passthrough();

const MemoriaSchema = z
  .object({
    anomaliaId: z.string(),
    versaoMotor: z.string(),
    hashRegrasAtivas: z.string(),
    statusFechamento: z.string(),
    statusJornada: z.string(),
    processadoEm: z.string(),
    parametrosSnapshot: ParametrosSchema,
    regrasAcionadas: z.array(z.object({}).passthrough()),
  })
  .passthrough();

const TratamentoSchema = z
  .object({
    anomaliaId: z.string(),
    status: z.string(),
    justificativa: z.string(),
    responsavel: z.string(),
    atualizadoEm: z.string(),
  })
  .passthrough();

const HistoricoTratamentoSchema = z
  .object({
    anomaliaId: z.string(),
    items: z.array(z.object({}).passthrough()),
  })
  .passthrough();

const ReprocessamentoSchema = z
  .object({
    jobId: z.string(),
    status: z.string(),
    eventosNaFila: z.number(),
  })
  .passthrough();

export const AuditoriaPontoApi = {
  getResumo(params = {}) {
    return ApiService.call(ApiRoutes.auditoriaPonto.resumo, pickParams(params), {
      module: "auditoriaPonto",
      schema: ResumoSchema,
      label: "Auditoria de ponto - resumo",
    });
  },

  getAnomalias(params = {}) {
    return ApiService.call(ApiRoutes.auditoriaPonto.anomalias, pickParams(params), {
      module: "auditoriaPonto",
      schema: PagedAnomaliasSchema,
      label: "Auditoria de ponto - anomalias",
    });
  },

  getMemoria(anomaliaId) {
    return ApiService.call(routeWithId(ApiRoutes.auditoriaPonto.memoria, anomaliaId), {}, {
      module: "auditoriaPonto",
      schema: MemoriaSchema,
      label: "Auditoria de ponto - memoria",
    });
  },

  salvarTratamento(body = {}) {
    return ApiService.callPost(ApiRoutes.auditoriaPonto.tratamentos, body, {
      module: "auditoriaPonto",
      schema: TratamentoSchema,
      label: "Auditoria de ponto - salvar tratamento",
    });
  },

  getHistoricoTratamento(anomaliaId) {
    return ApiService.call(routeWithId(ApiRoutes.auditoriaPonto.historicoTratamento, anomaliaId), {}, {
      module: "auditoriaPonto",
      schema: HistoricoTratamentoSchema,
      label: "Auditoria de ponto - historico de tratamento",
    });
  },

  getParametros(params = {}) {
    return ApiService.call(ApiRoutes.auditoriaPonto.parametros, pickParams(params), {
      module: "auditoriaPonto",
      schema: ParametrosSchema,
      label: "Auditoria de ponto - parametros",
    });
  },

  salvarParametros(body = {}) {
    return ApiService.callPut(ApiRoutes.auditoriaPonto.parametros, body, {
      module: "auditoriaPonto",
      schema: ParametrosSchema,
      label: "Auditoria de ponto - salvar parametros",
    });
  },

  reprocessar(body = {}) {
    return ApiService.callPost(ApiRoutes.auditoriaPonto.reprocessamentos, body, {
      module: "auditoriaPonto",
      schema: ReprocessamentoSchema,
      label: "Auditoria de ponto - reprocessamento",
    });
  },
};
