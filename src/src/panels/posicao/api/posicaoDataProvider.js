import { getPosicaoDataPolicy } from "./posicaoDataPolicy.js";

export function normalizePeriodo(periodo = {}) {
  return {
    de: periodo.de || periodo.from || periodo.dataInicio || "",
    ate: periodo.ate || periodo.to || periodo.dataFim || "",
  };
}

function unwrapEnvelope(envelope) {
  if (envelope && typeof envelope === "object" && "data" in envelope) return envelope.data;
  return envelope;
}

export function createPosicaoDataProvider(options = {}) {
  const policy = options.policy || getPosicaoDataPolicy();
  let apiClient = options.apiClient || null;

  async function getApiClient() {
    if (apiClient) return apiClient;
    const { createPosicaoApiClient } = await import("./posicaoApiClient");
    apiClient = createPosicaoApiClient({
      baseUrl: policy.apiBaseUrl,
      fetchImpl: options.fetchImpl,
    });
    return apiClient;
  }

  async function requireApi(methodName, periodo) {
    if (!policy.isApi) {
      throw new Error(
        `PosicaoDataProvider.${methodName} exige VITE_SOURCE_POSICAO=api. Fonte atual: ${policy.source}.`,
      );
    }
    const client = await getApiClient();
    const payload = await client[methodName](normalizePeriodo(periodo));
    return unwrapEnvelope(payload);
  }

  return Object.freeze({
    policy,
    getPositionDay: (periodo) => requireApi("getPositionDay", periodo),
    getAbsenteeism: (periodo) => requireApi("getAbsenteeism", periodo),
    getBankHours: (periodo) => requireApi("getBankHours", periodo),
    getMonthlyClosing: (periodo) => requireApi("getMonthlyClosing", periodo),
    getLaborRadar: (periodo) => requireApi("getLaborRadar", periodo),
  });
}

export const posicaoDataProvider = createPosicaoDataProvider();
