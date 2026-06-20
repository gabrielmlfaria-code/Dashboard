import type {
  AbsenteeismSummaryDto,
  ApiEnvelope,
  BankHoursDto,
  LaborRadarDto,
  MonthlyClosingDto,
  PeriodoDto,
  PositionDayDto,
} from "./posicaoDtos";

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

function buildUrl(baseUrl: string, path: string, params?: Record<string, string | undefined>) {
  const url = new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
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

export function createPosicaoApiClient(options: PosicaoApiClientOptions = {}) {
  const baseUrl = options.baseUrl || "/api/";
  const fetchImpl = options.fetchImpl || fetch;

  return {
    getPositionDay(periodo: PeriodoDto) {
      return readJson<ApiEnvelope<PositionDayDto[]>>(
        fetchImpl,
        buildUrl(baseUrl, "posicao/dia", { de: periodo.de, ate: periodo.ate }),
      );
    },

    getAbsenteeism(periodo: PeriodoDto) {
      return readJson<ApiEnvelope<AbsenteeismSummaryDto>>(
        fetchImpl,
        buildUrl(baseUrl, "posicao/absenteismo", { de: periodo.de, ate: periodo.ate }),
      );
    },

    getBankHours(periodo: PeriodoDto) {
      return readJson<ApiEnvelope<BankHoursDto>>(
        fetchImpl,
        buildUrl(baseUrl, "posicao/banco-horas", { de: periodo.de, ate: periodo.ate }),
      );
    },

    getMonthlyClosing(periodo: PeriodoDto) {
      return readJson<ApiEnvelope<MonthlyClosingDto>>(
        fetchImpl,
        buildUrl(baseUrl, "posicao/fechamento-mensal", { de: periodo.de, ate: periodo.ate }),
      );
    },

    getLaborRadar(periodo: PeriodoDto) {
      return readJson<ApiEnvelope<LaborRadarDto>>(
        fetchImpl,
        buildUrl(baseUrl, "posicao/radar-trabalhista", { de: periodo.de, ate: periodo.ate }),
      );
    },
  };
}
