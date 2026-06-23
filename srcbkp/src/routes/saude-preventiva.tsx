import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SaudePreventivaCard } from "../panels/posicao/SaudePreventivaCard.jsx";
import { resolveEmpresaLabel } from "../panels/posicao/saudePreventivaCampanhas.js";
import { readSaudePreventivaOpenContext } from "../panels/posicao/saudePreventivaOpen.js";
import "../panels/posicao/posicao-bento.css";

export const Route = createFileRoute("/saude-preventiva")({
  component: SaudePreventivaPage,
});

function SaudePreventivaPage() {
  const [theme, setTheme] = useState("light");
  const ctx = useMemo(() => readSaudePreventivaOpenContext() || {}, []);

  useEffect(() => {
    const readTheme = () => {
      try {
        const t = JSON.parse(localStorage.getItem("mp_theme") || '"light"');
        setTheme(t === "dark" ? "dark" : "light");
      } catch {
        setTheme("light");
      }
    };
    readTheme();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "mp_theme") readTheme();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("mp_theme", JSON.stringify(next));
      return next;
    });
  }, []);

  const periodoLabel = typeof ctx.periodoLabel === "string" ? ctx.periodoLabel : "";
  const histRows = Array.isArray(ctx.histRows) ? ctx.histRows : [];
  const empresaLabel =
    typeof ctx.empresaLabel === "string" && ctx.empresaLabel
      ? ctx.empresaLabel
      : resolveEmpresaLabel(histRows);

  return (
    <>
      <div className="saude-preventiva-page" data-theme={theme}>
        <main className="saude-preventiva-page-main">
          <div className="pos-bento" data-theme={theme}>
            <SaudePreventivaCard
              periodoLabel={periodoLabel}
              empresaLabel={empresaLabel}
              histRows={histRows}
              theme={theme}
              onToggleTheme={toggleTheme}
              showBackLink
            />
          </div>
        </main>
      </div>
    </>
  );
}
