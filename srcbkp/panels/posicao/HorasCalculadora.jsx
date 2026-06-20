import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import "./HorasCalculadora.css";

/* ── helpers ── */
function parseTime(v) {
  const s = String(v || "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10),
    min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function fmtMin(min) {
  if (min == null || isNaN(min)) return "—";
  const neg = min < 0;
  const v = Math.abs(Math.round(Number(min)));
  const h = Math.floor(v / 60),
    m = v % 60;
  return (neg ? "-" : "") + h.toLocaleString("pt-BR") + ":" + String(m).padStart(2, "0");
}

function fmtMinCard(min) {
  if (min == null || isNaN(min) || min === 0) return "0:00";
  return fmtMin(min);
}

function fmtMinLong(min) {
  if (!min) return "0min";
  const neg = min < 0;
  const v = Math.abs(Math.round(min));
  const h = Math.floor(v / 60),
    m = v % 60;
  if (h === 0) return (neg ? "-" : "") + m + "min";
  if (m === 0) return (neg ? "-" : "") + h + "h";
  return (neg ? "-" : "") + h + "h " + m + "min";
}

function fmtBRL(n) {
  if (n == null || isNaN(n)) return "—";
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/* ── drag + resize hook ── */
function useDragResize(initW, initH) {
  const posRef = useRef({ x: 0, y: 0 });
  const sizeRef = useRef({ w: initW, h: initH });
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ w: initW, h: initH });

  const onDragStart = useCallback((e) => {
    if (e.button !== 0) return;
    if (e.target.closest("button,input,select,a")) return;
    e.preventDefault();
    const ox = e.clientX - posRef.current.x;
    const oy = e.clientY - posRef.current.y;
    const move = (mv) => {
      posRef.current = { x: mv.clientX - ox, y: mv.clientY - oy };
      setPos({ ...posRef.current });
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    document.body.style.userSelect = "none";
  }, []);

  const onResizeStart = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const sx = e.clientX,
      sy = e.clientY,
      sw = sizeRef.current.w,
      sh = sizeRef.current.h;
    const move = (mv) => {
      sizeRef.current = {
        w: Math.max(640, sw + mv.clientX - sx),
        h: Math.max(420, sh + mv.clientY - sy),
      };
      setSize({ ...sizeRef.current });
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    document.body.style.userSelect = "none";
  }, []);

  return { pos, size, onDragStart, onResizeStart };
}

const DAY_TYPES = [
  { value: "util", label: "Dia útil" },
  { value: "sabado", label: "Sábado" },
  { value: "domingo", label: "Domingo" },
  { value: "feriado", label: "Feriado" },
];

let nextId = 1;
const blankRow = (date = "") => ({
  id: nextId++,
  date,
  tipo: "util",
  e1: "",
  s1: "",
  e2: "",
  s2: "",
});

function calcRow(row, cfg) {
  const { jornada, limiteHE1 } = cfg;
  let worked = 0;
  const t1e = parseTime(row.e1),
    t1s = parseTime(row.s1);
  const t2e = parseTime(row.e2),
    t2s = parseTime(row.s2);
  if (t1e != null && t1s != null && t1s > t1e) worked += t1s - t1e;
  if (t2e != null && t2s != null && t2s > t2e) worked += t2s - t2e;

  const hasEntry = !!(row.e1 || row.s1 || row.e2 || row.s2);
  if (!hasEntry) return { worked: 0, normal: 0, he50: 0, he100: 0, falta: 0, valid: false };

  const isDomFer = row.tipo === "domingo" || row.tipo === "feriado";

  let normal = 0,
    he50 = 0,
    he100 = 0,
    falta = 0;
  if (isDomFer) {
    he100 = worked;
  } else {
    normal = Math.min(worked, jornada);
    falta = Math.max(0, jornada - worked);
    const extra = Math.max(0, worked - jornada);
    he50 = Math.min(extra, limiteHE1);
    he100 = Math.max(0, extra - limiteHE1);
  }
  return { worked, normal, he50, he100, falta, valid: true };
}

const LS_KEY = "pb_hcalc_rows_v1";
const LS_CFG = "pb_hcalc_cfg_v1";

function loadRows() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || "null");
    if (Array.isArray(raw) && raw.length) {
      raw.forEach((r) => {
        if (r.id >= nextId) nextId = r.id + 1;
      });
      return raw;
    }
  } catch {}
  return [blankRow(new Date().toISOString().slice(0, 10))];
}

function loadCfg() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_CFG) || "null");
    if (raw && typeof raw === "object") return raw;
  } catch {}
  return { jornada: 480, limiteHE1: 120, salario: "" };
}

function saveRows(rows) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(rows));
  } catch {}
}
function saveCfg(cfg) {
  try {
    localStorage.setItem(LS_CFG, JSON.stringify(cfg));
  } catch {}
}

/* ── Hours Operations (mini-calculator) ── */
const OPS = [
  { value: "+", label: "+ Somar" },
  { value: "-", label: "− Subtrair" },
  { value: "*", label: "× Multiplicar" },
  { value: "/", label: "÷ Dividir" },
];

function HorasOp({ theme }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [op, setOp] = useState("+");
  const [fac, setFac] = useState("2");

  const result = useMemo(() => {
    const ma = parseTime(a);
    if (ma == null) return null;
    if (op === "+" || op === "-") {
      const mb = parseTime(b);
      if (mb == null) return null;
      return op === "+" ? ma + mb : ma - mb;
    }
    // × or ÷ — use factor
    const f = parseFloat(String(fac || "").replace(",", "."));
    if (!Number.isFinite(f) || f === 0) return null;
    if (op === "*") return Math.round(ma * f);
    return Math.round(ma / f);
  }, [a, b, op, fac]);

  const needsB = op === "+" || op === "-";
  const needsFac = op === "*" || op === "/";

  return (
    <div className="hcalc-op-panel" data-theme={theme}>
      <div className="hcalc-op-title">⚡ Operações com Horas</div>
      <div className="hcalc-op-row">
        <div className="hcalc-op-field">
          <label className="hcalc-op-lbl">Hora A (HH:MM)</label>
          <input
            type="time"
            className="hcalc-op-inp"
            value={a}
            onChange={(e) => setA(e.target.value)}
            placeholder="00:00"
          />
        </div>

        <div className="hcalc-op-field">
          <label className="hcalc-op-lbl">Operação</label>
          <select className="hcalc-op-sel" value={op} onChange={(e) => setOp(e.target.value)}>
            {OPS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {needsB && (
          <div className="hcalc-op-field">
            <label className="hcalc-op-lbl">Hora B (HH:MM)</label>
            <input
              type="time"
              className="hcalc-op-inp"
              value={b}
              onChange={(e) => setB(e.target.value)}
              placeholder="00:00"
            />
          </div>
        )}

        {needsFac && (
          <div className="hcalc-op-field">
            <label className="hcalc-op-lbl">Fator</label>
            <input
              type="text"
              inputMode="decimal"
              className="hcalc-op-inp hcalc-op-inp-fac"
              value={fac}
              onChange={(e) => setFac(e.target.value)}
              placeholder="1"
            />
          </div>
        )}

        <div className="hcalc-op-field hcalc-op-result-wrap">
          <label className="hcalc-op-lbl">Resultado</label>
          <div
            className={`hcalc-op-result${result == null ? " empty" : result < 0 ? " neg" : " pos"}`}
          >
            {result == null ? "—" : fmtMin(result)}
          </div>
        </div>

        {result != null && (
          <div className="hcalc-op-field hcalc-op-long-wrap">
            <label className="hcalc-op-lbl">&nbsp;</label>
            <div className="hcalc-op-long">{fmtMinLong(result)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export function HorasCalculadora({ onClose, theme = "dark" }) {
  const { pos, size, onDragStart, onResizeStart } = useDragResize(1060, 620);
  const [cfg, setCfg] = useState(loadCfg);
  const [rows, setRows] = useState(loadRows);
  const [tab, setTab] = useState("tabela"); // 'tabela' | 'op'

  useEffect(() => {
    saveRows(rows);
  }, [rows]);
  useEffect(() => {
    saveCfg(cfg);
  }, [cfg]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const updateCfg = useCallback((k, v) => setCfg((prev) => ({ ...prev, [k]: v })), []);
  const addRow = useCallback(() => setRows((prev) => [...prev, blankRow()]), []);
  const removeRow = useCallback(
    (id) => setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev)),
    [],
  );
  const clearRows = useCallback(
    () => setRows([blankRow(new Date().toISOString().slice(0, 10))]),
    [],
  );
  const updateRow = useCallback(
    (id, k, v) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [k]: v } : r))),
    [],
  );

  const calcs = useMemo(() => rows.map((r) => ({ ...r, ...calcRow(r, cfg) })), [rows, cfg]);

  const totals = useMemo(() => {
    const validRows = calcs.filter((r) => r.valid);
    const plan = validRows.length * cfg.jornada;
    const worked = calcs.reduce((s, r) => s + r.worked, 0);
    const normal = calcs.reduce((s, r) => s + r.normal, 0);
    const he50 = calcs.reduce((s, r) => s + r.he50, 0);
    const he100 = calcs.reduce((s, r) => s + r.he100, 0);
    const falta = calcs.reduce((s, r) => s + r.falta, 0);
    const banco = he50 + he100 - falta;
    const absRate = plan > 0 ? (falta / plan) * 100 : 0;

    const sal = parseFloat(String(cfg.salario || "").replace(",", "."));
    let costHe50 = null,
      costHe100 = null,
      costFalta = null;
    if (Number.isFinite(sal) && sal > 0) {
      const jornadaMensal = cfg.jornada * 22;
      const hrRate = sal / (jornadaMensal / 60);
      costHe50 = (he50 / 60) * hrRate * 0.5;
      costHe100 = (he100 / 60) * hrRate * 1.0;
      costFalta = (falta / 60) * hrRate;
    }
    return {
      plan,
      worked,
      normal,
      he50,
      he100,
      falta,
      banco,
      absRate,
      costHe50,
      costHe100,
      costFalta,
      validDays: validRows.length,
    };
  }, [calcs, cfg]);

  const jornadaH = Math.floor(cfg.jornada / 60);
  const jornadaM = cfg.jornada % 60;
  const limH = Math.floor(cfg.limiteHE1 / 60);
  const limM = cfg.limiteHE1 % 60;

  const exportPdf = useCallback(() => {
    const esc = (v) =>
      String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    const rows_html = calcs
      .map(
        (r) => `
      <tr style="background:${r.falta > 0 ? "rgba(239,68,68,.06)" : r.he50 + r.he100 > 0 ? "rgba(129,140,248,.06)" : ""}">
        <td>${esc(r.date)}</td>
        <td>${esc(DAY_TYPES.find((t) => t.value === r.tipo)?.label || r.tipo)}</td>
        <td>${esc(r.e1 || "—")} / ${esc(r.s1 || "—")}</td>
        <td>${esc(r.e2 || "—")} / ${esc(r.s2 || "—")}</td>
        <td style="text-align:right">${fmtMin(r.worked)}</td>
        <td style="text-align:right">${fmtMin(r.normal)}</td>
        <td style="text-align:right;color:#6366f1">${r.he50 > 0 ? fmtMin(r.he50) : "—"}</td>
        <td style="text-align:right;color:#a855f7">${r.he100 > 0 ? fmtMin(r.he100) : "—"}</td>
        <td style="text-align:right;color:#ef4444">${r.falta > 0 ? fmtMin(r.falta) : "—"}</td>
      </tr>`,
      )
      .join("");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document
      .write(`<!doctype html><html><head><meta charset="utf-8"/><title>Calculadora de Horas</title>
<style>body{font-family:Arial,sans-serif;padding:24px;color:#111}h1{font-size:14px;letter-spacing:.1em;text-transform:uppercase;margin:0 0 16px}
.summary{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:20px}
.card{border:1px solid #e5e7eb;border-radius:8px;padding:10px 14px;min-width:100px}
.card-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;font-weight:600}
.card-val{font-size:18px;font-weight:700;margin-top:2px}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #e5e7eb;padding:6px 8px;font-size:11px}
th{background:#f9fafb;font-weight:700}tfoot td{font-weight:700;background:#f3f4f6}</style></head><body>
<h1>Calculadora de Horas</h1>
<div class="summary">
  <div class="card"><div class="card-lbl">Jornada</div><div class="card-val">${fmtMin(cfg.jornada)}</div></div>
  <div class="card"><div class="card-lbl">Trabalhadas</div><div class="card-val">${fmtMin(totals.worked)}</div></div>
  <div class="card"><div class="card-lbl">HE 50%</div><div class="card-val" style="color:#6366f1">${fmtMin(totals.he50)}</div></div>
  <div class="card"><div class="card-lbl">HE 100%</div><div class="card-val" style="color:#a855f7">${fmtMin(totals.he100)}</div></div>
  <div class="card"><div class="card-lbl">Faltantes</div><div class="card-val" style="color:#ef4444">${fmtMin(totals.falta)}</div></div>
  <div class="card"><div class="card-lbl">Banco Saldo</div><div class="card-val" style="color:${totals.banco >= 0 ? "#22c55e" : "#ef4444"}">${fmtMin(totals.banco)}</div></div>
</div>
<table><thead><tr><th>Data</th><th>Tipo</th><th>Turno 1</th><th>Turno 2</th><th>Trabalhadas</th><th>Normais</th><th>HE 50%</th><th>HE 100%</th><th>Falta</th></tr></thead>
<tbody>${rows_html}</tbody>
<tfoot><tr><td colspan="4">Totais (${totals.validDays}d)</td><td style="text-align:right">${fmtMin(totals.worked)}</td><td style="text-align:right">${fmtMin(totals.normal)}</td><td style="text-align:right">${fmtMin(totals.he50)}</td><td style="text-align:right">${fmtMin(totals.he100)}</td><td style="text-align:right">${fmtMin(totals.falta)}</td></tr></tfoot>
</table></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => {
      try {
        w.print();
      } catch {}
    }, 300);
  }, [calcs, totals, cfg]);

  return createPortal(
    <div className="hcalc-overlay" data-theme={theme}>
      <div
        className="hcalc-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Calculadora de Horas"
        style={{
          transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
          width: size.w,
          height: size.h,
        }}
      >
        {/* Header — drag handle */}
        <div className="hcalc-header" onMouseDown={onDragStart}>
          <div className="hcalc-header-l">
            <span className="hcalc-icon">⏱</span>
            <div>
              <div className="hcalc-title">Calculadora de Horas</div>
              <div className="hcalc-sub">Horas extras · Banco de horas · Absenteísmo</div>
            </div>
          </div>
          <button type="button" className="hcalc-icon-btn" onClick={exportPdf} title="Exportar PDF">
            ⤓ PDF
          </button>
          <button type="button" className="hcalc-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        {/* Config */}
        <div className="hcalc-config-bar">
          <div className="hcalc-cfg-group">
            <label className="hcalc-cfg-lbl">Jornada diária</label>
            <div className="hcalc-time-inp">
              <input
                type="number"
                min="0"
                max="23"
                className="hcalc-num-inp"
                value={jornadaH}
                onChange={(e) =>
                  updateCfg("jornada", parseInt(e.target.value || 0, 10) * 60 + jornadaM)
                }
              />
              <span className="hcalc-sep">h</span>
              <input
                type="number"
                min="0"
                max="59"
                className="hcalc-num-inp"
                value={jornadaM}
                onChange={(e) =>
                  updateCfg("jornada", jornadaH * 60 + parseInt(e.target.value || 0, 10))
                }
              />
              <span className="hcalc-sep">min</span>
            </div>
          </div>
          <div className="hcalc-cfg-group">
            <label className="hcalc-cfg-lbl">Limite HE 50% / dia</label>
            <div className="hcalc-time-inp">
              <input
                type="number"
                min="0"
                max="23"
                className="hcalc-num-inp"
                value={limH}
                onChange={(e) =>
                  updateCfg("limiteHE1", parseInt(e.target.value || 0, 10) * 60 + limM)
                }
              />
              <span className="hcalc-sep">h</span>
              <input
                type="number"
                min="0"
                max="59"
                className="hcalc-num-inp"
                value={limM}
                onChange={(e) =>
                  updateCfg("limiteHE1", limH * 60 + parseInt(e.target.value || 0, 10))
                }
              />
              <span className="hcalc-sep">min</span>
            </div>
          </div>
          <div className="hcalc-cfg-group">
            <label className="hcalc-cfg-lbl">Salário mensal (opcional)</label>
            <div className="hcalc-time-inp">
              <span className="hcalc-sep">R$</span>
              <input
                type="text"
                inputMode="decimal"
                className="hcalc-sal-inp"
                placeholder="0,00"
                value={cfg.salario}
                onChange={(e) => updateCfg("salario", e.target.value)}
              />
            </div>
          </div>

          {/* Tab switcher */}
          <div style={{ marginLeft: "auto", display: "flex", gap: 4, alignSelf: "flex-end" }}>
            <button
              type="button"
              className={`hcalc-tab-btn${tab === "tabela" ? " active" : ""}`}
              onClick={() => setTab("tabela")}
            >
              📋 Tabela
            </button>
            <button
              type="button"
              className={`hcalc-tab-btn${tab === "op" ? " active" : ""}`}
              onClick={() => setTab("op")}
            >
              ⚡ Operações
            </button>
          </div>
        </div>

        {tab === "tabela" ? (
          <>
            {/* Summary cards */}
            <div className="hcalc-cards">
              <div className="hcalc-card hcalc-card-plan">
                <span className="hcalc-card-ico">📋</span>
                <div className="hcalc-card-body">
                  <span className="hcalc-card-lbl">Planejadas</span>
                  <span className="hcalc-card-val">{fmtMinCard(totals.plan)}</span>
                  <span className="hcalc-card-hint">
                    {totals.validDays}d × {fmtMin(cfg.jornada)}
                  </span>
                </div>
              </div>
              <div className="hcalc-card hcalc-card-worked">
                <span className="hcalc-card-ico">⏰</span>
                <div className="hcalc-card-body">
                  <span className="hcalc-card-lbl">Trabalhadas</span>
                  <span className="hcalc-card-val">{fmtMinCard(totals.worked)}</span>
                  <span className="hcalc-card-hint">bruto total</span>
                </div>
              </div>
              <div className="hcalc-card hcalc-card-normal">
                <span className="hcalc-card-ico">✓</span>
                <div className="hcalc-card-body">
                  <span className="hcalc-card-lbl">Normais</span>
                  <span className="hcalc-card-val">{fmtMinCard(totals.normal)}</span>
                  <span className="hcalc-card-hint">dentro da jornada</span>
                </div>
              </div>
              <div className="hcalc-card hcalc-card-he50">
                <span className="hcalc-card-ico">+½</span>
                <div className="hcalc-card-body">
                  <span className="hcalc-card-lbl">HE 50%</span>
                  <span className="hcalc-card-val">{fmtMinCard(totals.he50)}</span>
                  <span className="hcalc-card-hint">
                    {fmtMinLong(totals.he50)}
                    {totals.costHe50 != null && (
                      <>
                        {" "}
                        · <strong>{fmtBRL(totals.costHe50)}</strong>
                      </>
                    )}
                  </span>
                </div>
              </div>
              <div className="hcalc-card hcalc-card-he100">
                <span className="hcalc-card-ico">+1</span>
                <div className="hcalc-card-body">
                  <span className="hcalc-card-lbl">HE 100%</span>
                  <span className="hcalc-card-val">{fmtMinCard(totals.he100)}</span>
                  <span className="hcalc-card-hint">
                    {fmtMinLong(totals.he100)}
                    {totals.costHe100 != null && (
                      <>
                        {" "}
                        · <strong>{fmtBRL(totals.costHe100)}</strong>
                      </>
                    )}
                  </span>
                </div>
              </div>
              <div className="hcalc-card hcalc-card-falta">
                <span className="hcalc-card-ico">✗</span>
                <div className="hcalc-card-body">
                  <span className="hcalc-card-lbl">Faltantes</span>
                  <span className="hcalc-card-val">{fmtMinCard(totals.falta)}</span>
                  <span className="hcalc-card-hint">
                    {totals.absRate.toFixed(1)}% absenteísmo
                    {totals.costFalta != null && (
                      <>
                        {" "}
                        · <strong>{fmtBRL(totals.costFalta)}</strong>
                      </>
                    )}
                  </span>
                </div>
              </div>
              <div
                className={`hcalc-card hcalc-card-banco${totals.banco < 0 ? " negative" : totals.banco > 0 ? " positive" : ""}`}
              >
                <span className="hcalc-card-ico">{totals.banco >= 0 ? "↑" : "↓"}</span>
                <div className="hcalc-card-body">
                  <span className="hcalc-card-lbl">Banco de Horas</span>
                  <span className="hcalc-card-val">{fmtMinCard(Math.abs(totals.banco))}</span>
                  <span className="hcalc-card-hint">
                    {totals.banco >= 0 ? "saldo positivo" : "saldo negativo"}
                  </span>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="hcalc-table-wrap">
              <table className="hcalc-table">
                <thead>
                  <tr>
                    <th className="hcalc-th">Data</th>
                    <th className="hcalc-th">Tipo</th>
                    <th className="hcalc-th hcalc-th-time">Entrada 1</th>
                    <th className="hcalc-th hcalc-th-time">Saída 1</th>
                    <th className="hcalc-th hcalc-th-time">Entrada 2</th>
                    <th className="hcalc-th hcalc-th-time">Saída 2</th>
                    <th className="hcalc-th hcalc-th-r">Trabalhadas</th>
                    <th className="hcalc-th hcalc-th-r">Normais</th>
                    <th className="hcalc-th hcalc-th-r hcalc-th-he50">HE 50%</th>
                    <th className="hcalc-th hcalc-th-r hcalc-th-he100">HE 100%</th>
                    <th className="hcalc-th hcalc-th-r hcalc-th-falta">Falta</th>
                    <th className="hcalc-th" />
                  </tr>
                </thead>
                <tbody>
                  {calcs.map((r) => (
                    <tr
                      key={r.id}
                      className={`hcalc-row${r.falta > 0 ? " row-falta" : r.he50 + r.he100 > 0 ? " row-extra" : r.valid ? " row-ok" : ""}`}
                    >
                      <td className="hcalc-td">
                        <input
                          type="date"
                          className="hcalc-inp hcalc-inp-date"
                          value={r.date}
                          onChange={(e) => updateRow(r.id, "date", e.target.value)}
                        />
                      </td>
                      <td className="hcalc-td">
                        <select
                          className="hcalc-sel"
                          value={r.tipo}
                          onChange={(e) => updateRow(r.id, "tipo", e.target.value)}
                        >
                          {DAY_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="hcalc-td">
                        <input
                          type="time"
                          className="hcalc-inp hcalc-inp-time"
                          value={r.e1}
                          onChange={(e) => updateRow(r.id, "e1", e.target.value)}
                        />
                      </td>
                      <td className="hcalc-td">
                        <input
                          type="time"
                          className="hcalc-inp hcalc-inp-time"
                          value={r.s1}
                          onChange={(e) => updateRow(r.id, "s1", e.target.value)}
                        />
                      </td>
                      <td className="hcalc-td">
                        <input
                          type="time"
                          className="hcalc-inp hcalc-inp-time"
                          value={r.e2}
                          onChange={(e) => updateRow(r.id, "e2", e.target.value)}
                        />
                      </td>
                      <td className="hcalc-td">
                        <input
                          type="time"
                          className="hcalc-inp hcalc-inp-time"
                          value={r.s2}
                          onChange={(e) => updateRow(r.id, "s2", e.target.value)}
                        />
                      </td>
                      <td className="hcalc-td hcalc-td-r">{r.valid ? fmtMin(r.worked) : "—"}</td>
                      <td className="hcalc-td hcalc-td-r c-normal">
                        {r.valid ? fmtMin(r.normal) : "—"}
                      </td>
                      <td className="hcalc-td hcalc-td-r c-he50">
                        {r.he50 > 0 ? fmtMin(r.he50) : "—"}
                      </td>
                      <td className="hcalc-td hcalc-td-r c-he100">
                        {r.he100 > 0 ? fmtMin(r.he100) : "—"}
                      </td>
                      <td className="hcalc-td hcalc-td-r c-falta">
                        {r.falta > 0 ? fmtMin(r.falta) : "—"}
                      </td>
                      <td className="hcalc-td">
                        <button
                          type="button"
                          className="hcalc-del"
                          onClick={() => removeRow(r.id)}
                          aria-label="Remover linha"
                          title="Remover"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="hcalc-foot-row">
                    <td colSpan={6} className="hcalc-foot-lbl">
                      Totais · {totals.validDays} dia{totals.validDays !== 1 ? "s" : ""} com
                      marcação
                    </td>
                    <td className="hcalc-td-r">{fmtMin(totals.worked)}</td>
                    <td className="hcalc-td-r c-normal">{fmtMin(totals.normal)}</td>
                    <td className="hcalc-td-r c-he50">
                      {totals.he50 > 0 ? fmtMin(totals.he50) : "—"}
                    </td>
                    <td className="hcalc-td-r c-he100">
                      {totals.he100 > 0 ? fmtMin(totals.he100) : "—"}
                    </td>
                    <td className="hcalc-td-r c-falta">
                      {totals.falta > 0 ? fmtMin(totals.falta) : "—"}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Footer */}
            <div className="hcalc-footer">
              <button type="button" className="pb-trend-tab" onClick={addRow}>
                + Adicionar dia
              </button>
              <button
                type="button"
                className="pb-trend-tab"
                onClick={clearRows}
                title="Limpar todos os dias"
              >
                Limpar
              </button>
              <div style={{ flex: 1 }} />
              <button type="button" className="pb-trend-tab is-active" onClick={onClose}>
                Fechar
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
              <HorasOp theme={theme} />
            </div>
            <div className="hcalc-footer">
              <div style={{ flex: 1 }} />
              <button type="button" className="pb-trend-tab is-active" onClick={onClose}>
                Fechar
              </button>
            </div>
          </>
        )}

        {/* Resize handle */}
        <div className="hcalc-resize-handle" onMouseDown={onResizeStart} />
      </div>
    </div>,
    document.body,
  );
}

export default HorasCalculadora;
