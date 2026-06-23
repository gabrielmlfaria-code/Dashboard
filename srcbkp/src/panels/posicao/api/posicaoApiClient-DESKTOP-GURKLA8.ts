import type {
  AbsenteeismSummaryDto,
  ApiEnvelope,
  BankHoursDto,
  LaborRadarDto,
  MonthlyClosingDto,
  PeriodoDto,
  PositionDayDto,
} from "./posicaoDtos";
import { CONFIG } from "../../../config.js";
import { ApiRoutes } from "../../../api/apiRoutes.js";
import { HttpClient } from "../../../core/httpClient.js";

export interface PosicaoApiClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class PosicaoApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PosicaoApiError";
    this.status = status;
  }
}

function buildQuery(params?: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

function buildUrl(baseUrl: string, path: string, params?: Record<string, string | undefined>) {
  const url = new URL(path.replace(/^\//, ""), baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url.toString();
}

async function readJson<T>(fetchImpl: typeof fetch, url: string): Promise<T> {
  const response = await fetchImpl(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new PosicaoApiError(`Falha ao consultar API (${response.status})`, response.status);
  }
  return response.json() as Promise<T>;
}

async function readAppJson<T>(
  path: string,
  params?: Record<string, string | undefined>,
): Promise<T> {
  return HttpClient.get(`${path}${buildQuery(params)}`) as Promise<T>;
}

export function createPosicaoApiClient(options: PosicaoApiClientOptions = {}) {
  const baseUrl = options.baseUrl || CONFIG.API_BASE || "/api/";
  const fetchImpl = options.fetchImpl || fetch;
  const useInjectedFetch = Boolean(options.fetchImpl);

  return {
    getPositionDay(periodo: PeriodoDto) {
      const params = { de: periodo.de, ate: periodo.ate };
      if (!useInjectedFetch)
        return readAppJson<ApiEnvelope<PositionDayDto[]>>(ApiRoutes.posicao.dia, params);
      return readJson<ApiEnvelope<PositionDayDto[]>>(
        fetchImpl,
        buildUrl(baseUrl, ApiRoutes.posicao.dia, params),
      );
    },

    getAbsenteeism(periodo: PeriodoDto) {
      const params = { de: periodo.de, ate: periodo.ate };
      if (!useInjectedFetch)
        return readAppJson<ApiEnvelope<AbsenteeismSummaryDto>>(
          ApiRoutes.absenteismo.resumo,
          params,
        );
      return readJson<ApiEnvelope<AbsenteeismSummaryDto>>(
        fetchImpl,
        buildUrl(baseUrl, ApiRoutes.absenteismo.resumo, params),
      );
    },

    getBankHours(periodo: PeriodoDto) {
      const params = { de: periodo.de, ate: periodo.ate };
      if (!useInjectedFetch)
        return readAppJson<ApiEnvelope<BankHoursDto>>(ApiRoutes.bancoHoras.resumo, params);
      return readJson<ApiEnvelope<BankHoursDto>>(
        fetchImpl,
        buildUrl(baseUrl, ApiRoutes.bancoHoras.resumo, params),
      );
    },

    getMonthlyClosing(periodo: PeriodoDto) {
      const params = { de: periodo.de, ate: periodo.ate };
      if (!useInjectedFetch)
        return readAppJson<ApiEnvelope<MonthlyClosingDto>>(
          ApiRoutes.fechamentoMensal.eventos,
          params,
        );
      return readJson<ApiEnvelope<MonthlyClosingDto>>(
        fetchImpl,
        buildUrl(baseUrl, ApiRoutes.fechamentoMensal.eventos, params),
      );
    },

    getLaborRadar(periodo: PeriodoDto) {
      const params = { de: periodo.de, ate: periodo.ate };
      if (!useInjectedFetch)
        return readAppJson<ApiEnvelope<LaborRadarDto>>(ApiRoutes.radarTrabalhista.resumo, params);
      return readJson<ApiEnvelope<LaborRadarDto>>(
        fetchImpl,
        buildUrl(baseUrl, ApiRoutes.radarTrabalhista.resumo, params),
      );
    },
  };
}
