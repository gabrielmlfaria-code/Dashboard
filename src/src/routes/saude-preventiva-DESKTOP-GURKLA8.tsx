import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SaudePreventivaCard } from "../panels/posicao/saude-preventiva/SaudePreventivaCard.jsx";
import { resolveEmpresaLabel } from "../panels/posicao/saude-preventiva/saudePreventivaCampanhas.js";
import { readSaudePreventivaOpenContext } from "../panels/posicao/saude-preventiva/saudePreventivaOpen.js";
import "../panels/posicao/posicao-bento.css";

export const Route = createFileRoute("/saude-preventiva-DESKTOP-GURKLA8")({
  head: () => ({
    meta: [
      { title: "Lei nº 15.377/2026 — Campanhas de Saúde" },
      {
        name: "description",
        content:
          "Gestão de campanhas de saúde e conformidade com a Lei 15.377/2026 (arts. 169-A e 473, CLT).",
      },
    ],
  }),
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
