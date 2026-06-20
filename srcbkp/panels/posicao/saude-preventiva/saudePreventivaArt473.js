import { SAUDE_CAMPANHAS } from "./saudePreventivaCampanhas.js";

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

const ART_473_KEYWORDS = [
  "HPV",
  "MAMOGRAF",
  "MAMA",
  "PAPANIC",
  "PAPANICOLAU",
  "COLO",
  "UTERO",
  "UTERINO",
  "PROSTATA",
  "PSA",
  "PREVENTIV",
  "RASTREAMENTO",
  "CITOLOGIA",
  "EXAME PREVENT",
  "CANCER",
  "ONCOLOG",
];

/** Mapeamento campanha → mês recomendado (1–12). null = contínuo / especial. */
export const SAUDE_CALENDARIO_CFG = {
  "Campanha HPV 2026": { mes: 5, tipo: "anual" },
  "Outubro Rosa": { mes: 10, tipo: "anual" },
  "Novembro Azul": { mes: 11, tipo: "anual" },
  "Câncer de Colo do Útero": { mes: 1, tipo: "anual" },
  "Calendário Nacional de Vacinação": { mes: null, tipo: "continuo", intervaloDias: 90 },
  "SIPAT — Saúde Preventiva": { mes: 3, tipo: "anual" },
};

export function eventText(ev, row) {
  return [ev?.evento, ev?.desc, ev?.descricao, ev?.eventoDescricao, ev?.cod, ev?.codigo, ev?.categoria, row?.departamento, row?.depto]
    .filter(Boolean)
    .join(" ");
}

export function isArt473PreventivaEvent(ev, row = null) {
  const text = normalizeText(eventText(ev, row));
  if (!text) return false;
  return ART_473_KEYWORDS.some((kw) => text.includes(kw));
}

export function inferCampanhaFromEvento(ev, row = null) {
  const text = normalizeText(eventText(ev, row));
  if (text.includes("HPV") || text.includes("VACINA")) return "Campanha HPV 2026";
  if (text.includes("MAMOGRAF") || (text.includes("MAMA") && text.includes("CANCER"))) return "Outubro Rosa";
  if (text.includes("PROSTATA") || text.includes("PSA")) return "Novembro Azul";
  if (text.includes("PAPANIC") || text.includes("COLO") || text.includes("UTERO")) return "Câncer de Colo do Útero";
  if (text.includes("VACIN")) return "Calendário Nacional de Vacinação";
  return "SIPAT — Saúde Preventiva";
}

function colabKey(ev, row) {
  return String(
    ev?.matricula || ev?.mat || ev?.nome || ev?.colaborador || row?.matricula || row?.colaborador || "",
  ).trim();
}

function colabNome(ev, row) {
  return String(ev?.nome || ev?.colaborador || row?.colaborador || colabKey(ev, row) || "Colaborador").trim();
}

function deptLabel(ev, row) {
  return (
    String(
      ev?.departamento ||
        ev?.depto ||
        ev?.depto_desc ||
        row?.depto_desc ||
        row?.departamento ||
        row?.depto ||
        "Sem departamento",
    ).trim() || "Sem departamento"
  );
}

function parseIsoDate(iso) {
  const d = String(iso || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "";
}

function addDaysIso(iso, days) {
  const base = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(base.getTime())) return iso;
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  const da = new Date(`${a}T12:00:00`);
  const db = new Date(`${b}T12:00:00`);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return 0;
  return Math.round((db - da) / 86400000);
}

/** Ausências no histórico compatíveis com art. 473, XII (exames preventivos). */
export function buildArt473AusenciasStats(rows = [], registros = []) {
  const eventos = [];
  const byColab = new Map();

  for (const row of Array.isArray(rows) ? rows : []) {
    const date = parseIsoDate(row?.date || row?.data);
    if (!date) continue;
    for (const ev of row?._events || []) {
      if (!isArt473PreventivaEvent(ev, row)) continue;
      const ck = colabKey(ev, row);
      const campanha = inferCampanhaFromEvento(ev, row);
      const item = {
        date,
        colabKey: ck || colabNome(ev, row),
        colaborador: colabNome(ev, row),
        departamento: deptLabel(ev, row),
        evento: String(ev?.evento || ev?.desc || ev?.descricao || "Exame preventivo").trim(),
        campanha,
        categoria: ev?._cat || ev?.categoria || "—",
      };
      eventos.push(item);
      const bucket = byColab.get(item.colabKey) || [];
      bucket.push(item);
      byColab.set(item.colabKey, bucket);
    }
  }

  eventos.sort((a, b) => b.date.localeCompare(a.date) || a.colaborador.localeCompare(b.colaborador, "pt-BR"));

  const alertas = [];
  const today = new Date().toISOString().slice(0, 10);
  const janelaInicio = addDaysIso(today, -365);

  for (const [key, items] of byColab.entries()) {
    const recentes = items.filter((i) => i.date >= janelaInicio && i.date <= today);
    const diasDistintos = new Set(recentes.map((i) => i.date)).size;
    if (diasDistintos > 3) {
      alertas.push({
        colabKey: key,
        colaborador: recentes[0]?.colaborador || key,
        diasUsados: diasDistintos,
        limite: 3,
        periodo: "últimos 12 meses",
      });
    }
  }

  const realizados = (Array.isArray(registros) ? registros : []).filter((r) => r.status === "Realizado");
  const vinculos = eventos.map((ev) => {
    const comunicacao = realizados.find(
      (r) =>
        r.tema === ev.campanha &&
        parseIsoDate(r.data) &&
        parseIsoDate(r.data) <= ev.date &&
        daysBetween(r.data, ev.date) <= 120,
    );
    return { ...ev, comunicacaoRegistrada: Boolean(comunicacao), comunicacaoData: comunicacao?.data || null };
  });

  const semComunicacao = vinculos.filter((v) => !v.comunicacaoRegistrada).length;

  return {
    ocorrencias: eventos.length,
    colaboradores: byColab.size,
    eventos: vinculos,
    alertas,
    semComunicacao,
    diasLimiteClt: 3,
    janelaMesesClt: 12,
  };
}

function registroNoAno(registros, titulo, year) {
  return (Array.isArray(registros) ? registros : []).some(
    (r) => r.tema === titulo && r.status === "Realizado" && String(r.data || "").startsWith(String(year)),
  );
}

function registroRecente(registros, titulo, dias) {
  const hoje = new Date().toISOString().slice(0, 10);
  const limite = addDaysIso(hoje, -dias);
  return (Array.isArray(registros) ? registros : []).some(
    (r) => r.tema === titulo && r.status === "Realizado" && parseIsoDate(r.data) >= limite,
  );
}

/** Lembretes anuais de comunicação por campanha (Lei 15.377 / calendário RH). */
export function buildSaudeCalendarioLembretes(registros = [], refDate = new Date()) {
  const year = refDate.getFullYear();
  const month = refDate.getMonth() + 1;
  const todayIso = refDate.toISOString().slice(0, 10);

  return SAUDE_CAMPANHAS.map((campanha) => {
    const cfg = SAUDE_CALENDARIO_CFG[campanha.titulo] || { mes: null, tipo: "anual" };
    const realizadoAno = registroNoAno(registros, campanha.titulo, year);
    let status = "pendente";
    let mensagem = "Planeje a comunicação conforme o calendário de saúde.";

    if (realizadoAno) {
      status = "ok";
      mensagem = "Comunicação realizada registrada neste ano.";
    } else if (cfg.tipo === "continuo") {
      const recente = registroRecente(registros, campanha.titulo, cfg.intervaloDias || 90);
      if (recente) {
        status = "ok";
        mensagem = `Comunicação registrada nos últimos ${cfg.intervaloDias || 90} dias.`;
      } else {
        status = month >= 1 ? "ativo" : "pendente";
        mensagem = "Campanha contínua — registre comunicação trimestral.";
      }
    } else if (cfg.mes === month) {
      status = "ativo";
      mensagem = "Mês da campanha — registre a comunicação agora.";
    } else if (cfg.mes != null && cfg.mes < month) {
      status = "atrasado";
      mensagem = "Prazo do mês recomendado já passou — regularize o registro.";
    } else if (cfg.mes != null) {
      const mesAlvo = `${year}-${String(cfg.mes).padStart(2, "0")}-01`;
      const dias = daysBetween(todayIso, mesAlvo);
      if (dias > 0 && dias <= 30) {
        status = "proximo";
        mensagem = `Campanha em ${dias} dia(s) — prepare material e comunicação.`;
      } else {
        status = "pendente";
        mensagem = `Previsto para ${campanha.mes}.`;
      }
    }

    return {
      ...campanha,
      cfg,
      status,
      mensagem,
      realizadoAno,
      mesNumero: cfg.mes,
    };
  });
}
