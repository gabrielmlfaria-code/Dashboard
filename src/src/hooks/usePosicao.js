import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PosicaoApi } from "../api/posicaoApi.js";

export const POSICAO_KEYS = {
  filiais: ["posicao", "filiais"],
  dia: (date) => ["posicao", "dia", date ?? "hoje"],
  historico: (days) => ["posicao", "historico", days],
};

export function usePosicaoFiliais() {
  return useQuery({
    queryKey: POSICAO_KEYS.filiais,
    queryFn: () => PosicaoApi.getFiliais(),
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export function usePosicaoDia(date) {
  return useQuery({
    queryKey: POSICAO_KEYS.dia(date),
    queryFn: () => PosicaoApi.getDia(date),
    staleTime: 60_000,
    retry: 1,
    retryDelay: 400,
  });
}

export function usePosicaoHistorico(days = 180) {
  return useQuery({
    queryKey: POSICAO_KEYS.historico(days),
    queryFn: () => PosicaoApi.getHistorico(days),
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export function useForcaPrevistaDepartamentos({ idFilial, date, idSelecao } = {}, options = {}) {
  return useQuery({
    queryKey: ["posicao", "forca-prevista", "departamentos", idFilial, date, idSelecao],
    queryFn: () => PosicaoApi.getForcaPrevistaDepartamentos({ idFilial, date, idSelecao }),
    staleTime: 2 * 60_000,
    enabled: options.enabled !== false,
    ...options,
  });
}

export function useSalvarForcaPrevista() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ idFilial, itens }) => PosicaoApi.salvarForcaPrevista({ idFilial, itens }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["posicao", "forca-prevista"] }),
  });
}

export function useExcluirForcaPrevistaDepto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (idDepartamento) => PosicaoApi.excluirForcaPrevistaDepto(idDepartamento),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["posicao", "forca-prevista"] }),
  });
}

export function useLimparForcaPrevista() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (idFilial) => PosicaoApi.limparForcaPrevista(idFilial),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["posicao", "forca-prevista"] }),
  });
}

export function useCategoriasHorasConfig({ idFilial } = {}, options = {}) {
  const filialId = Number(idFilial);
  const queryFilial = Number.isFinite(filialId) && filialId > 0 ? filialId : 0;
  return useQuery({
    queryKey: ["posicao", "categorias-horas", queryFilial],
    queryFn: () =>
      PosicaoApi.getCategoriasHorasConfig(queryFilial > 0 ? { idFilial: queryFilial } : {}),
    staleTime: 2 * 60_000,
    ...options,
  });
}

export function useSalvarCategoriasHoras() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => PosicaoApi.salvarCategoriasHoras(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["posicao", "categorias-horas"] }),
  });
}
