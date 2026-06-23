import { useCallback, useEffect, useRef, useState } from "react";
import { GuidedTour } from "./GuidedTour.jsx";
import { HelpCenter } from "./HelpCenter.jsx";
import {
  ONBOARDING_STORAGE_KEY,
  POSICAO_CHECKLIST,
  POSICAO_DIA_AGORA_TOUR_STEPS,
  POSICAO_GLOSSARY,
  POSICAO_TOUR_STEPS,
} from "./posicaoTourContent.js";
import "./onboarding.css";

function loadState() {
  if (typeof window === "undefined") return { tourSeen: false, completed: {} };
  try {
    const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return { tourSeen: false, completed: {} };
    const parsed = JSON.parse(raw);
    return {
      tourSeen: !!parsed.tourSeen,
      completed: parsed.completed && typeof parsed.completed === "object" ? parsed.completed : {},
    };
  } catch {
    return { tourSeen: false, completed: {} };
  }
}

function saveState(state) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage indisponível — segue sem persistir */
  }
}

/**
 * Orquestra o auto-treinamento do painel "Posição do Dia": launcher flutuante,
 * tour guiado, central de ajuda (checklist + glossário) e persistência.
 *
 * Aciona via eventos globais:
 *  - "posicao:open-tour"     → abre o tour guiado geral
 *  - "posicao:open-card-help"→ abre o tour guiado de um card específico
 *  - "posicao:open-help"     → abre a central de ajuda
 *  - "posicao:open-glossary" → abre a central de ajuda (foco no glossário)
 */
export function PosicaoOnboarding({ theme = "light", autoStart = false }) {
  const [state, setState] = useState(loadState);
  const [tourOpen, setTourOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [tourSteps, setTourSteps] = useState(POSICAO_TOUR_STEPS);
  const initRef = useRef(false);

  const persist = useCallback((updater) => {
    setState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveState(next);
      return next;
    });
  }, []);

  const markCompleted = useCallback(
    (id) => {
      persist((prev) =>
        prev.completed[id] ?
          { ...prev, completed: { ...prev.completed, [id]: false } }
        : { ...prev, completed: { ...prev.completed, [id]: true } },
      );
    },
    [persist],
  );

  const startTour = useCallback((steps = POSICAO_TOUR_STEPS) => {
    setTourSteps(steps);
    setHelpOpen(false);
    setTourOpen(true);
  }, []);

  const finishTour = useCallback(() => {
    setTourOpen(false);
    persist((prev) => ({
      ...prev,
      tourSeen: true,
      completed: { ...prev.completed, tour: true },
    }));
  }, [persist]);

  const closeTour = useCallback(() => {
    setTourOpen(false);
    persist((prev) => ({ ...prev, tourSeen: true }));
  }, [persist]);

  // Auto-início no primeiro acesso.
  useEffect(() => {
    if (initRef.current) return undefined;
    initRef.current = true;
    if (autoStart && !state.tourSeen) {
      const t = window.setTimeout(() => setTourOpen(true), 900);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [autoStart, state.tourSeen]);

  // Eventos globais (botão da topbar, checklist etc.).
  useEffect(() => {
    const openTour = () => startTour();
    const openCardHelp = (event) => {
      const card = event?.detail?.card;
      if (card === "posicao-dia-agora") {
        startTour(POSICAO_DIA_AGORA_TOUR_STEPS);
        return;
      }
      startTour();
    };
    const openHelp = () => setHelpOpen(true);
    const openGlossary = () => {
      setHelpOpen(true);
      persist((prev) => ({ ...prev, completed: { ...prev.completed, glossario: true } }));
    };
    window.addEventListener("posicao:open-tour", openTour);
    window.addEventListener("posicao:open-card-help", openCardHelp);
    window.addEventListener("posicao:open-help", openHelp);
    window.addEventListener("posicao:open-glossary", openGlossary);
    return () => {
      window.removeEventListener("posicao:open-tour", openTour);
      window.removeEventListener("posicao:open-card-help", openCardHelp);
      window.removeEventListener("posicao:open-help", openHelp);
      window.removeEventListener("posicao:open-glossary", openGlossary);
    };
  }, [startTour, persist]);

  const handleItemAction = useCallback(
    (eventName) => {
      if (eventName === "posicao:open-tour") startTour();
      else if (eventName === "posicao:open-glossary") {
        /* já está na central; apenas garante o item marcado */
      } else if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(eventName));
      }
    },
    [startTour],
  );

  return (
    <>
      <HelpCenter
        open={helpOpen}
        theme={theme}
        checklist={POSICAO_CHECKLIST}
        glossary={POSICAO_GLOSSARY}
        completed={state.completed}
        onToggleItem={markCompleted}
        onItemAction={handleItemAction}
        onStartTour={startTour}
        onClose={() => setHelpOpen(false)}
      />

      {tourOpen ? (
        <GuidedTour
          steps={tourSteps}
          theme={theme}
          onClose={closeTour}
          onComplete={finishTour}
        />
      ) : null}
    </>
  );
}

export default PosicaoOnboarding;
