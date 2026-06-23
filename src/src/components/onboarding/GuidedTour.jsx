import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const SPOT_PAD = 8;
const GAP = 14;
const MARGIN = 12;

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
  const tipRef = useRef(null);
  const step = steps[index];
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
  }, [target, step, index]);

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

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      else if (e.key === "ArrowRight") goTo(index + 1);
      else if (e.key === "ArrowLeft") goTo(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, goTo, onClose]);

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
          <h3 className="mp-ob-tip-title">{step.title}</h3>
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

        <p className="mp-ob-tip-body">{step.body}</p>

        {step.why ? (
          <div className="mp-ob-why">
            <span className="mp-ob-why-ico" aria-hidden="true">
              💡
            </span>
            <span>
              <b>Por que importa:</b> {step.why}
            </span>
          </div>
        ) : null}

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
