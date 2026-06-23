import { ApiRoutes } from "../../../api/apiRoutes.js";
import { CONFIG } from "../../../configLocal.js";
import { HttpClient } from "../../../core/httpClient.js";

export class PosicaoApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "PosicaoApiError";
    this.status = status;
  }
}

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

function buildUrl(baseUrl, path, params = {}) {
  const url = new URL(path.replace(/^\//, ""), baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url.toString();
}

async function readJson(fetchImpl, url) {
  const response = await fetchImpl(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new PosicaoApiError(`Falha ao consultar API (${response.status})`, response.status);
  }
  return response.json();
}

async function readAppJson(path, params = {}) {
  return HttpClient.get(`${path}${buildQuery(params)}`);
}

function periodParams(periodo = {}) {
  return { de: periodo.de, ate: periodo.ate };
}

function endpointReader({ baseUrl, fetchImpl, useInjectedFetch }, path, params) {
  if (!useInjectedFetch) return readAppJson(path, params);
  return readJson(fetchImpl, buildUrl(baseUrl, path, params));
}

export function createPosicaoApiClient(options = {}) {
  const baseUrl = options.baseUrl || CONFIG.API_BASE || "/api/";
  const fetchImpl = options.fetchImpl || fetch;
  const useInjectedFetch = Boolean(options.fetchImpl);
  const readerOptions = { baseUrl, fetchImpl, useInjectedFetch };

  return {
    getPositionDay(periodo) {
      return endpointReader(readerOptions, ApiRoutes.posicao.dia, periodParams(periodo));
    },

    getAbsenteeism(periodo) {
      return endpointReader(readerOptions, ApiRoutes.absenteismo.resumo, periodParams(periodo));
    },

    getBankHours(periodo) {
      return endpointReader(readerOptions, ApiRoutes.bancoHoras.resumo, periodParams(periodo));
    },

    getMonthlyClosing(periodo) {
      return endpointReader(
        readerOptions,
        ApiRoutes.fechamentoMensal.eventos,
        periodParams(periodo),
      );
    },

    getLaborRadar(periodo) {
      return endpointReader(
        readerOptions,
        ApiRoutes.radarTrabalhista.resumo,
        periodParams(periodo),
      );
    },
  };
}

