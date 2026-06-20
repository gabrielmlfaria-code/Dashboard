import {
  DEFAULT_AUDITORIA_PONTO_EVENTOS_JORNADA_PRINCIPAL,
  DEFAULT_AUDITORIA_PONTO_EVENTOS_SEM_MARCACAO_OK,
  DEFAULT_AUDITORIA_PONTO_PARAMS,
} from "../config/parametros.js";
import { REGRAS_AUDITORIA_PONTO } from "../config/regras.js";
import { agregarAnomalias } from "./agregador.js";
import { normalizarMarcacoes } from "./normalizador.js";
import { parearHorarios } from "./pareador.js";
import { SEVERITY_LABEL } from "../types/regras.js";
import { extractTimes, fmtMin, hasFaltaMarcacaoMarker, normText, sumPairs } from "../utils/tempo.js";
import { simpleHash } from "../utils/hash.js";
import { normalizarParametros } from "../utils/validadores.js";
import {
  getEventoAuditText,
  isEventoPresenca,
  isEventoRiscoTrabalhista,
  isEventoTrabalhado,
} from "../regras/eventoNatureza.js";

export const AUDITORIA_PONTO_MOTOR_VERSION = "2.5.0";
const AUDITORIA_RULE_TREATMENT_ACTIONABLE = new Set(["acao", "revisao_manual"]);

export const DEFAULT_AUDITORIA_PONTO_EVENTOS_IGNORADOS = [
  {
    id: "NCP_NAO_CONTROLA_PONTO",
    ativo: true,
    campo: "evento",
    operador: "contem",
    valor: "NAO CONTROLA PONTO",
    regras: ["todas"],
    motivo: "Evento cadastrado para colaborador ou cargo que nao registra ponto.",
  },
];

function isCustomRuleIgnore(rule = {}) {
  const text = normText(
    [
      rule.acao,
      rule.tipo,
      rule.finalidade,
      rule.severidade,
      rule.titulo,
      rule.nome,
      rule.mensagem,
    ]
      .filter(Boolean)
      .join(" "),
  );
  return (
    text.includes("ignorar auditoria") ||
    text.includes("nao auditado") ||
    text.includes("nao auditar") ||
    text.includes("sem auditoria") ||
    text === "ignorar"
  );
}

function normalizarEventosIgnorados(parametros = {}) {
  const explicitRules = Array.isArray(parametros?.eventosIgnoradosAuditoria)
    ? parametros.eventosIgnoradosAuditoria
    : DEFAULT_AUDITORIA_PONTO_EVENTOS_IGNORADOS;
  const customIgnoreRules = (Array.isArray(parametros?.regrasCustomizadas)
    ? parametros.regrasCustomizadas
    : []
  )
    .filter((rule) => rule && rule.ativo !== false && isCustomRuleIgnore(rule))
    .map((rule, index) => ({
      id: rule.id || `CUSTOM_IGNORE_${index + 1}`,
      ativo: true,
      campo: rule.campo || "evento",
      operador: rule.operador || "contem",
      valor: rule.valor || "",
      regras: ["todas"],
      motivo: rule.mensagem || rule.titulo || rule.nome || "Regra especifica da empresa para nao auditar.",
    }));
  const source = [...explicitRules, ...customIgnoreRules];
  return source
    .filter((item) => item && item.ativo !== false)
    .map((item, index) => ({
      id: String(item.id || `IGNORAR_EVENTO_${index + 1}`).replace(/[^A-Za-z0-9_]/g, "_").toUpperCase(),
      campo: String(item.campo || "evento"),
      operador: String(item.operador || "contem"),
      valor: String(item.valor ?? "").trim(),
      regras: Array.isArray(item.regras) && item.regras.length ? item.regras.map(String) : ["todas"],
      motivo: String(item.motivo || "Evento ignorado por parametro da auditoria.").trim(),
    }))
    .filter((item) => item.valor);
}

function getIgnoredEventValue(input = {}, campo = "") {
  const field = String(campo || "").toLowerCase();
  if (field === "evento") return String(input.evento || input.situacaoDesc || input._cat || "");
  if (field === "codigo") return String(input.codigo || input.codEvento || input.cod || "");
  if (field === "categoria") return String(input._cat || input.categoria || "");
  if (field === "departamento") return String(input.departamento || input.depto || "");
  if (field === "cargo") return String(input.cargo || "");
  return String(input[field] || "");
}

function ignoredEventMatches(rule, input) {
  const valueText = normText(getIgnoredEventValue(input, rule.campo));
  const targetText = normText(rule.valor);
  switch (rule.operador) {
    case "igual":
      return valueText === targetText;
    case "nao_contem":
      return !valueText.includes(targetText);
    case "diferente":
      return valueText !== targetText;
    case "contem":
    default:
      return valueText.includes(targetText);
  }
}

function normalizarCustomRules(parametros = {}) {
  return (Array.isArray(parametros?.regrasCustomizadas) ? parametros.regrasCustomizadas : [])
    .filter((rule) => rule && rule.ativo !== false && !isCustomRuleIgnore(rule))
    .map((rule, index) => ({
      id: String(rule.id || `CUSTOM_${index + 1}`).replace(/[^A-Za-z0-9_]/g, "_").toUpperCase(),
      titulo: String(rule.titulo || rule.nome || `Regra customizada ${index + 1}`).trim(),
      campo: String(rule.campo || "evento"),
      operador: String(rule.operador || "contem"),
      valor: String(rule.valor ?? "").trim(),
      severidade: ["critica", "alta", "media", "baixa"].includes(rule.severidade) ? rule.severidade : "media",
      mensagem: String(rule.mensagem || "").trim(),
    }))
    .filter((rule) => rule.valor);
}

function getRuleTreatment(parametros = {}, ruleId = "") {
  const treatments = parametros?.tratamentoRegras || parametros?.regraTratamentos || {};
  const value = String(treatments?.[ruleId] || "acao");
  return ["acao", "informativa", "nao_aplicavel", "revisao_manual"].includes(value) ? value : "acao";
}

function getCustomRuleValue(input = {}, campo = "") {
  const field = String(campo || "").toLowerCase();
  if (field === "horas") return Number(input.horas || 0);
  if (field === "evento") return String(input.evento || input.situacaoDesc || input._cat || "");
  if (field === "marcacao") return String(input.marcacao || "");
  if (field === "horario") return String(input.horario || "");
  if (field === "departamento") return String(input.departamento || input.depto || "");
  if (field === "cargo") return String(input.cargo || "");
  if (field === "categoria") return String(input._cat || input.categoria || "");
  return String(input[field] || "");
}

function customRuleMatches(rule, input) {
  const rawValue = getCustomRuleValue(input, rule.campo);
  const rawTarget = rule.valor;
  const valueText = normText(rawValue);
  const targetText = normText(rawTarget);
  const valueNum = Number(rawValue);
  const targetNum = Number(rawTarget);
  switch (rule.operador) {
    case "nao_contem":
      return !valueText.includes(targetText);
    case "igual":
      return valueText === targetText;
    case "diferente":
      return valueText !== targetText;
    case "maior_que":
      return Number.isFinite(valueNum) && Number.isFinite(targetNum) && valueNum > targetNum;
    case "maior_igual":
      return Number.isFinite(valueNum) && Number.isFinite(targetNum) && valueNum >= targetNum;
    case "menor_que":
      return Number.isFinite(valueNum) && Number.isFinite(targetNum) && valueNum < targetNum;
    case "menor_igual":
      return Number.isFinite(valueNum) && Number.isFinite(targetNum) && valueNum <= targetNum;
    case "contem":
    default:
      return valueText.includes(targetText);
  }
}

function executarRegrasCustomizadas(input = {}, customRules = []) {
  return customRules
    .filter((rule) => customRuleMatches(rule, input))
    .map((rule) => ({
      code: rule.id,
      severity: rule.severidade,
      message: rule.mensagem || `${rule.titulo}: ${rule.campo} ${rule.operador.replace(/_/g, " ")} ${rule.valor}.`,
      details: `Regra especifica da empresa: campo ${rule.campo}, operador ${rule.operador}, valor ${rule.valor}.`,
      categoria: "customizada",
      memoria: [
        `Campo avaliado: ${rule.campo}`,
        `Operador: ${rule.operador}`,
        `Valor configurado: ${rule.valor}`,
        `Valor encontrado: ${getCustomRuleValue(input, rule.campo)}`,
      ],
      evidencia: {
        regraCustomizada: true,
        campo: rule.campo,
        operador: rule.operador,
        valor: rule.valor,
      },
    }));
}

function buildMemoria({
  input,
  params,
  horarioTimes,
  marcacaoTimes,
  marcacoes,
  issues,
  worst,
  metadata,
}) {
  const horasMarcacoes = marcacoes.length >= 2 ? sumPairs(marcacoes) : 0;
  return {
    titulo: `${SEVERITY_LABEL[worst.severity]} - ${worst.code}`,
    resumo: worst.message,
    evento: input.evento || input.situacaoDesc || "",
    horarioPlanejado: horarioTimes,
    marcacoes: marcacaoTimes,
    horasEvento: Number(input.horas || 0) > 0 ? fmtMin(input.horas) : "",
    horasMarcacoes: horasMarcacoes > 0 ? fmtMin(horasMarcacoes) : "",
    versaoMotor: metadata.versaoMotor,
    hashRegrasAtivas: metadata.hashRegrasAtivas,
    processadoEm: metadata.processadoEm,
    statusFechamento: metadata.statusFechamento,
    statusJornada: metadata.statusJornada,
    parametros: {
      toleranciaMinutos: params.toleranciaMinutos,
      toleranciaDuplicidadeMinutos: params.toleranciaDuplicidadeMinutos,
      janelaPareamentoMaxMinutos: params.janelaPareamentoMaxMinutos,
      intervaloIntrajornadaMinutos: params.intervaloIntrajornadaMinutos,
      jornadaIntrajornadaMinutos: params.jornadaIntrajornadaMinutos,
      intervaloInterjornadaMinutos: params.intervaloInterjornadaMinutos,
      pontoBritanicoDias: params.pontoBritanicoDias,
      minutosResiduaisMinutos: params.minutosResiduaisMinutos,
      limiteHoraExtraDiariaMinutos: params.limiteHoraExtraDiariaMinutos,
      intervaloIntrajornadaMaxMinutos: params.intervaloIntrajornadaMaxMinutos,
      diasConsecutivosLimite: params.diasConsecutivosLimite,
      limiteBancoHorasPositivoMinutos: params.limiteBancoHorasPositivoMinutos,
      limiteBancoHorasNegativoMinutos: params.limiteBancoHorasNegativoMinutos,
      recorrenciaRiscoLimite: params.recorrenciaRiscoLimite,
    },
    anomalias: issues.map((issue) => ({
      codigo: issue.code,
      severidade: issue.severity,
      mensagem: issue.message,
      detalhe: issue.details,
      memoria: issue.memoria || [],
      categoria: issue.categoria || "",
      evidencia: {
        ...(issue.evidencia || {}),
        regraAplicada: issue.regraAplicada || "",
        versaoRegra: issue.versaoRegra || "",
      },
    })),
  };
}

export function analisarAnomaliasPonto(input = {}, parametros = {}) {
  const params = normalizarParametros(parametros);
  const regrasDesativadas = new Set(
    [
      ...(Array.isArray(parametros?.regrasDesativadas) ? parametros.regrasDesativadas : []),
      ...(Array.isArray(parametros?.disabledRules) ? parametros.disabledRules : []),
    ].map(String),
  );
  const customRules = normalizarCustomRules(parametros);
  const eventosIgnorados = normalizarEventosIgnorados(parametros);
  const eventoIgnorado = eventosIgnorados.find((rule) => ignoredEventMatches(rule, input));
  const riscoTrabalhistaIgnorado = isEventoRiscoTrabalhista(input);
  const regrasAtivas = REGRAS_AUDITORIA_PONTO.filter((regra) => !regrasDesativadas.has(regra.id));
  const horarioTimes = extractTimes(input.horario);
  const marcacaoTimes = extractTimes(input.marcacao);
  const faltaMarcacaoIdentificada = hasFaltaMarcacaoMarker(input.marcacao);
  const planejados = normalizarMarcacoes(horarioTimes, input.data);
  const marcacoes = normalizarMarcacoes(marcacaoTimes, input.data);
  const pareamento = parearHorarios(planejados, marcacoes, params);
  const ctx = {
    input,
    params,
    horarioTimes,
    marcacaoTimes,
    faltaMarcacaoIdentificada,
    planejados,
    marcacoes,
    pareamento,
    eventText: getEventoAuditText(input),
    sameDayEventTexts: (Array.isArray(input.sameDayEvents) ? input.sameDayEvents : [])
      .map((event) => getEventoAuditText(event))
      .filter(Boolean),
    isEventoTrabalhado: isEventoTrabalhado(input, params),
    isEventoPresencaPrincipal: isEventoPresenca(input, params),
  };

  const hashRegrasAtivas = simpleHash([
    ...regrasAtivas.map(({ id, versao }) => ({ id, versao })),
    ...customRules.map(({ id, operador, campo, valor, severidade }) => ({ id, operador, campo, valor, severidade, versao: "custom" })),
    ...eventosIgnorados.map(({ id, campo, operador, valor, regras }) => ({ id, campo, operador, valor, regras, versao: "ignore" })),
  ]);
  const processadoEm = new Date().toISOString();
  const base = {
    versaoMotor: AUDITORIA_PONTO_MOTOR_VERSION,
    hashRegrasAtivas,
    parametrosSnapshot: {
      ...params,
      regrasDesativadas: [...regrasDesativadas],
      regrasCustomizadas: customRules.map(({ id, titulo, campo, operador, valor, severidade }) => ({
        id,
        titulo,
        campo,
        operador,
        valor,
        severidade,
      })),
      eventosIgnoradosAuditoria: eventosIgnorados.map(({ id, campo, operador, valor, regras, motivo }) => ({
        id,
        campo,
        operador,
        valor,
        regras,
        motivo,
      })),
    },
    processadoEm,
    statusFechamento: "ok",
    statusJornada: "ok",
  };

  if (eventoIgnorado?.regras?.includes("todas") || riscoTrabalhistaIgnorado) {
    const radarMessage = "Risco trabalhista: consulte o Radar.";
    return {
      ...base,
      status: "ignorado",
      severidade: "ok",
      observacao: riscoTrabalhistaIgnorado ? radarMessage : "",
      detalhes: riscoTrabalhistaIgnorado ? [radarMessage] : [],
      memoria: null,
      anomalias: [],
      ignoradoAuditoria: true,
      radarTrabalhista: riscoTrabalhistaIgnorado,
      motivoIgnoradoAuditoria: riscoTrabalhistaIgnorado
        ? "Evento ja tratado no Radar Trabalhista."
        : eventoIgnorado.motivo,
      regraIgnoradaAuditoria: riscoTrabalhistaIgnorado ? "RISCO_TRABALHISTA_RADAR" : eventoIgnorado.id,
    };
  }

  const rawIssues = [];
  for (const regra of regrasAtivas) {
    try {
      const result = regra.run(ctx);
      const normalized = (Array.isArray(result) ? result : [result]).filter(Boolean).map((issue) => ({
        ...issue,
        regraAplicada: `${regra.id}@${regra.versao}`,
        versaoRegra: regra.versao,
        evidencia: {
          ...(issue.evidencia || {}),
          regraAplicada: `${regra.id}@${regra.versao}`,
          parametrosVigentes: { ...params },
          horarioPrevisto: [...horarioTimes],
          marcacoesUsadas: [...marcacaoTimes],
        },
      }));
      rawIssues.push(...normalized);
    } catch {
      // Regra falha nao deve quebrar a tela; o motor continua auditavel pelas demais regras.
    }
  }
  for (const issue of executarRegrasCustomizadas(input, customRules)) {
    rawIssues.push({
      ...issue,
      regraAplicada: `${issue.code}@custom`,
      versaoRegra: "custom",
      evidencia: {
        ...(issue.evidencia || {}),
        regraAplicada: `${issue.code}@custom`,
        parametrosVigentes: { ...params },
        horarioPrevisto: [...horarioTimes],
        marcacoesUsadas: [...marcacaoTimes],
      },
    });
  }

  const filteredIssues = eventoIgnorado
    ? rawIssues.filter((issue) => !eventoIgnorado.regras.includes(issue.regraAplicada?.split("@")[0] || issue.code))
    : rawIssues;
  const aggregated = agregarAnomalias(filteredIssues);
  base.statusFechamento = aggregated.statusFechamento;
  base.statusJornada = aggregated.statusJornada;

  if (!aggregated.worst) {
    return {
      ...base,
      status: "ok",
      severidade: "ok",
      observacao: "",
      memoria: null,
      anomalias: [],
    };
  }

  return {
    ...base,
    status: aggregated.statusFechamento === "bloqueado" ? "bloqueado" : "revisar",
    severidade: aggregated.severidadeMaxima,
    codigo: aggregated.worst.code,
    tratamentoRegra: getRuleTreatment(parametros, aggregated.worst.code),
    passivelAcao: AUDITORIA_RULE_TREATMENT_ACTIONABLE.has(getRuleTreatment(parametros, aggregated.worst.code)),
    observacao: `${SEVERITY_LABEL[aggregated.worst.severity]}: ${aggregated.worst.message}`,
    detalhes: aggregated.anomalias.map((issue) => [issue.message, issue.details].filter(Boolean).join(" ")),
    memoria: buildMemoria({
      input,
      params,
      horarioTimes,
      marcacaoTimes,
      marcacoes,
      issues: aggregated.anomalias,
      worst: aggregated.worst,
      metadata: base,
    }),
    anomalias: aggregated.anomalias,
  };
}

export {
  DEFAULT_AUDITORIA_PONTO_EVENTOS_JORNADA_PRINCIPAL,
  DEFAULT_AUDITORIA_PONTO_EVENTOS_SEM_MARCACAO_OK,
  DEFAULT_AUDITORIA_PONTO_PARAMS,
};
