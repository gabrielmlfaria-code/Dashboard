import {
  DEFAULT_AUDITORIA_PONTO_EVENTOS_SEM_MARCACAO_OK,
  DEFAULT_AUDITORIA_PONTO_PARAMS,
} from "../config/parametros.js";

export function normalizarParametros(parametros = {}) {
  const numericParams = Object.fromEntries(
    Object.entries(DEFAULT_AUDITORIA_PONTO_PARAMS).map(([key, defaultValue]) => [
      key,
      Math.max(0, Number(parametros?.[key] ?? defaultValue) || 0),
    ]),
  );
  const eventosSemMarcacaoOk = (
    Array.isArray(parametros?.eventosSemMarcacaoOk)
      ? parametros.eventosSemMarcacaoOk
      : DEFAULT_AUDITORIA_PONTO_EVENTOS_SEM_MARCACAO_OK
  )
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  return {
    ...numericParams,
    eventosSemMarcacaoOk,
  };
}
