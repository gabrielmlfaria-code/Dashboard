import { useQuery } from "@tanstack/react-query";
import { PosicaoApi } from "../api/posicaoApi.js";

export const POSICAO_KEYS = {
  dia: (date) => ["posicao", "dia", date ?? "hoje"],
  historico: (days) => ["posicao", "historico", days],
};

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
