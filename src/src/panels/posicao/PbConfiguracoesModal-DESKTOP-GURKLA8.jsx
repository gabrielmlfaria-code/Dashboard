import React, { useEffect, useMemo, useState } from "react";
import { HorasConfigPanel } from "./HorasConfigModal.jsx";
import { PbConfigImportacoesTab } from "./PbConfigImportacoesTab.jsx";
import { PbConfigMetasTab } from "./PbConfigMetasTab.jsx";

export const PB_CFG_TABS = [
  { id: "importacoes", label: "Importações" },
  { id: "metas", label: "Metas" },
  { id: "horas", label: "Categorias de horas" },
];

export function PbConfiguracoesModal({
  theme = "light",
  initialTab = "metas",
  onClose,
  allowedTabs = {},
  metasTabProps,
  importTabProps,
  horasTabProps,
}) {
  const [showImportacoes, setShowImportacoes] = useState(false);

  const visibleTabs = useMemo(
    () =>
      PB_CFG_TABS.filter(
        (item) =>
          allowedTabs[item.id] !== false &&
          (item.id !== "importacoes" || showImportacoes),
      ),
    [allowedTabs, showImportacoes],
  );

  const firstTab = visibleTabs[0]?.id || "metas";
  const resolvedInitial = initialTab === "importacoes" ? "metas" : initialTab;

  const [tab, setTab] = useState(
    visibleTabs.some((item) => item.id === resolvedInitial)
      ? resolvedInitial
      : firstTab,
  );

  useEffect(() => {
    const next = initialTab === "importacoes" ? "metas" : initialTab;
    setTab(visibleTabs.some((item) => item.id === next) ? next : firstTab);
  }, [firstTab, initialTab, visibleTabs]);

  // Switch away from importacoes if it becomes hidden
  useEffect(() => {
    if (!showImportacoes && tab === "importacoes") {
      setTab("metas");
    }
  }, [showImportacoes]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        onClose?.();
        return;
      }
      if (e.ctrlKey && (e.key === "i" || e.key === "I")) {
        e.preventDefault();
        setShowImportacoes((prev) => {
          if (!prev) setTab("importacoes");
          return !prev;
        });
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isWide = tab === "horas";

  return (
    <div
      className={`pb-cfg-overlay${isWide ? " pb-cfg-overlay--wide" : ""}`}
      data-theme={theme}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={`pb-cfg-modal${isWide ? " is-wide" : ""}`}
        role="dialog"
        aria-label="Configurações"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="pb-cfg-head">
          <span className="pb-cfg-title">⚙ Configurações</span>
          <button type="button" className="pb-cfg-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="pb-cfg-tabs" role="tablist" aria-label="Seções de configuração">
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              className={`pb-cfg-tab${tab === t.id ? " is-active" : ""}`}
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.id === "importacoes" ? (
                <span className="pb-cfg-tab-badge" title="Entrada de dados provisória até a API">
                  Provisório
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <div className={`pb-cfg-body${isWide ? " pb-cfg-body--horas" : ""}`}>
          {tab === "importacoes" && <PbConfigImportacoesTab {...importTabProps} />}
          {tab === "metas" && <PbConfigMetasTab {...metasTabProps} />}
          {tab === "horas" && (
            <HorasConfigPanel embedded onClose={onClose} {...horasTabProps} />
          )}
        </div>

        {tab !== "horas" && (
          <div className="pb-cfg-foot">
            <div style={{ flex: 1 }} />
            <button type="button" className="pb-btn pb-btn-primary" onClick={onClose}>
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
