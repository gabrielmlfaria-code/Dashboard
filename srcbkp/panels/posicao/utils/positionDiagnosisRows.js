import { normalizePositionCategory } from "../domain/positionCategories.js";

export function buildEventKey(codigo, descricao) {
  const c = String(codigo ?? "").trim();
  const d = String(descricao ?? "").trim();
  if (c && d) return `${c} - ${d}`;
  return c || d;
}

export function inferPeriodoCategoryFromEventText(value) {
  const s = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (!s) return "";
  if (/\bferias\b|vacat/.test(s)) return "ferias";
  if (/afast|licenca|licenca medica|auxilio|inss|atestado|enfermidade|maternidade|acidente/.test(s))
    return "afastados";
  return "";
}

export function normalizeDiagPositionCategory(value) {
  const normalized = normalizePositionCategory(value, "");
  if (normalized === "falta") return "faltas";
  if (normalized === "atraso") return "atrasos";
  if (normalized === "ferias") return "ferias";
  if (normalized) return normalized;
  const inferred = inferPeriodoCategoryFromEventText(value);
  if (inferred === "ferias") return "ferias";
  return "";
}

export function compactDiagnosisRow(row = {}) {
  return {
    nome:
      row.nome ??
      row.colaborador ??
      row.colaboradorNome ??
      row.colaborador_nome ??
      row.name ??
      "",
    matricula: row.matricula ?? row.mat ?? row.codigo ?? row.cod ?? "",
    departamento:
      row.departamento ??
      row.depto ??
      row.departamentoNome ??
      row.departamento_nome ??
      row.department ??
      "",
    cargo: row.cargo ?? row.cargoNome ?? row.cargo_nome ?? "",
    inicio:
      row.inicio ??
      row.dataInicio ??
      row.data_inicio ??
      row.dtInicio ??
      row.feriasInicio ??
      row.afastamentoInicio ??
      "",
    termino:
      row.termino ??
      row.fim ??
      row.dataFim ??
      row.data_fim ??
      row.dtFim ??
      row.feriasFim ??
      row.afastamentoFim ??
      "",
    data: row.data ?? row.date ?? row.dia ?? "",
    categoria: row.categoria ?? row.cat ?? row.category ?? row.tipo ?? row.status ?? "",
    evento: row.evento ?? row.eventoDescricao ?? row.evento_descricao ?? row.descricao ?? "",
  };
}

export function collectDiagnosisCategoryRows(source, category) {
  if (!source) return [];
  const categoryKeys =
    category === "faltas"
      ? ["faltasGrupo", "faltasRows", "faltas", "falta"]
      : category === "atrasos"
        ? ["atrasosGrupo", "atrasosRows", "atrasos", "atraso"]
        : category === "ferias"
          ? ["férias", "feriasRows", "ferias"]
          : [category];
  const directBuckets = categoryKeys.flatMap((key) => [
    source?.[key],
    source?.byCat?.[key],
    source?.categorias?.[key],
    source?.categories?.[key],
  ]);
  const directRows = directBuckets.flatMap((bucket) => {
    if (Array.isArray(bucket)) return bucket;
    if (!bucket || typeof bucket !== "object") return [];
    return [
      ...(Array.isArray(bucket.rows) ? bucket.rows : []),
      ...(Array.isArray(bucket.colaboradores) ? bucket.colaboradores : []),
      ...(Array.isArray(bucket.eventos) ? bucket.eventos : []),
      ...(Array.isArray(bucket.events) ? bucket.events : []),
      ...(Array.isArray(bucket.employees) ? bucket.employees : []),
      ...(Array.isArray(bucket._employees) ? bucket._employees : []),
    ];
  });

  const broadRows = [
    ...(Array.isArray(source.rows) ? source.rows : []),
    ...(Array.isArray(source.eventos) ? source.eventos : []),
    ...(Array.isArray(source.events) ? source.events : []),
    ...(Array.isArray(source.items) ? source.items : []),
  ].filter((row) => {
    const rowCategory = normalizeDiagPositionCategory(
      row?.categoria ?? row?.cat ?? row?.category ?? row?.tipo ?? row?.status ?? row?.posListKey,
    );
    if (rowCategory === category) return true;
    const textCategory = normalizeDiagPositionCategory(
      `${row?.evento ?? ""} ${row?.eventoDescricao ?? ""} ${row?.descricao ?? ""} ${row?.situacao ?? ""}`,
    );
    return textCategory === category;
  });

  const seen = new Set();
  return [...directRows, ...broadRows]
    .map(compactDiagnosisRow)
    .filter((row) => {
      const key = `${row.matricula}|${row.nome}|${row.departamento}|${row.data}|${row.inicio}|${row.termino}|${row.evento}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return row.nome || row.matricula || row.departamento || row.inicio || row.termino;
    });
}
