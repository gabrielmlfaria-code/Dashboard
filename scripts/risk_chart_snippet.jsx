          <TAG className="pb-radar-premium-risk-view-row" role="tablist" aria-label="Visualização do gráfico">
            <span className="pb-radar-premium-risk-view-lbl">Visualização</span>
            <TAG className="pb-radar-risk-view-toggle">
              <button
                type="button"
                role="tab"
                aria-selected={riskViewMode === "timeline"}
                className={`pb-radar-risk-view-btn${riskViewMode === "timeline" ? " is-active" : ""}`}
                onClick={() => setRiskViewMode("timeline")}
              >
                Evolução
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={riskViewMode === "depto"}
                className={`pb-radar-risk-view-btn${riskViewMode === "depto" ? " is-active" : ""}`}
                onClick={() => setRiskViewMode("depto")}
              >
                Depto
              </button>
            </TAG>
          </TAG>
          <TAG
            className={`apex-hist-chart pb-radar-premium-risk-chart${riskViewMode === "depto" ? " pb-radar-premium-risk-chart--depto" : ""}`}
            ref={chartWrapRef}
          >
            {riskViewMode === "depto" ? (
              riskDeptRows.length ? (
                <TAG className="pb-radar-premium-risk-dept-scroll">
                  <ReactApexChart
                    options={riskDeptOptions}
                    series={riskDeptSeries}
                    type="bar"
                    height={riskDeptChartHeight}
                    width="100%"
                  />
                </TAG>
              ) : (
                <TAG className="pb-radar-evol-chart-empty">Sem departamentos com penalidades no período.</TAG>
              )
            ) : (
              <ReactApexChart
                options={riskOptions}
                series={riskSeries}
                type="line"
                height={chartHeight}
                width="100%"
              />
            )}
          </TAG>
