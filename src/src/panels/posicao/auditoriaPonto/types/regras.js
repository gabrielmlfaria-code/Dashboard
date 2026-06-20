export const SEVERITY_RANK = {
  critica: 4,
  alta: 3,
  media: 2,
  baixa: 1,
  ok: 0,
};

export const SEVERITY_LABEL = {
  critica: "Critica",
  alta: "Alta",
  media: "Media",
  baixa: "Baixa",
  ok: "OK",
};

export function createAnomalia({
  severity = "baixa",
  code,
  message,
  details = "",
  memoria = [],
  categoria = "operacional",
  forcaBloqueio = false,
  suprimidaPor = [],
  evidencia = {},
}) {
  return {
    severity,
    code,
    message,
    details,
    memoria,
    categoria,
    forcaBloqueio,
    suprimidaPor,
    evidencia,
  };
}
