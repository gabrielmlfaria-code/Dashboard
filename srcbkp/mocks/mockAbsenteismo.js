// Mock paginado para desenvolvimento — simula API .NET + SQL Server
import { ApiService } from "../api/apiService.js";

const FILIAIS = ["FASTPLAS AUTOMOTIVE LTDA", "SP - SBC", "SP - Santo André", "SP - Mauá"];
const DEPTOS = ["Produção", "Logística", "Qualidade", "Manutenção", "RH"];
const CARGOS = ["Operador", "Analista", "Técnico", "Supervisor"];
const CATS = ["presentes", "ausentes", "justificadas", "extras", "ignorar"];

const cache = new Map();

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function daysBetween(de, ate) {
  const out = [];
  const d0 = new Date(`${de}T00:00:00`);
  const d1 = new Date(`${ate}T00:00:00`);
  for (let d = new Date(d0); d <= d1; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function buildEventPool(de, ate) {
  const key = `${de}|${ate}`;
  if (cache.has(key)) return cache.get(key);
  const days = daysBetween(de, ate);
  const pool = [];
  let seq = 0;
  for (const day of days) {
    const perDay = 380 + (hash(day) % 120);
    for (let i = 0; i < perDay; i++) {
      const mat = String(10000 + ((seq + hash(day)) % 800));
      const cat = CATS[(seq + i) % CATS.length];
      pool.push({
        matricula: mat,
        nome: `Colaborador ${mat}`,
        filial: FILIAIS[(seq + i) % FILIAIS.length],
        departamento: DEPTOS[(seq + i) % DEPTOS.length],
        cargo: CARGOS[(seq + i) % CARGOS.length],
        data: day,
        horario: "08:00 - 17:00",
        marcacao: "07:58 12:00 13:05 17:02",
        codigo: String(100 + (seq % 50)),
        evento: cat === "presentes" ? "Hora Normal" : cat === "ausentes" ? "Falta" : "Evento",
        minutos: 480 - (seq % 60),
        categoria: cat,
      });
      seq++;
    }
  }
  cache.set(key, pool);
  return pool;
}

function filterPool(pool, p) {
  let rows = pool;
  const q = String(p.search || "")
    .trim()
    .toLowerCase();
  if (q) {
    rows = rows.filter(
      (r) =>
        r.nome.toLowerCase().includes(q) ||
        r.matricula.includes(q) ||
        r.filial.toLowerCase().includes(q) ||
        r.evento.toLowerCase().includes(q),
    );
  }
  if (p.categoria) rows = rows.filter((r) => r.categoria === p.categoria);
  if (p.filial) rows = rows.filter((r) => r.filial === p.filial);
  if (p.groupBy === "filial" && p.groupKey) rows = rows.filter((r) => r.filial === p.groupKey);
  if (p.groupBy === "depto" && p.groupKey) rows = rows.filter((r) => r.departamento === p.groupKey);
  if (p.matricula) rows = rows.filter((r) => r.matricula === p.matricula);
  return rows;
}

function sortPool(rows, sort, dir) {
  const sign = dir === "desc" ? -1 : 1;
  const col = sort || "data";
  const field =
    col === "matricula"
      ? "matricula"
      : col === "departamento"
        ? "departamento"
        : col === "minutos"
          ? "minutos"
          : col === "categoria"
            ? "categoria"
            : col === "codigo"
              ? "codigo"
              : col;
  return [...rows].sort((a, b) => {
    const va = a[field] ?? "";
    const vb = b[field] ?? "";
    if (typeof va === "number" && typeof vb === "number") return sign * (va - vb);
    return sign * String(va).localeCompare(String(vb), "pt-BR");
  });
}

function pageSlice(rows, page, pageSize) {
  const p = Math.max(1, Number(page) || 1);
  const ps = Math.min(500, Math.max(1, Number(pageSize) || 200));
  const start = (p - 1) * ps;
  return {
    items: rows.slice(start, start + ps),
    total: rows.length,
    page: p,
    pageSize: ps,
    totais: {
      horas: rows.reduce((s, r) => s + (r.minutos || 0), 0),
      horasPlanejadas: rows.length * 480,
      horasPresentes: rows.filter((r) => r.categoria === "presentes").reduce((s, r) => s + r.minutos, 0),
      horasAusentes: rows.filter((r) => r.categoria === "ausentes").reduce((s, r) => s + r.minutos, 0),
    },
  };
}

function mockResumo(p) {
  const de = p.de || "2025-01-01";
  const ate = p.ate || "2025-12-31";
  const days = daysBetween(de, ate).slice(0, 90);
  const pool = buildEventPool(de, ate);
  return {
    de,
    ate,
    dias: days.map((data) => ({
      data,
      total: 400,
      presentes: 350,
      faltas: 30,
      atrasos: 10,
      justificadas: 10,
      horasPresentes: 168000,
      horasPlanejadas: 192000,
      horasFaltas: 12000,
      horasExtras: 4000,
    })),
    totais: { eventos: pool.length, colaboradores: 800 },
  };
}

function mockEventos(p) {
  const de = p.de || "2025-05-20";
  const ate = p.ate || "2026-05-15";
  const pool = buildEventPool(de, ate);
  const filtered = sortPool(filterPool(pool, p), p.sort || "data", p.dir || "desc");
  return pageSlice(filtered, p.page, p.pageSize);
}

function mockGrupos(p) {
  const de = p.de || "2025-05-20";
  const ate = p.ate || "2026-05-15";
  const pool = filterPool(buildEventPool(de, ate), p);
  const gb = p.groupBy || "filial";
  const field =
    gb === "filial" ? "filial" : gb === "depto" ? "departamento" : gb === "cargo" ? "cargo" : "filial";
  const map = new Map();
  for (const r of pool) {
    const k = r[field] || "—";
    if (!map.has(k)) map.set(k, { count: 0, horas: 0, mats: new Set() });
    const g = map.get(k);
    g.count++;
    g.horas += r.minutos || 0;
    g.mats.add(r.matricula);
  }
  const items = [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
    .map(([label, g]) => ({
      key: label,
      label,
      count: g.count,
      colaboradores: g.mats.size,
      horas: g.horas,
      horasPlanejadas: g.count * 480,
    }));
  return { groupBy: gb, items, total: items.length };
}

export function ensureMockAbsenteismo() {
  ApiService.registerMock("/absenteismo/resumo", mockResumo);
  ApiService.registerMock("/absenteismo/colaboradores", (p) => {
    const pool = buildEventPool(p.de, p.ate);
    const byMat = new Map();
    for (const r of pool) {
      if (!byMat.has(r.matricula)) byMat.set(r.matricula, r);
    }
    const all = [...byMat.values()];
    return pageSlice(all, p.page, p.pageSize);
  });
  ApiService.registerMock("/absenteismo/eventos", mockEventos);
  ApiService.registerMock("/absenteismo/grupos", mockGrupos);
}

ensureMockAbsenteismo();
