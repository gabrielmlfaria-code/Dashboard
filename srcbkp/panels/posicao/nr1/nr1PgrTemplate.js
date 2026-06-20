import { NR1_DISCLAIMER } from "./nr1Data.js";

function escHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildNr1PgrTemplateHtml({ empresaLabel = "", checklistMeta = {} } = {}) {
  const geradoEm = new Date().toLocaleString("pt-BR");
  const meta = checklistMeta && typeof checklistMeta === "object" ? checklistMeta : {};
  const c1 = meta.c1 || {};
  const c25 = meta.c25 || {};

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Modelo PGR — ${escHtml(empresaLabel || "Empresa")}</title>
  <style>
    body { font-family: Segoe UI, sans-serif; color: #111; margin: 28px; max-width: 900px; line-height: 1.5; }
    h1 { font-size: 22px; margin: 0 0 6px; }
    h2 { font-size: 16px; margin: 28px 0 10px; border-bottom: 2px solid #0f766e; padding-bottom: 4px; color: #115e59; }
    h3 { font-size: 14px; margin: 18px 0 8px; }
    p.meta { color: #555; font-size: 13px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 10px 0; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f0fdfa; }
    .blank { color: #94a3b8; font-style: italic; }
    .disclaimer { font-size: 11px; color: #666; margin-top: 32px; padding: 12px; background: #f9fafb; border-radius: 8px; }
    .assinatura { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .assinatura div { border-top: 1px solid #333; padding-top: 8px; font-size: 12px; }
    @media print { body { margin: 16px; } }
  </style>
</head>
<body>
  <h1>Programa de Gerenciamento de Riscos (PGR)</h1>
  <p class="meta">
    Empresa: <strong>${escHtml(empresaLabel || "_________________________")}</strong> ·
    Modelo gerado em ${escHtml(geradoEm)} · Base: NR-1, cap. 1.5 (GRO)
  </p>

  <h2>1. Identificação</h2>
  <table>
    <tr><th>Razão social</th><td>${escHtml(empresaLabel || "—")}</td></tr>
    <tr><th>CNPJ</th><td class="blank">Preencher</td></tr>
    <tr><th>Endereço / unidades</th><td class="blank">Preencher</td></tr>
    <tr><th>CNAE / grau de risco</th><td class="blank">Preencher</td></tr>
    <tr><th>Data de elaboração / revisão</th><td>${escHtml(c1.dataAssinatura || c25.proximaRevisao || "—")}</td></tr>
    <tr><th>Responsável técnico (CREA/CRM)</th><td>${escHtml(c1.respTecnico || "—")}</td></tr>
  </table>

  <h2>2. Inventário de riscos</h2>
  <p class="blank">Mapear por setor/posto: físicos, químicos, biológicos, ergonômicos, psicossociais e de acidente.</p>
  <table>
    <thead>
      <tr><th>Setor / GHE</th><th>Perigo</th><th>Risco</th><th>Fonte</th><th>Exposição</th><th>Nível</th></tr>
    </thead>
    <tbody>
      <tr><td class="blank" colspan="6">Inserir linhas do inventário</td></tr>
    </tbody>
  </table>

  <h2>3. Riscos psicossociais (obrigatório no PGR)</h2>
  <p>Incluir diagnóstico de estresse, assédio, burnout, sobrecarga e demais fatores (Port. MTE 1.419/2024; prazo Port. 765/2025).</p>
  <table>
    <thead><tr><th>Fator</th><th>Setores afetados</th><th>Avaliação</th><th>Medidas</th><th>Prazo</th></tr></thead>
    <tbody><tr><td class="blank" colspan="5">Preencher após diagnóstico</td></tr></tbody>
  </table>

  <h2>4. Plano de ação</h2>
  <table>
    <thead><tr><th>Risco</th><th>Medida (hierarquia de controles)</th><th>Responsável</th><th>Prazo</th><th>Status</th></tr></thead>
    <tbody><tr><td class="blank" colspan="5">Vincular ao inventário</td></tr></tbody>
  </table>

  <h2>5. Treinamentos e comunicação</h2>
  <p>Registrar capacitações SST alinhadas ao PGR (cap. 1.7 NR-1) e disponibilização do PGR aos trabalhadores.</p>

  <h2>6. Monitoramento e revisão</h2>
  <p>Revisão mínima anual ou quando houver mudanças. Próxima revisão prevista: <strong>${escHtml(c25.proximaRevisao || "—")}</strong></p>
  <p>Indicadores: absenteísmo, afastamentos, acidentes, quase acidentes, denúncias (canal Lei 14.457/2022).</p>

  <h2>7. Anexos sugeridos</h2>
  <ul>
    <li>PCMSO (NR-7) — quando aplicável</li>
    <li>Laudos / medições ambientais</li>
    <li>Atas CIPA / SIPAT</li>
    <li>Registros de treinamento</li>
    <li>Investigações de acidentes e CAT</li>
  </ul>

  <div class="assinatura">
    <div>Responsável técnico SST<br/><span class="blank">${escHtml(c1.respTecnico || "Nome / registro")}</span></div>
    <div>Representante da empresa<br/><span class="blank">Nome / cargo</span></div>
  </div>

  <p class="disclaimer">${escHtml(NR1_DISCLAIMER)} Este arquivo é um <strong>modelo estrutural</strong> para apoio à elaboração do PGR — deve ser completado, assinado e arquivado conforme NR-1 (guarda 20 anos).</p>
</body>
</html>`;
}

export function downloadNr1PgrTemplate(options) {
  const html = buildNr1PgrTemplateHtml(options);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `modelo_pgr_nr1_${stamp}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
