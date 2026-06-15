from pathlib import Path

D = "d" + "i" + "v"
snippet_path = Path("scripts/risk_chart_snippet.jsx")
root = Path("src/panels/posicao/RadarPremiumChart.jsx")

snippet = snippet_path.read_text(encoding="utf-8")
snippet = snippet.replace("TAG", D)

s = root.read_text(encoding="utf-8")

old = f"""          <{D} className="apex-hist-chart pb-radar-premium-risk-chart" ref={{chartWrapRef}}>
            <ReactApexChart
              options={{riskOptions}}
              series={{riskSeries}}
              type="line"
              height={{chartHeight}}
              width="100%"
            />
          </{D}>"""

if old not in s:
    raise SystemExit("OLD not found")

s = s.replace(old, snippet.rstrip() + "\n", 1)

old2 = "            {riskWorstIdx >= 0 && ("
new2 = '            {riskViewMode === "timeline" && riskWorstIdx >= 0 && ('
if old2 not in s:
    raise SystemExit("OLD2 not found")
s = s.replace(old2, new2, 1)

marker = f"""                )}}
              </{D}>
            )}}
          </{D}>
        )}}
      </{D}>
    );
  }}

  if (!canShowChart) {{"""

depto = f"""

            {{riskViewMode === "depto" && riskDeptRows[0] && (
              <{D} className="apex-sidebar-section">
                <span className="apex-sidebar-lbl">Destaque</span>
                <{D} className="apex-sidebar-kpi" style={{{{ "--kpi-color": "#a855f7" }}}}>
                  <span className="apex-kpi-ico">▲</span>
                  <span className="apex-kpi-lbl">Mais penalidades</span>
                  <{D} className="apex-kpi-val">
                    {{riskDeptRows[0].dept}}
                    <br />
                    {{riskDeptRows[0].ocorrencias.toLocaleString("pt-BR")}} ocorr. · score {{riskDeptRows[0].score}}
                  </{D}>
                </{D}>
              </{D}>
            )}}"""

if marker not in s:
    raise SystemExit("MARKER not found")

s = s.replace(marker, depto + marker, 1)
root.write_text(s, encoding="utf-8")
print("OK")
