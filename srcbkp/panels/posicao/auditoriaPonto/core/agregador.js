import { SEVERITY_RANK } from "../types/regras.js";

export function agregarAnomalias(anomalias = []) {
  const codes = new Set(anomalias.map((item) => item.code));
  const filtradas = anomalias.filter(
    (item) => !(item.suprimidaPor || []).some((code) => codes.has(code)),
  );
  const worst = filtradas.reduce((acc, item) => {
    if (!acc) return item;
    return SEVERITY_RANK[item.severity] > SEVERITY_RANK[acc.severity] ? item : acc;
  }, null);
  const severidadeMaxima = worst?.severity || "ok";
  const statusFechamento =
    severidadeMaxima === "critica" || filtradas.some((item) => item.forcaBloqueio)
      ? "bloqueado"
      : severidadeMaxima === "alta" || severidadeMaxima === "media"
        ? "revisar"
        : "liberado";
  const statusJornada =
    statusFechamento === "bloqueado"
      ? "bloqueada"
      : statusFechamento === "revisar"
        ? "suspeita"
        : "confiavel";

  return { anomalias: filtradas, worst, severidadeMaxima, statusFechamento, statusJornada };
}
