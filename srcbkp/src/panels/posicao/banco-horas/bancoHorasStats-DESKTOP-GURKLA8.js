import { parseBancoHorasMin } from "./bancoHoras.js";

export { parseBancoHorasMin };

const eventConfigKey = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const getEventConfigForBancoHoras = (ev, configByName) => {
  if (!configByName || typeof configByName.get !== "function") return null;
  const keys = [ev?.evento, ev?.desc, ev?.descricao, ev?.cod, ev?.codigo]
    .map(eventConfigKey)
    .filter(Boolean);
  for (const key of keys) {
    const cfg = configByName.get(key);
    if (cfg) return cfg;
  }
  return null;
};

const isBancoHorasEvent = (ev, configByName = null) => {
  const cfg = getEventConfigForBancoHoras(ev, configByName);
  if (cfg?.creditoBH || cfg?.debitoBH) return true;
  const text = [ev?.evento, ev?.desc, ev?.descricao, ev?.cod, ev?.codigo]
    .map((v) => String(v || ""))
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return /\bbanco\b/.test(text) && /\bhoras?\b/.test(text);
};

const bancoHorasSign = (ev, configByName = null) => {
  const cfg = getEventConfigForBancoHoras(ev, configByName);
  if (cfg?.debitoBH) return -1;
  if (cfg?.creditoBH) return 1;
  const text = [ev?.evento, ev?.desc, ev?.descricao, ev?.cod, ev?.codigo]
    .map((v) => String(v || ""))
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/deb|descont|compens|saida|negat|utiliz/.test(text)) return -1;
  return 1;
};

const normBancoHorasKey = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const pickBancoHorasMin = (obj, keys) => {
  if (!obj || typeof obj !== "object") return null;
  const wanted = new Set(keys.map(normBancoHorasKey));
  for (const [key, value] of Object.entries(obj)) {
    if (!wanted.has(normBancoHorasKey(key))) continue;
    const parsed = parseBancoHorasMin(value);
    if (parsed != null) return parsed;
  }
  return null;
};

const bancoHorasGroupLabel = (...items) => {
  for (const row of items) {
    const direct =
      row?.departamento ||
      row?.depto ||
      row?.depto_desc ||
      row?.setor ||
      row?.departamentoNome ||
      row?.["departamento.nome"] ||
      row?.departamento_nome;
    const value = String(direct || "").trim();
    if (value) return value;
  }
  for (const row of items) {
    const fallback = row?.filial || row?.empresa;
    const value = String(fallback || "").trim();
    if (value) return value;
  }
  return "Sem departamento";
};

const bancoHorasPersonKeys = (row) => {
  const keys = [];
  const matricula =
    row?.matricula ||
    row?.["matrícula"] ||
    row?.["matrícula"] ||
    row?.colaboradorMatricula ||
    row?.["colaborador.matricula"];
  const nome = row?.nome || row?.colaborador || row?.colaboradorNome || row?.["colaborador.nome"];
  if (matricula) keys.push(`m:${normBancoHorasKey(matricula)}`);
  if (nome) keys.push(`n:${normBancoHorasKey(nome)}`);
  return keys.filter((key) => key.length > 2);
};

const buildBancoHorasDeptLookup = (rows) => {
  const lookup = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const depto = bancoHorasGroupLabel(row);
    if (!depto || depto === "Sem departamento") continue;
    for (const key of bancoHorasPersonKeys(row)) {
      if (!lookup.has(key)) lookup.set(key, depto);
    }
  }
  return lookup;
};

const enrichBancoHorasDept = (row, lookup) => {
  if (bancoHorasGroupLabel(row) !== "Sem departamento") return row;
  for (const key of bancoHorasPersonKeys(row)) {
    const depto = lookup?.get(key);
    if (depto) return { ...row, departamento: depto, depto };
  }
  return row;
};

const mergeBancoHorasEventRow = (row, ev, patch = {}) => ({
  ...row,
  ...ev,
  departamento:
    ev?.departamento ||
    ev?.depto ||
    ev?.depto_desc ||
    ev?.departamentoNome ||
    ev?.["departamento.nome"] ||
    row?.departamento ||
    row?.depto ||
    row?.depto_desc ||
    "",
  depto:
    ev?.depto ||
    ev?.departamento ||
    ev?.depto_desc ||
    ev?.departamentoNome ||
    ev?.["departamento.nome"] ||
    row?.depto ||
    row?.departamento ||
    row?.depto_desc ||
    "",
  depto_desc:
    ev?.depto_desc ||
    ev?.departamento ||
    ev?.depto ||
    ev?.departamentoNome ||
    ev?.["departamento.nome"] ||
    row?.depto_desc ||
    row?.departamento ||
    row?.depto ||
    "",
  ...patch,
});

const addBancoHorasTopRow = (map, label, row) => {
  const key = String(label || "Sem departamento").trim() || "Sem departamento";
  const current = map.get(key) || {
    label: key,
    saldoAnterior: 0,
    credito: 0,
    debito: 0,
    saldoProximo: 0,
    ocorrencias: 0,
    colaboradores: new Set(),
    items: [],
    hasSaldoProximo: false,
  };
  const credito = Number(row?.credito || 0);
  const debito = Number(row?.debito || 0);
  const saldoProximo = row?.saldoProximo != null ? Number(row.saldoProximo) || 0 : null;
  const saldoAnterior =
    row?.hasSaldoAnterior !== false
      ? Number(row?.saldoAnterior || 0)
      : saldoProximo != null
        ? saldoProximo - credito + debito
        : Number(row?.saldoAnterior || 0);
  current.saldoAnterior += saldoAnterior;
  current.credito += credito;
  current.debito += debito;
  if (saldoProximo != null) {
    current.saldoProximo += saldoProximo;
    current.hasSaldoProximo = true;
  }
  current.ocorrencias += 1;
  current.items.push(row || {});
  const colab = row?.matricula || row?.nome || row?.colaborador || row?.colaboradorNome;
  if (colab) current.colaboradores.add(String(colab).trim());
  map.set(key, current);
};

const finishBancoHorasTop = (map, limit = 10) =>
  Array.from(map.values())
    .map((item) => {
      const saldoProximo = item.hasSaldoProximo
        ? item.saldoProximo
        : item.saldoAnterior + item.credito - item.debito;
      return {
        ...item,
        saldoProximo,
        saldoAbs: Math.abs(saldoProximo),
        colaboradores: item.colaboradores.size,
        items: Array.isArray(item.items) ? item.items : [],
      };
    })
    .sort(
      (a, b) => b.saldoAbs - a.saldoAbs || b.credito - a.credito || a.label.localeCompare(b.label),
    )
    .slice(0, limit);

const splitBancoHorasTop = (items) => {
  const rows = Array.isArray(items) ? items : [];
  return {
    positivos: rows
      .filter((item) => Number(item?.saldoProximo || 0) > 0)
      .sort(
        (a, b) =>
          Number(b.saldoProximo || 0) - Number(a.saldoProximo || 0) ||
          a.label.localeCompare(b.label),
      )
      .slice(0, 10),
    negativos: rows
      .filter((item) => Number(item?.saldoProximo || 0) < 0)
      .sort(
        (a, b) =>
          Number(a.saldoProximo || 0) - Number(b.saldoProximo || 0) ||
          a.label.localeCompare(b.label),
      )
      .slice(0, 10),
  };
};

export const buildBancoHorasStats = (rows, eventCategories = [], storedBancoHoras = null) => {
  if (storedBancoHoras?.totals && Number(storedBancoHoras?.count || 0) > 0) {
    const totals = storedBancoHoras.totals;
    const importedRows = Array.isArray(storedBancoHoras.rows) ? storedBancoHoras.rows : [];
    const saldoAnteriorAliases = [
      "saldoAnterior",
      "saldoAnteriorBH",
      "saldo_anterior",
      "saldo_anterior_bh",
      "saldo anterior",
      "Saldo Anterior",
      "saldo inicial",
    ];
    const saldoProximoAliases = [
      "saldoProximo",
      "saldoProximoBH",
      "saldo_proximo",
      "saldo_proximo_bh",
      "saldo próximo",
      "saldo proximo",
      "Saldo Próximo",
      "saldo final",
      "saldo atual",
    ];
    const creditoAliases = ["credito", "creditoBH", "crédito", "Credito", "Crédito"];
    const debitoAliases = ["debito", "debitoBH", "débito", "Debito", "Débito"];
    const totalsCredito = pickBancoHorasMin(totals, creditoAliases) ?? 0;
    const totalsDebito = Math.abs(pickBancoHorasMin(totals, debitoAliases) ?? 0);
    const totalsSaldoAnterior = pickBancoHorasMin(totals, saldoAnteriorAliases);
    const totalsSaldoProximo = pickBancoHorasMin(totals, saldoProximoAliases);
    const rowSaldoAnterior = importedRows.reduce((sum, row) => {
      const creditoRow = pickBancoHorasMin(row, creditoAliases) ?? 0;
      const debitoRow = Math.abs(pickBancoHorasMin(row, debitoAliases) ?? 0);
      const anteriorRow = pickBancoHorasMin(row, saldoAnteriorAliases);
      const proximoRow = pickBancoHorasMin(row, saldoProximoAliases);
      if (anteriorRow != null) return sum + anteriorRow;
      if (proximoRow != null) return sum + (proximoRow - creditoRow + debitoRow);
      return sum;
    }, 0);
    const saldoAnteriorFromTotals =
      totalsSaldoAnterior != null
        ? totalsSaldoAnterior
        : totalsSaldoProximo != null
          ? totalsSaldoProximo - totalsCredito + totalsDebito
          : 0;
    const rowsHaveSaldoAnterior = importedRows.some(
      (row) =>
        pickBancoHorasMin(row, saldoAnteriorAliases) != null ||
        pickBancoHorasMin(row, saldoProximoAliases) != null,
    );
    const saldoAnteriorTotal = saldoAnteriorFromTotals || rowSaldoAnterior || 0;
    const saldoProximo =
      totalsSaldoProximo != null
        ? totalsSaldoProximo
        : saldoAnteriorTotal + totalsCredito - totalsDebito;
    const topMap = new Map();
    const deptLookup = buildBancoHorasDeptLookup(rows);
    for (const row of importedRows) {
      const enriched = enrichBancoHorasDept(row, deptLookup);
      addBancoHorasTopRow(topMap, bancoHorasGroupLabel(enriched), enriched);
    }
    const topDepartamentosAll = finishBancoHorasTop(topMap, Number.POSITIVE_INFINITY);
    const topSplit = splitBancoHorasTop(topDepartamentosAll);
    return {
      saldoAnterior: saldoAnteriorTotal,
      saldoAnteriorKnown:
        totalsSaldoAnterior != null || totalsSaldoProximo != null || rowsHaveSaldoAnterior,
      credito: totalsCredito,
      debito: totalsDebito,
      saldo: saldoProximo,
      saldoProximo,
      ocorrencias: Number(storedBancoHoras.count) || 0,
      colaboradores: Number(storedBancoHoras.colaboradores) || 0,
      source: "import",
      topDepartamentos: topSplit.positivos.length
        ? topSplit.positivos
        : topDepartamentosAll.slice(0, 10),
      topDepartamentosPositivos: topSplit.positivos,
      topDepartamentosNegativos: topSplit.negativos,
    };
  }
  const configByName = new Map(
    (Array.isArray(eventCategories) ? eventCategories : [])
      .filter((ev) => ev?.creditoBH || ev?.debitoBH)
      .map((ev) => [eventConfigKey(ev.name), ev]),
  );
  let saldoAnterior = 0;
  let saldoProximoInformado = 0;
  let hasSaldoAnterior = false;
  let hasSaldoProximo = false;
  let credito = 0;
  let debito = 0;
  let ocorrencias = 0;
  const topMap = new Map();

  for (const row of Array.isArray(rows) ? rows : []) {
    const rowSaldoAnterior = pickBancoHorasMin(row, [
      "saldo_anterior",
      "saldoAnterior",
      "saldoAnteriorBH",
      "saldo anterior",
      "saldo inicial",
      "anterior",
    ]);
    const rowSaldoProximo = pickBancoHorasMin(row, [
      "saldo_proximo",
      "saldoProximo",
      "saldoProximoBH",
      "saldo próximo",
      "saldo proximo",
      "saldo final",
      "saldo atual",
      "próximo saldo",
      "proximo saldo",
    ]);
    if (rowSaldoAnterior != null) {
      saldoAnterior += rowSaldoAnterior;
      hasSaldoAnterior = true;
    }
    if (rowSaldoProximo != null) {
      saldoProximoInformado += rowSaldoProximo;
      hasSaldoProximo = true;
    }

    for (const ev of Array.isArray(row?._events) ? row._events : []) {
      if (!isBancoHorasEvent(ev, configByName)) continue;
      const explicitCredito = pickBancoHorasMin(ev, [
        "credito",
        "creditoBH",
        "crédito",
        "creditos",
        "créditos",
      ]);
      const explicitDebito = pickBancoHorasMin(ev, [
        "debito",
        "debitoBH",
        "débito",
        "debitos",
        "débitos",
      ]);
      const evSaldoAnterior = pickBancoHorasMin(ev, [
        "saldo_anterior",
        "saldoAnterior",
        "saldoAnteriorBH",
        "saldo anterior",
        "saldo inicial",
        "anterior",
      ]);
      const evSaldoProximo = pickBancoHorasMin(ev, [
        "saldo_proximo",
        "saldoProximo",
        "saldoProximoBH",
        "saldo próximo",
        "saldo proximo",
        "saldo final",
        "saldo atual",
        "próximo saldo",
        "proximo saldo",
      ]);
      const mins = Math.max(0, Math.round(Number(ev?.horas) || 0));
      ocorrencias += 1;
      if (evSaldoAnterior != null) {
        saldoAnterior += evSaldoAnterior;
        hasSaldoAnterior = true;
      }
      if (evSaldoProximo != null) {
        saldoProximoInformado += evSaldoProximo;
        hasSaldoProximo = true;
      }
      if (explicitCredito != null || explicitDebito != null) {
        credito += Math.max(0, explicitCredito || 0);
        debito += Math.max(0, explicitDebito || 0);
        addBancoHorasTopRow(
          topMap,
          bancoHorasGroupLabel(ev, row),
          mergeBancoHorasEventRow(row, ev, {
            credito: Math.max(0, explicitCredito || 0),
            debito: Math.max(0, explicitDebito || 0),
            saldoProximo: evSaldoProximo,
            saldoAnterior: evSaldoAnterior || 0,
          }),
        );
      } else if (bancoHorasSign(ev, configByName) < 0) {
        debito += mins;
        addBancoHorasTopRow(
          topMap,
          bancoHorasGroupLabel(ev, row),
          mergeBancoHorasEventRow(row, ev, { credito: 0, debito: mins }),
        );
      } else {
        credito += mins;
        addBancoHorasTopRow(
          topMap,
          bancoHorasGroupLabel(ev, row),
          mergeBancoHorasEventRow(row, ev, { credito: mins, debito: 0 }),
        );
      }
    }
  }

  if (!hasSaldoAnterior && hasSaldoProximo) {
    saldoAnterior = saldoProximoInformado - credito + debito;
    hasSaldoAnterior = true;
  }
  if (!hasSaldoAnterior) {
    saldoAnterior = 0;
  }
  const saldoProximo = hasSaldoProximo ? saldoProximoInformado : saldoAnterior + credito - debito;
  const topDepartamentosAll = finishBancoHorasTop(topMap, Number.POSITIVE_INFINITY);
  const topSplit = splitBancoHorasTop(topDepartamentosAll);
  return {
    saldoAnterior,
    saldoAnteriorKnown: hasSaldoAnterior,
    credito,
    debito,
    saldo: saldoProximo,
    saldoProximo,
    ocorrencias,
    topDepartamentos: topSplit.positivos.length
      ? topSplit.positivos
      : topDepartamentosAll.slice(0, 10),
    topDepartamentosPositivos: topSplit.positivos,
    topDepartamentosNegativos: topSplit.negativos,
  };
};
