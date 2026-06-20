import { getPosicaoDataPolicy } from "./posicaoDataPolicy.js";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizePeriodo(periodo = {}) {
  return {
    de: String(periodo.de || periodo.from || periodo.dataInicio || "").trim(),
    ate: String(periodo.ate || periodo.to || periodo.dataFim || "").trim(),
  };
}

export function validatePeriodo(periodo = {}, label = "periodo") {
  const normalized = normalizePeriodo(periodo);
  if (!ISO_DATE_RE.test(normalized.de) || !ISO_DATE_RE.test(normalized.ate)) {
    throw new Error(`${label} exige datas no formato yyyy-MM-dd em de/ate.`);
  }
  if (normalized.de > normalized.ate) {
    throw new Error(`${label} exige de menor ou igual a ate.`);
  }
  return normalized;
}

function unwrapEnvelopeResult(envelope) {
  if (envelope && typeof envelope === "object" && "data" in envelope) {
    const { data, warnings, generatedAt, traceId, fonteDados, versaoRegra } = envelope;
    return {
      data,
      meta: {
        warnings: Array.isArray(warnings) ? warnings : [],
        generatedAt: generatedAt || null,
        traceId: traceId || null,
        fonteDados: fonteDados || null,
        versaoRegra: versaoRegra || null,
      },
    };
  }
  return {
    data: envelope,
    meta: {
      warnings: [],
      generatedAt: null,
      traceId: null,
      fonteDados: null,
      versaoRegra: null,
    },
  };
}

export function createPosicaoDataProvider(options = {}) {
  const policy = options.policy || getPosicaoDataPolicy();
  let apiClient = options.apiClient || null;

  async function getApiClient() {
    if (apiClient) return apiClient;
    const { createPosicaoApiClient } = await import("./posicaoApiClient.js");
    apiClient = createPosicaoApiClient({
      baseUrl: policy.apiBaseUrl,
      fetchImpl: options.fetchImpl,
    });
    return apiClient;
  }

  async function requireApiResult(methodName, periodo) {
    if (!policy.isApi) {
      throw new Error(
        `PosicaoDataProvider.${methodName} exige VITE_SOURCE_POSICAO=api. Fonte atual: ${policy.source}.`,
      );
    }
    const client = await getApiClient();
    const payload = await client[methodName](
      validatePeriodo(periodo, `PosicaoDataProvider.${methodName}`),
    );
    return unwrapEnvelopeResult(payload);
  }

  async function requireApiData(methodName, periodo) {
    const result = await requireApiResult(methodName, periodo);
    return result.data;
  }

  return Object.freeze({
    policy,
    getPositionDay: (periodo) => requireApiData("getPositionDay", periodo),
    getAbsenteeism: (periodo) => requireApiData("getAbsenteeism", periodo),
    getBankHours: (periodo) => requireApiData("getBankHours", periodo),
    getMonthlyClosing: (periodo) => requireApiData("getMonthlyClosing", periodo),
    getLaborRadar: (periodo) => requireApiData("getLaborRadar", periodo),
    getPositionDayResult: (periodo) => requireApiResult("getPositionDay", periodo),
    getAbsenteeismResult: (periodo) => requireApiResult("getAbsenteeism", periodo),
    getBankHoursResult: (periodo) => requireApiResult("getBankHours", periodo),
    getMonthlyClosingResult: (periodo) => requireApiResult("getMonthlyClosing", periodo),
    getLaborRadarResult: (periodo) => requireApiResult("getLaborRadar", periodo),
  });
}

export const posicaoDataProvider = createPosicaoDataProvider();
