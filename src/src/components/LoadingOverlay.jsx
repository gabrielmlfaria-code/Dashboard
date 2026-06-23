import { createPortal } from "react-dom";
import "./loadingOverlay.css";

/**
 * Overlay de carregamento em tela cheia ("Aguarde, processando…").
 * Exibido enquanto os dados iniciais do painel são buscados.
 */
export function LoadingOverlay({
  theme = "light",
  title = "Aguarde, processando…",
  subtitle = "Estamos carregando os dados do painel. Isso pode levar alguns instantes.",
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="mp-load"
      data-theme={theme}
      role="status"
      aria-live="polite"
      aria-label={title}
    >
      <div className="mp-load-card">
        <div className="mp-load-spinner" aria-hidden="true" />
        <div className="mp-load-text">
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
        <div className="mp-load-bar" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default LoadingOverlay;
