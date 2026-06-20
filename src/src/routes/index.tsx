import { createFileRoute } from "@tanstack/react-router";
import { CONFIG } from "../configLocal";
import { WindowManager } from "../components/WindowManager";
import { PosicaoDiaPanel } from "../panels/posicao/PosicaoDiaPanel.jsx";

if (CONFIG.USE_MOCK) {
  await Promise.all([import("../mocks/mockPosicao.js"), import("../mocks/mockAbsenteismo.js")]);
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard Radar Trabalhista" },
      { name: "description", content: "Dashboard Radar Trabalhista Macchips" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <>
      {/* Modais (shell vazio — o conteúdo é portado via createPortal pelo painel) */}
      <div
        id="posListModal"
        className="wm-window"
        style={{ position: "fixed", left: 80, top: 80, width: 1100, height: 640 }}
      >
        <div className="wm-header">
          <span id="posListTitle" className="wm-title">
            Lista
          </span>
          <span id="posListSub" className="wm-sub" style={{ display: "none" }} />
          <span id="posListHdrDate" className="wm-meta" />
          <span id="posListHdrUpd" className="wm-meta" />
          <div className="wm-actions" style={{ marginLeft: "auto" }}>
            <button id="posListThemeBtn" type="button" className="wm-btn" title="Alternar tema">
              🌙
            </button>
            <button id="posListExpandBtn" type="button" className="wm-btn">
              ⤢
            </button>
            <button type="button" className="wm-btn" data-wm-cls="posListModal">
              ✕
            </button>
          </div>
        </div>
        <div id="posListCanvasWrap" className="wm-body" />
      </div>

      <div
        id="deptModal"
        className="wm-window"
        style={{ position: "fixed", left: 120, top: 100, width: 980, height: 600 }}
      >
        <div className="wm-header">
          <span id="deptTitle" className="wm-title">
            Departamentos
          </span>
          <span id="deptSub" className="wm-sub" />
          <div className="wm-actions" style={{ marginLeft: "auto" }}>
            <button id="deptThemeBtn" type="button" className="wm-btn" title="Alternar tema">
              🌙
            </button>
            <button id="deptPngBtn" type="button" className="wm-btn">
              PNG
            </button>
            <button id="deptTableToggle" type="button" className="wm-btn">
              Tabela
            </button>
            <button id="deptExpandBtn" type="button" className="wm-btn">
              ⤢
            </button>
            <button type="button" className="wm-btn cls" data-wm-cls="deptModal">
              ✕
            </button>
          </div>
        </div>
        <div id="deptCtrl" className="bm-ctrl" />
        <div id="deptCanvasWrap" className="wm-body" />
        <div id="deptLegend" className="wm-legend" />
      </div>

      <div
        id="posBarModal"
        className="wm-window"
        style={{ position: "fixed", left: 160, top: 120, width: 900, height: 560 }}
      >
        <div className="wm-header">
          <span className="wm-title">Gráfico</span>
          <span id="pos_barModalMeta" className="wm-meta" />
          <div className="wm-actions" style={{ marginLeft: "auto" }}>
            <button type="button" className="wm-btn" data-wm-cls="posBarModal">
              ✕
            </button>
          </div>
        </div>
        <div className="wm-body">
          <canvas id="pos_barChart" />
        </div>
      </div>

      <WindowManager />
      <PosicaoDiaPanel />
    </>
  );
}
