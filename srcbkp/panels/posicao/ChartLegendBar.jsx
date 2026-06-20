import React, { useCallback, useEffect, useState } from "react";
import ApexCharts from "apexcharts";

export const PB_CHART_IDS = {
  abs: "pb-abs-chart",
  pres: "pb-pres-chart",
  hrs: "pb-hrs-chart",
};

export function toggleChartSeries(chartId, seriesName) {
  if (!chartId || !seriesName) return;
  try {
    ApexCharts.exec(chartId, "toggleSeries", seriesName);
  } catch {
    /* chart ainda montando */
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function downloadPngBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function captureHtmlElement(element, { backgroundColor, scale }) {
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const { default: html2canvas } = await import("html2canvas");
  return html2canvas(element, {
    backgroundColor,
    scale,
    useCORS: true,
    logging: false,
    width: element.scrollWidth,
    height: element.scrollHeight,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
    onclone: (clonedDocument) => {
      clonedDocument.querySelectorAll("[data-html2canvas-ignore]").forEach((node) => {
        node.style.setProperty("display", "none", "important");
      });
    },
  });
}

/**
 * Desenha os cards KPI a partir do DOM (html2canvas falha com color-mix / flex).
 */
function drawKpisCanvasFromDom(kpisEl, { theme = "light", scale = 1, maxWidth = 720 }) {
  const cards = [...kpisEl.querySelectorAll(".pb-abs-kpi")];
  if (!cards.length) return null;

  const parsed = cards.map((el) => {
    const label = el.querySelector(":scope > span")?.textContent?.trim() || "";
    const strong = el.querySelector(":scope > strong")?.textContent?.trim() || "";
    const em = el.querySelector(":scope > em")?.textContent?.trim() || "";
    let valueColor = theme === "dark" ? "#f1f5f9" : "#0f172a";
    if (el.classList.contains("is-ok")) valueColor = "#16a34a";
    if (el.classList.contains("is-bad")) valueColor = "#dc2626";
    if (el.classList.contains("is-warn")) valueColor = "#b45309";
    return { label, strong, em, valueColor, isWarn: el.classList.contains("is-warn") };
  });

  const outerPad = Math.round(8 * scale);
  const gap = Math.round(8 * scale);
  const cardMinW = Math.round(118 * scale);
  const cardH = Math.round(54 * scale);
  const innerPad = Math.round(8 * scale);
  const cols = Math.max(
    1,
    Math.min(parsed.length, Math.floor((maxWidth - outerPad * 2 + gap) / (cardMinW + gap))),
  );
  const cardW = Math.floor((maxWidth - outerPad * 2 - gap * (cols - 1)) / cols);
  const rows = Math.ceil(parsed.length / cols);
  const height = outerPad * 2 + rows * cardH + Math.max(0, rows - 1) * gap;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(maxWidth, 1);
  canvas.height = Math.max(height, 1);
  const ctx = canvas.getContext("2d");
  const bg = theme === "dark" ? "#0f172a" : "#ffffff";
  const border = theme === "dark" ? "rgba(148,163,184,0.35)" : "rgba(148,163,184,0.28)";
  const labelColor = theme === "dark" ? "#94a3b8" : "#64748b";
  const subColor = theme === "dark" ? "#64748b" : "#94a3b8";
  const warnBg = theme === "dark" ? "rgba(245,158,11,0.15)" : "rgba(245,158,11,0.08)";

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const labelSize = Math.round(9 * scale);
  const valueSize = Math.round(13 * scale);
  const subSize = Math.round(9 * scale);

  parsed.forEach((card, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = outerPad + col * (cardW + gap);
    const y = outerPad + row * (cardH + gap);

    ctx.fillStyle = card.isWarn ? warnBg : theme === "dark" ? "#1e293b" : "#f8fafc";
    ctx.strokeStyle = card.isWarn ? "rgba(245,158,11,0.45)" : border;
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, cardW, cardH, Math.round(8 * scale));
    ctx.fill();
    ctx.stroke();

    let ty = y + innerPad + labelSize;
    ctx.font = `700 ${labelSize}px system-ui, sans-serif`;
    ctx.fillStyle = labelColor;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(card.label, x + innerPad, ty);

    ty += Math.round(4 * scale) + valueSize;
    ctx.font = `800 ${valueSize}px system-ui, sans-serif`;
    ctx.fillStyle = card.valueColor;
    ctx.fillText(card.strong, x + innerPad, ty);

    if (card.em) {
      ty += Math.round(4 * scale) + subSize;
      ctx.font = `600 ${subSize}px system-ui, sans-serif`;
      ctx.fillStyle = subColor;
      ctx.fillText(card.em, x + innerPad, ty);
    }
  });

  return canvas;
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Desenha a legenda em canvas (evita falhas do html2canvas em botões flex).
 */
function drawLegendCanvas(items, { theme = "light", scale = 1, maxWidth = 720 }) {
  if (!items.length) return null;

  const textColor = theme === "dark" ? "#94a3b8" : "#64748b";
  const bg = theme === "dark" ? "#0f172a" : "#ffffff";
  const fontSize = Math.round(10 * scale);
  const rowH = Math.round(20 * scale);
  const gapX = Math.round(14 * scale);
  const pad = Math.round(8 * scale);
  const dot = Math.round(8 * scale);

  const measure = document.createElement("canvas").getContext("2d");
  measure.font = `600 ${fontSize}px system-ui, -apple-system, Segoe UI, sans-serif`;

  const placements = [];
  let x = pad;
  let y = pad + fontSize;

  items.forEach((item) => {
    const dashW = item.dashed ? Math.round(14 * scale) : dot;
    const textW = measure.measureText(item.label).width;
    const itemW = dashW + Math.round(5 * scale) + textW;
    if (x + itemW > maxWidth - pad && x > pad) {
      x = pad;
      y += rowH;
    }
    placements.push({ item, x, y, itemW });
    x += itemW + gapX;
  });

  const height = y + pad;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(maxWidth, 1);
  canvas.height = Math.max(height, 1);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = `600 ${fontSize}px system-ui, -apple-system, Segoe UI, sans-serif`;
  ctx.textBaseline = "alphabetic";

  placements.forEach(({ item, x: ix, y: iy }) => {
    const midY = iy - fontSize * 0.35;
    if (item.dashed) {
      ctx.strokeStyle = item.color;
      ctx.lineWidth = Math.max(2, 2 * scale);
      ctx.setLineDash([Math.round(3 * scale), Math.round(2 * scale)]);
      ctx.beginPath();
      ctx.moveTo(ix, midY);
      ctx.lineTo(ix + Math.round(14 * scale), midY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = textColor;
      ctx.fillText(item.label, ix + Math.round(18 * scale), iy);
    } else {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(ix + dot / 2, midY, dot / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = textColor;
      ctx.fillText(item.label, ix + dot + Math.round(5 * scale), iy);
    }
  });

  return canvas;
}

function stackCanvases(layers, { bg, pad }) {
  const valid = layers.filter(Boolean);
  if (!valid.length) return null;

  const innerW = Math.max(...valid.map((c) => c.width), 1);
  const width = innerW + pad * 2;
  let height = pad;
  valid.forEach((layer, i) => {
    height += layer.height;
    if (i < valid.length - 1) height += pad;
  });
  height += pad;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.max(height, 1);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  let y = pad;
  valid.forEach((layer, i) => {
    const ox = pad + (innerW - layer.width) / 2;
    ctx.drawImage(layer, ox, y);
    y += layer.height + (i < valid.length - 1 ? pad : 0);
  });
  return canvas;
}

export async function exportChartPng(chartId, filename = "grafico") {
  if (!chartId) return false;
  try {
    const result = await ApexCharts.exec(chartId, "dataURI", { scale: 2 });
    const href = result?.imgURI;
    if (!href) return false;
    const img = await loadImage(href);
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });
    if (!blob) return false;
    downloadPngBlob(blob, filename);
    return true;
  } catch {
    return false;
  }
}

/**
 * Exporta cards KPI + legenda + gráfico (Apex) num único PNG.
 */
export async function exportChartWithLegend(
  container,
  chartId,
  filename = "grafico",
  { theme = "light", legendItems = [] } = {},
) {
  if (!container || !chartId) return false;

  const bg = theme === "dark" ? "#0f172a" : "#ffffff";
  const scale = Math.min(2, window.devicePixelRatio || 1.5);
  const pad = Math.round(10 * scale);
  const maxWidth = Math.max(container.offsetWidth || 0, 480);

  let kpisCanvas = null;
  const kpisEl =
    container.querySelector(".pb-chart-export-kpis") ||
    container.querySelector(".pb-abs-kpis");
  if (kpisEl && kpisEl.offsetHeight > 0) {
    kpisCanvas = drawKpisCanvasFromDom(kpisEl, { theme, scale, maxWidth });
    if (!kpisCanvas) {
      try {
        kpisCanvas = await captureHtmlElement(kpisEl, { backgroundColor: bg, scale });
      } catch {
        /* KPIs opcionais */
      }
    }
  }

  const visibleLegend = legendItems.filter((item) => item && item.label);
  let legendCanvas = drawLegendCanvas(visibleLegend, { theme, scale, maxWidth });

  if (!legendCanvas) {
    const legendEl = container.querySelector(".pb-pres-legend-inline");
    if (legendEl) {
      try {
        legendCanvas = await captureHtmlElement(legendEl, { backgroundColor: bg, scale });
      } catch {
        /* sem legenda */
      }
    }
  }

  let chartImg = null;
  try {
    const result = await ApexCharts.exec(chartId, "dataURI", { scale: 2 });
    if (result?.imgURI) chartImg = await loadImage(result.imgURI);
  } catch {
    /* apex indisponível */
  }

  let chartCanvas = null;
  if (chartImg) {
    chartCanvas = document.createElement("canvas");
    chartCanvas.width = chartImg.width;
    chartCanvas.height = chartImg.height;
    const chartCtx = chartCanvas.getContext("2d");
    chartCtx.fillStyle = bg;
    chartCtx.fillRect(0, 0, chartCanvas.width, chartCanvas.height);
    chartCtx.drawImage(chartImg, 0, 0);
  }

  const merged = stackCanvases([kpisCanvas, legendCanvas, chartCanvas], { bg, pad });
  if (!merged) return false;

  const blob = await new Promise((resolve) => {
    merged.toBlob(resolve, "image/png");
  });
  if (!blob) return false;
  downloadPngBlob(blob, filename);
  return true;
}

/**
 * @param {{ seriesName: string, label: string, color: string, dashed?: boolean }[]} items
 */
export function ChartLegendBar({
  chartId,
  items = [],
  exportFilename = "grafico",
  hint = null,
  resetKey = "",
  captureRef = null,
  exportTheme = "light",
}) {
  const [hidden, setHidden] = useState(() => new Set());
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setHidden(new Set());
    if (!chartId) return;
    items.forEach((item) => {
      try {
        ApexCharts.exec(chartId, "showSeries", item.seriesName);
      } catch {
        /* noop */
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset explícito via resetKey
  }, [resetKey, chartId]);

  const handleToggle = useCallback(
    (seriesName) => {
      toggleChartSeries(chartId, seriesName);
      setHidden((prev) => {
        const next = new Set(prev);
        if (next.has(seriesName)) next.delete(seriesName);
        else next.add(seriesName);
        return next;
      });
    },
    [chartId],
  );

  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const el = captureRef?.current;
      const legendForExport = items.filter((item) => !hidden.has(item.seriesName));
      if (el && chartId) {
        const ok = await exportChartWithLegend(el, chartId, exportFilename, {
          theme: exportTheme,
          legendItems: legendForExport,
        });
        if (ok) return;
      }
      await exportChartPng(chartId, exportFilename);
    } finally {
      setExporting(false);
    }
  }, [captureRef, exportFilename, exportTheme, chartId, exporting, items, hidden]);

  if (!items.length) return null;

  return (
    <div className="pb-pres-legend-row">
      <div className="pb-pres-legend-inline" aria-label="Legenda do gráfico">
        {items.map((item) => (
          <button
            key={item.seriesName}
            type="button"
            className={`pb-pres-legend-item pb-pres-legend-btn${hidden.has(item.seriesName) ? " is-off" : ""}`}
            onClick={() => handleToggle(item.seriesName)}
            aria-pressed={!hidden.has(item.seriesName)}
            title={hidden.has(item.seriesName) ? "Mostrar série" : "Ocultar série"}
          >
            <i
              className={item.dashed ? "is-dashed" : ""}
              style={
                item.dashed
                  ? { borderColor: item.color }
                  : { background: item.color }
              }
              aria-hidden="true"
            />
            {item.label}
          </button>
        ))}
      </div>
      <div className="pb-chart-export-actions" data-html2canvas-ignore="true">
        <button
          type="button"
          className="pb-chart-export-btn"
          onClick={handleExport}
          disabled={exporting}
          title="Exportar cards, legenda e gráfico (PNG)"
          aria-label="Exportar PNG com cards, legenda e gráfico"
        >
          {exporting ? "Exportando…" : "Exportar"}
        </button>
      </div>
      {hint ? <span className="pb-pres-chart-hint">{hint}</span> : null}
    </div>
  );
}
