import { regraMarcacaoImpar } from "../regras/operacional/marcacaoImpar.js";
import { regraMarcacaoForaDeOrdem } from "../regras/operacional/marcacaoForaDeOrdem.js";
import { regraMarcacaoDuplicada } from "../regras/operacional/marcacaoDuplicada.js";
import { regraMarcacaoDeslocadaDeDia } from "../regras/operacional/marcacaoDeslocadaDeDia.js";
import { regraMarcacaoExcedente } from "../regras/operacional/marcacaoExcedente.js";
import { regraPareamentoAmbiguo } from "../regras/operacional/pareamentoAmbiguo.js";
import { regraIntervaloAtipicoMarcacoes } from "../regras/operacional/intervaloAtipicoMarcacoes.js";
import { regraSobreposicaoEventos } from "../regras/operacional/sobreposicaoEventos.js";
import { regraColaboradorForaPeriodoAtivo } from "../regras/legal/colaboradorForaPeriodoAtivo.js";
import { regraEventoSemMarcacao } from "../regras/legal/eventoSemMarcacao.js";
import { regraIntrajornadaInsuficiente } from "../regras/legal/intrajornadaInsuficiente.js";
import { regraInterjornadaInsuficiente } from "../regras/legal/interjornadaInsuficiente.js";
import { regraTrocaTurnoSemDescanso } from "../regras/legal/trocaTurnoSemDescanso.js";
import { regraAdicionalNoturnoNaoClassificado } from "../regras/legal/adicionalNoturnoNaoClassificado.js";
import { regraAdicionalNoturnoProrrogacaoNaoClassificada } from "../regras/legal/adicionalNoturnoProrrogacaoNaoClassificada.js";
import { regraHoraExtraAcimaLimiteLegal } from "../regras/legal/horaExtraAcimaLimiteLegal.js";
import { regraAusenciaComMarcacao } from "../regras/legal/ausenciaComMarcacao.js";
import { regraDomingoFeriadoSemClassificacao } from "../regras/legal/domingoFeriadoSemClassificacao.js";
import { regraFeriadoLocalSemClassificacao } from "../regras/legal/feriadoLocalSemClassificacao.js";
import { regraJornadaSemIntervalo } from "../regras/legal/jornadaSemIntervalo.js";
import { regraSequenciaDiasSemFolga } from "../regras/legal/sequenciaDiasSemFolga.js";
import { regraFechamentoComPendenciaCritica } from "../regras/legal/fechamentoComPendenciaCritica.js";
import { regraEvidenciaObrigatoriaAusente } from "../regras/legal/evidenciaObrigatoriaAusente.js";
import { regraHoraExtraSemMarcacao } from "../regras/financeiro/horaExtraSemMarcacao.js";
import { regraDivergenciaHorasEvento } from "../regras/financeiro/divergenciaHorasEvento.js";
import { regraDivergenciaPlanejado } from "../regras/financeiro/divergenciaPlanejado.js";
import { regraMinutosResiduaisExcedidos } from "../regras/financeiro/minutosResiduaisExcedidos.js";
import { regraSaidaAposEscalaSemExtra } from "../regras/financeiro/saidaAposEscalaSemExtra.js";
import { regraEntradaAntesEscalaSemExtra } from "../regras/financeiro/entradaAntesEscalaSemExtra.js";
import { regraBancoHorasIncompativel } from "../regras/financeiro/bancoHorasIncompativel.js";
import { regraBancoHorasSaldoExcedido } from "../regras/financeiro/bancoHorasSaldoExcedido.js";
import { regraDuplicidadeEventoRemunerado } from "../regras/financeiro/duplicidadeEventoRemunerado.js";
import { regraPontoBritanico } from "../regras/fraude/pontoBritanico.js";
import { regraTratamentoManualRecorrente } from "../regras/fraude/tratamentoManualRecorrente.js";
import { regraRiscoRecorrente } from "../regras/fraude/riscoRecorrente.js";
import { regraMarcacaoSemEscala } from "../regras/configuracao/marcacaoSemEscala.js";
import { regraJornadaIncoerente } from "../regras/configuracao/jornadaIncoerente.js";
import { regraPresencaSemJornadaUtil } from "../regras/configuracao/presencaSemJornadaUtil.js";
import { regraParametrizacaoIncompleta } from "../regras/configuracao/parametrizacaoIncompleta.js";

export const REGRAS_AUDITORIA_PONTO = [
  { id: "EVENTO_SEM_MARCACAO", versao: "1.0.0", run: regraEventoSemMarcacao },
  { id: "COLABORADOR_FORA_PERIODO_ATIVO", versao: "1.0.0", run: regraColaboradorForaPeriodoAtivo },
  { id: "AUSENCIA_COM_MARCACAO", versao: "1.0.0", run: regraAusenciaComMarcacao },
  { id: "MARCACAO_IMPAR", versao: "1.0.0", run: regraMarcacaoImpar },
  { id: "MARCACAO_DUPLICADA", versao: "1.0.0", run: regraMarcacaoDuplicada },
  { id: "MARCACAO_FORA_DE_ORDEM", versao: "1.0.0", run: regraMarcacaoForaDeOrdem },
  { id: "MARCACAO_DESLOCADA_DE_DIA", versao: "1.0.0", run: regraMarcacaoDeslocadaDeDia },
  { id: "MARCACAO_EXCEDENTE", versao: "1.0.0", run: regraMarcacaoExcedente },
  { id: "PAREAMENTO_AMBIGUO", versao: "1.0.0", run: regraPareamentoAmbiguo },
  { id: "INTERVALO_ATIPICO_MARCACOES", versao: "1.0.0", run: regraIntervaloAtipicoMarcacoes },
  { id: "SOBREPOSICAO_EVENTOS", versao: "1.0.0", run: regraSobreposicaoEventos },
  { id: "INTRAJORNADA_INSUFICIENTE", versao: "1.0.0", run: regraIntrajornadaInsuficiente },
  { id: "INTERJORNADA_INSUFICIENTE", versao: "1.0.0", run: regraInterjornadaInsuficiente },
  { id: "TROCA_TURNO_SEM_DESCANSO", versao: "1.0.0", run: regraTrocaTurnoSemDescanso },
  { id: "JORNADA_SEM_INTERVALO", versao: "1.0.0", run: regraJornadaSemIntervalo },
  { id: "DOMINGO_FERIADO_SEM_CLASSIFICACAO", versao: "1.0.0", run: regraDomingoFeriadoSemClassificacao },
  { id: "FERIADO_LOCAL_SEM_CLASSIFICACAO", versao: "1.0.0", run: regraFeriadoLocalSemClassificacao },
  { id: "SEQUENCIA_DIAS_SEM_FOLGA", versao: "1.0.0", run: regraSequenciaDiasSemFolga },
  { id: "ADICIONAL_NOTURNO_NAO_CLASSIFICADO", versao: "1.0.0", run: regraAdicionalNoturnoNaoClassificado },
  { id: "PRORROGACAO_NOTURNA_NAO_CLASSIFICADA", versao: "1.0.0", run: regraAdicionalNoturnoProrrogacaoNaoClassificada },
  { id: "HORA_EXTRA_ACIMA_LIMITE", versao: "1.0.0", run: regraHoraExtraAcimaLimiteLegal },
  { id: "FECHAMENTO_COM_PENDENCIA_CRITICA", versao: "1.0.0", run: regraFechamentoComPendenciaCritica },
  { id: "EVIDENCIA_OBRIGATORIA_AUSENTE", versao: "1.0.0", run: regraEvidenciaObrigatoriaAusente },
  { id: "EXTRA_SEM_MARCACAO", versao: "1.0.0", run: regraHoraExtraSemMarcacao },
  { id: "ENTRADA_ANTES_ESCALA_SEM_EXTRA", versao: "1.0.0", run: regraEntradaAntesEscalaSemExtra },
  { id: "SAIDA_APOS_ESCALA_SEM_EXTRA", versao: "1.0.0", run: regraSaidaAposEscalaSemExtra },
  { id: "BANCO_HORAS_INCOMPATIVEL", versao: "1.0.0", run: regraBancoHorasIncompativel },
  { id: "BANCO_HORAS_SALDO_EXCEDIDO", versao: "1.0.0", run: regraBancoHorasSaldoExcedido },
  { id: "DUPLICIDADE_EVENTO_REMUNERADO", versao: "1.0.0", run: regraDuplicidadeEventoRemunerado },
  { id: "DIVERGENCIA_HORAS_EVENTO", versao: "1.0.0", run: regraDivergenciaHorasEvento },
  { id: "DESVIO_PLANEJADO", versao: "1.0.0", run: regraDivergenciaPlanejado },
  { id: "MINUTOS_RESIDUAIS_EXCEDIDOS", versao: "1.0.0", run: regraMinutosResiduaisExcedidos },
  { id: "PONTO_BRITANICO", versao: "1.0.0", run: regraPontoBritanico },
  { id: "TRATAMENTO_MANUAL_RECORRENTE", versao: "1.0.0", run: regraTratamentoManualRecorrente },
  { id: "RISCO_RECORRENTE", versao: "1.0.0", run: regraRiscoRecorrente },
  { id: "MARCACAO_SEM_ESCALA", versao: "1.0.0", run: regraMarcacaoSemEscala },
  { id: "JORNADA_INCOERENTE", versao: "1.0.0", run: regraJornadaIncoerente },
  { id: "PRESENCA_SEM_JORNADA_UTIL", versao: "1.0.0", run: regraPresencaSemJornadaUtil },
  { id: "PARAMETRIZACAO_INCOMPLETA", versao: "1.0.0", run: regraParametrizacaoIncompleta },
];

const REGRA_TITULOS = {
  EVENTO_SEM_MARCACAO: "Evento sem marcacao",
  COLABORADOR_FORA_PERIODO_ATIVO: "Colaborador fora do periodo ativo",
  AUSENCIA_COM_MARCACAO: "Ausencia com marcacao",
  MARCACAO_IMPAR: "Marcacao impar",
  MARCACAO_DUPLICADA: "Marcacao duplicada",
  MARCACAO_FORA_DE_ORDEM: "Marcacao fora de ordem",
  MARCACAO_DESLOCADA_DE_DIA: "Marcacao deslocada de dia",
  MARCACAO_EXCEDENTE: "Marcacao excedente",
  PAREAMENTO_AMBIGUO: "Pareamento ambiguo",
  INTERVALO_ATIPICO_MARCACOES: "Intervalo atipico entre marcacoes",
  SOBREPOSICAO_EVENTOS: "Sobreposicao de eventos",
  INTRAJORNADA_INSUFICIENTE: "Intervalo intrajornada insuficiente",
  INTERJORNADA_INSUFICIENTE: "Intervalo interjornada insuficiente",
  TROCA_TURNO_SEM_DESCANSO: "Troca de turno sem descanso",
  JORNADA_SEM_INTERVALO: "Jornada sem intervalo",
  DOMINGO_FERIADO_SEM_CLASSIFICACAO: "Domingo/feriado sem classificacao",
  FERIADO_LOCAL_SEM_CLASSIFICACAO: "Feriado local sem classificacao",
  SEQUENCIA_DIAS_SEM_FOLGA: "Sequencia de dias sem folga",
  ADICIONAL_NOTURNO_NAO_CLASSIFICADO: "Adicional noturno nao classificado",
  PRORROGACAO_NOTURNA_NAO_CLASSIFICADA: "Prorrogacao noturna nao classificada",
  HORA_EXTRA_ACIMA_LIMITE: "Hora extra acima do limite",
  FECHAMENTO_COM_PENDENCIA_CRITICA: "Fechamento com pendencia critica",
  EVIDENCIA_OBRIGATORIA_AUSENTE: "Evidencia obrigatoria ausente",
  EXTRA_SEM_MARCACAO: "Extra sem marcacao",
  ENTRADA_ANTES_ESCALA_SEM_EXTRA: "Entrada antes da escala sem extra",
  SAIDA_APOS_ESCALA_SEM_EXTRA: "Saida apos escala sem extra",
  BANCO_HORAS_INCOMPATIVEL: "Banco de horas incompativel",
  BANCO_HORAS_SALDO_EXCEDIDO: "Banco de horas com saldo excedido",
  DUPLICIDADE_EVENTO_REMUNERADO: "Duplicidade de evento remunerado",
  DIVERGENCIA_HORAS_EVENTO: "Divergencia entre evento e marcacoes",
  DESVIO_PLANEJADO: "Desvio do horario planejado",
  MINUTOS_RESIDUAIS_EXCEDIDOS: "Minutos residuais excedidos",
  PONTO_BRITANICO: "Ponto britanico",
  TRATAMENTO_MANUAL_RECORRENTE: "Tratamento manual recorrente",
  RISCO_RECORRENTE: "Risco recorrente",
  MARCACAO_SEM_ESCALA: "Marcacao sem escala",
  JORNADA_INCOERENTE: "Jornada incoerente",
  PRESENCA_SEM_JORNADA_UTIL: "Presenca sem jornada util",
  PARAMETRIZACAO_INCOMPLETA: "Parametrizacao incompleta",
};

const CATEGORIA_REGRA = {
  legal: new Set([
    "EVENTO_SEM_MARCACAO",
    "COLABORADOR_FORA_PERIODO_ATIVO",
    "AUSENCIA_COM_MARCACAO",
    "INTRAJORNADA_INSUFICIENTE",
    "INTERJORNADA_INSUFICIENTE",
    "TROCA_TURNO_SEM_DESCANSO",
    "JORNADA_SEM_INTERVALO",
    "DOMINGO_FERIADO_SEM_CLASSIFICACAO",
    "FERIADO_LOCAL_SEM_CLASSIFICACAO",
    "SEQUENCIA_DIAS_SEM_FOLGA",
    "ADICIONAL_NOTURNO_NAO_CLASSIFICADO",
    "PRORROGACAO_NOTURNA_NAO_CLASSIFICADA",
    "HORA_EXTRA_ACIMA_LIMITE",
    "FECHAMENTO_COM_PENDENCIA_CRITICA",
    "EVIDENCIA_OBRIGATORIA_AUSENTE",
  ]),
  financeiro: new Set([
    "EXTRA_SEM_MARCACAO",
    "ENTRADA_ANTES_ESCALA_SEM_EXTRA",
    "SAIDA_APOS_ESCALA_SEM_EXTRA",
    "BANCO_HORAS_INCOMPATIVEL",
    "BANCO_HORAS_SALDO_EXCEDIDO",
    "DUPLICIDADE_EVENTO_REMUNERADO",
    "DIVERGENCIA_HORAS_EVENTO",
    "DESVIO_PLANEJADO",
    "MINUTOS_RESIDUAIS_EXCEDIDOS",
  ]),
  fraude: new Set(["PONTO_BRITANICO", "TRATAMENTO_MANUAL_RECORRENTE", "RISCO_RECORRENTE"]),
  configuracao: new Set(["MARCACAO_SEM_ESCALA", "JORNADA_INCOERENTE", "PRESENCA_SEM_JORNADA_UTIL", "PARAMETRIZACAO_INCOMPLETA"]),
};

function inferirCategoriaRegra(id) {
  for (const [categoria, ids] of Object.entries(CATEGORIA_REGRA)) {
    if (ids.has(id)) return categoria;
  }
  return "operacional";
}

function inferirSeveridadeRegra(id, categoria) {
  if (
    [
      "EVENTO_SEM_MARCACAO",
      "AUSENCIA_COM_MARCACAO",
      "INTRAJORNADA_INSUFICIENTE",
      "INTERJORNADA_INSUFICIENTE",
      "FECHAMENTO_COM_PENDENCIA_CRITICA",
      "PARAMETRIZACAO_INCOMPLETA",
    ].includes(id)
  ) {
    return "critica";
  }
  if (categoria === "legal" || categoria === "financeiro" || categoria === "fraude") return "alta";
  if (categoria === "configuracao") return "media";
  return "media";
}

export const REGRAS_AUDITORIA_PONTO_META = REGRAS_AUDITORIA_PONTO.map(({ id, versao }) => {
  const categoria = inferirCategoriaRegra(id);
  return {
    id,
    versao,
    titulo: REGRA_TITULOS[id] || id,
    categoria,
    severidadePadrao: inferirSeveridadeRegra(id, categoria),
  };
});
