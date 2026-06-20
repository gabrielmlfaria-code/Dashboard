import { ApiService } from "./apiService.js";

const BASE = "/absenteismo";
const MODULE = "absenteismo";

function pickParams(obj) {
  const out = {};
  for (const [key, value] of Object.entries(obj || {})) {
    if (value != null && value !== "") out[key] = value;
  }
  return out;
}

export const AbsenteismoApi = {
  getResumo({ de, ate, filialId, deptoId } = {}) {
    return ApiService.call(`${BASE}/resumo`, pickParams({ de, ate, filialId, deptoId }), {
      module: MODULE,
    });
  },

  getColaboradores(params = {}) {
    return ApiService.call(`${BASE}/colaboradores`, pickParams(params), {
      module: MODULE,
    });
  },

  getEventos(params = {}) {
    return ApiService.call(
      `${BASE}/eventos`,
      pickParams({
        page: 1,
        pageSize: 200,
        sort: "data",
        dir: "desc",
        ...params,
      }),
      { module: MODULE },
    );
  },

  getGrupos(params = {}) {
    return ApiService.call(
      `${BASE}/grupos`,
      pickParams({
        ...params,
      }),
      { module: MODULE },
    );
  },
};

