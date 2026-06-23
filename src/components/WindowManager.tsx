import { useEffect } from "react";

/**
 * Ativa drag (via .wm-header) e resize (handles inseridos dinamicamente)
 * para todos os elementos .wm-window. Redimensionamento interno dos painéis
 * #cpPosicao .panel via .panel-rz (limitado ao container #cpPosicao).
 */
export function WindowManager() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const HANDLES = ["n", "s", "e", "w", "nw", "ne", "sw", "se"] as const;
    const LS_WIN = "wm_win_state_v1";
    const LS_PANELS = "wm_panel_order_v1";

    function loadMap(key: string): Record<string, unknown> {
      try {
        return JSON.parse(localStorage.getItem(key) || "{}") || {};
      } catch {
        return {};
      }
    }
    function saveMap(key: string, map: Record<string, unknown>) {
      try {
        localStorage.setItem(key, JSON.stringify(map));
      } catch {
        // Ignore persistence failures; window dragging should continue working.
      }
    }
    function persistWin(win: HTMLElement) {
      if (!win.id) return;
      const map = loadMap(LS_WIN);
      map[win.id] = {
        left: win.style.left,
        top: win.style.top,
        width: win.style.width,
        height: win.style.height,
      };
      saveMap(LS_WIN, map);
    }
    function restoreWin(win: HTMLElement) {
      if (!win.id || win.dataset.wmRestored === "1") return;
      win.dataset.wmRestored = "1";
      const map = loadMap(LS_WIN);
      const s = map[win.id] as
        | { left?: string; top?: string; width?: string; height?: string }
        | undefined;
      if (!s) return;
      if (s.left) win.style.left = s.left;
      if (s.top) win.style.top = s.top;
      if (s.width) win.style.width = s.width;
      if (s.height) win.style.height = s.height;
    }
    function persistPanelOrder() {
      const root = document.getElementById("cpPosicao");
      if (!root) return;
      const order: string[] = [];
      root.querySelectorAll<HTMLElement>(".panel").forEach((p) => {
        if (p.id) order.push(p.id);
      });
      saveMap(LS_PANELS, { order });
    }
    function restorePanelOrder() {
      const root = document.getElementById("cpPosicao");
      if (!root) return;
      const map = loadMap(LS_PANELS);
      const order: string[] = Array.isArray(map.order) ? map.order : [];
      if (!order.length) return;
      order.forEach((id) => {
        const el = document.getElementById(id);
        if (el && el.parentElement) el.parentElement.appendChild(el);
      });
    }

    function clampSizeToViewport(
      left: number,
      top: number,
      width: number,
      height: number,
      minWidth: number,
      minHeight: number,
    ) {
      const maxWidth = Math.max(minWidth, window.innerWidth - Math.max(0, left));
      const maxHeight = Math.max(minHeight, window.innerHeight - Math.max(0, top));
      return {
        width: Math.min(maxWidth, Math.max(minWidth, width)),
        height: Math.min(maxHeight, Math.max(minHeight, height)),
      };
    }

    function clampBoxToViewport(
      left: number,
      top: number,
      width: number,
      height: number,
      minWidth: number,
      minHeight: number,
    ) {
      let l = Math.max(0, left);
      let t = Math.max(0, top);
      let w = Math.max(minWidth, width);
      let h = Math.max(minHeight, height);
      ({ width: w, height: h } = clampSizeToViewport(l, t, w, h, minWidth, minHeight));
      if (l + w > window.innerWidth) l = Math.max(0, window.innerWidth - w);
      if (t + h > window.innerHeight) t = Math.max(0, window.innerHeight - h);
      ({ width: w, height: h } = clampSizeToViewport(l, t, w, h, minWidth, minHeight));
      return { left: l, top: t, width: w, height: h };
    }

    function applyPanelUserSize(panel: HTMLElement, width: number, height: number) {
      panel.classList.add("panel-user-sized");
      panel.style.flex = "0 0 auto";
      panel.style.flexBasis = `${width}px`;
      panel.style.flexGrow = "0";
      panel.style.flexShrink = "0";
      panel.style.width = `${width}px`;
      panel.style.minWidth = `${width}px`;
      panel.style.maxWidth = `${width}px`;
      panel.style.height = `${height}px`;
      panel.style.minHeight = `${height}px`;
    }

    function clampPanelResizeToContainer(
      panel: HTMLElement,
      anchorLeft: number,
      anchorTop: number,
      width: number,
      height: number,
      minWidth: number,
      minHeight: number,
    ) {
      const container = panel.closest<HTMLElement>("#cpPosicao") || panel.parentElement;
      const bounds = container?.getBoundingClientRect();
      const maxWidth = bounds
        ? Math.max(minWidth, Math.min(bounds.width, bounds.right - anchorLeft))
        : Math.max(minWidth, window.innerWidth - anchorLeft);
      const maxHeight = bounds
        ? Math.max(minHeight, bounds.bottom - anchorTop)
        : Math.max(minHeight, window.innerHeight - anchorTop);
      return {
        width: Math.min(maxWidth, Math.max(minWidth, width)),
        height: Math.min(maxHeight, Math.max(minHeight, height)),
      };
    }

    function ensureHandles(win: HTMLElement) {
      if (win.dataset.wmHandles === "1") return;
      win.dataset.wmHandles = "1";
      const cs = getComputedStyle(win);
      if (cs.position === "static") win.style.position = "fixed";
      HANDLES.forEach((dir) => {
        const h = document.createElement("div");
        h.className = `wm-rz wm-rz-${dir}`;
        h.dataset.dir = dir;
        win.appendChild(h);
      });
      restoreWin(win);
    }

    function bringToFront(win: HTMLElement) {
      document.querySelectorAll<HTMLElement>(".wm-window").forEach((w) => {
        w.style.zIndex = "600";
      });
      win.style.zIndex = "900";
    }

    function startDrag(win: HTMLElement, ev: PointerEvent) {
      const rect = win.getBoundingClientRect();
      const offX = ev.clientX - rect.left;
      const offY = ev.clientY - rect.top;
      win.classList.add("dragging");
      bringToFront(win);
      const onMove = (e: PointerEvent) => {
        const x = Math.max(0, Math.min(window.innerWidth - 60, e.clientX - offX));
        const y = Math.max(0, Math.min(window.innerHeight - 30, e.clientY - offY));
        win.style.left = x + "px";
        win.style.top = y + "px";
        win.style.right = "auto";
        win.style.bottom = "auto";
      };
      const onUp = () => {
        win.classList.remove("dragging");
        persistWin(win);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    }

    function startResize(win: HTMLElement, dir: string, ev: PointerEvent) {
      const rect = win.getBoundingClientRect();
      const startX = ev.clientX;
      const startY = ev.clientY;
      const startW = rect.width;
      const startH = rect.height;
      const startL = rect.left;
      const startT = rect.top;
      const minW = 320;
      const minH = 200;
      win.classList.add("resizing");
      bringToFront(win);
      const onMove = (e: PointerEvent) => {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        let w = startW;
        let h = startH;
        let l = startL;
        let t = startT;
        if (dir.includes("e")) w = Math.max(minW, startW + dx);
        if (dir.includes("s")) h = Math.max(minH, startH + dy);
        if (dir.includes("w")) {
          w = Math.max(minW, startW - dx);
          l = startL + (startW - w);
        }
        if (dir.includes("n")) {
          h = Math.max(minH, startH - dy);
          t = startT + (startH - h);
        }
        ({ left: l, top: t, width: w, height: h } = clampBoxToViewport(l, t, w, h, minW, minH));
        win.style.width = w + "px";
        win.style.height = h + "px";
        win.style.left = l + "px";
        win.style.top = t + "px";
        win.style.right = "auto";
        win.style.bottom = "auto";
      };
      const onUp = () => {
        win.classList.remove("resizing");
        persistWin(win);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    }

    function swapPanels(a: HTMLElement, b: HTMLElement) {
      const aParent = a.parentElement;
      const bParent = b.parentElement;
      if (!aParent || !bParent || a === b) return;

      const aNext = a.nextSibling === b ? a : a.nextSibling;
      const bNext = b.nextSibling === a ? b : b.nextSibling;
      bParent.insertBefore(a, bNext);
      aParent.insertBefore(b, aNext);
    }

    function startPanelSwapDrag(panel: HTMLElement, ev: PointerEvent) {
      const rect = panel.getBoundingClientRect();
      const offX = ev.clientX - rect.left;
      const offY = ev.clientY - rect.top;
      let dropTarget: HTMLElement | null = null;

      const ghost = panel.cloneNode(true) as HTMLElement;
      ghost.className = `${panel.className} ghost`;
      ghost.removeAttribute("id");
      ghost.style.width = rect.width + "px";
      ghost.style.height = rect.height + "px";
      ghost.style.left = rect.left + "px";
      ghost.style.top = rect.top + "px";
      ghost.style.margin = "0";
      document.body.appendChild(ghost);

      panel.classList.add("dragging");
      document.body.style.cursor = "grabbing";

      const clearDropTarget = () => {
        if (dropTarget) dropTarget.classList.remove("panel-drop-target");
        dropTarget = null;
      };

      const onMove = (e: PointerEvent) => {
        const x = Math.max(0, Math.min(window.innerWidth - rect.width, e.clientX - offX));
        const y = Math.max(0, Math.min(window.innerHeight - rect.height, e.clientY - offY));
        ghost.style.left = x + "px";
        ghost.style.top = y + "px";

        const under = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
        const candidate = under?.closest<HTMLElement>("#cpPosicao .panel");
        if (candidate && candidate !== panel) {
          if (candidate !== dropTarget) {
            clearDropTarget();
            dropTarget = candidate;
            dropTarget.classList.add("panel-drop-target");
          }
        } else {
          clearDropTarget();
        }
      };

      const onUp = () => {
        if (dropTarget) {
          swapPanels(panel, dropTarget);
          persistPanelOrder();
        }
        clearDropTarget();
        panel.classList.remove("dragging");
        ghost.remove();
        document.body.style.cursor = "";
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    }

    const onPointerDown = (ev: PointerEvent) => {
      const target = ev.target as HTMLElement | null;
      if (!target) return;

      // Resize handle nos modais
      const rzHandle = target.closest<HTMLElement>(".wm-rz");
      if (rzHandle) {
        const win = rzHandle.closest<HTMLElement>(".wm-window");
        if (win) {
          ev.preventDefault();
          startResize(win, rzHandle.dataset.dir || "se", ev);
          return;
        }
      }

      // Drag pelo header dos modais
      const header = target.closest<HTMLElement>(".wm-header");
      if (header) {
        // Não iniciar drag se clicou em botão dentro do header
        if (target.closest("button, input, select, a")) return;
        const win = header.closest<HTMLElement>(".wm-window");
        if (win) {
          ev.preventDefault();
          startDrag(win, ev);
          return;
        }
      }

      // Foco no modal ao clicar
      const win = target.closest<HTMLElement>(".wm-window");
      if (win) bringToFront(win);

      // Drag dos painéis (chart-panel / panel) via .panel-header
      const pHeader = target.closest<HTMLElement>(".panel-header");
      if (pHeader && !target.closest("button, input, select, a, .panel-actions")) {
        const panel = pHeader.closest<HTMLElement>("#cpPosicao .panel");
        if (panel) {
          ev.preventDefault();
          startPanelSwapDrag(panel, ev);
          return;
        }
      }

      // Resize dos sub-painéis via .panel-rz (canto inf. direito)
      const subRz = target.closest<HTMLElement>(".panel-rz");
      if (subRz) {
        const panel = subRz.closest<HTMLElement>("#cpPosicao .panel");
        if (!panel) return;
        ev.preventDefault();
        const rect = panel.getBoundingClientRect();
        const startX = ev.clientX;
        const startY = ev.clientY;
        const startW = rect.width;
        const startH = rect.height;
        const anchorLeft = rect.left;
        const anchorTop = rect.top;
        const onMove = (e: PointerEvent) => {
          const nextW = Math.max(220, startW + (e.clientX - startX));
          const nextH = Math.max(160, startH + (e.clientY - startY));
          const { width, height } = clampPanelResizeToContainer(
            panel,
            anchorLeft,
            anchorTop,
            nextW,
            nextH,
            220,
            160,
          );
          applyPanelUserSize(panel, width, height);
        };
        const onUp = () => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          // Persiste o tamanho final para restaurar no próximo carregamento
          try {
            const panelId = panel.id;
            if (panelId) {
              const map: Record<string, { w?: number; h?: number }> =
                JSON.parse(localStorage.getItem("pp_panel_sizes") || "{}") || {};
              map[panelId] = {
                w: Math.round(parseFloat(panel.style.width || String(panel.offsetWidth))),
                h: Math.round(parseFloat(panel.style.height || String(panel.offsetHeight))),
              };
              localStorage.setItem("pp_panel_sizes", JSON.stringify(map));
            }
          } catch {
            // ignore
          }
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        return;
      }
    };

    document.addEventListener("pointerdown", onPointerDown);

    // Observa novas .wm-window e injeta handles
    const ensureAll = () => {
      document.querySelectorAll<HTMLElement>(".wm-window").forEach(ensureHandles);
    };
    let panelOrderRestored = false;
    const tryRestorePanels = () => {
      if (panelOrderRestored) return;
      const root = document.getElementById("cpPosicao");
      if (!root || !root.querySelector(".panel")) return;
      restorePanelOrder();
      panelOrderRestored = true;
    };
    ensureAll();
    tryRestorePanels();
    const mo = new MutationObserver(() => {
      ensureAll();
      tryRestorePanels();
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      mo.disconnect();
    };
  }, []);

  return null;
}
