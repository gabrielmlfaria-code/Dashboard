import { useCallback, useEffect, useRef, useState } from "react";

const LAYOUT_KEY = "rt_playbook_panel_layout_v1";
const MIN_W = 520;
const MIN_H = 380;
const DEFAULT_W = 960;
const DEFAULT_H = 640;

function readLayout() {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLayout(layout) {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    /* ignore */
  }
}

function clampLayout(layout) {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const w = Math.max(MIN_W, Math.min(layout.w, vw - 24));
  const h = Math.max(MIN_H, Math.min(layout.h, vh - 24));
  const x = Math.max(8, Math.min(layout.x, vw - w - 8));
  const y = Math.max(8, Math.min(layout.y, vh - h - 8));
  return { x, y, w, h };
}

function defaultLayout() {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const w = Math.min(DEFAULT_W, vw - 32);
  const h = Math.min(DEFAULT_H, vh - 32);
  return clampLayout({
    x: Math.round((vw - w) / 2),
    y: Math.round((vh - h) / 2),
    w,
    h,
  });
}

/**
 * Painel flutuante: arrastar pelo cabeçalho e redimensionar pelo canto inferior direito.
 */
export function useRtPlaybookPanelLayout() {
  const layoutRef = useRef(clampLayout(readLayout() || defaultLayout()));
  const [layout, setLayout] = useState(layoutRef.current);
  const dragRef = useRef(null);
  const resizeRef = useRef(null);

  layoutRef.current = layout;

  useEffect(() => {
    const onResize = () => {
      const next = clampLayout(layoutRef.current);
      layoutRef.current = next;
      setLayout(next);
      writeLayout(next);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const persistLayout = useCallback((next) => {
    const clamped = clampLayout(next);
    layoutRef.current = clamped;
    setLayout(clamped);
    writeLayout(clamped);
  }, []);

  const onDragStart = useCallback((e) => {
    if (e.button !== 0) return;
    const t = e.target;
    if (t.closest("button, a, input, textarea, select, .rt-pb-resize-handle")) return;
    e.preventDefault();
    const L = layoutRef.current;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: L.x,
      originY: L.y,
      w: L.w,
      h: L.h,
    };

    const onMove = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      persistLayout({
        x: d.originX + (ev.clientX - d.startX),
        y: d.originY + (ev.clientY - d.startY),
        w: d.w,
        h: d.h,
      });
    };

    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [persistLayout]);

  const onResizeStart = useCallback((e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const L = layoutRef.current;
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originW: L.w,
      originH: L.h,
      x: L.x,
      y: L.y,
    };

    const onMove = (ev) => {
      const r = resizeRef.current;
      if (!r) return;
      persistLayout({
        x: r.x,
        y: r.y,
        w: r.originW + (ev.clientX - r.startX),
        h: r.originH + (ev.clientY - r.startY),
      });
    };

    const onUp = () => {
      resizeRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [persistLayout]);

  const panelStyle = {
    position: "fixed",
    left: layout.x,
    top: layout.y,
    width: layout.w,
    height: layout.h,
    zIndex: 12051,
  };

  const resetLayout = useCallback(() => {
    persistLayout(defaultLayout());
  }, [persistLayout]);

  return { panelStyle, onDragStart, onResizeStart, resetLayout, layout };
}
