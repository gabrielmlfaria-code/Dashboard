const STORE_KEY = "rt_playbook_notes_v1";
const LOG_KEY = "rt_playbook_audit_log_v1";
const MAX_LOG = 300;

/** @type {Record<string, string>} */
const AREA_FIELD = {
  juridico: "juridico",
  rh: "rh",
  cct: "clausulaCct",
};

/** @type {Record<string, string>} */
const AREA_DEFAULT_AUTHOR = {
  juridico: "Jurídico",
  rh: "RH",
  cct: "Jurídico/RH",
};

function normKey(evento) {
  return String(evento ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .slice(0, 160);
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn("[rtPlaybookNotes]", err?.message || err);
    return false;
  }
}

function emptyNotes() {
  return {
    juridico: "",
    rh: "",
    clausulaCct: "",
    updatedAt: null,
    updatedBy: null,
    clausulaCctUpdatedAt: null,
    clausulaCctUpdatedBy: null,
  };
}

export function getPlaybookEventKey(evento) {
  return normKey(evento) || "evento-desconhecido";
}

export function loadPlaybookNotes(eventKey) {
  const all = readJson(STORE_KEY, {});
  const row = all[eventKey];
  if (!row) return emptyNotes();
  return {
    juridico: String(row.juridico || ""),
    rh: String(row.rh || ""),
    clausulaCct: String(row.clausulaCct || ""),
    updatedAt: row.updatedAt || null,
    updatedBy: row.updatedBy || null,
    clausulaCctUpdatedAt: row.clausulaCctUpdatedAt || null,
    clausulaCctUpdatedBy: row.clausulaCctUpdatedBy || null,
  };
}

/**
 * @param {string} eventKey
 * @param {"juridico"|"rh"|"cct"} area
 * @param {string} text
 * @param {{ author?: string, eventTitle?: string }} meta
 */
export function savePlaybookNote(eventKey, area, text, meta = {}) {
  const field = AREA_FIELD[area];
  if (!field) return emptyNotes();

  const all = readJson(STORE_KEY, {});
  const prev = all[eventKey] || emptyNotes();
  const trimmed = String(text || "").trim().slice(0, 8000);
  const now = new Date().toISOString();
  const author = String(meta.author || AREA_DEFAULT_AUTHOR[area] || "—")
    .trim()
    .slice(0, 80);

  const next = {
    ...prev,
    [field]: trimmed,
    updatedAt: now,
    updatedBy: author,
  };

  if (area === "cct") {
    next.clausulaCctUpdatedAt = now;
    next.clausulaCctUpdatedBy = author;
  }

  all[eventKey] = next;
  writeJson(STORE_KEY, all);

  appendPlaybookAuditLog({
    action: trimmed ? "nota_salva" : "nota_limpa",
    area,
    eventKey,
    eventTitle: meta.eventTitle || eventKey,
    author,
    preview: trimmed.slice(0, 200),
  });

  return all[eventKey];
}

/**
 * @param {object} entry
 */
export function appendPlaybookAuditLog(entry) {
  const log = readJson(LOG_KEY, []);
  const row = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    ...entry,
  };
  log.unshift(row);
  if (log.length > MAX_LOG) log.length = MAX_LOG;
  writeJson(LOG_KEY, log);
  return row;
}

/** @param {string} [eventKey] — se omitido, retorna log global */
export function loadPlaybookAuditLog(eventKey, limit = 40) {
  const log = readJson(LOG_KEY, []);
  const filtered = eventKey ? log.filter((l) => l.eventKey === eventKey) : log;
  return filtered.slice(0, limit);
}

export function formatAuditTs(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Rótulo amigável para o log de auditoria. */
export function auditAreaLabel(area) {
  if (area === "juridico") return "Jurídico";
  if (area === "rh") return "RH";
  if (area === "cct") return "Cláusula CCT";
  if (area === "sistema") return "Sistema";
  return area || "—";
}
