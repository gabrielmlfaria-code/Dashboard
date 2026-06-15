import { NR1_DISCLAIMER, countNr1ChecklistTotal } from "./nr1Data.js";

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

function allChecked(checkState, ids) {
  return ids.length > 0 && ids.every((id) => Boolean(checkState[id]));
}

function countRegistrosTipo(registros, tipo) {
  return (Array.isArray(registros) ? registros : []).filter((r) => r.tipo === tipo).length;
}

function countRegistrosRisco(registros, risco) {
  return (Array.isArray(registros) ? registros : []).filter((r) => r.risco === risco).length;
}

/** Linhas da matriz com status dinâmico conforme checklist, registros e pilares. */
export function buildNr1MatrizRows({
  stats = {},
  checkState = {},
  checklistPct = 0,
  checklistDone = 0,
  cardsProg = {},
  registros = [],
  histRows = [],
} = {}) {
  const total = Number(stats.total) || 0;
  const concluidas = Number(stats.concluidas) || 0;
  const checklistTotal = countNr1ChecklistTotal();
  const hasHist = Array.isArray(histRows) && histRows.length > 0;

  const pgrOk = allChecked(checkState, ["c1", "c2", "c3"]);
  const psicoCheckOk = allChecked(checkState, ["c6", "c7", "c8"]);
  const psicoReg = countRegistrosTipo(registros, "Avaliação de Riscos Psicossociais");
  const pgrReg =
    countRegistrosTipo(registros, "Elaboração / Revisão do PGR") +
    countRegistrosTipo(registros, "Monitoramento / Revisão do PGR");
  const treinReg = countRegistrosTipo(registros, "Treinamento em SST");
  const controleReg = countRegistrosTipo(registros, "Medida de Controle Implementada");
  const psicoRiscoReg = countRegistrosRisco(registros, "Psicossocial");
  const progPsico = Number(cardsProg.psicossocial ?? 0);
  const progPgr = Number(cardsProg.pgr ?? 0);
  const checklistAlto = checklistPct >= 70;
  const rows = Array.isArray(registros) ? registros : [];
  const comAnexo = rows.filter((r) => (r.anexos || []).length > 0).length;
  const concluidasComAnexo = rows.filter(
    (r) => r.status === "Concluído" && (r.anexos || []).length > 0,
  ).length;
  const evidenciaOk = concluidas > 0 && concluidasComAnexo >= Math.ceil(concluidas * 0.5);

  return {
    resumo: [
      {
        dim: "Conteúdo e referência legal (NR-1 / GRO)",
        status: "ok",
        nota: "~8/10",
      },
      {
        dim: "Apoio operacional ao SST / RH",
        status: total > 0 || checklistDone > 0 ? "ok" : "partial",
        nota: total > 0 ? "~7/10" : "~5/10",
      },
      {
        dim: "Documentação para auditoria interna",
        status: checklistAlto && total > 0 ? "partial" : "partial",
        nota: checklistAlto && total > 0 ? "~6/10" : "~4/10",
      },
      {
        dim: "Prova perante fiscalização / Justiça",
        status: "no",
        nota: "~3/10",
      },
      {
        dim: "Cumprimento automático da obrigação legal",
        status: "no",
        nota: "Exige PGR e ações do empregador",
      },
    ],
    groPgr: [
      {
        id: "2.1",
        req: "Elaborar e manter o PGR (cap. 1.5, NR-1)",
        status: pgrOk || pgrReg > 0 ? "partial" : "no",
        app: "Pilar PGR, checklist c1–c5, registro de ações",
        gap: pgrOk ? "Checklist marcado ≠ PGR assinado por profissional habilitado" : "PGR não evidenciado no módulo",
      },
      {
        id: "2.2",
        req: "Inventário de riscos por setor/posto",
        status: Boolean(checkState.c2) || countRegistrosTipo(registros, "Identificação de Perigos") > 0 ? "partial" : "partial",
        app: "Checklist c2, c15–c19 e tipo Identificação de Perigos",
        gap: "Não gera inventário formal exportável",
      },
      {
        id: "2.3",
        req: "Plano de ação com prazos e responsáveis",
        status: Boolean(checkState.c3) || controleReg > 0 ? "partial" : "partial",
        app: "Checklist c3, registro com responsável, prazo e status",
        gap: "Sem vinculação automática ao documento PGR",
      },
      {
        id: "2.4",
        req: "Disponibilizar PGR aos trabalhadores",
        status: Boolean(checkState.c4) ? "partial" : "partial",
        app: "Checklist c4",
        gap: "App não comprova divulgação efetiva",
      },
      {
        id: "2.5",
        req: "Guarda documental por 20 anos",
        status: Boolean(checkState.c5) ? "partial" : "partial",
        app: "Checklist c5",
        gap: "localStorage no navegador — exportar CSV/matriz para GED",
      },
      {
        id: "2.6",
        req: "Revisão anual ou quando houver mudanças",
        status: Boolean(checkState.c25) || countRegistrosTipo(registros, "Monitoramento / Revisão do PGR") > 0 ? "partial" : "partial",
        app: "Checklist c25, pilar Monitoramento, tipo de ação dedicado",
        gap: "Não alerta vencimento automático da revisão",
      },
      {
        id: "2.7",
        req: "Hierarquia de controles (eliminação → EPI)",
        status: Boolean(checkState.c21) || controleReg > 0 ? "partial" : "partial",
        app: "Checklist c21–c23, pilar Medidas de Controle",
        gap: "Sem matriz de risco nem evidência de implementação",
      },
      {
        id: "2.8",
        req: "Registrar ações de conformidade SST",
        status: total > 0 ? "ok" : "partial",
        app: "Formulário, histórico, CSV e checklist GRO",
        gap: total === 0 ? "Nenhuma ação registrada" : "—",
      },
    ],
    psicossocial: [
      {
        id: "3.1",
        req: "Incluir riscos psicossociais no PGR (Port. 1.419/2024)",
        status: psicoCheckOk || psicoReg > 0 || psicoRiscoReg > 0 ? "partial" : "no",
        app: "Pilar dedicado, checklist c6–c8, tipo e categoria Psicossocial",
        gap: "Obrigatório no PGR físico/assinado — app só apoia gestão",
      },
      {
        id: "3.2",
        req: "Adequação até 25/05/2026 (Port. MTE 765/2025)",
        status: psicoCheckOk && progPsico >= 50 ? "partial" : "partial",
        app: `Alerta de vigência, badge e progresso do pilar (${progPsico}%)`,
        gap: "Progresso manual — não mede conformidade real",
      },
      {
        id: "3.3",
        req: "Diagnosticar fatores (estresse, assédio, burnout, sobrecarga)",
        status: Boolean(checkState.c6) || psicoReg > 0 ? "partial" : "partial",
        app: "Checklist c6 e registro de avaliação psicossocial",
        gap: "Sem metodologia/API de questionário ou laudo técnico",
      },
      {
        id: "3.4",
        req: "Plano de ação específico para psicossociais",
        status: Boolean(checkState.c8) || psicoReg > 0 ? "partial" : "partial",
        app: "Checklist c8, registros de medidas de controle",
        gap: "Não valida eficácia das medidas",
      },
      {
        id: "3.5",
        req: "Canal de escuta/denúncias (Lei 14.457/2022)",
        status: Boolean(checkState.c9) ? "partial" : "partial",
        app: "Checklist c9",
        gap: "App não implementa canal — apenas lembrete",
      },
      {
        id: "3.6",
        req: "Participação da CIPA no GRO psicossocial",
        status: Boolean(checkState.c10) ? "partial" : "partial",
        app: "Checklist c10, tipo Comunicação ao CIPA",
        gap: "Comprovação de ata/reunião é externa ao módulo",
      },
    ],
    treinamento: [
      {
        id: "4.1",
        req: "Treinamentos SST documentados (cap. 1.7)",
        status: Boolean(checkState.c11) || treinReg > 0 ? "partial" : "partial",
        app: "Pilar Treinamento, checklist c11–c14",
        gap: "Sem lista de presença nem anexos",
      },
      {
        id: "4.2",
        req: "Conteúdo alinhado aos riscos do PGR",
        status: Boolean(checkState.c12) ? "partial" : "partial",
        app: "Checklist c12",
        gap: "Não cruza automaticamente riscos × treinamentos",
      },
      {
        id: "4.3",
        req: "EaD conforme Anexo II da NR-1",
        status: Boolean(checkState.c13) ? "partial" : "partial",
        app: "Checklist c13",
        gap: "Não valida carga horária nem plataforma",
      },
      {
        id: "4.4",
        req: "Calendário de reciclagem",
        status: Boolean(checkState.c14) ? "partial" : "partial",
        app: "Checklist c14",
        gap: "Sem calendário automático de vencimentos",
      },
    ],
    monitoramento: [
      {
        id: "5.1",
        req: "Investigação de acidentes/incidentes",
        status: Boolean(checkState.c26) || countRegistrosTipo(registros, "Investigação de Acidente/Incidente") > 0 ? "partial" : "partial",
        app: "Checklist c26, tipo de ação dedicado",
        gap: "Sem formulário estruturado de investigação",
      },
      {
        id: "5.2",
        req: "Indicadores de SST (absenteísmo, afastamentos)",
        status: hasHist ? "partial" : "no",
        app: hasHist
          ? "Bloco de indicadores SST (ausências/afastamentos) no módulo NR-1"
          : "Sem histórico vinculado",
        gap: hasHist
          ? "Detecção heurística — valide categorias no ponto"
          : "Abra o NR-1 a partir do dashboard para importar histórico",
      },
      {
        id: "5.3",
        req: "CAT emitida no prazo",
        status: Boolean(checkState.c28) ? "partial" : "partial",
        app: "Checklist c28",
        gap: "Sem integração eSocial / emissão de CAT",
      },
      {
        id: "5.4",
        req: "Checklist GRO/PGR (28 itens)",
        status: checklistPct >= 80 ? "partial" : checklistDone > 0 ? "partial" : "partial",
        app: `${checklistDone}/${checklistTotal} itens (${checklistPct}%)`,
        gap: checklistPct < 80 ? "Checklist incompleto — auto-declaratório" : "Marcar item ≠ cumprir exigência",
      },
      {
        id: "5.5",
        req: "Progresso dos pilares SST",
        status: progPgr > 0 || progPsico > 0 ? "partial" : "partial",
        app: `Sliders manuais — PGR ${progPgr}%, Psicossocial ${progPsico}%`,
        gap: "Não baseado em evidências documentais",
      },
    ],
    transversal: [
      {
        id: "6.1",
        req: "Fontes oficiais NR-1 / MTE",
        status: "ok",
        app: "Aba Fontes Oficiais com links gov.br e Planalto",
        gap: "—",
      },
      {
        id: "6.2",
        req: "Rastreabilidade de ações (quem, quando, o quê)",
        status: total > 0 ? (evidenciaOk ? "partial" : "partial") : "partial",
        app: `Histórico, anexos (IndexedDB), CSV e backup JSON${comAnexo > 0 ? ` — ${comAnexo} com anexo(s)` : ""}`,
        gap:
          total === 0
            ? "Sem registros exportados"
            : evidenciaOk
              ? "Exportar matriz/relatório para GED"
              : "Concluídas sem anexo — evidência documental fraca",
      },
      {
        id: "6.3",
        req: "Não substitui PGR nem parecer técnico/jurídico",
        status: "ok",
        app: "Disclaimer explícito no módulo",
        gap: "—",
      },
      {
        id: "6.4",
        req: "Responsável técnico habilitado (eng./médico SST)",
        status: "no",
        app: "Campo responsável livre no registro",
        gap: "Sem validação de registro profissional",
      },
      {
        id: "6.5",
        req: "Integração eSocial / GRO Digital MTE",
        status: "no",
        app: "Não há envio a órgãos",
        gap: "Fora do escopo atual do módulo",
      },
      {
        id: "6.6",
        req: "Arquivo centralizado corporativo (GED)",
        status: "no",
        app: "localStorage + exportação manual",
        gap: "Política de retenção e backup da empresa",
      },
      {
        id: "6.7",
        req: "Matriz de conformidade exportável",
        status: "ok",
        app: "Este relatório HTML imprimível",
        gap: "—",
      },
    ],
    checklist: [
      {
        pergunta: "Existe PGR assinado por profissional habilitado, além do checklist no app?",
        ok: pgrOk && pgrReg > 0,
        risco: "Documento central da NR-1 ausente ou desatualizado",
      },
      {
        pergunta: "Riscos psicossociais estão no PGR com plano de ação até 25/05/2026?",
        ok: psicoCheckOk && (psicoReg > 0 || psicoRiscoReg > 0),
        risco: "Autuação e passivo trabalhista pós-vigência",
      },
      {
        pergunta: "Canal de denúncias (Lei 14.457) está implementado na empresa?",
        ok: Boolean(checkState.c9),
        risco: "Checklist marcado sem canal real",
      },
      {
        pergunta: "Ações concluídas no app têm evidência externa (ata, laudo, foto)?",
        ok: evidenciaOk,
        risco: evidenciaOk
          ? "—"
          : "Registros concluídos sem anexo — evidência fraca em fiscalização",
      },
      {
        pergunta: "CSV/matriz foi arquivado em servidor/GED corporativo?",
        ok: false,
        risco: "Perda de evidência — verificar manualmente",
      },
      {
        pergunta: "Checklist GRO reflete a realidade (não apenas marcação rápida)?",
        ok: checklistPct >= 80,
        risco: checklistPct < 80 ? `Apenas ${checklistPct}% do checklist` : "Auto-declaração sem auditoria",
      },
    ],
  };
}

const MATRIZ_STYLES = `
  body { font-family: Segoe UI, sans-serif; color: #111; margin: 24px; max-width: 1100px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  h2 { font-size: 15px; margin: 28px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  p.meta { color: #555; font-size: 13px; margin-bottom: 16px; }
  .matriz-table { width: 100%; border-collapse: collapse; font-size: 11px; margin: 8px 0 16px; }
  .matriz-table th, .matriz-table td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
  .matriz-table th { background: #f0fdfa; }
  .matriz-status { font-weight: 600; white-space: nowrap; }
  .st-ok { color: #047857; }
  .st-partial { color: #b45309; }
  .st-no { color: #b91c1c; }
  .resumo-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 12px 0 20px; }
  .resumo-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
  .resumo-card strong { display: block; font-size: 13px; margin-bottom: 4px; }
  .conclusao { background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 14px; margin: 20px 0; font-size: 12px; line-height: 1.5; }
  .conclusao blockquote { margin: 10px 0 0; padding-left: 12px; border-left: 3px solid #0f766e; font-style: italic; color: #115e59; }
  .checklist { list-style: none; padding: 0; margin: 0; }
  .checklist li { padding: 8px 10px; border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 6px; font-size: 12px; }
  .check-ok { background: #ecfdf5; border-color: #a7f3d0; }
  .check-warn { background: #fffbeb; border-color: #fde68a; }
  .disclaimer { font-size: 11px; color: #666; margin-top: 24px; padding: 12px; background: #f9fafb; border-radius: 8px; }
  .legenda { font-size: 11px; color: #6b7280; margin-bottom: 12px; }
  .vigencia { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 12px; font-size: 12px; margin-bottom: 16px; }
  @media print { body { margin: 12px; } .resumo-grid { grid-template-columns: 1fr 1fr; } }
`;

export function buildNr1MatrizConformidadeHtml({
  empresaLabel = "",
  stats = {},
  checkState = {},
  checklistPct = 0,
  checklistDone = 0,
  cardsProg = {},
  registros = [],
  histRows = [],
  embedded = false,
} = {}) {
  const geradoEm = new Date().toLocaleString("pt-BR");
  const m = buildNr1MatrizRows({
    stats,
    checkState,
    checklistPct,
    checklistDone,
    cardsProg,
    registros,
    histRows,
  });

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
  <title>Matriz de Conformidade — NR-1 GRO/PGR</title>
  <style>${MATRIZ_STYLES}</style>
</head>
<body>`}
  <h1>Matriz de Conformidade — NR-1 (GRO / PGR / Riscos Psicossociais)</h1>
  <p class="meta">Gerado em ${escHtml(geradoEm)} · ${escHtml(empresaLabel || "Empresa")} · Módulo: Gestão de Conformidade NR-1</p>
  <p class="legenda">Legenda: ✅ Atendido pela ferramenta · ⚠️ Parcial / depende do SST · ❌ Não atendido pelo software</p>
  <div class="vigencia"><strong>Vigência psicossociais:</strong> 25/05/2026 (Portaria MTE 765/2025) · <strong>GRO:</strong> Portaria MTE 1.419/2024</div>

  <h2>1. Visão executiva</h2>
  <div class="resumo-grid">${resumoHtml}</div>

  <h2>2. Cap. 1.5 — GRO e PGR (NR-1)</h2>
  ${matrizTable(m.groPgr)}

  <h2>3. Riscos psicossociais (Port. 1.419/2024 e 765/2025)</h2>
  ${matrizTable(m.psicossocial)}

  <h2>4. Treinamento em SST (cap. 1.7, NR-1)</h2>
  ${matrizTable(m.treinamento)}

  <h2>5. Monitoramento, indicadores e checklist</h2>
  ${matrizTable(m.monitoramento)}

  <h2>6. Aspectos transversais</h2>
  ${matrizTable(m.transversal)}

  <h2>7. Checklist prático (SST / RH / jurídico)</h2>
  <ul class="checklist">${checklistHtml}</ul>

  <div class="conclusao">
    <strong>Conclusão</strong>
    <p>O módulo <strong>apoia a gestão e o acompanhamento</strong> das obrigações da NR-1 (GRO/PGR), mas <strong>não substitui o PGR assinado</strong>, laudos técnicos, canal de denúncias implementado nem validação por profissional habilitado.</p>
    <blockquote>“Ferramenta de apoio à conformidade com a NR-1 (GRO/PGR). Não substitui PGR assinado por profissional habilitado nem parecer técnico/jurídico. A obrigação de identificar, avaliar e controlar riscos — inclusive psicossociais — permanece com o empregador.”</blockquote>
  </div>

  <p class="disclaimer">${escHtml(NR1_DISCLAIMER)} Matriz gerada automaticamente com base no checklist, registros e histórico disponíveis no momento da exportação.</p>
  ${embedded ? "" : "</body></html>"}`;

  return body;
}

export function downloadNr1MatrizConformidadeReport(options) {
  const html = buildNr1MatrizConformidadeHtml(options);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `matriz_conformidade_nr1_${stamp}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
