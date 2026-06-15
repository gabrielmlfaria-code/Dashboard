import { ApiService } from "./apiService.js";
import { ApiRoutes } from "./apiRoutes.js";

function pickParams(obj) {
  const out = {};
  for (const [key, value] of Object.entries(obj || {})) {
    if (value != null && value !== "") out[key] = value;
  }
  return out;
}

export const AbonosApi = {
  getResumo({ de, ate, status, filialId, deptoId } = {}) {
    return ApiService.call(
      ApiRoutes.abonos.resumo,
      pickParams({ de, ate, status, filialId, deptoId }),
      { module: "abonos" },
    );
  },

  getDepartamentos({ de, ate, status, top = 10 } = {}) {
    return ApiService.call(
      ApiRoutes.abonos.departamentos,
      pickParams({ de, ate, status, top }),
      { module: "abonos" },
    );
  },

  getColaboradores({ de, ate, status, departamento, page = 1, pageSize = 200 } = {}) {
    return ApiService.call(
      ApiRoutes.abonos.colaboradores,
      pickParams({ de, ate, status, departamento, page, pageSize }),
      { module: "abonos" },
    );
  },
};
