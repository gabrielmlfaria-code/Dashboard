import { ApiService } from "./apiService.js";
import { ApiRoutes } from "./apiRoutes.js";

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
    return ApiService.call(
      ApiRoutes.absenteismo.resumo,
      pickParams({ de, ate, filialId, deptoId }),
      {
        module: MODULE,
      },
    );
  },

  getColaboradores(params = {}) {
    return ApiService.call(ApiRoutes.absenteismo.colaboradores, pickParams(params), {
      module: MODULE,
    });
  },

  getEventos(params = {}) {
    return ApiService.call(
      ApiRoutes.absenteismo.eventos,
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
      ApiRoutes.absenteismo.grupos,
      pickParams({
        ...params,
      }),
      { module: MODULE },
    );
  },
};
