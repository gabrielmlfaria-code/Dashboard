import { SAUDE_DISCLAIMER } from "./saudePreventivaCampanhas.js";

const STATUS_LABEL = {
  ok: "Atendido",
  partial: "Parcial",
  no: "Não atendido",
};

const STATUS_CLASS = {
  ok: "st-ok",
  partial: "st-partial",
  no: "st-no",
};

function escHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusCell(status) {
  const label = STATUS_LABEL[status] || status;
  const cls = STATUS_CLASS[status] || "st-partial";
  const icon = status === "ok" ? "✅" : status === "no" ? "❌" : "⚠️";
  return `<span class="matriz-status ${cls}">${icon} ${label}</span>`;
}

function matrizTable(rows) {
  const body = rows
    .map(
      (r) => `<tr>
        <td>${escHtml(r.id)}</td>
        <td>${escHtml(r.req)}</td>
        <td>${statusCell(r.status)}</td>
        <td>${escHtml(r.app)}</td>
        <td>${escHtml(r.gap)}</td>
      </tr>`,
    )
    .join("");
  return `<table class="matriz-table">
    <thead><tr><th>#</th><th>Exigência</th><th>Status</th><th>O que o app faz</th><th>Lacuna / dependência</th></tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}

/** Linhas da matriz com status dinâmico conforme dados do período. */
export function buildSaudeMatrizRows({ stats = {}, art473 = {}, registros = [] } = {}) {
  const realizadas = Number(stats.realizadas) || 0;
  const total = Number(stats.total) || 0;
  const comAnexo = (Array.isArray(registros) ? registros : []).filter(
    (r) => r.status === "Realizado" && (r.anexos?.length > 0 || String(r.obs || "").trim()),
  ).length;
  const comArt473 = (Array.isArray(registros) ? registros : []).filter(
    (r) => r.status === "Realizado" && r.art473Comunicado,
  ).length;
  const semCom = Number(art473.semComunicacao) || 0;
  const alertas = Array.isArray(art473.alertas) ? art473.alertas.length : 0;
  const evidenciaOk = realizadas > 0 && comAnexo >= realizadas * 0.8;

  return {
    resumo: [
      { dim: "Apoio operacional ao RH", status: "ok", nota: "~9/10" },
      { dim: "Documentação para auditoria interna", status: realizadas > 0 && evidenciaOk ? "ok" : "partial", nota: evidenciaOk ? "~8/10" : "~6/10" },
      { dim: "Prova perante fiscalização / Justiça", status: evidenciaOk ? "partial" : "partial", nota: "~7/10" },
      { dim: "Cumprimento automático da obrigação legal", status: "no", nota: "Exige ação do empregador" },
    ],
    art169a: [
      {
        id: "2.1",
        req: "Divulgar informações oficiais (Ministério da Saúde)",
        status: realizadas > 0 ? "partial" : "partial",
        app: "Checklist legal, links gov.br, modelos e fontes oficiais",
        gap: "RH deve comunicar e anexar evidência; app não envia automaticamente",
      },
      {
        id: "2.2",
        req: "Promover conscientização sobre a campanha",
        status: realizadas > 0 ? "partial" : "partial",
        app: "Checklist e modelos por campanha (HPV, Outubro Rosa etc.)",
        gap: "Efetividade da comunicação é responsabilidade do RH",
      },
      {
        id: "2.3",
        req: "Orientar acesso a diagnóstico/vacinação",
        status: realizadas > 0 ? "partial" : "partial",
        app: "Checklist e textos orientativos nos modelos",
        gap: "Não valida se o colaborador foi orientado na prática",
      },
      {
        id: "2.4",
        req: "Informar direito de ausência (art. 473, XII)",
        status: comArt473 > 0 ? "partial" : "partial",
        app: "Checklist, modelo legal e checkbox art. 473 § 3º",
        gap: "Registrar no app ≠ informar o colaborador efetivamente",
      },
      {
        id: "2.5",
        req: "Calendário das campanhas de saúde",
        status: "ok",
        app: "Calendário anual, lembretes, badge e notificações",
        gap: "RH pode ignorar lembretes sem bloqueio legal automático",
      },
      {
        id: "2.6",
        req: "Registrar comunicações realizadas",
        status: total > 0 ? "ok" : "partial",
        app: "Formulário, histórico, CSV e backup JSON",
        gap: total === 0 ? "Nenhum registro no período exportado" : "—",
      },
      {
        id: "2.7",
        req: "Evidenciar a comunicação (prova documental)",
        status: evidenciaOk ? "partial" : realizadas > 0 ? "partial" : "partial",
        app: "Anexos e validação em status Realizado",
        gap: evidenciaOk ? "Sem AR/log de e-mail; exportar para GED" : "Faltam anexos ou observações nas realizadas",
      },
      {
        id: "2.8",
        req: "Identificar público-alvo",
        status: "ok",
        app: "Todos, departamentos (histórico) ou lista nominal",
        gap: "—",
      },
      {
        id: "2.9",
        req: "Bloquear registro Realizado incompleto",
        status: "ok",
        app: "Validação: checklist, § 3º, público-alvo e evidência",
        gap: "Ineficaz se RH preencher dados fictícios",
      },
    ],
    art473xii: [
      {
        id: "3.1",
        req: "Ausência remunerada sem desconto (folha)",
        status: "no",
        app: "Não calcula folha",
        gap: "Responsabilidade do DP/folha de pagamento",
      },
      {
        id: "3.2",
        req: "Limite de 3 dias a cada 12 meses",
        status: alertas > 0 ? "partial" : "partial",
        app: `Alerta na aba Art. 473${alertas > 0 ? ` (${alertas} colaborador(es) acima do limite)` : ""}`,
        gap: "Detecção heurística no histórico de ponto importado",
      },
      {
        id: "3.3",
        req: "Comprovação da realização do exame",
        status: "no",
        app: "Não armazena laudo/atestado do colaborador",
        gap: "Processo à parte (RH/medicina do trabalho)",
      },
      {
        id: "3.4",
        req: "Identificar ausências preventivas no histórico",
        status: (art473.ocorrencias || 0) > 0 ? "partial" : "partial",
        app: "Detecção por palavras-chave; badge 473 na tabela e modal",
        gap: "Depende da classificação correta dos eventos no ponto",
      },
      {
        id: "3.5",
        req: "Cruzar ausência com comunicação prévia",
        status: semCom > 0 ? "partial" : (art473.ocorrencias || 0) > 0 ? "ok" : "partial",
        app: `Vínculo comunicação ↔ ausência (120 dias)${semCom > 0 ? `; ${semCom} sem comunicação prévia` : ""}`,
        gap: semCom > 0 ? "Regularizar comunicações antes das ausências detectadas" : "Não prova que o colaborador específico foi comunicado",
      },
      {
        id: "3.6",
        req: "Informar colaborador sobre o direito (§ 3º)",
        status: comArt473 > 0 ? "partial" : "partial",
        app: "Texto legal + checkbox obrigatório em Realizado",
        gap: "Exige evidência de entrega além do checkbox",
      },
    ],
    art473p3: [
      {
        id: "4.1",
        req: "Texto expresso do direito de ausência",
        status: "ok",
        app: "Modelo legal com art. 473, XII e referência à Lei 15.377/2026",
        gap: "—",
      },
      {
        id: "4.2",
        req: "Confirmação de comunicação expressa",
        status: comArt473 > 0 ? "partial" : "partial",
        app: `${comArt473} registro(s) com art. 473 § 3º confirmado`,
        gap: comArt473 === 0 ? "Nenhuma comunicação realizada com confirmação § 3º" : "Checkbox sem anexo pode ser insuficiente em disputa",
      },
      {
        id: "4.3",
        req: "Comunicação antes da ausência",
        status: semCom > 0 ? "partial" : "partial",
        app: "Vínculo retroativo (até 120 dias antes do evento)",
        gap: semCom > 0 ? `${semCom} ausência(s) sem vínculo com comunicação` : "Depende de datas corretas nos registros",
      },
      {
        id: "4.4",
        req: "Canal, responsável e público documentados",
        status: total > 0 ? "ok" : "partial",
        app: "Campos obrigatórios no formulário de registro",
        gap: total === 0 ? "Sem registros exportados" : "—",
      },
      {
        id: "4.5",
        req: "Prova para auditoria",
        status: evidenciaOk ? "partial" : "partial",
        app: "Este relatório, anexos locais e backup JSON",
        gap: "Armazenamento no navegador — exportar para servidor/GED",
      },
    ],
    transversal: [
      { id: "5.1", req: "Campanhas HPV e calendário nacional", status: "ok", app: "Catálogo com links oficiais", gap: "—" },
      { id: "5.2", req: "Rastreabilidade (quem, quando, como, a quem)", status: total > 0 ? "ok" : "partial", app: "Histórico e exportações", gap: total === 0 ? "Sem registros" : "—" },
      { id: "5.3", req: "Não substitui parecer jurídico", status: "ok", app: "Disclaimer explícito no módulo", gap: "—" },
      { id: "5.4", req: "Integração eSocial / MTE / MS", status: "no", app: "Não há envio a órgãos", gap: "Fora do escopo do módulo" },
      { id: "5.5", req: "Arquivo centralizado corporativo", status: "no", app: "IndexedDB/localStorage + backup manual", gap: "Política de GED da empresa" },
      { id: "5.6", req: "Assistente NL (saúde preventiva / art. 473)", status: "ok", app: "Perguntas e chips no dashboard", gap: "Apoio à gestão, não prova legal" },
      { id: "5.7", req: "Relatório de conformidade exportável", status: "ok", app: "HTML imprimível (este documento)", gap: "—" },
    ],
    checklist: [
      {
        pergunta: "Cada campanha do ano foi comunicada de fato (e-mail, mural, SIPAT)?",
        ok: realizadas >= 3,
        risco: "Descumprimento do art. 169-A",
      },
      {
        pergunta: "Cada Realizado tem anexo real (print, foto, ata)?",
        ok: evidenciaOk,
        risco: "Prova documental fraca",
      },
      {
        pergunta: "O texto do art. 473 foi incluído na comunicação aos colaboradores?",
        ok: comArt473 > 0,
        risco: "Risco no art. 473, § 3º",
      },
      {
        pergunta: "Backup/relatório foi exportado para servidor/GED?",
        ok: false,
        risco: "Perda de evidência (verificar manualmente)",
      },
      {
        pergunta: "Ausências preventivas estão bem classificadas no ponto?",
        ok: semCom === 0 && (art473.ocorrencias || 0) >= 0,
        risco: "Badge 473 pode falhar com eventos mal cadastrados",
      },
      {
        pergunta: "Colaboradores acima de 3 dias/12 meses foram analisados?",
        ok: alertas === 0,
        risco: alertas > 0 ? `${alertas} alerta(s) pendente(s)` : "—",
      },
    ],
  };
}

const MATRIZ_STYLES = `
  body { font-family: Segoe UI, sans-serif; color: #111; margin: 24px; max-width: 1100px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  h2 { font-size: 15px; margin: 28px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  h3 { font-size: 13px; margin: 16px 0 6px; color: #374151; }
  p.meta { color: #555; font-size: 13px; margin-bottom: 16px; }
  .matriz-table { width: 100%; border-collapse: collapse; font-size: 11px; margin: 8px 0 16px; }
  .matriz-table th, .matriz-table td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
  .matriz-table th { background: #f3f4f6; }
  .matriz-status { font-weight: 600; white-space: nowrap; }
  .st-ok { color: #047857; }
  .st-partial { color: #b45309; }
  .st-no { color: #b91c1c; }
  .resumo-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 12px 0 20px; }
  .resumo-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
  .resumo-card strong { display: block; font-size: 13px; margin-bottom: 4px; }
  .conclusao { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px; margin: 20px 0; font-size: 12px; line-height: 1.5; }
  .conclusao blockquote { margin: 10px 0 0; padding-left: 12px; border-left: 3px solid #1a56db; font-style: italic; color: #1e3a5f; }
  .checklist { list-style: none; padding: 0; margin: 0; }
  .checklist li { padding: 8px 10px; border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 6px; font-size: 12px; }
  .check-ok { background: #ecfdf5; border-color: #a7f3d0; }
  .check-warn { background: #fffbeb; border-color: #fde68a; }
  .disclaimer { font-size: 11px; color: #666; margin-top: 24px; padding: 12px; background: #f9fafb; border-radius: 8px; }
  .legenda { font-size: 11px; color: #6b7280; margin-bottom: 12px; }
  @media print { body { margin: 12px; } .resumo-grid { grid-template-columns: 1fr 1fr; } }
`;

export function buildSaudeMatrizConformidadeHtml({
  periodoLabel = "",
  empresaLabel = "",
  stats = {},
  art473 = {},
  registros = [],
  embedded = false,
} = {}) {
  const geradoEm = new Date().toLocaleString("pt-BR");
  const m = buildSaudeMatrizRows({ stats, art473, registros });

  const resumoHtml = m.resumo
    .map(
      (r) => `<div class="resumo-card">
        <strong>${escHtml(r.dim)}</strong>
        ${statusCell(r.status)} · Nota: ${escHtml(r.nota)}
      </div>`,
    )
    .join("");

  const checklistHtml = m.checklist
    .map(
      (c) => `<li class="${c.ok ? "check-ok" : "check-warn"}">
        <strong>${c.ok ? "✅" : "⚠️"}</strong> ${escHtml(c.pergunta)}
        ${c.ok ? "" : `<br><em>Risco: ${escHtml(c.risco)}</em>`}
      </li>`,
    )
    .join("");

  const body = `
  ${embedded ? "" : `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Matriz de Conformidade — Lei 15.377/2026</title>
  <style>${MATRIZ_STYLES}</style>
</head>
<body>`}
  <h1>Matriz de Conformidade — Lei nº 15.377/2026</h1>
  <p class="meta">Gerado em ${escHtml(geradoEm)} · ${escHtml(empresaLabel || "Empresa")} · Período: ${escHtml(periodoLabel || "—")} · Módulo: Gestão de Campanhas de Saúde</p>
  <p class="legenda">Legenda: ✅ Atendido pela ferramenta · ⚠️ Parcial / depende do RH · ❌ Não atendido pelo software</p>

  <h2>1. Visão executiva</h2>
  <div class="resumo-grid">${resumoHtml}</div>

  <h2>2. Art. 169-A da CLT (comunicação de campanhas)</h2>
  ${matrizTable(m.art169a)}

  <h2>3. Art. 473, XII, da CLT (ausência para exames preventivos)</h2>
  ${matrizTable(m.art473xii)}

  <h2>4. Art. 473, § 3º, da CLT (informação expressa)</h2>
  ${matrizTable(m.art473p3)}

  <h2>5. Lei 15.377/2026 — aspectos transversais</h2>
  ${matrizTable(m.transversal)}

  <h2>6. Checklist prático (RH / jurídico)</h2>
  <ul class="checklist">${checklistHtml}</ul>

  <div class="conclusao">
    <strong>Conclusão</strong>
    <p>O módulo <strong>atende como instrumento de gestão e documentação</strong> alinhado à Lei 15.377/2026, mas <strong>não garante conformidade legal</strong> sem comunicação efetiva, evidências robustas e validação jurídica.</p>
    <blockquote>“O sistema constitui ferramenta de apoio à conformidade com a Lei nº 15.377/2026, facilitando o cumprimento dos arts. 169-A e 473 da CLT mediante registro auditável das comunicações de saúde preventiva. A obrigação legal de comunicar efetivamente os empregados permanece com o empregador.”</blockquote>
  </div>

  <p class="disclaimer">${escHtml(SAUDE_DISCLAIMER)} Matriz gerada automaticamente com base nos registros e no histórico importado no momento da exportação.</p>
  ${embedded ? "" : "</body></html>"}`;

  return body;
}

export function downloadSaudeMatrizConformidadeReport(options) {
  const html = buildSaudeMatrizConformidadeHtml(options);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `matriz_conformidade_lei15377_${stamp}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
