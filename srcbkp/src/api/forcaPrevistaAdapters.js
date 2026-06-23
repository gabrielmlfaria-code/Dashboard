function readConfiguredPrevista(d) {
  const raw = d?.prevista ?? d?.forcaPrevista ?? d?.ForcaPrevista;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function readConfiguredMoney(d, ...keys) {
  for (const key of keys) {
    const raw = d?.[key];
    if (raw == null || raw === "") continue;
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function hasForcaPrevistaConfig(d) {
  const prevista = readConfiguredPrevista(d);
  const custoHora = readConfiguredMoney(d, "custoHora", "custo_hora_medio", "CustoHora");
  const custoHExtra = readConfiguredMoney(d, "custoHExtra", "custo_h_extra_medio", "CustoHExtra");
  return prevista != null || custoHora > 0 || custoHExtra > 0;
}

export function forcaPrevistaListToMap(list = []) {
  const map = {};
  const nomeToId = {};
  for (const d of list) {
    const id = d.id ?? d.idDepartamento;
    if (id == null) continue;
    if (d.nome) nomeToId[String(d.nome).trim()] = id;
    if (!hasForcaPrevistaConfig(d)) continue;
    map[id] = {
      idDepartamento: id,
      nome: d.nome || "",
      ativos: d.ativos ?? 0,
      prevista: readConfiguredPrevista(d) ?? 0,
      custoHora: readConfiguredMoney(d, "custoHora", "custo_hora_medio", "CustoHora"),
      custoHExtra: readConfiguredMoney(d, "custoHExtra", "custo_h_extra_medio", "CustoHExtra"),
    };
  }
  return { map, nomeToId };
}

export function resolveDepartamentoAtivos(dept) {
  return dept?.ativos ?? dept?.forcaAtual ?? 0;
}

export function resolveDepartamentoForcaPrevista(dept) {
  return readConfiguredPrevista(dept) ?? 0;
}

export function computeQuadroForcaAtualFromDepartamentos(departamentos = [], { deptoFilter, nomeToId } = {}) {
  if (!Array.isArray(departamentos) || !departamentos.length) return null;
  return departamentos
    .filter((d) => {
      if (!deptoFilter) return true;
      const id = d.id ?? d.idDepartamento;
      return (
        String(id) === String(deptoFilter) ||
        (nomeToId && String(nomeToId[d.nome]) === String(deptoFilter))
      );
    })
    .reduce((sum, d) => sum + resolveDepartamentoAtivos(d), 0);
}

export function computeQuadroForcaPrevistaFromDepartamentos(departamentos = [], { deptoFilter, nomeToId } = {}) {
  if (!Array.isArray(departamentos) || !departamentos.length) return null;
  return departamentos
    .filter((d) => {
      if (!deptoFilter) return true;
      const id = d.id ?? d.idDepartamento;
      return (
        String(id) === String(deptoFilter) ||
        (nomeToId && String(nomeToId[d.nome]) === String(deptoFilter))
      );
    })
    .reduce((sum, d) => sum + resolveDepartamentoForcaPrevista(d), 0);
}

export function computeQuadroForcaPrevista(deptStats = [], fpdMap = {}, { deptoFilter } = {}) {
  const stats = deptoFilter
    ? deptStats.filter(
        (s) => String(s.id ?? s.idDepartamento ?? s.depto) === String(deptoFilter),
      )
    : deptStats;
  return stats.reduce((sum, s) => {
    const id = s.id ?? s.idDepartamento;
    const entry = id != null ? fpdMap[id] : null;
    const prevista =
      entry && readConfiguredPrevista(entry) != null
        ? readConfiguredPrevista(entry)
        : readConfiguredPrevista(s) ?? s.atual ?? 0;
    return sum + prevista;
  }, 0);
}

export function buildDeptoOptionsFromForcaPrevista(list = []) {
  return list.map((d) => ({
    value: String(d.id ?? d.idDepartamento),
    label: d.nome || String(d.id),
  }));
}

export function forcaPrevistaMapToApiList(map = {}, idFilial) {
  return forcaPrevistaMapToPutPayload(idFilial, map);
}

export function forcaPrevistaMapToPutPayload(idFilial, map = {}) {
  const itens = [];
  for (const [key, v] of Object.entries(map || {})) {
    if (!v || typeof v !== "object") continue;
    const prevista = Number(v.prevista);
    if (!Number.isFinite(prevista) || prevista <= 0) continue;
    const idDepartamento = Number(v.idDepartamento ?? (/^\d+$/.test(String(key)) ? key : NaN));
    if (!Number.isFinite(idDepartamento)) continue;
    itens.push({
      idDepartamento,
      prevista,
      custoHora: Number(v.custoHora) || 0,
      custoHExtra: Number(v.custoHExtra) || 0,
    });
  }
  return { idFilial: idFilial ?? 0, itens };
}

/** Zera configuração FPD de um departamento na lista em cache (após exclusão). */
export function forcaPrevistaClearApiItem(list = [], idDepartamento) {
  const id = String(idDepartamento);
  return (Array.isArray(list) ? list : []).map((d) =>
    String(d.id ?? d.idDepartamento) === id
      ? { ...d, prevista: null, custoHora: null, custoHExtra: null }
      : d,
  );
}

/** Atualiza lista da query FPD no cache (otimista). */
export function forcaPrevistaPatchApiList(list = [], map = {}) {
  const byId = new Map(
    (Array.isArray(list) ? list : []).map((d) => [String(d.id ?? d.idDepartamento), { ...d }]),
  );
  for (const [key, entry] of Object.entries(map || {})) {
    const id = String(entry?.idDepartamento ?? key);
    const prevista = Number(entry?.prevista);
    if (!Number.isFinite(prevista) || prevista <= 0) {
      if (byId.has(id)) {
        const prev = byId.get(id);
        byId.set(id, { ...prev, prevista: null, custoHora: null, custoHExtra: null });
      }
      continue;
    }
    const prev = byId.get(id) || { id: Number(id), idDepartamento: Number(id) };
    byId.set(id, {
      ...prev,
      idDepartamento: Number(id),
      prevista,
      custoHora: entry.custoHora ?? prev.custoHora ?? 0,
      custoHExtra: entry.custoHExtra ?? prev.custoHExtra ?? 0,
      nome: entry.nome || prev.nome || "",
    });
  }
  return Array.from(byId.values());
}
