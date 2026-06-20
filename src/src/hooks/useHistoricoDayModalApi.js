import { useMemo, useState, useEffect, useCallback } from "react";
import { useAbsenteismoEventos, useAbsenteismoGrupos } from "./useAbsenteismo.js";
import { mapGroupByToApi, mapSortColToApi } from "../api/absenteismoNormalize.js";

const DEFAULT_PAGE_SIZE = 200;

/**
 * Camada de dados do HistoricoDayModal em modo API (paginação server-side).
 */
export function useHistoricoDayModalApi({
  enabled = false,
  de = "",
  ate = "",
  filialId = "",
  deptoId = "",
  sortCol = "data",
  sortDir = "desc",
  search = "",
  pillFilter = null,
  groupBy = [],
  expandedGroupKey = null,
  pageSize = DEFAULT_PAGE_SIZE,
}) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [de, ate, sortCol, sortDir, search, pillFilter, groupBy.join(","), expandedGroupKey]);

  const apiSort = mapSortColToApi(sortCol);
  const useGroupList = enabled && groupBy.length > 0 && !expandedGroupKey;

  const eventosFiltro = useMemo(
    () => ({
      de,
      ate,
      page,
      pageSize,
      sort: apiSort,
      dir: sortDir,
      search: search.trim() || undefined,
      categoria: pillFilter || undefined,
      filialId: filialId || undefined,
      deptoId: deptoId || undefined,
      groupBy: expandedGroupKey ? mapGroupByToApi(groupBy[0]) : undefined,
      groupKey: expandedGroupKey || undefined,
    }),
    [
      de,
      ate,
      page,
      pageSize,
      apiSort,
      sortDir,
      search,
      pillFilter,
      filialId,
      deptoId,
      groupBy,
      expandedGroupKey,
    ],
  );

  const gruposFiltro = useMemo(
    () => ({
      de,
      ate,
      groupBy: mapGroupByToApi(groupBy[0]),
      search: search.trim() || undefined,
      categoria: pillFilter || undefined,
      filialId: filialId || undefined,
      deptoId: deptoId || undefined,
    }),
    [de, ate, groupBy, search, pillFilter, filialId, deptoId],
  );

  const eventosQuery = useAbsenteismoEventos(eventosFiltro, enabled && !useGroupList);
  const gruposQuery = useAbsenteismoGrupos(gruposFiltro, useGroupList);

  const totalPages = useMemo(() => {
    const total = eventosQuery.data?.total ?? 0;
    const ps = eventosQuery.data?.pageSize ?? pageSize;
    return Math.max(1, Math.ceil(total / ps));
  }, [eventosQuery.data, pageSize]);

  const resetPage = useCallback(() => setPage(1), []);

  return {
    enabled,
    events: eventosQuery.data?.items ?? [],
    total: eventosQuery.data?.total ?? 0,
    page,
    setPage,
    pageSize: eventosQuery.data?.pageSize ?? pageSize,
    totalPages,
    totais: eventosQuery.data?.totais ?? { horas: 0, horasPlan: 0 },
    grupos: gruposQuery.data?.items ?? [],
    groupByCol: gruposQuery.data?.groupBy ?? mapGroupByToApi(groupBy[0]),
    isLoading: eventosQuery.isLoading || gruposQuery.isLoading,
    isFetching: eventosQuery.isFetching || gruposQuery.isFetching,
    refetch: () => {
      eventosQuery.refetch();
      gruposQuery.refetch();
    },
    useGroupList,
  };
}
