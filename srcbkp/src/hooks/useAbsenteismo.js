import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { AbsenteismoApi } from "../api/absenteismoApi.js";
import { normalizeEventosPage, normalizeGrupos } from "../api/absenteismoNormalize.js";

export const ABSENTEISMO_KEYS = {
  resumo: (f) => ["absenteismo", "resumo", f],
  eventos: (f) => ["absenteismo", "eventos", f],
  grupos: (f) => ["absenteismo", "grupos", f],
  colaboradores: (f) => ["absenteismo", "colaboradores", f],
};

/**
 * Eventos paginados para o modal / grid.
 * @param {object} filtro — de, ate, page, pageSize, sort, dir, search, categoria, filial, groupBy, groupKey, ...
 * @param {boolean} [enabled=true]
 */
export function useAbsenteismoEventos(filtro, enabled = true) {
  return useQuery({
    queryKey: ABSENTEISMO_KEYS.eventos(filtro),
    queryFn: async () => normalizeEventosPage(await AbsenteismoApi.getEventos(filtro)),
    enabled: enabled && !!filtro?.de && !!filtro?.ate,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useAbsenteismoGrupos(filtro, enabled = true) {
  return useQuery({
    queryKey: ABSENTEISMO_KEYS.grupos(filtro),
    queryFn: async () => normalizeGrupos(await AbsenteismoApi.getGrupos(filtro)),
    enabled: enabled && !!filtro?.de && !!filtro?.ate && !!filtro?.groupBy,
    staleTime: 60_000,
  });
}

export function useAbsenteismoResumo(filtro, enabled = true) {
  return useQuery({
    queryKey: ABSENTEISMO_KEYS.resumo(filtro),
    queryFn: () => AbsenteismoApi.getResumo(filtro),
    enabled: enabled && !!filtro?.de && !!filtro?.ate,
    staleTime: 5 * 60_000,
  });
}
