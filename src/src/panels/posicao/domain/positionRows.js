import {
  POSITION_CATEGORY_KEYS,
  getPositionCategoryHours,
  normalizePositionCategory,
} from "./positionCategories.js";

export function getPositionGroupItems(group) {
  if (!group) return [];
  if (Array.isArray(group)) return group;
  if (Array.isArray(group.colaboradores)) return group.colaboradores;
  if (Array.isArray(group.Colaboradores)) return group.Colaboradores;
  if (Array.isArray(group.rows)) return group.rows;
  if (Array.isArray(group.Rows)) return group.Rows;
  if (Array.isArray(group.items)) return group.items;
  if (Array.isArray(group.lista)) return group.lista;
  return [];
}

function firstText(source, keys, fallback = "") {
  for (const key of keys) {
    const value = source?.[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return fallback;
}

function normalizeGender(value) {
  const text = String(value || "").trim().toUpperCase();
  if (text === "MASCULINO") return "M";
  if (text === "FEMININO") return "F";
  if (text === "M" || text === "F") return text;
  return text;
}

export function resolveIdDepartamento(record) {
  return record?.idDepartamento ?? record?.deptoId ?? record?.id_departamento ?? null;
}

export function resolveDeptoNome(record) {
  return record?.depto_desc || record?.depto || record?.departamento || record?.nome || "";
}

export function deptoFilterKeyFromRow(record, { nomeToId = {} } = {}) {
  const id = resolveIdDepartamento(record);
  if (id) return String(id);
  const nome = resolveDeptoNome(record);
  const mappedId = nome ? nomeToId[nome] : null;
  if (mappedId != null) return String(mappedId);
  return nome || "";
}

export function matchesDeptoFilter(record, deptoFilter, { nomeToId = {} } = {}) {
  if (!deptoFilter) return true;
  const id = resolveIdDepartamento(record);
  if (id != null && String(id) === String(deptoFilter)) return true;
  // fallback por nome (legado/import)
  const nome = resolveDeptoNome(record);
  const mappedId = nome ? nomeToId[nome] : null;
  if (mappedId != null && String(mappedId) === String(deptoFilter)) return true;
  return false;
}

export function normalizePositionEmployee(raw, { category = "presentes", index = 0, date = "" } = {}) {
  const cat = normalizePositionCategory(raw?.cat || raw?.categoria || category, category);
  const hours = getPositionCategoryHours(cat);
  const mat = firstText(raw, ["matricula", "mat", "codigo", "cod"], `${cat}-${index}`);
  const nome = firstText(raw, ["nome", "colaborador", "name", "colaborador_nome"]);
  const depto = firstText(raw, [
    "depto_desc",
    "depto",
    "departamento",
    "departamentoNome",
    "departamento_nome",
  ]);
  const cargo = firstText(raw, ["cargo_desc", "cargo", "cargoDescricao", "cargo_descricao"]);
  const data = firstText(raw, ["data", "Data", "date", "Date", "data_referencia", "dataReferencia", "dt"], date);
  const inicio = firstText(raw, ["inicio", "Inicio", "dt_inicio", "data_inicio", "afastamento_inicio"]);
  const fim = firstText(raw, [
    "fim",
    "Fim",
    "termino",
    "Termino",
    "dt_termino",
    "data_fim",
    "afastamento_fim",
  ]);

  return {
    id: `${cat}-${mat || nome || index}-${data || ""}`,
    mat: String(mat),
    matricula: String(mat),
    nome,
    colaborador: nome,
    data,
    depto,
    departamento: depto,
    idDepartamento: raw?.idDepartamento ?? raw?.deptoId ?? null,
    filialId:
      raw?.filialId ?? raw?.filial_id ?? raw?.filial?.id ?? raw?.filial?.codigo ?? undefined,
    filial: firstText(raw, ["filial", "filialNome", "filial_nome"]),
    cargo,
    genero: normalizeGender(raw?.genero ?? raw?.sexo),
    cat,
    categoria: cat,
    eventoCodigo: firstText(raw, ["eventoCodigo", "evento_codigo", "_evt_cod", "codEvento", "cod"]),
    eventoDescricao: firstText(raw, [
      "eventoDescricao",
      "evento_descricao",
      "_evt_desc",
      "descEvento",
      "evento",
      "descricao",
    ]),
    inicio,
    fim,
    termino: fim,
    dias: raw?.dias ?? raw?.qtd_dias ?? raw?.qtdDias ?? "",
    horario: raw?.horario ?? raw?.horario_dia ?? "",
    marcacoes: Array.isArray(raw?.marcacoes) ? raw.marcacoes : raw?.marcacao || "",
    hrsPlan: Number(raw?.hrsPlan ?? raw?.hrs_planejadas ?? hours.hrsPlan ?? 0) || 0,
    hrsPres: Number(raw?.hrsPres ?? raw?.hrs_presentes ?? hours.hrsPres ?? 0) || 0,
    hrsAuse: Number(raw?.hrsAuse ?? raw?.hrs_ausentes ?? hours.hrsAuse ?? 0) || 0,
    hrsJust: Number(raw?.hrsJust ?? raw?.hrs_justificadas ?? hours.hrsJust ?? 0) || 0,
    hrsExtr: Number(raw?.hrsExtr ?? raw?.hrs_extras ?? hours.hrsExtr ?? 0) || 0,
    _raw: raw,
  };
}

export function normalizePositionEmployeesFromDay(day, filterFn = () => true) {
  if (!day || typeof day !== "object") return [];
  if (Array.isArray(day._employees) && day._employees.length > 0) {
    return day._employees
      .map((employee, index) =>
        normalizePositionEmployee(employee, {
          category: employee?.cat || employee?.categoria || "presentes",
          index,
          date: day.date || day.data_referencia || day.data || "",
        }),
      )
      .filter((employee) => filterFn(employee._raw || employee));
  }

  const rows = [];
  POSITION_CATEGORY_KEYS.forEach((category) => {
    getPositionGroupItems(day?.[category]).forEach((employee, index) => {
      if (!filterFn(employee)) return;
      rows.push(
        normalizePositionEmployee(employee, {
          category,
          index,
          date: day.date || day.data_referencia || day.data || "",
        }),
      );
    });
  });
  return rows;
}
