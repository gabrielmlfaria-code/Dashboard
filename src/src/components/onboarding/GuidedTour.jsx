import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const SPOT_PAD = 8;
const GAP = 14;
const MARGIN = 12;
const TOUR_TEXT_OVERRIDES_KEY = "mp_posicao_tour_text_overrides_v1";

function loadTextOverrides() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(TOUR_TEXT_OVERRIDES_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveTextOverrides(overrides) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOUR_TEXT_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch {
    /* storage indisponível — segue sem persistir */
  }
}

function isTextInputTarget(target) {
  const tag = target?.tagName?.toLowerCase?.();
  return tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable;
}

function measureTarget(selector) {
  if (typeof document === "undefined" || !selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { el, rect: r };
}

/** Calcula a posição do tooltip a partir do retângulo do alvo. */
function computeTipPos(rect, tipSize, placement) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const { w, h } = tipSize;

  if (!rect) {
    return { top: (vh - h) / 2, left: (vw - w) / 2, centered: true };
  }

  const spot = {
    top: rect.top - SPOT_PAD,
    left: rect.left - SPOT_PAD,
    right: rect.right + SPOT_PAD,
    bottom: rect.bottom + SPOT_PAD,
  };

  const order =
    placement === "right" ? ["right", "left", "bottom", "top"]
    : placement === "left" ? ["left", "right", "bottom", "top"]
    : placement === "top" ? ["top", "bottom", "right", "left"]
    : ["bottom", "top", "right", "left"];

  const fits = {
    bottom: vh - spot.bottom - GAP >= h,
    top: spot.top - GAP >= h,
    right: vw - spot.right - GAP >= w,
    left: spot.left - GAP >= w,
  };

  const chosen = order.find((p) => fits[p]) || "bottom";
  let top;
  let left;

  if (chosen === "bottom" || chosen === "top") {
    left = rect.left + rect.width / 2 - w / 2;
    top = chosen === "bottom" ? spot.bottom + GAP : spot.top - GAP - h;
  } else {
    top = rect.top + rect.height / 2 - h / 2;
    left = chosen === "right" ? spot.right + GAP : spot.left - GAP - w;
  }

  left = Math.max(MARGIN, Math.min(left, vw - w - MARGIN));
  top = Math.max(MARGIN, Math.min(top, vh - h - MARGIN));
  return { top, left, centered: false };
}

export function GuidedTour({
  steps = [],
  startIndex = 0,
  theme = "light",
  onClose,
  onComplete,
  onStepView,
}) {
  const [index, setIndex] = useState(startIndex);
  const [target, setTarget] = useState(null);
  const [tipPos, setTipPos] = useState(null);
  const [textOverrides, setTextOverrides] = useState(loadTextOverrides);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: "", body: "", why: "" });
  const tipRef = useRef(null);
  const step = steps[index];
  const displayStep = step ? { ...step, ...(textOverrides[step.id] || {}) } : null;
  const total = steps.length;

  const recalc = useCallback(() => {
    const t = step ? measureTarget(step.selector) : null;
    setTarget(t);
  }, [step]);

  useEffect(() => {
    if (!step) return undefined;
    const t = measureTarget(step.selector);
    setTarget(t);
    if (t?.el) {
      try {
        t.el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      } catch {
        t.el.scrollIntoView();
      }
    }
    onStepView?.(step.id);
    const reflow = window.setTimeout(recalc, 340);
    return () => window.clearTimeout(reflow);
  }, [step, recalc, onStepView]);

  useEffect(() => {
    const handler = () => recalc();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [recalc]);

  useLayoutEffect(() => {
    const node = tipRef.current;
    const size = node ?
        { w: node.offsetWidth, h: node.offsetHeight }
      : { w: 360, h: 220 };
    setTipPos(computeTipPos(target?.rect ?? null, size, step?.placement));
  }, [target, step, index, editing, draft]);

  const goTo = useCallback(
    (next) => {
      if (next < 0) return;
      if (next >= total) {
        onComplete?.();
        return;
      }
      setIndex(next);
    },
    [total, onComplete],
  );

  const beginEdit = useCallback(() => {
    if (!displayStep) return;
    setDraft({
      title: displayStep.title || "",
      body: displayStep.body || "",
      why: displayStep.why || "",
    });
    setEditing(true);
  }, [displayStep]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
  }, []);

  const saveEdit = useCallback(() => {
    if (!step) return;
    const next = {
      ...textOverrides,
      [step.id]: {
        title: draft.title.trim() || step.title,
        body: draft.body.trim() || step.body,
        why: draft.why.trim(),
      },
    };
    setTextOverrides(next);
    saveTextOverrides(next);
    setEditing(false);
  }, [draft, step, textOverrides]);

  useEffect(() => {
    setEditing(false);
  }, [step?.id]);

  useEffect(() => {
    const onKey = (e) => {
      const key = String(e.key || "").toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === "e") {
        e.preventDefault();
        if (editing) cancelEdit();
        else beginEdit();
        return;
      }
      if (editing) {
        if (e.key === "Escape") {
          e.preventDefault();
          cancelEdit();
        } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          saveEdit();
        }
        return;
      }
      if (isTextInputTarget(e.target)) return;
      if (e.key === "Escape") onClose?.();
      else if (e.key === "ArrowRight") goTo(index + 1);
      else if (e.key === "ArrowLeft") goTo(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [beginEdit, cancelEdit, editing, goTo, index, onClose, saveEdit]);

  if (!step || typeof document === "undefined") return null;

  const rect = target?.rect;
  const isLast = index === total - 1;

  return createPortal(
    <div className="mp-ob" data-theme={theme} role="dialog" aria-modal="true" aria-label="Tour guiado">
      <div className="mp-ob-overlay" aria-hidden="true">
        {rect ? (
          <div
            className="mp-ob-spot"
            style={{
              top: rect.top - SPOT_PAD,
              left: rect.left - SPOT_PAD,
              width: rect.width + SPOT_PAD * 2,
              height: rect.height + SPOT_PAD * 2,
            }}
          />
        ) : (
          <div className="mp-ob-spot" style={{ inset: 0, opacity: 0 }} />
        )}
      </div>

      {/* bloqueia cliques no resto da tela durante o tour */}
      <div className="mp-ob-click-block" onClick={onClose} />

      <div
        ref={tipRef}
        className="mp-ob-tip"
        style={{
          top: tipPos?.top ?? "50%",
          left: tipPos?.left ?? "50%",
          visibility: tipPos ? "visible" : "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mp-ob-tip-head">
          <span className="mp-ob-step-count">
            {index + 1} / {total}
          </span>
          <h3 className="mp-ob-tip-title">{displayStep.title}</h3>
          <button
            type="button"
            className={`mp-ob-edit-toggle${editing ? " is-active" : ""}`}
            onClick={editing ? cancelEdit : beginEdit}
            aria-label={editing ? "Cancelar edição do texto" : "Editar texto deste passo"}
            title="Editar texto (Ctrl+E)"
          >
            Editar
          </button>
          <button
            type="button"
            className="mp-ob-close"
            onClick={onClose}
            aria-label="Fechar tour"
            title="Fechar"
          >
            ×
          </button>
        </div>

        {editing ? (
          <div className="mp-ob-editor" aria-label="Editar texto do tour">
            <label>
              <span>Título</span>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => setDraft((current) => ({ ...current, title: e.target.value }))}
              />
            </label>
            <label>
              <span>Texto</span>
              <textarea
                rows={4}
                value={draft.body}
                onChange={(e) => setDraft((current) => ({ ...current, body: e.target.value }))}
              />
            </label>
            <label>
              <span>Por que importa</span>
              <textarea
                rows={3}
                value={draft.why}
                onChange={(e) => setDraft((current) => ({ ...current, why: e.target.value }))}
              />
            </label>
            <div className="mp-ob-editor-actions">
              <span>Atalho: Ctrl+Enter salva · Esc cancela</span>
              <button type="button" className="mp-ob-btn" onClick={cancelEdit}>
                Cancelar
              </button>
              <button type="button" className="mp-ob-btn mp-ob-btn-primary" onClick={saveEdit}>
                Salvar
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="mp-ob-tip-body">{displayStep.body}</p>

            {displayStep.why ? (
              <div className="mp-ob-why">
                <span className="mp-ob-why-ico" aria-hidden="true">
                  💡
                </span>
                <span>
                  <b>Por que importa:</b> {displayStep.why}
                </span>
              </div>
            ) : null}
          </>
        )}

        <div className="mp-ob-tip-foot">
          <div className="mp-ob-dots" aria-hidden="true">
            {steps.map((s, i) => (
              <span
                key={s.id}
                className={`mp-ob-dot${i === index ? " is-active" : ""}${i < index ? " is-done" : ""}`}
              />
            ))}
          </div>
          {index > 0 ? (
            <button type="button" className="mp-ob-btn" onClick={() => goTo(index - 1)}>
              Anterior
            </button>
          ) : (
            <button type="button" className="mp-ob-btn mp-ob-btn-ghost" onClick={onClose}>
              Pular
            </button>
          )}
          <button type="button" className="mp-ob-btn mp-ob-btn-primary" onClick={() => goTo(index + 1)}>
            {isLast ? "Concluir" : "Próximo"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default GuidedTour;
