import { formatNr1DataBr } from "./nr1Data.js";
import { buildNr1MatrizConformidadeHtml } from "./nr1Matriz.js";

function escHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildNr1ConformidadeReportHtml({
  empresaLabel = "",
  stats = {},
  checkState = {},
  checklistPct = 0,
  checklistDone = 0,
  cardsProg = {},
  registros = [],
  histRows = [],
  indicadores = null,
} = {}) {
  const list = Array.isArray(registros) ? registros : [];
  const geradoEm = new Date().toLocaleString("pt-BR");
  const ind = indicadores || {};

  const registroRows = list
    .map(
      (r) => `<tr>
        <td>${escHtml(formatNr1DataBr(r.data))}</td>
        <td>${escHtml(r.tipo)}</td>
        <td>${escHtml(r.setor || "—")}</td>
        <td>${escHtml(r.resp)}</td>
        <td>${escHtml(r.risco || "—")}</td>
        <td>${escHtml(r.status)}</td>
        <td>${(r.anexos || []).length}</td>
        <td>${escHtml(r.desc || "—")}</td>
      </tr>`,
    )
    .join("");

  const alertasInd =
    Array.isArray(ind.alertas) && ind.alertas.length
      ? `<ul>${ind.alertas.map((a) => `<li>${escHtml(a)}</li>`).join("")}</ul>`
      : "<p>Sem histórico importado ou sem alertas automáticos.</p>";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Relatório NR-1 — GRO/PGR</title>
  <style>
    body { font-family: Segoe UI, sans-serif; color: #111; margin: 24px; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    h2 { font-size: 15px; margin: 24px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    p.meta { color: #555; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f0fdfa; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
    .kpi { border: 1px solid #ddd; padding: 12px; border-radius: 8px; }
    .kpi strong { display: block; font-size: 22px; }
    .kpi span { font-size: 11px; color: #666; text-transform: uppercase; }
    .matriz-section { margin-top: 32px; padding-top: 8px; border-top: 2px solid #0f766e; }
    .page-break { page-break-before: always; }
  </style>
</head>
<body>
  <h1>Relatório de Conformidade — NR-1 (GRO / PGR)</h1>
  <p class="meta">Gerado em ${escHtml(geradoEm)} · ${escHtml(empresaLabel || "Empresa")}</p>
  <div class="kpis">
    <div class="kpi"><strong>${stats.total ?? 0}</strong><span>Ações</span></div>
    <div class="kpi"><strong>${stats.concluidas ?? 0}</strong><span>Concluídas</span></div>
    <div class="kpi"><strong>${checklistPct}%</strong><span>Checklist GRO</span></div>
    <div class="kpi"><strong>${ind.eventosAfastamento ?? "—"}</strong><span>Afast. (hist.)</span></div>
  </div>
  <h2>Indicadores do histórico (dashboard)</h2>
  <p>Dias no recorte: <strong>${ind.diasHist ?? 0}</strong> · Colaboradores: <strong>${ind.colaboradores ?? 0}</strong> · Ausências detectadas: <strong>${ind.eventosAusencia ?? 0}</strong></p>
  ${alertasInd}
  <h2>Ações registradas no módulo NR-1</h2>
  <table>
    <thead><tr><th>Data</th><th>Tipo</th><th>Setor</th><th>Responsável</th><th>Risco</th><th>Status</th><th>Anexos</th><th>Descrição</th></tr></thead>
    <tbody>${registroRows || "<tr><td colspan='8'>Nenhum registro</td></tr>"}</tbody>
  </table>
  <div class="matriz-section page-break">
    ${buildNr1MatrizConformidadeHtml({
      empresaLabel,
      stats,
      checkState,
      checklistPct,
      checklistDone,
      cardsProg,
      registros: list,
      histRows,
      embedded: true,
    })}
  </div>
</body>
</html>`;
}

export function downloadNr1ConformidadeReport(options) {
  const html = buildNr1ConformidadeReportHtml(options);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `conformidade_nr1_${stamp}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
