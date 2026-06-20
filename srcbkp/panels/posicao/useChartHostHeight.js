import { useEffect, useState } from "react";

/**
 * Mede a altura do container (px) para o ApexCharts.
 * Mantém fallback até o flex layout entregar altura real.
 */
export function useChartHostHeight(
  ref,
  { enabled = true, minHeight = 120, fallbackHeight = 300 } = {},
) {
  const [height, setHeight] = useState(fallbackHeight);

  useEffect(() => {
    if (!enabled) return undefined;
    const el = ref.current;
    if (!el) return undefined;

    const sync = () => {
      const next = Math.floor(el.getBoundingClientRect().height);
      if (next >= minHeight) setHeight(next);
    };

    sync();
    requestAnimationFrame(() => requestAnimationFrame(sync));
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    window.addEventListener("resize", sync);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [enabled, minHeight, fallbackHeight]);

  return height;
}

/** Altura + largura — largura só para debug/layout; gráficos usam width="100%". */
export function useChartHostSize(ref, options = {}) {
  const height = useChartHostHeight(ref, options);
  return { height, width: 0 };
}
