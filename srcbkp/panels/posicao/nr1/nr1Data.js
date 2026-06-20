export const NR1_LS_REGISTROS = "nr1_registros";
export const NR1_LS_CHECKLIST = "nr1_checklist";
export const NR1_LS_CHECKLIST_META = "nr1_checklist_meta";
export const NR1_LS_CARDS_PROG = "nr1_cards_prog";

export const NR1_BADGE_GRO = "Portaria MTE 1.419/2024 — GRO";
export const NR1_BADGE_PRAZO = "Port. 765/2025 · Psicossociais: 25/05/2026";
/** @deprecated Use NR1_BADGE_GRO + NR1_BADGE_PRAZO */
export const NR1_BADGE = NR1_BADGE_PRAZO;

/** Campos obrigatórios para marcar itens críticos do checklist. */
export const NR1_CHECKLIST_REQUIRES = {
  c1: [
    { key: "dataAssinatura", label: "Data de assinatura do PGR", type: "date" },
    { key: "respTecnico", label: "Responsável técnico (CREA/CRM)", type: "text" },
  ],
  c6: [
    { key: "dataDiag", label: "Data do diagnóstico psicossocial", type: "date" },
    { key: "metodo", label: "Método / ferramenta utilizada", type: "text" },
  ],
  c9: [{ key: "canalRef", label: "Canal de denúncias (URL ou procedimento)", type: "text" }],
  c25: [{ key: "proximaRevisao", label: "Data da próxima revisão do PGR", type: "date" }],
};

export function nr1ChecklistMetaComplete(itemId, meta = {}) {
  const reqs = NR1_CHECKLIST_REQUIRES[itemId];
  if (!reqs?.length) return true;
  const bag = meta && typeof meta === "object" ? meta : {};
  return reqs.every((f) => String(bag[f.key] || "").trim());
}

export const NR1_DISCLAIMER =
  "Ferramenta de apoio à conformidade com a NR-1 (GRO/PGR). Não substitui PGR assinado por profissional habilitado nem parecer técnico/jurídico.";

export const NR1_ALERTA =
  "A inclusão de Riscos Psicossociais no PGR é obrigatória desde 25/05/2026 (Portaria MTE 765/2025). Empresas não adequadas estão sujeitas a autuação, multas e passivo trabalhista por danos psíquicos.";

export const NR1_TIPO_OPTIONS = [
  "Elaboração / Revisão do PGR",
  "Identificação de Perigos",
  "Avaliação de Riscos Ocupacionais",
  "Avaliação de Riscos Psicossociais",
  "Treinamento em SST",
  "SIPAT",
  "Inspeção de Segurança",
  "Investigação de Acidente/Incidente",
  "Comunicação ao CIPA",
  "Medida de Controle Implementada",
  "Monitoramento / Revisão do PGR",
  "Outro",
];

export const NR1_STATUS_OPTIONS = ["Concluído", "Em Andamento", "Agendado", "Cancelado"];

export const NR1_RISCO_OPTIONS = [
  "Físico",
  "Químico",
  "Biológico",
  "Ergonômico",
  "Psicossocial",
  "Acidente / Mecânico",
  "Geral / Múltiplos",
];

export const NR1_CARDS = [
  {
    id: "pgr",
    titulo: "PGR — Programa de Gerenciamento de Riscos",
    sub: "Obrigatório · Todas as empresas",
    icon: "📄",
    cor: "linear-gradient(135deg,#0f766e,#14b8a6)",
    desc: "Documento central da NR-1. Deve identificar perigos, avaliar e controlar riscos ocupacionais. Atualização mínima anual ou quando houver mudanças. Guarda obrigatória por 20 anos.",
    status: "critico",
    prog: 0,
    progLabel: "Implantação",
    link: "https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/nr-1",
    tipoRegistrar: "Elaboração / Revisão do PGR",
  },
  {
    id: "psicossocial",
    titulo: "Riscos Psicossociais",
    sub: "Vigência: 25/05/2026 · Portaria 1.419/2024",
    icon: "🧠",
    cor: "linear-gradient(135deg,#7c3aed,#a78bfa)",
    desc: "Identificar e gerenciar estresse, assédio, burnout, sobrecarga e outros fatores psicossociais. Obrigatório no PGR desde maio/2026. CANPAT 2026 tem foco nesse tema.",
    status: "critico",
    prog: 0,
    progLabel: "Avaliação",
    link: "https://www.gov.br/trabalho-e-emprego/pt-br/noticias-e-conteudo/2026/marco/mte-lanca-manual-para-orientar-gestao-de-riscos-ocupacionais-nas-empresas",
    tipoRegistrar: "Avaliação de Riscos Psicossociais",
  },
  {
    id: "treinamento",
    titulo: "Treinamento em SST",
    sub: "Cap. 1.7 · Obrigatório",
    icon: "🎓",
    cor: "linear-gradient(135deg,#2563eb,#60a5fa)",
    desc: "Capacitação obrigatória em Segurança e Saúde no Trabalho. Pode ser presencial, semipresencial ou EaD conforme Anexo II da NR-1. Deve ser documentada e ter conteúdo alinhado ao PGR.",
    status: "alerta",
    prog: 50,
    progLabel: "Realização",
    link: "https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/nr-1",
    tipoRegistrar: "Treinamento em SST",
  },
  {
    id: "perigos",
    titulo: "Identificação de Perigos",
    sub: "Cap. 1.5 · GRO",
    icon: "🔍",
    cor: "linear-gradient(135deg,#d97706,#fbbf24)",
    desc: "Mapear todos os perigos existentes nos postos de trabalho: físicos, químicos, biológicos, ergonômicos, psicossociais e de acidente. Base do GRO.",
    status: "alerta",
    prog: 30,
    progLabel: "Mapeamento",
    link: "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/seguranca-e-saude-no-trabalho/sst-portarias/2024/portaria-mte-no-1-419-nr-01-gro-nova-redacao.pdf",
    tipoRegistrar: "Identificação de Perigos",
  },
  {
    id: "controles",
    titulo: "Medidas de Prevenção e Controle",
    sub: "Cap. 1.5 · Hierarquia de controles",
    icon: "🛡️",
    cor: "linear-gradient(135deg,#059669,#34d399)",
    desc: "Implementar controles na hierarquia: eliminação > substituição > controles de engenharia > controles administrativos > EPI. Documentar no PGR com prazos e responsáveis.",
    status: "andamento",
    prog: 45,
    progLabel: "Implementação",
    link: "https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/nr-1",
    tipoRegistrar: "Medida de Controle Implementada",
  },
  {
    id: "monitoramento",
    titulo: "Monitoramento e Revisão do PGR",
    sub: "Cap. 1.5 · Mínimo anual",
    icon: "🔄",
    cor: "linear-gradient(135deg,#0891b2,#67e8f9)",
    desc: "Revisar o PGR ao menos anualmente ou após mudanças no processo produtivo, acidentes ou alterações legais. Registrar datas e responsáveis de cada revisão.",
    status: "alerta",
    prog: 20,
    progLabel: "Monitoramento",
    link: "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/manuais-e-publicacoes/2026/perguntas-e-respostas-gro-pgr-maio-2026",
    tipoRegistrar: "Monitoramento / Revisão do PGR",
  },
];

export const NR1_CHECKLIST_GRUPOS = [
  {
    grupo: "📄 PGR — Estrutura Básica",
    itens: [
      { id: "c1", txt: "PGR elaborado e assinado", desc: "Documento formal com identificação da empresa, data e responsável técnico" },
      { id: "c2", txt: "Inventário de riscos atualizado", desc: "Todos os perigos mapeados por setor/posto de trabalho" },
      { id: "c3", txt: "Plano de ação com prazos", desc: "Medidas de controle com responsáveis e datas definidas" },
      { id: "c4", txt: "PGR disponível aos trabalhadores", desc: "Acesso garantido a todos os empregados" },
      { id: "c5", txt: "Guarda documental por 20 anos", desc: "Arquivo físico ou digital com controle de versões" },
    ],
  },
  {
    grupo: "🧠 Riscos Psicossociais",
    itens: [
      { id: "c6", txt: "Diagnóstico de fatores psicossociais realizado", desc: "Avaliação de estresse, assédio, burnout, sobrecarga, autonomia" },
      { id: "c7", txt: "Fatores incluídos no PGR", desc: "Riscos psicossociais documentados formalmente no PGR" },
      { id: "c8", txt: "Plano de ação psicossocial elaborado", desc: "Medidas preventivas específicas para riscos psicossociais" },
      { id: "c9", txt: "Canal de escuta / denúncias ativo", desc: "Lei 14.457/2022 — canal para relatos de assédio e sofrimento" },
      { id: "c10", txt: "CIPA envolvida no processo", desc: "CIPA informada e participante do GRO psicossocial" },
    ],
  },
  {
    grupo: "🎓 Treinamento e Capacitação",
    itens: [
      { id: "c11", txt: "Treinamentos de SST realizados", desc: "Documentados com listas de presença ou registros digitais" },
      { id: "c12", txt: "Conteúdo alinhado ao PGR", desc: "Treinamentos abordam os riscos identificados no PGR" },
      { id: "c13", txt: "Modalidade EaD registrada conforme Anexo II", desc: "Se EaD, atende aos requisitos mínimos do Anexo II da NR-1" },
      { id: "c14", txt: "Reciclagens programadas", desc: "Calendário de reciclagem definido para cada função" },
    ],
  },
  {
    grupo: "🔍 Identificação e Avaliação de Riscos",
    itens: [
      { id: "c15", txt: "Riscos físicos mapeados", desc: "Ruído, calor, radiações, vibração, pressão" },
      { id: "c16", txt: "Riscos químicos mapeados", desc: "Poeiras, fumos, névoas, gases, vapores, produtos químicos" },
      { id: "c17", txt: "Riscos biológicos mapeados", desc: "Vírus, bactérias, fungos, parasitas" },
      { id: "c18", txt: "Riscos ergonômicos mapeados", desc: "Postura, esforço repetitivo, levantamento de peso, jornada" },
      { id: "c19", txt: "Riscos de acidente mapeados", desc: "Máquinas, eletricidade, quedas, incêndio, explosão" },
      { id: "c20", txt: "Avaliação quantitativa realizada (quando exigida)", desc: "Dosimetria, laudos técnicos, medições ambientais" },
    ],
  },
  {
    grupo: "🛡️ Medidas de Controle",
    itens: [
      { id: "c21", txt: "Hierarquia de controles aplicada", desc: "Eliminação > Substituição > Eng. > Adm. > EPI" },
      { id: "c22", txt: "EPIs fornecidos e documentados", desc: "CA válido, entrega registrada, treinamento de uso" },
      { id: "c23", txt: "Medidas coletivas implementadas", desc: "Controles de engenharia e administrativos priorizados" },
      { id: "c24", txt: "Emergências previstas no PGR", desc: "Procedimentos de emergência documentados e treinados" },
    ],
  },
  {
    grupo: "🔄 Monitoramento e Conformidade",
    itens: [
      { id: "c25", txt: "Revisão anual do PGR programada", desc: "Data da próxima revisão definida formalmente" },
      { id: "c26", txt: "Investigação de acidentes/incidentes", desc: "Procedimento formalizado e registros disponíveis" },
      { id: "c27", txt: "Indicadores de SST monitorados", desc: "Absenteísmo, afastamentos, quase acidentes" },
      { id: "c28", txt: "Comunicação de acidentes (CAT) em dia", desc: "CAT emitida dentro do prazo legal" },
    ],
  },
];

export const NR1_FONTES = [
  {
    titulo: "NR-1 — Texto Atualizado 2025",
    desc: "Texto completo da NR-1 com todas as alterações incluindo a Portaria MTE 765/2025.",
    url: "https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/nr-01-atualizada-2025-i-1.pdf",
    tag: "Texto Legal",
    cor: "#0f766e",
  },
  {
    titulo: "Portaria MTE 1.419/2024 — GRO",
    desc: "Nova redação do capítulo 1.5 — Gerenciamento de Riscos Ocupacionais, incluindo riscos psicossociais.",
    url: "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/seguranca-e-saude-no-trabalho/sst-portarias/2024/portaria-mte-no-1-419-nr-01-gro-nova-redacao.pdf",
    tag: "Portaria",
    cor: "#14b8a6",
  },
  {
    titulo: "Manual GRO — MTE março/2026",
    desc: "Manual de Interpretação e Aplicação do Cap. 1.5 da NR-1 lançado pelo MTE em março de 2026.",
    url: "https://www.gov.br/trabalho-e-emprego/pt-br/noticias-e-conteudo/2026/marco/mte-lanca-manual-para-orientar-gestao-de-riscos-ocupacionais-nas-empresas",
    tag: "Manual Oficial",
    cor: "#7c3aed",
  },
  {
    titulo: "Perguntas e Respostas GRO/PGR — maio/2026",
    desc: "FAQ oficial do MTE sobre aplicação do cap. 1.5 da NR-1 e riscos psicossociais.",
    url: "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/manuais-e-publicacoes/2026/perguntas-e-respostas-gro-pgr-maio-2026",
    tag: "FAQ MTE",
    cor: "#2563eb",
  },
  {
    titulo: "Guia Riscos Psicossociais 2025 — MTE",
    desc: "Guia com conceitos, métodos de avaliação e exemplos de planos de ação para riscos psicossociais.",
    url: "https://www.gov.br/trabalho-e-emprego/pt-br/noticias-e-conteudo/2024/Novembro/empresas-brasileiras-terao-que-avaliar-riscos-psicossociais-a-partir-de-2025",
    tag: "Guia Técnico",
    cor: "#059669",
  },
  {
    titulo: "NR-1 — Página Oficial MTE",
    desc: "Portal oficial com histórico de atualizações, portarias, consultas públicas e materiais relacionados.",
    url: "https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/nr-1",
    tag: "Portal MTE",
    cor: "#0891b2",
  },
  {
    titulo: "CANPAT 2026 — Riscos Psicossociais",
    desc: "Campanha Nacional de Prevenção de Acidentes do Trabalho 2026 com foco em saúde mental e riscos psicossociais.",
    url: "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/prevencao-de-acidentes-de-trabalho/canpat",
    tag: "Campanha",
    cor: "#d97706",
  },
  {
    titulo: "Lei 14.831/2024 — Empresa Promotora Saúde Mental",
    desc: "Certificado de Empresa Promotora da Saúde Mental — diferencial competitivo e alinhamento à NR-1.",
    url: "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2024/lei/l14831.htm",
    tag: "Lei",
    cor: "#7c3aed",
  },
];

export const NR1_STATUS_BADGE = {
  critico: { className: "critico", label: "🔴 Crítico" },
  alerta: { className: "alerta", label: "🟡 Atenção" },
  andamento: { className: "andamento", label: "🔵 Em andamento" },
  ok: { className: "ok", label: "🟢 OK" },
};

export const NR1_REG_STATUS_BADGE = {
  Concluído: "ok",
  "Em Andamento": "andamento",
  Agendado: "alerta",
  Cancelado: "critico",
};

export function formatNr1DataBr(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** Valida registro com status Concluído (exige evidência documental). */
export function validateNr1RegistroConcluido(registro) {
  if (registro?.status !== "Concluído") return [];
  const anexos = Array.isArray(registro?.anexos) ? registro.anexos : [];
  const desc = String(registro?.desc || "").trim();
  if (!anexos.length && !desc) {
    return ['Status "Concluído" exige ao menos um anexo ou descrição da evidência.'];
  }
  return [];
}

export function computeNr1Stats(registros = []) {
  const rows = Array.isArray(registros) ? registros : [];
  return {
    total: rows.length,
    concluidas: rows.filter((r) => r.status === "Concluído").length,
    andamento: rows.filter((r) => r.status === "Em Andamento").length,
    agendadas: rows.filter((r) => r.status === "Agendado").length,
  };
}

export function countNr1ChecklistTotal() {
  return NR1_CHECKLIST_GRUPOS.reduce((sum, g) => sum + g.itens.length, 0);
}

export function computeNr1ChecklistPct(checkState = {}) {
  const total = countNr1ChecklistTotal();
  if (!total) return 0;
  const done = Object.values(checkState).filter(Boolean).length;
  return Math.round((done / total) * 100);
}

export function exportNr1RegistrosCsv(registros = []) {
  const h = ["ID", "Data", "Tipo", "Setor", "Responsável", "Participantes", "Status", "Risco", "Prazo Revisão", "Descrição"];
  const rows = (Array.isArray(registros) ? registros : []).map((r) => [
    r.id,
    r.data,
    r.tipo,
    r.setor || "",
    r.resp,
    r.part ?? "",
    r.status,
    r.risco || "",
    r.prazo || "",
    r.desc || "",
  ]);
  const csv = [h, ...rows].map((line) => line.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "nr1_acoes_conformidade.csv";
  a.click();
  URL.revokeObjectURL(url);
}
