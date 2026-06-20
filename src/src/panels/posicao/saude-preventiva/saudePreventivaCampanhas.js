export const SAUDE_PREVENTIVA_LS_KEY = "campanhas_registros";

/** Pilares do art. 169-A da CLT (Lei 15.377/2026). */
export const SAUDE_CHECKLIST_ITEMS = [
  {
    id: "divulgar_oficial",
    label: "Divulgar informações oficiais (Ministério da Saúde)",
  },
  {
    id: "conscientizar",
    label: "Promover conscientização sobre a doença/campanha",
  },
  {
    id: "orientar_diagnostico",
    label: "Orientar acesso aos serviços de diagnóstico",
  },
  {
    id: "informar_ausencia",
    label: "Informar direito de ausência remunerada (art. 473, XII, CLT)",
  },
];

export const SAUDE_ART_473_TEXTO = `DIREITO DE AUSÊNCIA REMUNERADA (art. 473, XII, CLT — Lei 13.767/2018, reforçado pela Lei 15.377/2026):

Você pode deixar de comparecer ao serviço, sem prejuízo do salário, por até 3 (três) dias a cada 12 (doze) meses de trabalho para realizar exames preventivos de HPV e de câncer (mama, colo do útero, próstata e correlatos), mediante comprovação da realização do exame.

O empregador informa expressamente este direito nos termos do art. 473, § 3º, da CLT.`;

export const SAUDE_DISCLAIMER =
  "Ferramenta de apoio à conformidade com a Lei 15.377/2026. Não substitui comunicação efetiva aos colaboradores nem parecer jurídico.";

export const SAUDE_CAMPANHAS = [
  {
    id: 1,
    titulo: "Campanha HPV 2026",
    mes: "Maio / 2026",
    icon: "💉",
    cor: "linear-gradient(135deg,#1a56db,#3b82f6)",
    desc: "Divulgar a campanha oficial de vacinação contra o HPV (Ministério da Saúde), promover conscientização, orientar diagnóstico/vacinação no SUS e informar o direito de ausência para exames preventivos de HPV.",
    link: "https://www.gov.br/saude/pt-br/campanhas-da-saude/2026/hpv/acesse-as-pecas",
    modeloIntro:
      "Comunicamos a campanha oficial de vacinação contra o HPV, conforme orientações do Ministério da Saúde, com material institucional para divulgação interna.",
    orientacaoDiagnostico:
      "A vacinação e o acompanhamento preventivo do HPV estão disponíveis na rede pública de saúde (SUS) e em unidades credenciadas. Consulte a unidade básica de saúde mais próxima ou o posto de vacinação indicado pela Secretaria Municipal de Saúde.",
  },
  {
    id: 2,
    titulo: "Outubro Rosa",
    mes: "Outubro / 2026",
    icon: "🎀",
    cor: "linear-gradient(135deg,#db2777,#f472b6)",
    desc: "Conscientização sobre câncer de mama, divulgação de conteúdo oficial (INCA/MS), orientação para mamografia preventiva no SUS e informação sobre ausência remunerada para exames.",
    link: "https://www.inca.gov.br/controle-do-cancer-de-mama",
    modeloIntro:
      "Campanha Outubro Rosa: conscientização sobre prevenção do câncer de mama, com informações oficiais do INCA e do Ministério da Saúde.",
    orientacaoDiagnostico:
      "A mamografia de rastreamento e demais exames preventivos podem ser realizados pelo SUS. Procure a unidade básica de saúde, o Centro de Referência ou agende pelo canal oficial do município.",
  },
  {
    id: 3,
    titulo: "Novembro Azul",
    mes: "Novembro / 2026",
    icon: "🔵",
    cor: "linear-gradient(135deg,#1e40af,#60a5fa)",
    desc: "Conscientização sobre câncer de próstata, materiais oficiais (INCA), orientação para exames preventivos e informação sobre ausência remunerada.",
    link: "https://www.inca.gov.br/controle-do-cancer-de-prostata",
    modeloIntro:
      "Campanha Novembro Azul: prevenção do câncer de próstata com base em orientações oficiais do INCA e do Ministério da Saúde.",
    orientacaoDiagnostico:
      "Homens a partir da idade recomendada pelas diretrizes de saúde devem procurar atendimento na rede pública (SUS) ou convênio para exames preventivos. A unidade básica de saúde orienta o encaminhamento.",
  },
  {
    id: 4,
    titulo: "Câncer de Colo do Útero",
    mes: "Janeiro / 2026",
    icon: "🩺",
    cor: "linear-gradient(135deg,#0e9f6e,#34d399)",
    desc: "Orientação sobre exame preventivo (Papanicolau), acesso ao SUS, conscientização e direito de ausência remunerada para exames preventivos.",
    link: "https://www.inca.gov.br/controle-do-cancer-do-colo-do-utero",
    modeloIntro:
      "Prevenção do câncer de colo do útero: divulgação de orientações oficiais sobre exame preventivo (Papanicolau) e cuidados com a saúde da mulher.",
    orientacaoDiagnostico:
      "O exame citopatológico (Papanicolau) está disponível gratuitamente no SUS. Agende na unidade básica de saúde, Centro de Referência ou programa de saúde da mulher do município.",
  },
  {
    id: 5,
    titulo: "Calendário Nacional de Vacinação",
    mes: "Contínuo / 2026",
    icon: "📅",
    cor: "linear-gradient(135deg,#7e3af2,#a78bfa)",
    desc: "Divulgação do Calendário Nacional de Vacinação 2026 (MS), conscientização sobre imunizações por faixa etária, orientação de acesso e direito de ausência para exames preventivos de HPV/câncer quando aplicável.",
    link: "https://www.gov.br/saude/pt-br/vacinacao/publicacoes/instrucao-normativa-que-instrui-o-calendario-nacional-de-vacinacao-2026.pdf/view",
    modeloIntro:
      "Divulgação do Calendário Nacional de Vacinação 2026, conforme Instrução Normativa do Ministério da Saúde, com esquemas vacinais por faixa etária.",
    orientacaoDiagnostico:
      "Vacinas do calendário oficial estão disponíveis nas unidades de saúde da rede pública. Para HPV e demais imunizações, consulte o posto de vacinação indicado pela Secretaria de Saúde local.",
  },
  {
    id: 6,
    titulo: "SIPAT — Saúde Preventiva",
    mes: "Conforme PCMSO",
    icon: "🏥",
    cor: "linear-gradient(135deg,#ff5a1f,#fbbf24)",
    desc: "Integrar à SIPAT as obrigações da Lei 15.377/2026: vacinação, HPV, cânceres previstos, orientação diagnóstica e direito de ausência (art. 473, XII). Registrar ata com participantes.",
    link: "https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/h/hpv",
    modeloIntro:
      "Na SIPAT, abordamos as obrigações de saúde preventiva da Lei 15.377/2026 (art. 169-A, CLT): vacinação, HPV, câncer de mama, colo do útero e próstata.",
    orientacaoDiagnostico:
      "Orientamos colaboradores sobre acesso a vacinas e exames preventivos na rede pública (SUS) e canais oficiais de saúde, conforme material do Ministério da Saúde e INCA.",
  },
];

export const SAUDE_FONTES = [
  {
    titulo: "HPV — Ministério da Saúde",
    desc: "Informações oficiais sobre o HPV: sintomas, prevenção, vacinação e diagnóstico.",
    url: "https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/h/hpv",
    cor: "#1a56db",
  },
  {
    titulo: "Peças da Campanha HPV 2026",
    desc: "Cartazes, vídeos e spots de áudio prontos para download e uso nas empresas.",
    url: "https://www.gov.br/saude/pt-br/campanhas-da-saude/2026/hpv/acesse-as-pecas",
    cor: "#3b82f6",
  },
  {
    titulo: "Calendário Nacional de Vacinação 2026",
    desc: "Instrução Normativa com todos os esquemas vacinais por faixa etária.",
    url: "https://www.gov.br/saude/pt-br/vacinacao/publicacoes/instrucao-normativa-que-instrui-o-calendario-nacional-de-vacinacao-2026.pdf/view",
    cor: "#7e3af2",
  },
  {
    titulo: "INCA — Câncer de Mama",
    desc: "Instituto Nacional de Câncer: informações, rastreamento e prevenção.",
    url: "https://www.inca.gov.br/controle-do-cancer-de-mama",
    cor: "#db2777",
  },
  {
    titulo: "INCA — Câncer de Próstata",
    desc: "Informações sobre prevenção, diagnóstico e tratamento do câncer de próstata.",
    url: "https://www.inca.gov.br/controle-do-cancer-de-prostata",
    cor: "#1e40af",
  },
  {
    titulo: "INCA — Câncer do Colo do Útero",
    desc: "Orientações sobre o Papanicolau e acesso ao diagnóstico pelo SUS.",
    url: "https://www.inca.gov.br/controle-do-cancer-do-colo-do-utero",
    cor: "#0e9f6e",
  },
  {
    titulo: "Painel de Cobertura Vacinal HPV",
    desc: "Dados em tempo real de cobertura vacinal contra HPV no Brasil por município.",
    url: "https://infoms.saude.gov.br/extensions/SEIDIGI_DEMAS_VACINACAO_HPV/SEIDIGI_DEMAS_VACINACAO_HPV.html",
    cor: "#ff5a1f",
  },
  {
    titulo: "Lei nº 15.377/2026 — DOU",
    desc: "Texto integral da lei publicado no Diário Oficial da União.",
    url: "https://www.in.gov.br/en/web/dou/-/lei-n-15.377-de-2-de-abril-de-2026-697377506",
    cor: "#374151",
  },
];

export const SAUDE_LEI_URL =
  "https://www.in.gov.br/en/web/dou/-/lei-n-15.377-de-2-de-abril-de-2026-697377506";

export const SAUDE_TEMA_OPTIONS = [
  "Campanha HPV 2026",
  "Outubro Rosa",
  "Novembro Azul",
  "Câncer de Colo do Útero",
  "Calendário Nacional de Vacinação",
  "SIPAT — Saúde Preventiva",
  "Outro",
];

export const SAUDE_CANAL_OPTIONS = [
  "E-mail corporativo",
  "App / Portal do colaborador",
  "Mural físico",
  "Reunião / SIPAT",
  "WhatsApp corporativo",
  "Intranet",
];

export const SAUDE_STATUS_OPTIONS = ["Realizado", "Agendado", "Pendente"];

export const SAUDE_PUBLICO_OPTIONS = [
  { id: "todos", label: "Todos os colaboradores" },
  { id: "departamentos", label: "Departamentos específicos" },
  { id: "lista", label: "Lista nominal de colaboradores" },
];

export function emptySaudeChecklist() {
  return Object.fromEntries(SAUDE_CHECKLIST_ITEMS.map((item) => [item.id, false]));
}

export function normalizeSaudeChecklist(value) {
  const base = emptySaudeChecklist();
  if (!value || typeof value !== "object") return base;
  for (const item of SAUDE_CHECKLIST_ITEMS) {
    base[item.id] = Boolean(value[item.id]);
  }
  return base;
}

export function countSaudeChecklistDone(checklist) {
  const normalized = normalizeSaudeChecklist(checklist);
  return SAUDE_CHECKLIST_ITEMS.filter((item) => normalized[item.id]).length;
}

export function findCampanhaByTitulo(titulo) {
  return SAUDE_CAMPANHAS.find((c) => c.titulo === titulo) || null;
}

export function buildModeloComunicacao(titulo) {
  const campanha = findCampanhaByTitulo(titulo);
  if (!campanha) {
    return `${SAUDE_ART_473_TEXTO}\n\n[Especifique o tema e a evidência da comunicação.]`;
  }
  return [
    `COMUNICAÇÃO INTERNA — ${campanha.titulo}`,
    `Base legal: Lei nº 15.377/2026 (art. 169-A, CLT).`,
    "",
    campanha.modeloIntro,
    "",
    "ORIENTAÇÃO PARA DIAGNÓSTICO E PREVENÇÃO:",
    campanha.orientacaoDiagnostico,
    "",
    SAUDE_ART_473_TEXTO,
    "",
    "EVIDÊNCIA: [descreva canal, data, anexo ou link — e-mail enviado, mural, ata SIPAT, etc.]",
  ].join("\n");
}

export function mergeCampanhaChecklist(acc, checklist) {
  const next = { ...acc };
  const normalized = normalizeSaudeChecklist(checklist);
  for (const item of SAUDE_CHECKLIST_ITEMS) {
    next[item.id] = Boolean(acc[item.id] || normalized[item.id]);
  }
  return next;
}

/** Consolida checklist e progresso a partir dos registros realizados por tema. */
export function computeCampanhaCompliance(titulo, registros = []) {
  const temaRegs = (Array.isArray(registros) ? registros : []).filter((r) => r.tema === titulo);
  const realizados = temaRegs.filter((r) => r.status === "Realizado");
  let checklist = emptySaudeChecklist();
  for (const reg of realizados) {
    checklist = mergeCampanhaChecklist(checklist, reg.checklist);
  }
  const done = countSaudeChecklistDone(checklist);
  const progresso = Math.round((done / SAUDE_CHECKLIST_ITEMS.length) * 100);
  let status = "pendente";
  if (progresso >= 100) status = "realizado";
  else if (progresso > 0 || temaRegs.some((r) => r.status === "Agendado")) status = "agendado";
  return { checklist, progresso, status, realizados: realizados.length };
}

export function getCampanhasComCompliance(registros = []) {
  return SAUDE_CAMPANHAS.map((campanha) => {
    const compliance = computeCampanhaCompliance(campanha.titulo, registros);
    return { ...campanha, ...compliance };
  });
}

export function parseSaudeListaNominal(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function formatSaudeListaLinha(nome, matricula) {
  const n = String(nome || "").trim();
  const m = String(matricula || "").trim();
  if (n && m) return `${n} — ${m}`;
  return n || m;
}

function histColabMatricula(source) {
  return String(
    source?.mat ||
      source?.matricula ||
      source?.colaboradorMatricula ||
      source?.["colaborador.matricula"] ||
      "",
  ).trim();
}

function histColabNome(source) {
  return String(
    source?.nome || source?.colaborador || source?.colaboradorNome || source?.["colaborador.nome"] || "",
  ).trim();
}

function histColabDepto(source, row) {
  return String(
    source?.departamento ||
      source?.depto ||
      source?.depto_desc ||
      row?.departamento ||
      row?.depto ||
      row?.depto_desc ||
      "",
  ).trim();
}

/** Índice único de colaboradores a partir do histórico importado. */
export function buildHistColaboradoresList(rows = []) {
  const map = new Map();
  const add = (source, row = null) => {
    const matricula = histColabMatricula(source);
    const nome = histColabNome(source);
    if (!nome && !matricula) return;
    const id = matricula ? `m:${matricula}` : `n:${nome.toLowerCase()}`;
    if (!map.has(id)) {
      map.set(id, {
        id,
        nome: nome || matricula,
        matricula,
        departamento: histColabDepto(source, row),
      });
    }
  };
  for (const row of Array.isArray(rows) ? rows : []) {
    for (const emp of row?._employees || []) add(emp, row);
    for (const ev of row?._events || []) add(ev, row);
  }
  return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function isLineInListaNominal(line, colab) {
  const norm = String(line || "").trim().toLowerCase();
  if (!norm || !colab) return false;
  const key = formatSaudeListaLinha(colab.nome, colab.matricula).toLowerCase();
  if (norm === key) return true;
  if (colab.matricula && norm.includes(colab.matricula.toLowerCase())) return true;
  if (colab.nome && norm.startsWith(colab.nome.toLowerCase())) return true;
  return false;
}

export function buildListaNominalFromColabs(colaboradores = [], selectedIds = new Set()) {
  return colaboradores
    .filter((c) => selectedIds.has(c.id))
    .map((c) => formatSaudeListaLinha(c.nome, c.matricula))
    .join("\n");
}

export function parseSaudeDepartamentos(text) {
  return String(text || "")
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function histRowDepartamento(row) {
  return String(
    row?.departamento ||
      row?.depto ||
      row?.depto_desc ||
      row?.departamentoNome ||
      row?.["departamento.nome"] ||
      "",
  ).trim();
}

/** Departamentos únicos do histórico importado. */
export function buildHistDepartamentosList(rows = []) {
  const map = new Map();
  const add = (nome) => {
    const label = String(nome || "").trim();
    if (!label) return;
    const id = label.toLowerCase();
    if (!map.has(id)) map.set(id, { id, nome: label });
  };
  for (const row of Array.isArray(rows) ? rows : []) {
    add(histRowDepartamento(row));
    for (const emp of row?._employees || []) add(histColabDepto(emp, row));
    for (const ev of row?._events || []) add(histColabDepto(ev, row));
  }
  return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function isDeptInSelection(nome, selected = []) {
  const norm = String(nome || "").trim().toLowerCase();
  return (Array.isArray(selected) ? selected : []).some((s) => String(s).trim().toLowerCase() === norm);
}

export function buildDepartamentosFromSelection(departamentos = [], selectedIds = new Set()) {
  return departamentos
    .filter((d) => selectedIds.has(d.id))
    .map((d) => d.nome)
    .join(", ");
}

export function resolveEmpresaLabel(rows = [], filialFilter = "") {
  const filter = String(filialFilter || "").trim();
  if (filter) return filter;
  const filiais = new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    const f = String(row?.filial || row?.empresa || "").trim();
    if (f) filiais.add(f);
  }
  if (filiais.size === 1) return [...filiais][0];
  if (filiais.size > 1) return "Várias filiais";
  return "Empresa";
}

export function normalizeSaudeRegistro(registro) {
  const base = registro && typeof registro === "object" ? registro : {};
  return {
    ...base,
    checklist: normalizeSaudeChecklist(base.checklist),
    publicoAlcance: base.publicoAlcance || "",
    departamentos: String(base.departamentos || "").trim(),
    listaNominal: String(base.listaNominal || "").trim(),
    art473Comunicado: Boolean(base.art473Comunicado),
    anexos: Array.isArray(base.anexos)
      ? base.anexos.map((a) => ({
          id: a.id,
          nome: String(a.nome || "anexo"),
          tipo: String(a.tipo || ""),
          tamanho: Number(a.tamanho) || 0,
        }))
      : [],
  };
}

export function countSaudeAlcance(registro) {
  const norm = normalizeSaudeRegistro(registro);
  if (norm.publicoAlcance === "lista") return parseSaudeListaNominal(norm.listaNominal).length;
  if (norm.colaboradores != null && norm.colaboradores !== "") return Number(norm.colaboradores) || 0;
  return 0;
}

export function labelSaudePublicoAlcance(registro) {
  const norm = normalizeSaudeRegistro(registro);
  if (norm.publicoAlcance === "todos") {
    const n = countSaudeAlcance(norm);
    return n > 0 ? `Todos (${n} colab.)` : "Todos os colaboradores";
  }
  if (norm.publicoAlcance === "departamentos") {
    const n = parseSaudeDepartamentos(norm.departamentos).length;
    return n ? `Deptos (${n}): ${norm.departamentos}` : "Departamentos";
  }
  if (norm.publicoAlcance === "lista") {
    const n = parseSaudeListaNominal(norm.listaNominal).length;
    return n ? `Lista nominal (${n})` : "Lista nominal";
  }
  return "—";
}

export function validateSaudeRegistroRealizado(registro) {
  const norm = normalizeSaudeRegistro(registro);
  const erros = [];
  const pendentes = SAUDE_CHECKLIST_ITEMS.filter((item) => !norm.checklist[item.id]);
  if (pendentes.length) {
    erros.push(`Marque todos os itens do checklist legal (faltam ${pendentes.length}).`);
  }
  if (!norm.art473Comunicado) {
    erros.push("Confirme a comunicação do direito de ausência (art. 473, § 3º, CLT).");
  }
  if (!norm.publicoAlcance) {
    erros.push("Informe o público-alvo da comunicação.");
  } else if (norm.publicoAlcance === "departamentos" && !parseSaudeDepartamentos(norm.departamentos).length) {
    erros.push("Informe os departamentos atingidos.");
  } else if (norm.publicoAlcance === "lista" && !parseSaudeListaNominal(norm.listaNominal).length) {
    erros.push("Informe ao menos um colaborador na lista nominal.");
  } else if (norm.publicoAlcance === "todos" && !(Number(norm.colaboradores) > 0)) {
    erros.push("Informe o número de colaboradores atingidos.");
  }
  if (!norm.anexos.length && !String(norm.obs || "").trim()) {
    erros.push("Anexe ao menos uma evidência ou descreva a evidência no texto.");
  }
  return erros;
}

export function formatSaudeDataBr(iso) {
  if (!iso) return "—";
  const [y, m, dia] = String(iso).split("-");
  if (!y || !m || !dia) return "—";
  return `${dia}/${m}/${y}`;
}

export function computeSaudeRegistroStats(registros = []) {
  const list = Array.isArray(registros) ? registros : [];
  return {
    total: list.length,
    realizadas: list.filter((r) => r.status === "Realizado").length,
    pendentes: list.filter((r) => r.status === "Pendente").length,
    agendadas: list.filter((r) => r.status === "Agendado").length,
  };
}

export function statusClassFromLabel(status) {
  const key = String(status || "").toLowerCase();
  if (key === "realizado") return "realizado";
  if (key === "agendado") return "agendado";
  return "pendente";
}

export function exportSaudeRegistrosCsv(registros = []) {
  const header = [
    "ID",
    "Data",
    "Tema",
    "Canal",
    "Responsável",
    "Público-alvo",
    "Colaboradores",
    "Art. 473 comunicado",
    "Anexos",
    "Status",
    ...SAUDE_CHECKLIST_ITEMS.map((i) => i.label),
    "Observações",
  ];
  const rows = registros.map((r) => {
    const norm = normalizeSaudeRegistro(r);
    const checklist = norm.checklist;
    return [
      norm.id,
      norm.data,
      norm.tema,
      norm.canal,
      norm.responsavel,
      labelSaudePublicoAlcance(norm),
      norm.colaboradores || countSaudeAlcance(norm) || "",
      norm.art473Comunicado ? "Sim" : "Não",
      norm.anexos.length,
      norm.status,
      ...SAUDE_CHECKLIST_ITEMS.map((i) => (checklist[i.id] ? "Sim" : "Não")),
      norm.obs || "",
    ];
  });
  const csv = [header, ...rows].map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "campanhas_saude_lei15377.csv";
  a.click();
  URL.revokeObjectURL(url);
}
