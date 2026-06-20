const DEPT_GROUPS_ORDER = ["Todos", "Operacoes", "Logistica", "Comercial", "Administrativo", "TI"];

function normDept(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Agrupa departamento em macroarea (modelo Colaboradores). */
export function inferDeptGroup(dept) {
  const t = normDept(dept);
  if (/\bti\b|tecnologia|informatica|sistemas|desenvolv|software/.test(t)) return "TI";
  if (/comercial|vendas|venda|marketing/.test(t)) return "Comercial";
  if (/logistica|expedi|transporte|motorista|frota|distribui/.test(t)) return "Logistica";
  if (/admin|administrat|\brh\b|financeiro|contabil|departamento pessoal|dp\b|gente/.test(t))
    return "Administrativo";
  return "Operacoes";
}

export function colabsInitials(nome) {
  const parts = String(nome ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  return (parts[0] || "?").slice(0, 2).toUpperCase();
}

export function colabsAvatarHue(seed) {
  const s = String(seed ?? "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return (s * 47) % 360;
}

export function availableDeptGroups(collaborators) {
  const found = new Set();
  for (const c of collaborators || []) {
    found.add(inferDeptGroup(c.dept));
  }
  return DEPT_GROUPS_ORDER.filter((g) => g === "Todos" || found.has(g));
}

export function filterCollaborators(collaborators, grupo) {
  const list = collaborators || [];
  if (!grupo || grupo === "Todos") return list;
  return list.filter((c) => inferDeptGroup(c.dept) === grupo);
}

/** Percentual visual do ranking baseado em volume factual de penalidades. */
export function colabRankPct(ocorrencias, maxOcorr = 1) {
  const o = Number(ocorrencias) || 0;
  return maxOcorr > 0 ? Math.max(4, Math.round((o / maxOcorr) * 100)) : 0;
}

export function enrichCollaboratorsDisplay(collaborators) {
  const list = [...(collaborators || [])];
  const maxO = Math.max(...list.map((c) => c.ocorrencias), 1);
  return list.map((c) => ({ ...c, rankPct: colabRankPct(c.ocorrencias, maxO) }));
}

export function occurrenceDistribution(collaborators) {
  const dist = { uma: 0, duasTres: 0, quatroMais: 0 };
  for (const c of collaborators || []) {
    const o = Number(c.ocorrencias) || 0;
    if (o >= 4) dist.quatroMais += 1;
    else if (o >= 2) dist.duasTres += 1;
    else if (o === 1) dist.uma += 1;
  }
  return dist;
}
