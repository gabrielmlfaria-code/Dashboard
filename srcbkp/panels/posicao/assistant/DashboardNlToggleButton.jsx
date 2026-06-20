import React, { forwardRef } from "react";

export const DashboardNlToggleButton = forwardRef(function DashboardNlToggleButton(
  { modalOpen, onOpen },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className="dnl-toggle"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-expanded={modalOpen}
      aria-controls="dnl-modal"
      aria-label="Abrir Assistente de Dados"
      title="Abrir Assistente de Dados"
    >
      <span className="dnl-toggle-ico" aria-hidden>
        💬
      </span>
      <span className="dnl-toggle-label">Assistente</span>
    </button>
  );
});
