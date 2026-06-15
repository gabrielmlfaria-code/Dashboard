import { createAnomalia } from "../../types/regras.js";

export function regraMarcacaoExcedente(ctx) {
  const excedentes = ctx.pareamento.filter((item) => item.status === "EXCEDENTE");
  if (!excedentes.length) return null;
  return createAnomalia({
    severity: "media",
    code: "MARCACAO_EXCEDENTE",
    message: "Ha marcacoes sem horario planejado correspondente.",
    categoria: "operacional",
    memoria: excedentes.map((item) => `Excedente: ${item.marcacaoEncontrada?.original || "-"}`),
  });
}
