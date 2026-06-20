export function forcaPrevistaListToMap(list = []) {
  const map = {};
  const nomeToId = {};
  for (const d of list) {
    const id = d.id ?? d.idDepartamento;
    if (id == null) continue;
    map[id] = {
      idDepartamento: id,
      nome: d.nome || "",
      ativos: d.ativos ?? 0,
      prevista: d.prevista ?? d.ativos ?? 0,
      custoHora: d.custoHora ?? 0,
      custoHExtra: d.custoHExtra ?? 0,
    };
    if (d.nome) nomeToId[String(d.nome).trim()] = id;
  }
  return { map, nomeToId };
}

export function resolveDepartamentoAtivos(dept) {
  return dept?.ativos ?? dept?.forcaAtual ?? 0;
}

export function resolveDepartamentoForcaPrevista(dept) {
  return dept?.forcaPrevista ?? dept?.prevista ?? resolveDepartamentoAtivos(dept);
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
    const prevista = entry?.prevista > 0 ? entry.prevista : s.forcaPrevista ?? s.atual ?? 0;
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
  return {
    idFilial,
    itens: Object.values(map).map((v) => ({
      idDepartamento: v.idDepartamento,
      prevista: v.prevista,
      custoHora: v.custoHora ?? 0,
      custoHExtra: v.custoHExtra ?? 0,
    })),
  };
}
