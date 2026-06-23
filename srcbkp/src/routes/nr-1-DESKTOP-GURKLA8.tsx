import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Nr1Card } from "../panels/posicao/nr1/Nr1Card.jsx";
import { resolveEmpresaLabel } from "../panels/posicao/saude-preventiva/saudePreventivaCampanhas.js";
import { readNr1OpenContext } from "../panels/posicao/nr1/nr1Open.js";
import "../panels/posicao/posicao-bento.css";

export const Route = createFileRoute("/nr-1-DESKTOP-GURKLA8")({
  component: Nr1Page,
});

function Nr1Page() {
  const [theme, setTheme] = useState("light");
  const ctx = useMemo(() => readNr1OpenContext() || {}, []);

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

  const histRows = Array.isArray(ctx.histRows) ? ctx.histRows : [];
  const empresaLabel =
    typeof ctx.empresaLabel === "string" && ctx.empresaLabel
      ? ctx.empresaLabel
      : resolveEmpresaLabel(histRows);

  return (
    <>
      <div className="nr1-page" data-theme={theme}>
        <main className="nr1-page-main">
          <div className="pos-bento" data-theme={theme}>
            <Nr1Card
              empresaLabel={empresaLabel}
              histRows={histRows}
              showBackLink
              theme={theme}
              onToggleTheme={toggleTheme}
            />
          </div>
        </main>
      </div>
    </>
  );
}
