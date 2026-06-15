import { fixPosicaoSheetRef, normalizeGenero, _fmtTime } from "../posicaoImport.js";
import { parseBancoHorasMin } from "../banco-horas/bancoHorasStats.js";
import { buildEventKey, inferPeriodoCategoryFromEventText } from "../utils/positionDiagnosisRows.js";

export function parseXlsxToHistTabela(wb, XLSX) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  fixPosicaoSheetRef(ws, XLSX);
  const aoa = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    blankrows: false,
    raw: true,
  });
  if (aoa.length < 2) {
    return [];
  }

  const norm = (s) =>
    String(s || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "");
  const normLoose = (s) => norm(s).replace(/[^a-z0-9]+/g, "");
  const hasHeader = (h, list) => {
    const loose = normLoose(h);
    return list.some((item) => {
      const target = normLoose(item);
      return (
        loose === target ||
        (loose.length > 3 &&
          target.length > 3 &&
          (loose.includes(target) || target.includes(loose)))
      );
    });
  };
  const formatLocalDate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const parseDate = (v) => {
    if (v == null || v === "") return null;
    if (v instanceof Date && !Number.isNaN(v.getTime())) return formatLocalDate(v);
    if (typeof v === "number" && v > 0) {
      if (v > 1000) {
        const whole = Math.floor(v);
        const ms = Math.round((v - whole) * 86400000);
        const base = new Date(Date.UTC(1899, 11, 30 + whole));
        base.setUTCDate(base.getUTCDate());
        const d = new Date(base.getTime() + ms);
        if (!Number.isNaN(d.getTime())) return formatLocalDate(d);
      }
    }
    const s = String(v).trim();
    if (!s || s === "-" || s === "—") return null;
    const mWeek = s.match(
      /^(?:seg|ter|qua|qui|sex|sab|sáb|dom)\s+(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?$/i,
    );
    if (mWeek) {
      const y = mWeek[3]
        ? mWeek[3].length === 2
          ? `20${mWeek[3]}`
          : mWeek[3]
        : String(new Date().getFullYear());
      return `${y}-${mWeek[2].padStart(2, "0")}-${mWeek[1].padStart(2, "0")}`;
    }
    const br = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/);
    if (br) {
      const y = br[3].length === 2 ? `20${br[3]}` : br[3];
      return `${y}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
    }
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[tT\s].*)?/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    return null;
  };
  const parseTimeMin = (v) => {
    if (v == null || v === "") return 0;
    if (typeof v === "number") {
      if (v > 0 && v < 1) return Math.round(v * 24 * 60);
      if (v >= 1) return Math.round(v * 60);
      return 0;
    }
    const s = String(v).trim();
    if (!s || s === "\uFFFD" || s === "-") return 0;
    const m = s.match(/^(\d+):(\d{2})/);
    if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
    const n = Number(s.replace(/\./g, "").replace(",", ".").replace("%", ""));
    if (Number.isFinite(n) && n > 0) return Math.round(n * 60);
    return 0;
  };
  const parseCount = (v) => {
    if (v == null || v === "") return 0;
    const m = String(v).trim().match(/-?\d+/);
    return m ? Math.max(0, parseInt(m[0], 10) || 0) : 0;
  };
  let headerRow = aoa.findIndex((line) => {
    const hs = (line || []).map((h) => norm(h));
    const hasDate = hs.some((h) =>
      hasHeader(h, [
        "apontamento.data",
        "data",
        "dt",
        "dia",
        "data apontamento",
        "data do apontamento",
        "data ponto",
        "data da marcacao",
        "data da marca?o",
        "data evento",
        "competencia",
      ]),
    );
    const hasSignal = hs.some((h) =>
      hasHeader(h, [
        "evento.codigo",
        "codigo",
        "cod",
        "c?digo",
        "evento.descricao",
        "evento",
        "descricao",
        "descri?o",
        "ocorrencia",
        "ocorr?ncia",
        "situacao",
        "situa?o",
        "tipo",
        "tipo evento",
        "apontamento.horas",
        "total",
        "horas",
        "hora",
        "qtd",
        "quantidade",
        "marcacao.horario",
        "horario",
        "hor?rio",
        "jornada",
        "turno",
        "marcacao",
        "marca?es",
        "marcacoes",
        "batidas",
        "registro",
        "ponto",
      ]),
    );
    return hasDate && hasSignal;
  });
  if (headerRow === -1) {
    const looksDate = (v) => {
      if (v instanceof Date && !Number.isNaN(v.getTime())) return true;
      if (typeof v === "number" && v > 1000) return true;
      return (
        /^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}(?:\s+.*)?$/.test(String(v || "").trim()) ||
        /^\d{4}-\d{2}-\d{2}/.test(String(v || "").trim())
      );
    };
    const dataRow = aoa.findIndex((line) => (line || []).some(looksDate));
    if (dataRow > 0) {
      const prev = aoa[dataRow - 1] || [];
      const prevTextCount = prev.filter((v) => String(v ?? "").trim() && !looksDate(v)).length;
      if (prevTextCount >= 2) headerRow = dataRow - 1;
    }
    if (headerRow === -1) {
      const first = (aoa[0] || []).map((h) => norm(h));
      const looksSummary =
        first.some((h) => hasHeader(h, ["data"])) &&
        first.some((h) =>
          hasHeader(h, [
            "planejadas",
            "trabalhadas",
            "perdidas",
            "qtd presentes",
            "qtd ausentes",
            "hrs ausentes",
          ]),
        );
      if (looksSummary) headerRow = 0;
    }
  }
  if (headerRow === -1) {
    return null;
  }
  const headers = (aoa[headerRow] || []).map((h) => norm(h));
  const findCol = (aliases, opts = {}) => {
    const { reject = [] } = opts;
    return headers.findIndex((h) => {
      const loose = normLoose(h);
      if (reject.some((r) => loose.includes(normLoose(r)))) return false;
      return hasHeader(h, aliases);
    });
  };
  const exactCol = (...names) => {
    const wanted = names.map(normLoose);
    return headers.findIndex((h) => wanted.includes(normLoose(h)));
  };
  const exactOrFind = (exactNames, aliases, opts) => {
    const exact = exactCol(...exactNames);
    return exact >= 0 ? exact : findCol(aliases, opts);
  };
  /** CID e CID.DESCRI?O: evita que o alias "cid" capture a coluna de descri?o. */
  const findCidColumns = () => {
    const isCidDescLoose = (loose) =>
      loose.includes("ciddesc") ||
      (loose.includes("cid") && (loose.includes("descricao") || loose.includes("desc")));
    const isCidOnlyLoose = (loose) =>
      (loose === "cid" || loose === "apontamentocid") && !isCidDescLoose(loose);

    let cid = exactCol("apontamento.cid", "cid");
    if (cid < 0) {
      cid = headers.findIndex((h) => {
        const loose = normLoose(h);
        return isCidOnlyLoose(loose);
      });
    }

    let cidDesc = exactCol(
      "apontamento.ciddescricao",
      "apontamento.cid.descricao",
      "cid.descricao",
      "ciddescricao",
      "cid.descricao",
    );
    if (cidDesc < 0) {
      cidDesc = headers.findIndex((h) => {
        const loose = normLoose(h);
        if (!isCidDescLoose(loose)) return false;
        return (
          hasHeader(h, [
            "cid.descricao",
            "cid.descricao",
            "cid descricao",
            "descricao cid",
            "descri?o cid",
            "cid descricao",
            "ciddescricao",
            "apontamento.cid descricao",
          ]) || isCidDescLoose(loose)
        );
      });
    }

    if (cid >= 0 && cidDesc === cid) cidDesc = -1;
    return { cid, cidDesc };
  };
  const dateCol = exactOrFind(
    ["apontamento.data"],
    [
      "data",
      "dt",
      "dia",
      "data apontamento",
      "data do apontamento",
      "data ponto",
      "data da marcacao",
      "data da marca?o",
      "data evento",
      "competencia",
    ],
  );
  const totalCol = exactOrFind(
    ["apontamento.horas"],
    [
      "total",
      "horas",
      "hora",
      "qtd horas",
      "quantidade horas",
      "horas apontamento",
      "horas trabalhadas",
      "horas abonadas",
      "horas falta",
      "horas extras",
    ],
  );
  const codigoCol = exactOrFind(
    ["evento.codigo"],
    ["codigo evento", "c?digo evento", "cod evento", "cod ocorrencia", "codigo ocorrencia"],
    { reject: ["colaborador"] },
  );
  const descCol = exactOrFind(
    ["evento.descricao"],
    [
      "descricao evento",
      "descri?o evento",
      "nome evento",
      "evento",
      "ocorrencia",
      "ocorr?ncia",
      "tipo evento",
      "motivo",
    ],
    { reject: ["cargo", "colaborador", "departamento", "filial", "situacao", "situa?o"] },
  );
  const situacaoDescCol = exactOrFind(
    ["situacao.descricao"],
    ["situacao descricao", "descri?o situa?o", "descricao situacao", "situa?o", "situacao"],
    { reject: ["evento", "cargo", "colaborador"] },
  );
  const { cid: cidCol, cidDesc: cidDescCol } = findCidColumns();
  const atividadeCol = exactOrFind(
    ["apontamento.atividade"],
    ["atividade", "atividade apontamento", "tipo atividade"],
  );
  const matCol = exactOrFind(
    ["colaborador.matricula"],
    [
      "matricula",
      "matr?cula",
      "mat",
      "chapa",
      "cadastro",
      "registro",
      "codigo colaborador",
      "cod colaborador",
      "id colaborador",
    ],
  );
  const nomeCol = exactOrFind(
    ["colaborador.nome"],
    ["nome colaborador", "funcionario", "funcion?rio", "empregado", "trabalhador", "colaborador"],
  );
  const filialCol = exactOrFind(
    ["filial.nomefantasia"],
    ["nome fantasia", "filial", "empresa", "unidade", "loja", "estabelecimento"],
  );
  const deptoCol = exactOrFind(
    ["departamento.nome"],
    [
      "departamento",
      "depto",
      "setor",
      "centro custo",
      "centro de custo",
      "ccusto",
      "lotacao",
      "lota?o",
      "area",
      "?rea",
    ],
  );
  const cargoCol = exactOrFind(
    ["cargo.descricao", "cargo.nome"],
    ["cargo", "fun?o", "funcao", "ocupacao", "ocupa?o", "job", "posto"],
  );
  const generoCol = exactOrFind(
    ["colaborador.genero", "colaborador.sexo"],
    ["genero", "sexo"],
  );
  const periodoInicioCol = exactOrFind(
    [
      "afastamento.inicio",
      "afastamento.dataInicio",
      "ferias.inicio",
      "ferias.dataInicio",
      "dataInicio",
    ],
    [
      "afastamento inicio",
      "inicio afastamento",
      "data inicio afastamento",
      "data inicial afastamento",
      "ferias inicio",
      "inicio ferias",
      "data inicio ferias",
      "data inicial ferias",
      "periodo inicio",
      "data inicio",
      "data inicial",
    ],
  );
  const periodoFimCol = exactOrFind(
    [
      "afastamento.final",
      "afastamento.fim",
      "afastamento.dataFinal",
      "ferias.final",
      "ferias.fim",
      "ferias.dataFinal",
      "dataFinal",
    ],
    [
      "afastamento final",
      "afastamento fim",
      "fim afastamento",
      "data fim afastamento",
      "data final afastamento",
      "ferias final",
      "ferias fim",
      "fim ferias",
      "data fim ferias",
      "data final ferias",
      "periodo fim",
      "periodo ate",
      "data fim",
      "data final",
    ],
  );
  const saldoAnteriorBHCol = exactOrFind(
    ["saldoAnteriorBH", "saldo_anterior_bh", "saldo anterior", "Saldo Anterior"],
    ["saldo anterior", "saldo inicial", "saldo antes", "saldo ant"],
  );
  const creditoBHCol = exactOrFind(
    ["creditoBH", "credito_bh", "crédito", "credito", "Crédito"],
    ["credito", "crédito", "creditos", "créditos", "credito bh", "crédito bh"],
  );
  const debitoBHCol = exactOrFind(
    ["debitoBH", "debito_bh", "débito", "debito", "Débito"],
    ["debito", "débito", "debitos", "débitos", "debito bh", "débito bh"],
  );
  const saldoProximoBHCol = exactOrFind(
    ["saldoProximoBH", "saldo_proximo_bh", "saldo próximo", "saldo proximo", "Saldo Próximo"],
    ["saldo próximo", "saldo proximo", "saldo final", "saldo atual", "saldo seguinte", "proximo saldo"],
  );
  const horarioCol = exactOrFind(
    ["marcacao.horario", "apontamento.horario"],
    [
      "horario",
      "hor?rio",
      "jornada",
      "turno",
      "horario do dia",
      "escala",
      "horario trabalho",
    ],
  );

  const isHorarioScheduleHeader = (h) => {
    const loose = normLoose(h);
    if (loose === "marcacaohorario" || loose === "apontamentohorario") return true;
    if (
      loose.includes("horariododia") ||
      loose === "horario" ||
      loose === "jornada" ||
      loose === "turno" ||
      loose === "escala"
    ) {
      return !loose.includes("marcacaoponto") && loose !== "marcacao";
    }
    return (
      hasHeader(h, ["marcacao.horario", "horario", "jornada", "turno", "escala"]) &&
      !hasHeader(h, ["marcacao.marcacao", "marcacao.batidas", "batidas", "ponto"])
    );
  };

  const findMarcacaoColumn = () => {
    const exactMarcacao = exactCol(
      "apontamento.marcacao",
      "marcacao.marcacao",
      "marcacao.batidas",
      "marcacao.ponto",
      "marcacao.entrada",
    );
    if (exactMarcacao >= 0 && exactMarcacao !== horarioCol) return exactMarcacao;

    const idx = headers.findIndex((h, i) => {
      if (i === horarioCol) return false;
      if (isHorarioScheduleHeader(h)) return false;
      const loose = normLoose(h);
      if (loose.includes("marcacao") || loose.includes("marcacoes")) {
        if (loose.includes("horario")) return false;
        return true;
      }
      return hasHeader(h, [
        "marca?es",
        "marcacoes",
        "apontamento.marcacao",
        "marcacao.marcacao",
        "marcacao.batidas",
        "marcacao.ponto",
        "marcacao.entrada",
        "batidas",
        "ponto",
        "entrada",
        "marcacoes do ponto",
        "marca?es do ponto",
        "batidas ponto",
        "batidas do ponto",
        "registro ponto",
        "registros ponto",
        "registros do ponto",
      ]);
    });
    if (idx >= 0 && idx !== horarioCol) return idx;
    return -1;
  };

  const marcacaoCol = findMarcacaoColumn();

  const marcPartCols = [];
  for (let n = 1; n <= 4; n++) {
    for (const alias of [`marc${n}`, `marc_${n}`, `marcacao${n}`, `batida${n}`, `entrada${n}`, `saida${n}`]) {
      const i = headers.findIndex((h) => normLoose(h) === normLoose(alias));
      if (i >= 0 && i !== horarioCol && i !== marcacaoCol && !marcPartCols.includes(i)) {
        marcPartCols.push(i);
      }
    }
  }
  const planejadasCol = headers.findIndex((h) =>
    hasHeader(h, ["planejadas", "horas planejadas", "hrs planejadas"]),
  );
  const trabalhadasCol = headers.findIndex((h) =>
    hasHeader(h, ["trabalhadas", "horas trabalhadas", "hrs trabalhadas"]),
  );
  const perdidasCol = headers.findIndex((h) =>
    hasHeader(h, ["perdidas", "horas perdidas", "hrs perdidas"]),
  );
  const qtdPresentesCol = headers.findIndex((h) =>
    hasHeader(h, ["qtd presentes", "qtd. presentes", "presentes"]),
  );
  const qtdAusentesCol = headers.findIndex((h) =>
    hasHeader(h, ["qtd ausentes", "qtd. ausentes", "ausentes", "faltas"]),
  );
  const hrsAusentesCol = headers.findIndex((h) =>
    hasHeader(h, ["hrs ausentes", "hrs. ausentes", "horas ausentes", "horas faltas"]),
  );
  const qtdJustCol = headers.findIndex((h) =>
    hasHeader(h, ["qtd justificadas", "qtd. justificadas", "justificadas"]),
  );
  const hrsJustCol = headers.findIndex((h) =>
    hasHeader(h, ["hrs justificadas", "hrs. justificadas", "horas justificadas"]),
  );
  const qtdExtrasCol = headers.findIndex((h) =>
    hasHeader(h, ["qtd extras", "qtd. extras", "extras"]),
  );
  const hrsExtrasCol = headers.findIndex((h) =>
    hasHeader(h, ["hrs extras", "hrs. extras", "horas extras"]),
  );
  const isSummaryLayout =
    planejadasCol >= 0 ||
    trabalhadasCol >= 0 ||
    perdidasCol >= 0 ||
    qtdPresentesCol >= 0 ||
    qtdAusentesCol >= 0;

  if (isSummaryLayout) {
    const byDateSummary = new Map();
    for (let i = headerRow + 1; i < aoa.length; i++) {
      const row = aoa[i] || [];
      const date = parseDate(row[dateCol]);
      if (!date) continue;
      const presentes = qtdPresentesCol >= 0 ? parseCount(row[qtdPresentesCol]) : 0;
      const faltas = qtdAusentesCol >= 0 ? parseCount(row[qtdAusentesCol]) : 0;
      const justificadas = qtdJustCol >= 0 ? parseCount(row[qtdJustCol]) : 0;
      const extras = qtdExtrasCol >= 0 ? parseCount(row[qtdExtrasCol]) : 0;
      const hrsPlan = planejadasCol >= 0 ? parseTimeMin(row[planejadasCol]) : 0;
      const hrsPresRaw = trabalhadasCol >= 0 ? parseTimeMin(row[trabalhadasCol]) : 0;
      const hrsPres = capWorkedHours(hrsPresRaw, hrsPlan);
      const hrsAuse = hrsAusentesCol >= 0 ? parseTimeMin(row[hrsAusentesCol]) : 0;
      const hrsJust = hrsJustCol >= 0 ? parseTimeMin(row[hrsJustCol]) : 0;
      const hrsExtr = hrsExtrasCol >= 0 ? parseTimeMin(row[hrsExtrasCol]) : 0;
      const filial = filialCol >= 0 ? String(row[filialCol] ?? "").trim() : "";
      const depto = deptoCol >= 0 ? String(row[deptoCol] ?? "").trim() : "";
      const cargo = cargoCol >= 0 ? String(row[cargoCol] ?? "").trim() : "";
      const cur = byDateSummary.get(date) || {
        date,
        total: 0,
        presentes: 0,
        faltas: 0,
        atrasos: 0,
        justificadas: 0,
        extras: 0,
        horas_presentes: 0,
        horas_planejadas: 0,
        horas_faltas: 0,
        horas_atrasos: null,
        horas_justificadas: 0,
        horas_extras: 0,
        _employees: [],
        _events: null,
      };
      cur.presentes += presentes;
      cur.faltas += faltas;
      cur.justificadas += justificadas;
      cur.extras += extras;
      cur.horas_presentes += hrsPres;
      cur.horas_planejadas += hrsPlan;
      cur.horas_faltas += hrsAuse;
      cur.horas_justificadas += hrsJust;
      cur.horas_extras += hrsExtr;
      cur.total = cur.presentes + cur.faltas + cur.justificadas;
      if (filial || depto || cargo) {
        cur._employees.push({
          mat: `resumo-${i}`,
          nome: depto || cargo || filial || "Resumo",
          filial,
          depto,
          depto_desc: depto,
          cargo,
          hrsPlan,
          hrsPres,
          hrsAuse,
          hrsJust,
          hrsExtr,
        });
      }
      byDateSummary.set(date, cur);
    }
    const rows = [...byDateSummary.values()].map((r) => ({
      ...r,
      extras: r.extras > 0 ? r.extras : null,
      abs_rate: r.total > 0 ? +((r.faltas / r.total) * 100).toFixed(2) : 0,
      horas_presentes: r.horas_presentes > 0 ? r.horas_presentes : null,
      horas_planejadas: r.horas_planejadas > 0 ? r.horas_planejadas : null,
      horas_faltas: r.horas_faltas > 0 ? r.horas_faltas : null,
      horas_justificadas: r.horas_justificadas > 0 ? r.horas_justificadas : null,
      horas_extras: r.horas_extras > 0 ? r.horas_extras : null,
      _employees: r._employees.length ? r._employees : null,
    }));
    rows.sort((a, b) => a.date.localeCompare(b.date));
    return rows;
  }

  if (dateCol === -1) {
    return null;
  }
  if (
    codigoCol === -1 &&
    descCol === -1 &&
    totalCol === -1 &&
    marcacaoCol === -1 &&
    horarioCol === -1
  ) {
    return null;
  }
  if (cidCol < 0 && cidDescCol < 0) {
    console.warn(
      "[ImportTabela] Colunas CID nao detectadas. Cabecalhos:",
      (aoa[headerRow] || []).filter(Boolean).slice(0, 40),
    );
  }

  const cats = loadEventCategories();
  const eventKeyNorm = (v) => norm(v).replace(/\s+/g, " ").trim();
  const eventKeyLoose = (v) => eventKeyNorm(v).replace(/[^a-z0-9]+/g, "");
  const catByName = {};
  cats.forEach((c) => {
    const key = eventKeyNorm(c.name);
    if (key) catByName[key] = c.category;
    if (key) catByName[eventKeyLoose(key)] = c.category;
    const parts = key.match(/^\s*[^-?]+[-?]\s*(.+)$/);
    if (parts?.[1]) {
      catByName[eventKeyNorm(parts[1])] = c.category;
      catByName[eventKeyLoose(parts[1])] = c.category;
    }
  });

  // Parse "6 - 14:47 18:00 19:00 23:00" ? (saida1-entrada1) + (saida2-entrada2)
  const parseHorarioMin = (v) => {
    if (!v) return 0;
    const s = String(v)
      .trim()
      .replace(/^[^-]*-\s*/, "");
    const toMin = (t) => {
      const m = String(t).match(/^(\d+):(\d{2})$/);
      return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : 0;
    };
    const ts = s.split(/\s+/).filter(Boolean);
    const mins = ts.map(toMin);
    for (let i = 1; i < mins.length; i++) {
      if (mins[i] < mins[i - 1]) {
        for (let j = i; j < mins.length; j++) mins[j] += 1440;
      }
    }
    if (mins.length >= 4) return Math.max(0, mins[1] - mins[0]) + Math.max(0, mins[3] - mins[2]);
    if (mins.length >= 2) return Math.max(0, mins[1] - mins[0]);
    return 0;
  };

  const byDate = new Map();
  const planSeen = new Set(); // `${date}|${mat}` ? count each employee's planned hours once
  const presentDerivedSeen = new Set(); // marca?es/jornada derivadas representam o dia do colaborador
  let rawRowCount = 0;
  let skippedNoDate = 0;
  const sheetDataRows = Math.max(0, aoa.length - headerRow - 1);

  for (let i = headerRow + 1; i < aoa.length; i++) {
    const raw = aoa[i] || [];
    const row =
      raw.length >= headers.length ?
         raw
        : headers.map((_, ci) => (ci < raw.length ? raw[ci] : null));
    const date = parseDate(row[dateCol]);
    if (!date) {
      skippedNoDate++;
      continue;
    }
    rawRowCount++;

    const mat = matCol >= 0 ? String(row[matCol] ?? `_${i}`).trim() : `_${i}`;
    const codRaw = codigoCol >= 0 ? row[codigoCol] : "";
    const descRaw = descCol >= 0 ? row[descCol] : "";
    const situacaoRaw = situacaoDescCol >= 0 ? String(row[situacaoDescCol] ?? "").trim() : "";
    const periodoInicio = periodoInicioCol >= 0 ? parseDate(row[periodoInicioCol]) || "" : "";
    const periodoFim = periodoFimCol >= 0 ? parseDate(row[periodoFimCol]) || "" : "";
    const saldoAnteriorBH = saldoAnteriorBHCol >= 0 ? parseBancoHorasMin(row[saldoAnteriorBHCol]) : null;
    const creditoBH = creditoBHCol >= 0 ? parseBancoHorasMin(row[creditoBHCol]) : null;
    const debitoBH = debitoBHCol >= 0 ? parseBancoHorasMin(row[debitoBHCol]) : null;
    const saldoProximoBH = saldoProximoBHCol >= 0 ? parseBancoHorasMin(row[saldoProximoBHCol]) : null;
    const eventKey = buildEventKey(codRaw, descRaw);
    const mins = totalCol >= 0 ? parseTimeMin(row[totalCol]) : 0;
    let marcacaoRaw = "";
    if (marcacaoCol >= 0 && marcacaoCol !== horarioCol) {
      marcacaoRaw = String(row[marcacaoCol] ?? "").trim();
    }
    if (!marcacaoRaw && marcPartCols.length) {
      marcacaoRaw = marcPartCols
        .map((colIdx) => _fmtTime(row[colIdx]))
        .filter(Boolean)
        .join(" ");
    }
    const horarioStr = horarioCol >= 0 ? String(row[horarioCol] ?? "").trim() : "";
    if (marcacaoRaw && horarioStr && marcacaoRaw === horarioStr) marcacaoRaw = "";
    const planMins = horarioCol >= 0 ? parseHorarioMin(row[horarioCol]) : 0;
    const eventPeriodoCat = inferPeriodoCategoryFromEventText(
      `${eventKey || ""} ${descRaw || ""} ${codRaw || ""} ${situacaoRaw || ""}`,
    );
    let category =
      catByName[eventKeyNorm(eventKey)] ||
      catByName[eventKeyLoose(eventKey)] ||
      catByName[eventKeyNorm(descRaw)] ||
      catByName[eventKeyLoose(descRaw)] ||
      catByName[eventKeyNorm(codRaw)] ||
      catByName[eventKeyLoose(codRaw)] ||
      "ignorar";
    if (category === "ignorar" && eventPeriodoCat) category = "justificadas";

    if (!byDate.has(date))
      byDate.set(date, {
        pres: new Set(),
        ause: new Set(),
        atr: new Set(),
        just: new Set(),
        extr: new Set(),
        hrsPres: 0,
        hrsAuse: 0,
        hrsAtraso: 0,
        hrsJust: 0,
        hrsExtr: 0,
        hrsPlan: 0,
        empMap: new Map(),
        events: [],
      });
    const d = byDate.get(date);

    // Per-employee tracking
    if (!d.empMap.has(mat))
      d.empMap.set(mat, {
        nome: "",
        filial: "",
        depto: "",
        cargo: "",
        genero: "",
        periodoCat: "",
        inicio: "",
        termino: "",
        hrsPlan: 0,
        hrsPres: 0,
        hrsAuse: 0,
        hrsAtraso: 0,
        hrsJust: 0,
        hrsExtr: 0,
      });
    const emp = d.empMap.get(mat);
    if (nomeCol >= 0 && !emp.nome) {
      const v = String(row[nomeCol] ?? "").trim();
      if (v) emp.nome = v;
    }
    if (filialCol >= 0 && !emp.filial) {
      const v = String(row[filialCol] ?? "").trim();
      if (v) emp.filial = v;
    }
    if (deptoCol >= 0 && !emp.depto) {
      const v = String(row[deptoCol] ?? "").trim();
      if (v) emp.depto = v;
    }
    if (cargoCol >= 0 && !emp.cargo) {
      const v = String(row[cargoCol] ?? "").trim();
      if (v) emp.cargo = v;
    }
    if (generoCol >= 0 && !emp.genero) {
      emp.genero = normalizeGenero(row[generoCol]);
    }
    const periodoCat = eventPeriodoCat;
    if (periodoCat && !emp.periodoCat) emp.periodoCat = periodoCat;
    if (periodoInicio && !emp.inicio) emp.inicio = periodoInicio;
    if (periodoFim && !emp.termino) emp.termino = periodoFim;

    // Store planned hours per employee; total is computed later (only for active employees)
    const planKey = `${date}|${mat}`;
    if (!planSeen.has(planKey) && horarioCol >= 0) {
      if (planMins > 0) {
        emp.hrsPlan += planMins;
        planSeen.add(planKey);
      }
    }

    d.events.push({
      mat,
      nome: nomeCol >= 0 ? String(row[nomeCol] ?? "").trim() || mat : mat,
      filial: filialCol >= 0 ? String(row[filialCol] ?? "").trim() : "",
      depto: deptoCol >= 0 ? String(row[deptoCol] ?? "").trim() : "",
      cargo: cargoCol >= 0 ? String(row[cargoCol] ?? "").trim() : "",
      genero: generoCol >= 0 ? normalizeGenero(row[generoCol]) : "",
      data: date,
      horario: horarioStr,
      marcacao: marcacaoRaw,
      cod: codigoCol >= 0 ? String(row[codigoCol] ?? "").trim() : "",
      evento: descCol >= 0 ? String(row[descCol] ?? "").trim() : "",
      cid: cidCol >= 0 ? String(row[cidCol] ?? "").trim() : "",
      cidDescricao: cidDescCol >= 0 ? String(row[cidDescCol] ?? "").trim() : "",
      atividade: atividadeCol >= 0 ? String(row[atividadeCol] ?? "").trim() : "",
      situacaoDesc: situacaoRaw,
      inicio: periodoInicio,
      termino: periodoFim,
      horas: mins,
      creditoBH: creditoBH != null ? Math.max(0, creditoBH) : null,
      debitoBH: debitoBH != null ? Math.abs(debitoBH) : null,
      saldoAnteriorBH,
      saldoProximoBH,
      credito: creditoBH != null ? Math.max(0, creditoBH) : null,
      debito: debitoBH != null ? Math.abs(debitoBH) : null,
      saldoAnterior: saldoAnteriorBH,
      saldoProximo: saldoProximoBH,
      hasSaldoAnterior: saldoAnteriorBH != null,
      hasSaldoProximo: saldoProximoBH != null,
      _cat: category,
    });

    if (category === "ignorar") continue;
    const evText = `${codRaw} ${descRaw}`;
    const isAtrasoEv = /\batraso\b/i.test(evText);
    if (category === "presentes") {
      const derivedKey = `${date}|${mat}`;
      let workedMins = mins;
      if (!(workedMins > 0) && !presentDerivedSeen.has(derivedKey)) {
        workedMins = parseHorarioMin(marcacaoRaw) || planMins;
        if (workedMins > 0) presentDerivedSeen.add(derivedKey);
      }
      const remainingPlan = Math.max(0, (Number(emp.hrsPlan) || planMins || 0) - (Number(emp.hrsPres) || 0));
      if (remainingPlan > 0) workedMins = Math.min(workedMins, remainingPlan);
      d.pres.add(mat);
      d.hrsPres += workedMins;
      emp.hrsPres += workedMins;
    } else if (category === "ausentes" && isAtrasoEv) {
      d.atr.add(mat);
      d.hrsAtraso += mins;
      emp.hrsAtraso = (emp.hrsAtraso || 0) + mins;
    } else if (category === "ausentes") {
      d.ause.add(mat);
      d.hrsAuse += mins;
      emp.hrsAuse += mins;
    } else if (category === "justificadas") {
      d.just.add(mat);
      d.hrsJust += mins;
      emp.hrsJust += mins;
    } else if (category === "extras") {
      d.extr.add(mat);
      d.hrsExtr += mins;
      emp.hrsExtr += mins;
    } else if (category === "risco") {
      d.hrsRisco = (d.hrsRisco || 0) + mins;
      emp.hrsRisco = (emp.hrsRisco || 0) + mins;
    } else if (category === "noturnas") {
      d.hrsNoturnas = (d.hrsNoturnas || 0) + mins;
      emp.hrsNoturnas = (emp.hrsNoturnas || 0) + mins;
    }
  }

  const rows = [];
  for (const [date, d] of byDate) {
    const presentes = d.pres.size;
    const faltas = d.ause.size;
    const atrasos = d.atr.size;
    const justificadas = d.just.size;
    const extras = d.extr.size;
    const total = presentes + faltas + atrasos + justificadas;

    // Only count planned hours for employees who have some worked or absent hours
    let hrsPlan = 0,
      hrsPres = 0,
      hrsAuse = 0,
      hrsAtraso = 0,
      hrsJust = 0,
      hrsExtr = 0;
    const _employees = [];
    for (const [mat, e] of d.empMap) {
      const active =
        e.hrsPres > 0 || e.hrsAuse > 0 || e.hrsAtraso > 0 || e.hrsJust > 0 || e.hrsExtr > 0;
      hrsPres += e.hrsPres;
      hrsAuse += e.hrsAuse;
      hrsAtraso += e.hrsAtraso || 0;
      hrsJust += e.hrsJust;
      hrsExtr += e.hrsExtr;
      if (active) hrsPlan += e.hrsPlan;
      let cat = "presentes";
      if (d.atr.has(mat)) cat = "atraso";
      else if (d.ause.has(mat)) cat = "falta";
      else if (d.just.has(mat)) cat = e.periodoCat || "folga";
      _employees.push({
        mat,
        nome: e.nome || mat,
        filial: e.filial,
        depto: e.depto,
        depto_desc: e.depto,
        cargo: e.cargo,
        genero: e.genero,
        inicio: e.inicio || "",
        termino: e.termino || "",
        cat,
        hrsPlan: active ? e.hrsPlan : 0,
        hrsPres: e.hrsPres,
        hrsAuse: e.hrsAuse,
        hrsAtraso: e.hrsAtraso || 0,
        hrsJust: e.hrsJust,
        hrsExtr: e.hrsExtr,
        hrsRisco: e.hrsRisco || 0,
        hrsNoturnas: e.hrsNoturnas || 0,
      });
    }
    _employees.sort((a, b) => (a.nome || a.mat).localeCompare(b.nome || b.mat, "pt-BR"));

    rows.push({
      date,
      total,
      presentes,
      faltas,
      atrasos,
      justificadas,
      extras: extras > 0 ? extras : null,
      abs_rate: total > 0 ? +((faltas / total) * 100).toFixed(2) : 0,
      horas_presentes: hrsPres > 0 ? hrsPres : null,
      horas_planejadas: hrsPlan > 0 ? hrsPlan : null,
      horas_faltas: hrsAuse > 0 ? hrsAuse : null,
      horas_atrasos: hrsAtraso > 0 ? hrsAtraso : null,
      horas_justificadas: hrsJust > 0 ? hrsJust : null,
      horas_extras: hrsExtr > 0 ? hrsExtr : null,
      _employees: _employees.length > 0 ? _employees : null,
      _events: d.events.length > 0 ? d.events : null,
    });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  const eventCount = rows.reduce((s, r) => s + (r._events?.length || 0), 0);
  rows._rawRowCount = rawRowCount;
  rows._importStats = {
    sheetRows: sheetDataRows,
    importedRows: rawRowCount,
    skippedNoDate,
    eventCount,
    dayCount: rows.length,
  };
  return rows;
}

