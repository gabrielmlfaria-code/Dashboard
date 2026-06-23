import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

export function HelpCenter({
  open,
  theme = "light",
  checklist = [],
  glossary = [],
  completed = {},
  onToggleItem,
  onItemAction,
  onStartTour,
  onClose,
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const doneCount = useMemo(
    () => checklist.filter((it) => completed[it.id]).length,
    [checklist, completed],
  );
  const pct = checklist.length ? Math.round((doneCount / checklist.length) * 100) : 0;

  const filteredGlossary = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return glossary;
    return glossary.filter(
      (g) => g.term.toLowerCase().includes(q) || g.def.toLowerCase().includes(q),
    );
  }, [glossary, query]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="mp-ob" data-theme={theme}>
      <div className="mp-ob-scrim" onClick={onClose} />
      <aside className="mp-ob-drawer" role="dialog" aria-modal="true" aria-label="Central de ajuda">
        <div className="mp-ob-drawer-head">
          <div className="mp-ob-drawer-head-row">
            <h2 className="mp-ob-drawer-title">Central de Ajuda</h2>
            <button
              type="button"
              className="mp-ob-close"
              onClick={onClose}
              aria-label="Fechar"
              title="Fechar"
            >
              ×
            </button>
          </div>
          <p className="mp-ob-drawer-sub">
            Aprenda o painel no seu ritmo: faça o tour, acompanhe os primeiros passos e consulte o
            glossário quando precisar.
          </p>
        </div>

        <div className="mp-ob-drawer-body">
          <section className="mp-ob-section">
            <button type="button" className="mp-ob-hero-card" onClick={onStartTour}>
              <span className="mp-ob-hero-ico" aria-hidden="true">
                🎯
              </span>
              <span className="mp-ob-hero-txt">
                <strong>Iniciar tour guiado</strong>
                <span>Conheça cada elemento da tela em ~1 minuto</span>
              </span>
            </button>
          </section>

          <section className="mp-ob-section">
            <div className="mp-ob-section-title">Comece por aqui</div>
            <div className="mp-ob-progress">
              <div className="mp-ob-progress-track">
                <div className="mp-ob-progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="mp-ob-progress-label">
                {doneCount}/{checklist.length}
              </span>
            </div>
            <ul className="mp-ob-check">
              {checklist.map((item) => {
                const done = !!completed[item.id];
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`mp-ob-check-item${done ? " is-done" : ""}`}
                      onClick={() => {
                        onToggleItem?.(item.id);
                        if (!done && item.event) onItemAction?.(item.event);
                      }}
                    >
                      <span className="mp-ob-check-box" aria-hidden="true">
                        {done ? "✓" : ""}
                      </span>
                      <span className="mp-ob-check-txt">
                        <strong>{item.label}</strong>
                        {item.hint ? <span>{item.hint}</span> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="mp-ob-section">
            <div className="mp-ob-section-title">Glossário</div>
            <input
              type="text"
              className="mp-ob-search"
              placeholder="Buscar termo…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar no glossário"
            />
            <div className="mp-ob-gloss">
              {filteredGlossary.length === 0 ? (
                <div className="mp-ob-empty">Nenhum termo encontrado.</div>
              ) : (
                filteredGlossary.map((g) => (
                  <div className="mp-ob-gloss-item" key={g.term}>
                    <div className="mp-ob-gloss-term">{g.term}</div>
                    <div className="mp-ob-gloss-def">{g.def}</div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </aside>
    </div>,
    document.body,
  );
}

export default HelpCenter;
