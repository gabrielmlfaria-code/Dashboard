export function fmtDate(v) {
  if (!v) return "";
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) return s.slice(0, 10);
  try {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yy = String(d.getFullYear());
      return `${dd}/${mm}/${yy}`;
    }
  } catch {
    // Keep original value when browser date parsing rejects it.
  }
  return s;
}

export function getInicioTermino(r) {
  const ini =
    r?.inicio ??
    r?.Inicio ??
    r?.dt_inicio ??
    r?.data_inicio ??
    r?.inicio_data ??
    r?.ini;
  const fim =
    r?.termino ??
    r?.Termino ??
    r?.dt_termino ??
    r?.data_termino ??
    r?.termino_data ??
    r?.fim ??
    r?.Fim;
  return { ini: fmtDate(ini), fim: fmtDate(fim), iniRaw: ini, fimRaw: fim };
}

export function parseDateAny(v) {
  if (!v) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getQtdDias(r) {
  const { iniRaw, fimRaw } = getInicioTermino(r);
  const di = parseDateAny(iniRaw);
  if (!di) return "";
  const df = parseDateAny(fimRaw) || new Date();
  const a = new Date(di.getFullYear(), di.getMonth(), di.getDate());
  const b = new Date(df.getFullYear(), df.getMonth(), df.getDate());
  const diff = Math.floor((b - a) / 86400000) + 1;
  return diff < 0 ? 0 : diff;
}

export function getGridCellText(r, key) {
  if (key === "departamento") return r?.depto_desc || r?.depto || "";
  if (key === "cargo") return r?.cargo_desc || r?.cargo || "";
  if (key === "gestor") return r?.gestor || "";
  if (key === "inicio") return getInicioTermino(r).ini;
  if (key === "termino") return getInicioTermino(r).fim;
  if (key === "qtd_dias") {
    const direct = r?.qtd_dias ?? r?.qtdDias ?? r?.QtdDias;
    if (direct != null && String(direct).trim() !== "") return String(direct).trim();
    const v = getQtdDias(r);
    return v === "" ? "" : String(v);
  }
  if (key === "justificativa")
    return r?.justificativa ?? r?.motivo ?? r?.observacao ?? r?.obs ?? "";
  if (key === "marcacoes") return (r?.marcacoes || []).map((m) => m?.time || "").join(" | ");
  return r?.[key] ?? "";
}

export function normalizeGridRow(row) {
  const r = row || {};
  return {
    ...r,
    filial: r.filial || "",
    matricula: r.matricula != null ? String(r.matricula) : "",
    nome: r.nome || "",
    departamento: getGridCellText(r, "departamento"),
    cargo: getGridCellText(r, "cargo"),
    gestor: getGridCellText(r, "gestor"),
    inicio: getGridCellText(r, "inicio"),
    termino: getGridCellText(r, "termino"),
    qtd_dias: getGridCellText(r, "qtd_dias"),
    justificativa: getGridCellText(r, "justificativa"),
    marcacoes_text: getGridCellText(r, "marcacoes"),
    _search:
      `${r.filial || ""} ${r.matricula || ""} ${r.nome || ""} ${getGridCellText(r, "departamento")} ${getGridCellText(r, "cargo")} ${r.gestor || ""}`.toLowerCase(),
  };
}

export function getCategoryClass(category) {
  const key = String(category || "");
  if (key === "presentes") return "cat-presentes";
  if (key === "falta") return "cat-falta";
  if (key === "atraso") return "cat-atraso";
  if (key === "folga") return "cat-folga";
  if (key === "ferias") return "cat-ferias";
  if (key === "afastados") return "cat-afastados";
  return "";
}
