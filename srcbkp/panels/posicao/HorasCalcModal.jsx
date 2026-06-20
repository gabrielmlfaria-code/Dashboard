import React, { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { getDateMeta } from "./calendarUtils";
import "./HorasCalcModal.css";

const TOL_KEY = "hcm_tolerances";
const THEME_KEY = "hcm_theme";
const POS_KEY = "hcm_pos";
const MIN_ROWS = 4; // always show at least E1 S1 E2 S2

function lsr(key, def) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : def;
  } catch {
    return def;
  }
}
function lsw(key, v) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
}

function toMin(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{1,2}):(\d{2})$/);
  return m ? +m[1] * 60 + +m[2] : null;
}
function normalizeMins(rawMins) {
  const mins = rawMins.slice();
  for (let i = 1; i < mins.length; i++) {
    if (mins[i] == null) continue;
    let prev = null;
    for (let j = i - 1; j >= 0; j--) {
      if (mins[j] != null) {
        prev = mins[j];
        break;
      }
    }
    if (prev != null && mins[i] < prev) {
      for (let j = i; j < mins.length; j++) {
        if (mins[j] != null) mins[j] += 1440;
      }
    }
  }
  return mins;
}
function fmtM(n, withSign = false) {
  if (n == null || isNaN(n)) return "—";
  const sign = n < 0 ? "-" : withSign ? "+" : "";
  const a = Math.abs(Math.round(n));
  return `${sign}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
}
function parseHor(s) {
  if (!s) return { prefix: "", times: [] };
  const m = s.match(/^([^-]+-\s*)(.*)/);
  const prefix = m ? m[1].trim() : "";
  const part = m ? m[2] : s;
  return {
    prefix,
    times: part
      .trim()
      .split(/\s+/)
      .filter((t) => /^\d{1,2}:\d{2}$/.test(t)),
  };
}
function parseMrc(s) {
  if (!s) return [];
  return s
    .trim()
    .split(/\s+/)
    .filter((t) => /^\d{1,2}:\d{2}$/.test(t));
}

export default function HorasCalcModal({ ev, onClose }) {
  const [tols, setTols] = useState(() => lsr(TOL_KEY, { entrada: 5, saida: 5, extra: 10 }));
  const [tolsOpen, setTolsOpen] = useState(false);
  const [theme, setTheme] = useState(() => lsr(THEME_KEY, "dark"));
  const clamp = useCallback(
    ({ x, y }) => ({
      x: Math.max(0, Math.min(window.innerWidth - 480, x)),
      y: Math.max(0, Math.min(window.innerHeight - 60, y)),
    }),
    [],
  );

  const [pos, setPos] = useState(() => {
    const saved = lsr(POS_KEY, null);
    const raw = saved ?? { x: Math.max(20, window.innerWidth / 2 - 240), y: 60 };
    // clamp inline (clamp callback not available here yet)
    return {
      x: Math.max(0, Math.min(window.innerWidth - 480, raw.x)),
      y: Math.max(0, Math.min(window.innerHeight - 60, raw.y)),
    };
  });

  useEffect(() => {
    lsw(TOL_KEY, tols);
  }, [tols]);
  useEffect(() => {
    lsw(THEME_KEY, theme);
  }, [theme]);
  useEffect(() => {
    lsw(POS_KEY, pos);
  }, [pos]);

  const { prefix: horPrefix, times: rawHorTimes } = useMemo(
    () => parseHor(ev.horario),
    [ev.horario],
  );

  // Always at least MIN_ROWS, rounded up to even (complete pairs)
  const numRows = useMemo(() => {
    const n = Math.max(rawHorTimes.length, MIN_ROWS);
    return n % 2 === 0 ? n : n + 1;
  }, [rawHorTimes.length]);

  const horTimes = useMemo(
    () => Array.from({ length: numRows }, (_, i) => rawHorTimes[i] || ""),
    [rawHorTimes, numRows],
  );

  const [mrcTimes, setMrcTimes] = useState(() => {
    const p = parseMrc(ev.marcacao);
    return Array.from({ length: numRows }, (_, i) => p[i] || "");
  });

  const setMrc = useCallback(
    (i, val) =>
      setMrcTimes((p) => {
        const n = [...p];
        n[i] = val;
        return n;
      }),
    [],
  );

  const normHorMins = useMemo(() => normalizeMins(horTimes.map(toMin)), [horTimes]);
  const normMrcMins = useMemo(() => normalizeMins(mrcTimes.map(toMin)), [mrcTimes]);

  const dateMeta = useMemo(() => getDateMeta(ev.data), [ev.data]);

  const calc = useMemo(() => {
    const pairs = numRows / 2;
    let planTotal = 0,
      realTotal = 0,
      atrasoTotal = 0,
      antecTotal = 0;
    const pairData = [];

    for (let p = 0; p < pairs; p++) {
      const ei = p * 2,
        si = p * 2 + 1;
      const ePlan = normHorMins[ei];
      const sPlan = normHorMins[si];
      const eReal = normMrcMins[ei];
      const sReal = normMrcMins[si];
      if (ePlan != null && sPlan != null) planTotal += sPlan - ePlan;
      if (eReal != null && sReal != null) realTotal += sReal - eReal;
      const eDelta = ePlan != null && eReal != null ? eReal - ePlan : null;
      const sDelta = sPlan != null && sReal != null ? sReal - sPlan : null;
      if (eDelta != null && eDelta > tols.entrada) atrasoTotal += eDelta; // total, não só excesso
      if (sDelta != null && sDelta < -tols.saida) antecTotal += Math.abs(sDelta); // total, não só excesso
      pairData.push({ ei, si, ePlan, sPlan, eReal, sReal, eDelta, sDelta });
    }

    const diff = realTotal - planTotal;
    const extra = diff > tols.extra ? diff : 0; // total, não só excesso
    const deficit = diff < 0 ? Math.abs(diff) : 0;
    return { planTotal, realTotal, diff, extra, deficit, atrasoTotal, antecTotal };
  }, [normHorMins, normMrcMins, tols, numRows]);

  const onDragStart = useCallback(
    (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const sx = e.clientX - pos.x,
        sy = e.clientY - pos.y;
      const move = (me) => setPos(clamp({ x: me.clientX - sx, y: me.clientY - sy }));
      const up = () => {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    },
    [pos, clamp],
  );

  const diffSign = calc.diff > 0 ? "pos" : calc.diff < 0 ? "neg" : "";

  return (
    <div className="hcm-root">
      <div className={`hcm-float ${theme}`} style={{ left: pos.x, top: pos.y }}>
        {/* ── Header ── */}
        <div className="hcm-header" onMouseDown={onDragStart}>
          <span className="hcm-hdr-icon">⏱</span>
          <span className="hcm-hdr-title">Calculadora de Horas</span>
          <button
            type="button"
            className={`hcm-hdr-btn${tolsOpen ? " on" : ""}`}
            onClick={() => setTolsOpen((v) => !v)}
            title="Tolerâncias"
          >
            ⚙
          </button>
          <button
            type="button"
            className="hcm-hdr-btn"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            title={theme === "dark" ? "Tema claro" : "Tema escuro"}
          >
            {theme === "dark" ? "☀" : "🌙"}
          </button>
          <button
            type="button"
            className="hcm-hdr-btn"
            title="Reposicionar"
            onClick={() => setPos(clamp({ x: Math.max(20, window.innerWidth / 2 - 240), y: 60 }))}
          >
            ⊹
          </button>
          <button type="button" className="hcm-hdr-btn hcm-hdr-x" onClick={onClose}>
            ×
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="hcm-body">
          {/* ── Employee info ── */}
          <div className="hcm-info">
            <div className="hcm-info-name">
              {ev.mat && <span className="hcm-info-mat">{ev.mat}</span>}
              {ev.nome || "—"}
            </div>
            <div className="hcm-info-sub">
              {dateMeta ? (
                <>
                  <span>{dateMeta.label}</span>
                  <span className="hcm-sep-dot">·</span>
                  <span>{dateMeta.dowLabel}</span>
                  {dateMeta.feriado && <span className="hcm-feriado">{dateMeta.feriado}</span>}
                </>
              ) : (
                ev.data || ""
              )}
              {horPrefix && (
                <>
                  <span className="hcm-sep-dot">·</span>
                  <span className="hcm-hor-cod">Hor. {horPrefix}</span>
                </>
              )}
            </div>
            {ev.evento && <div className="hcm-info-evt">{ev.evento}</div>}
          </div>

          {/* ── Tolerances ── */}
          {tolsOpen && (
            <div className="hcm-tols">
              <TolField
                label="Entrada"
                value={tols.entrada}
                onChange={(v) => setTols((p) => ({ ...p, entrada: v }))}
              />
              <TolField
                label="Saída"
                value={tols.saida}
                onChange={(v) => setTols((p) => ({ ...p, saida: v }))}
              />
              <TolField
                label="Extra >"
                value={tols.extra}
                onChange={(v) => setTols((p) => ({ ...p, extra: v }))}
              />
            </div>
          )}

          {/* ── Timeline ── */}
          <Timeline
            normHorMins={normHorMins}
            normMrcMins={normMrcMins}
            horTimes={horTimes}
            mrcTimes={mrcTimes}
            numRows={numRows}
            tols={tols}
          />

          {/* ── Punch grid ── */}
          <div className="hcm-grid">
            <div className="hcm-grid-hd">
              <span>Batida</span>
              <span>Planejado</span>
              <span>Marcação</span>
              <span className="hcm-grid-hd-delta">Δ</span>
            </div>
            {horTimes.map((planTime, i) => {
              const isIn = i % 2 === 0;
              const period = Math.floor(i / 2) + 1;
              const pMin = normHorMins[i];
              const rMin = normMrcMins[i];
              const delta = pMin != null && rMin != null ? rMin - pMin : null;
              const tol = isIn ? tols.entrada : tols.saida;
              const issue = isIn ? delta != null && delta > tol : delta != null && delta < -tol;

              return (
                <div key={i} className={`hcm-row${isIn ? " in" : " out"}${issue ? " issue" : ""}`}>
                  <span className="hcm-punch-lbl">
                    <span className={`hcm-punch-arrow ${isIn ? "in" : "out"}`}>
                      {isIn ? "▶" : "◀"}
                    </span>
                    <span className="hcm-punch-tag">{isIn ? `E${period}` : `S${period}`}</span>
                  </span>
                  <span className="hcm-plan-t">
                    {planTime || <span className="hcm-empty-t">—</span>}
                  </span>
                  <span className="hcm-real-t">
                    <input
                      type="text"
                      className={`hcm-t-inp${isIn ? " in" : " out"}${issue ? " issue" : ""}`}
                      value={mrcTimes[i]}
                      placeholder="--:--"
                      maxLength={5}
                      onChange={(e) => setMrc(i, e.target.value)}
                    />
                  </span>
                  <span className={`hcm-delta${delta == null ? " nil" : issue ? " bad" : " ok"}`}>
                    {delta == null ? (
                      "—"
                    ) : delta === 0 ? (
                      <span className="hcm-chk">✓</span>
                    ) : (
                      <>
                        {delta > 0 ? "+" : ""}
                        {fmtM(Math.abs(delta))}
                        {issue && <span className="hcm-wrn">!</span>}
                      </>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {/* ── Results ── */}
          <div className="hcm-results">
            <div className="hcm-res-row">
              <span className="hcm-res-lbl">Planejado</span>
              <span className="hcm-res-val">{fmtM(calc.planTotal)}</span>
            </div>
            <div className="hcm-res-row">
              <span className="hcm-res-lbl">Trabalhado</span>
              {calc.planTotal > 0 && (
                <div className="hcm-bar-wrap">
                  <div className="hcm-bar">
                    <div
                      className={`hcm-bar-fill ${diffSign || "neutral"}`}
                      style={{
                        width: `${Math.min(100, Math.max(3, (calc.realTotal / calc.planTotal) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              )}
              <span className={`hcm-res-val${diffSign ? ` ${diffSign}` : ""}`}>
                {fmtM(calc.realTotal)}
              </span>
            </div>
            <div className={`hcm-res-row diff${diffSign ? ` ${diffSign}` : ""}`}>
              <span className="hcm-res-lbl">Diferença</span>
              <span className="hcm-res-val">{fmtM(calc.diff, true)}</span>
            </div>

            <div className="hcm-line-sep" />

            <div className={`hcm-res-row${calc.atrasoTotal > 0 ? " neg" : ""}`}>
              <span className="hcm-res-lbl">
                Atraso <span className="hcm-tol-note">(tol. {tols.entrada} min)</span>
              </span>
              <span className="hcm-res-val">{fmtM(calc.atrasoTotal)}</span>
            </div>
            <div className={`hcm-res-row${calc.antecTotal > 0 ? " neg" : ""}`}>
              <span className="hcm-res-lbl">
                Saída antecipada <span className="hcm-tol-note">(tol. {tols.saida} min)</span>
              </span>
              <span className="hcm-res-val">{fmtM(calc.antecTotal)}</span>
            </div>
            <div className={`hcm-res-row${calc.extra > 0 ? " pos" : ""}`}>
              <span className="hcm-res-lbl">
                Hora extra <span className="hcm-tol-note">(&gt; {tols.extra} min)</span>
              </span>
              <span className="hcm-res-val">{fmtM(calc.extra)}</span>
            </div>
          </div>

          {/* ── Operações de horas ── */}
          <OpsSection theme={theme} />
        </div>
        {/* end hcm-body */}
      </div>
    </div>
  );
}

/* ── Visual timeline ── */
function Timeline({ normHorMins, normMrcMins, horTimes, mrcTimes, numRows, tols }) {
  const pairs = numRows / 2;

  // Collect all valid minute values (already normalized for midnight crossing)
  const allMins = [];
  for (let i = 0; i < numRows; i++) {
    const ph = normHorMins[i];
    if (ph != null) allMins.push(ph);
    const pm = normMrcMins[i];
    if (pm != null) allMins.push(pm);
  }
  if (allMins.length < 2) return null;

  const pad = 20;
  const minT = Math.min(...allMins) - pad;
  const maxT = Math.max(...allMins) + pad;
  const span = maxT - minT;
  if (span <= 0) return null;

  const pct = (t) => `${((t - minT) / span) * 100}%`;
  const wPct = (s, e) => `${Math.max(0.5, ((e - s) / span) * 100)}%`;

  // Build period data using normalized values
  const periods = [];
  for (let p = 0; p < pairs; p++) {
    const ei = p * 2,
      si = p * 2 + 1;
    const ePlan = normHorMins[ei];
    const sPlan = normHorMins[si];
    const eReal = normMrcMins[ei];
    const sReal = normMrcMins[si];
    const isLate = ePlan != null && eReal != null && eReal - ePlan > tols.entrada;
    const isEarly = sPlan != null && sReal != null && sPlan - sReal > tols.saida;
    const hasOT = sPlan != null && sReal != null && sReal - sPlan > tols.extra;
    periods.push({
      p,
      ePlan,
      sPlan,
      eReal,
      sReal,
      isLate,
      isEarly,
      hasOT,
      hasIssue: isLate || isEarly,
    });
  }

  // Whole-hour axis ticks within range
  const firstH = Math.ceil(minT / 60) * 60;
  const hours = [];
  for (let h = firstH; h <= maxT; h += 60) hours.push(h);

  return (
    <div className="hcm-tl">
      {/* Plan row */}
      <div className="hcm-tl-row">
        <span className="hcm-tl-lbl">Plan.</span>
        <div className="hcm-tl-track">
          {periods.map(({ p, ePlan, sPlan }, i) => (
            <React.Fragment key={p}>
              {ePlan != null && sPlan != null && (
                <div
                  className="hcm-tl-bar plan"
                  style={{ left: pct(ePlan), width: wPct(ePlan, sPlan) }}
                />
              )}
              {/* interval stripe between consecutive periods */}
              {i < periods.length - 1 && sPlan != null && periods[i + 1].ePlan != null && (
                <div
                  className="hcm-tl-bar interval"
                  style={{ left: pct(sPlan), width: wPct(sPlan, periods[i + 1].ePlan) }}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Real row */}
      <div className="hcm-tl-row">
        <span className="hcm-tl-lbl">Real</span>
        <div className="hcm-tl-track">
          {periods.map(({ p, sPlan, eReal, sReal, hasIssue, hasOT }) => {
            if (eReal == null || sReal == null) return null;
            const normalEnd = hasOT && sPlan != null ? sPlan : sReal;
            return (
              <React.Fragment key={p}>
                <div
                  className={`hcm-tl-bar real${hasIssue ? " issue" : ""}`}
                  style={{ left: pct(eReal), width: wPct(eReal, normalEnd) }}
                  title={`${horTimes[p * 2] || "—"} → ${mrcTimes[p * 2] || "—"}`}
                />
                {hasOT && sPlan != null && (
                  <div
                    className="hcm-tl-bar extra"
                    style={{ left: pct(sPlan), width: wPct(sPlan, sReal) }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Hour axis */}
      <div className="hcm-tl-row hcm-tl-axis-row">
        <span className="hcm-tl-lbl" />
        <div className="hcm-tl-axis">
          {hours.map((h) => (
            <div key={h} className="hcm-tl-tick" style={{ left: pct(h) }}>
              {String(Math.floor((h % 1440) / 60)).padStart(2, "0")}h
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="hcm-tl-legend">
        <span className="hcm-tl-leg-item">
          <span className="hcm-tl-leg-dot plan" />
          Planejado
        </span>
        <span className="hcm-tl-leg-item">
          <span className="hcm-tl-leg-dot real" />
          Normal
        </span>
        <span className="hcm-tl-leg-item">
          <span className="hcm-tl-leg-dot issue" />
          Atraso/Antecip.
        </span>
        <span className="hcm-tl-leg-item">
          <span className="hcm-tl-leg-dot extra" />
          Extra
        </span>
      </div>
    </div>
  );
}

function TolField({ label, value, onChange }) {
  return (
    <label className="hcm-tol-field">
      <span className="hcm-tol-lbl">{label}</span>
      <div className="hcm-tol-ctrl">
        <button
          type="button"
          className="hcm-tol-step"
          onClick={() => onChange(Math.max(0, value - 1))}
        >
          −
        </button>
        <input
          type="number"
          className="hcm-tol-num"
          value={value}
          min={0}
          max={120}
          onChange={(e) => onChange(Math.max(0, +e.target.value || 0))}
        />
        <button
          type="button"
          className="hcm-tol-step"
          onClick={() => onChange(Math.min(120, value + 1))}
        >
          +
        </button>
        <span className="hcm-tol-unit">min</span>
      </div>
    </label>
  );
}

/* ── Arithmetic operations section ── */
const OPS = [
  { id: "+", label: "+", title: "Adição" },
  { id: "-", label: "−", title: "Subtração" },
  { id: "×", label: "×", title: "Multiplicação (HH:MM × número)" },
  { id: "÷", label: "÷", title: "Divisão (HH:MM ÷ número)" },
];

function OpsSection() {
  const [op1, setOp1] = useState("");
  const [op2, setOp2] = useState("");
  const [oper, setOper] = useState("+");

  const isScalar = oper === "×" || oper === "÷";

  const result = useMemo(() => {
    const a = toMin(op1);
    if (a == null) return null;

    if (!isScalar) {
      const b = toMin(op2);
      if (b == null) return null;
      const r = oper === "+" ? a + b : a - b;
      return { min: r, label: fmtM(r, r > 0 && oper === "-" ? false : false) };
    } else {
      const b = parseFloat(op2.replace(",", "."));
      if (isNaN(b) || b === 0) return null;
      const r = oper === "×" ? Math.round(a * b) : Math.round(a / b);
      return { min: r, label: fmtM(r) };
    }
  }, [op1, op2, oper, isScalar]);

  const resAccent = result == null ? "" : result.min < 0 ? " neg" : result.min > 0 ? " pos" : "";

  return (
    <div className="hcm-ops">
      <div className="hcm-ops-title">Operações de horas</div>
      <div className="hcm-ops-row">
        {/* Operand 1 — always HH:MM */}
        <input
          type="text"
          className="hcm-ops-inp"
          value={op1}
          placeholder="HH:MM"
          maxLength={5}
          onChange={(e) => setOp1(e.target.value)}
        />

        {/* Operation selector */}
        <div className="hcm-ops-btns">
          {OPS.map((o) => (
            <button
              key={o.id}
              type="button"
              title={o.title}
              className={`hcm-ops-btn${oper === o.id ? " active" : ""}`}
              onClick={() => setOper(o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Operand 2 — HH:MM for +/-, number for ×/÷ */}
        <input
          type="text"
          className="hcm-ops-inp"
          value={op2}
          placeholder={isScalar ? "0.5" : "HH:MM"}
          maxLength={isScalar ? 8 : 5}
          onChange={(e) => setOp2(e.target.value)}
        />

        {/* Equals + result */}
        <span className="hcm-ops-eq">=</span>
        <span className={`hcm-ops-result${resAccent}`}>{result ? result.label : "—"}</span>

        {/* Clear */}
        {(op1 || op2) && (
          <button
            type="button"
            className="hcm-ops-clear"
            title="Limpar"
            onClick={() => {
              setOp1("");
              setOp2("");
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
