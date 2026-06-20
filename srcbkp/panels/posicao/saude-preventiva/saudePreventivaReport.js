import {
  SAUDE_CHECKLIST_ITEMS,
  SAUDE_DISCLAIMER,
  computeSaudeRegistroStats,
  formatSaudeDataBr,
  labelSaudePublicoAlcance,
  normalizeSaudeChecklist,
  normalizeSaudeRegistro,
} from "./saudePreventivaCampanhas.js";
import { buildSaudeMatrizConformidadeHtml } from "./saudePreventivaMatriz.js";

const CALENDARIO_STATUS = {
  ok: "Concluído",
  ativo: "Ação agora",
  proximo: "Em breve",
  atrasado: "Atrasado",
  pendente: "Pendente",
};

function escHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildSaudeConformidadeReportHtml({
  periodoLabel = "",
  empresaLabel = "",
  registros = [],
  art473 = null,
  calendario = [],
} = {}) {
  const list = (Array.isArray(registros) ? registros : []).map(normalizeSaudeRegistro);
  const stats = computeSaudeRegistroStats(list);
  const geradoEm = new Date().toLocaleString("pt-BR");
  const art = art473 || { ocorrencias: 0, colaboradores: 0, semComunicacao: 0, alertas: [], eventos: [] };
  const cal = Array.isArray(calendario) ? calendario : [];

  const registroRows = list
    .map((r) => {
      const checklist = SAUDE_CHECKLIST_ITEMS.map(
        (item) => `${item.label}: ${normalizeSaudeChecklist(r.checklist)[item.id] ? "Sim" : "Não"}`,
      ).join("; ");
      return `<tr>
        <td>${escHtml(formatSaudeDataBr(r.data))}</td>
        <td>${escHtml(r.tema)}</td>
        <td>${escHtml(labelSaudePublicoAlcance(r))}</td>
        <td>${escHtml(r.status)}</td>
        <td>${r.anexos.length}</td>
        <td>${r.art473Comunicado ? "Sim" : "Não"}</td>
        <td>${escHtml(checklist)}</td>
      </tr>`;
    })
    .join("");

  const calRows = cal
    .map(
      (c) => `<tr>
        <td>${escHtml(c.titulo)}</td>
        <td>${escHtml(c.mes)}</td>
        <td>${escHtml(CALENDARIO_STATUS[c.status] || c.status)}</td>
        <td>${escHtml(c.mensagem)}</td>
      </tr>`,
    )
    .join("");

  const artRows = (art.eventos || [])
    .slice(0, 50)
    .map(
      (ev) => `<tr>
        <td>${escHtml(formatSaudeDataBr(ev.date))}</td>
        <td>${escHtml(ev.colaborador)}</td>
        <td>${escHtml(ev.evento)}</td>
        <td>${ev.comunicacaoRegistrada ? "Sim" : "Não"}</td>
      </tr>`,
    )
    .join("");

  const alertasHtml = (art.alertas || []).length
    ? `<ul>${art.alertas.map((a) => `<li>${escHtml(a.colaborador)}: ${a.diasUsados} dia(s) em 12 meses (limite ${a.limite})</li>`).join("")}</ul>`
    : "<p>Nenhum colaborador acima do limite de 3 dias em 12 meses.</p>";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Relatório de Conformidade — Lei 15.377/2026</title>
  <style>
    body { font-family: Segoe UI, sans-serif; color: #111; margin: 24px; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    h2 { font-size: 15px; margin: 24px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    p.meta { color: #555; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
    .kpi { border: 1px solid #ddd; padding: 12px; border-radius: 8px; }
    .kpi strong { display: block; font-size: 22px; }
    .kpi span { font-size: 11px; color: #666; text-transform: uppercase; }
    .disclaimer { font-size: 11px; color: #666; margin-top: 24px; padding: 12px; background: #f9fafb; border-radius: 8px; }
    .matriz-section { margin-top: 32px; padding-top: 8px; border-top: 2px solid #1a56db; }
    .page-break { page-break-before: always; }
  </style>
</head>
<body>
  <h1>Relatório de Conformidade — Lei nº 15.377/2026</h1>
  <p class="meta">Gerado em ${escHtml(geradoEm)} · ${escHtml(empresaLabel || "Empresa")} · Período: ${escHtml(periodoLabel || "—")}</p>
  <div class="kpis">
    <div class="kpi"><strong>${stats.total}</strong><span>Comunicações</span></div>
    <div class="kpi"><strong>${stats.realizadas}</strong><span>Realizadas</span></div>
    <div class="kpi"><strong>${art.ocorrencias}</strong><span>Art. 473 no período</span></div>
    <div class="kpi"><strong>${art.semComunicacao}</strong><span>Sem comunicação prévia</span></div>
  </div>
  <h2>Calendário de campanhas (${new Date().getFullYear()})</h2>
  <table><thead><tr><th>Campanha</th><th>Período</th><th>Status</th><th>Observação</th></tr></thead><tbody>${calRows || "<tr><td colspan='4'>Sem dados</td></tr>"}</tbody></table>
  <h2>Comunicações registradas</h2>
  <table><thead><tr><th>Data</th><th>Tema</th><th>Alcance</th><th>Status</th><th>Anexos</th><th>Art. 473</th><th>Checklist</th></tr></thead><tbody>${registroRows || "<tr><td colspan='7'>Nenhum registro</td></tr>"}</tbody></table>
  <h2>Art. 473, XII — ausências preventivas no histórico</h2>
  <table><thead><tr><th>Data</th><th>Colaborador</th><th>Evento</th><th>Comunicação prévia</th></tr></thead><tbody>${artRows || "<tr><td colspan='4'>Nenhuma ocorrência detectada</td></tr>"}</tbody></table>
  <h2>Alertas de limite (3 dias / 12 meses)</h2>
  ${alertasHtml}
  <div class="matriz-section page-break">
    ${buildSaudeMatrizConformidadeHtml({
      periodoLabel,
      empresaLabel,
      stats,
      art473: art,
      registros: list,
      embedded: true,
    })}
  </div>
  <p class="disclaimer">${escHtml(SAUDE_DISCLAIMER)} Este relatório consolida registros locais e eventos do histórico importado.</p>
</body>
</html>`;
}

export function downloadSaudeConformidadeReport(options) {
  const html = buildSaudeConformidadeReportHtml(options);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `conformidade_lei15377_${stamp}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
