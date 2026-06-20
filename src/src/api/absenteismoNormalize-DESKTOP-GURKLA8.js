/** Normaliza DTO da API .NET para o modelo usado pelo HistoricoDayModal. */

export function normalizeEventoDto(dto) {
  if (!dto) return null;
  return {
    mat: dto.matricula ?? dto.mat ?? "",
    nome: dto.nome ?? "",
    filial: dto.filial ?? "",
    depto: dto.departamento ?? dto.depto ?? "",
    cargo: dto.cargo ?? "",
    genero: dto.genero ?? dto.sexo ?? "",
    data: String(dto.data ?? "").slice(0, 10),
    horario: dto.horario ?? "",
    marcacao: dto.marcacao ?? "",
    cod: dto.codigoEvento ?? dto.codigo ?? dto.cod ?? "",
    evento: dto.descricaoEvento ?? dto.evento ?? "",
    horas: dto.minutos ?? dto.horas ?? 0,
    _cat: dto.categoria ?? dto._cat ?? "ignorar",
  };
}

export function normalizeEventosPage(payload) {
  const items = (payload?.items ?? []).map(normalizeEventoDto).filter(Boolean);
  const totais = payload?.totais ?? {};
  return {
    items,
    total: Number(payload?.total) || items.length,
    page: Number(payload?.page) || 1,
    pageSize: Number(payload?.pageSize) || items.length,
    totais: {
      horas: totais.horasMinutos ?? totais.horas ?? 0,
      horasPlan: totais.horasPlanejadasMinutos ?? totais.horasPlanejadas ?? totais.horasPlan ?? 0,
      horasPres: totais.horasPresentesMinutos ?? totais.horasPresentes ?? totais.horasPres ?? 0,
      horasAuse: totais.horasAusentesMinutos ?? totais.horasAusentes ?? totais.horasAuse ?? 0,
    },
  };
}

export function normalizeGrupoDto(dto) {
  return {
    key: dto.key ?? dto.label ?? "—",
    label: dto.label ?? dto.key ?? "—",
    count: Number(dto.count) || 0,
    colaboradores: Number(dto.colaboradores) || 0,
    horas: Number(dto.horas) || 0,
    horasPlan: Number(dto.horasPlanejadasMinutos ?? dto.horasPlanejadas ?? dto.horasPlan) || 0,
  };
}

export function normalizeGrupos(payload) {
  return {
    groupBy: payload?.groupBy ?? "",
    items: (payload?.items ?? []).map(normalizeGrupoDto),
    total: Number(payload?.total) || (payload?.items?.length ?? 0),
  };
}

/** Mapeia colId do grid → parâmetro sort da API */
export function mapSortColToApi(col) {
  const m = {
    nome: "nome",
    mat: "matricula",
    filial: "filial",
    depto: "departamento",
    cargo: "cargo",
    genero: "genero",
    _cat: "categoria",
    data: "data",
    horario: "horario",
    marcacao: "marcacao",
    cod: "codigoEvento",
    evento: "descricaoEvento",
    horas: "minutos",
    hrsPlan: "horario",
  };
  return m[col] ?? col ?? "data";
}

/** Mapeia groupBy do grid → API */
export function mapGroupByToApi(col) {
  const m = {
    mat: "mat",
    filial: "filial",
    depto: "depto",
    cargo: "cargo",
    genero: "genero",
    _cat: "categoria",
    cod: "codigoEvento",
    evento: "descricaoEvento",
  };
  return m[col] ?? col;
}
