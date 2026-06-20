import React from "react";
import { PeriodoApuracaoBlock } from "./PeriodoApuracaoBlock.jsx";

export function PbConfigImportacoesTab({
  periodoApuracao = null,
  onPeriodoApuracaoChange = null,
  importBusy,
  onImportXlsx,
  cfgFileRef,
  eventosBusy,
  handleImportEventos,
  cfgEventosFileRef,
  tabelaBusy,
  handleImportTabela,
  tabelaImportCount,
  onClearTabelaImport,
  cfgTabelaFileRef,
  bancoHorasBusy,
  handleImportBancoHoras,
  storedBancoHoras,
  cfgBancoHorasFileRef,
  abonosBusy,
  handleImportAbonos,
  handleImportAbonosEfetuados,
  storedAbonos,
  cfgAbonosFileRef,
  cfgAbonosEfetuadosFileRef,
  mensalBusy,
  handleImportMensal,
  storedMensal,
  cfgMensalFileRef,
  backupBusy,
  setBackupBusy,
  onExportPosicaoBackup,
  onImportPosicaoBackup,
  cfgBackupFileRef,
  importOverrides,
  onClearImport,
  importTurnoverCsv,
  openRadarToCct,
}) {
  const hiddenFileStyle = {
    position: "absolute",
    left: "-9999px",
    width: 1,
    height: 1,
    opacity: 0,
  };

  return (
    <div className="pb-cfg-tab-panel">
      <div className="pb-cfg-provisional-banner" role="note" aria-label="Aviso provisório">
        <div className="pb-cfg-provisional-banner-head">
          <span className="pb-cfg-provisional-badge">Provisório</span>
          <strong>Importações por planilha — até ligar com a API</strong>
        </div>
        <p>
          Esta tela é temporária. Enquanto a integração automática não estiver ativa, os dados
          entram somente por upload de arquivos e ficam salvos no navegador deste computador
          (localStorage).
        </p>
        <ul>
          <li>Após conectar a API, as importações manuais deixarão de ser necessárias.</li>
          <li>Metas e categorias de horas continuam válidas após a migração.</li>
        </ul>
      </div>

      <PeriodoApuracaoBlock
        periodoApuracao={periodoApuracao}
        onPeriodoApuracaoChange={onPeriodoApuracaoChange}
        hint="Intervalo provisório das planilhas importadas e do filtro «Período atual» no painel."
      />

      <div className="pb-cfg-imports-head">
        <div>
          <p className="pb-cfg-section-title">Central de importação</p>
          <span className="pb-cfg-hint">
            Escolha o tipo de arquivo abaixo. Cada botão corresponde a uma fonte de dados do
            painel.
          </span>
        </div>
      </div>

      <div className="pb-cfg-import-panel pb-cfg-import-panel--cct">
        <span className="pb-cfg-label">Convenções coletivas (CCT)</span>
        <span className="pb-cfg-hint">
          Envie PDFs no Radar Trabalhista para cruzar regras da convenção com os eventos.
        </span>
        <button type="button" className="pb-btn pb-btn-compact" onClick={openRadarToCct}>
          <span className="pb-btn-ico">▣</span>
          Abrir CCT
        </button>
      </div>

      <div className="pb-cfg-import-grid">
        <div className="pb-cfg-import-card">
          <span className="pb-cfg-label">Planilha por categoria</span>
          <span className="pb-cfg-hint">
            Listas de Presentes, Faltas, Férias, Afastados e demais abas/categorias.
          </span>
          <input
            id="pb_cfg_import_xlsx"
            ref={cfgFileRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            style={hiddenFileStyle}
            onChange={(e) => {
              const f = e.target.files && e.target.files[0];
              e.target.value = "";
              if (!f || !onImportXlsx) return;
              onImportXlsx(f);
            }}
          />
          <label
            className="pb-btn"
            htmlFor="pb_cfg_import_xlsx"
            aria-disabled={!!importBusy}
            onClick={(e) => {
              if (importBusy) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
          >
            <span className="pb-btn-ico">↑</span>
            {importBusy ? "Importando..." : "Importar XLSX"}
          </label>
        </div>

        <div className="pb-cfg-import-card">
          <span className="pb-cfg-label">Eventos de marcação</span>
          <span className="pb-cfg-hint">
            Lê a coluna Evento e atualiza as Categorias de Horas automaticamente.
          </span>
          <input
            ref={cfgEventosFileRef}
            type="file"
            accept=".xlsx,.xls"
            style={hiddenFileStyle}
            onChange={(e) => {
              const f = e.target.files && e.target.files[0];
              e.target.value = "";
              if (f) handleImportEventos(f);
            }}
          />
          <button
            type="button"
            className="pb-btn"
            style={{ cursor: eventosBusy ? "wait" : "pointer" }}
            disabled={eventosBusy}
            onClick={(e) => {
              e.preventDefault();
              if (!eventosBusy) cfgEventosFileRef.current?.click();
            }}
          >
            <span className="pb-btn-ico">↑</span>
            {eventosBusy ? "Lendo..." : "Importar Eventos"}
          </button>
        </div>

        <div className="pb-cfg-import-card pb-cfg-import-card--wide">
          <span className="pb-cfg-label">Tabela histórica</span>
          <span className="pb-cfg-hint">
            Agrupa por data e alimenta a tabela, gráficos, Férias e Afastados quando os eventos
            indicarem essas categorias.
            {tabelaImportCount > 0 && (
              <strong>
                {" "}
                {tabelaImportCount} dia{tabelaImportCount !== 1 ? "s" : ""} ativo
                {tabelaImportCount !== 1 ? "s" : ""}.
              </strong>
            )}
          </span>
          <input
            ref={cfgTabelaFileRef}
            type="file"
            accept=".xlsx,.xls,.csv,text/csv"
            style={hiddenFileStyle}
            onChange={(e) => {
              const f = e.target.files && e.target.files[0];
              e.target.value = "";
              if (f) handleImportTabela(f);
            }}
          />
          <button
            type="button"
            className="pb-btn"
            style={{ cursor: tabelaBusy ? "wait" : "pointer" }}
            disabled={tabelaBusy}
            onClick={(e) => {
              e.preventDefault();
              if (!tabelaBusy) cfgTabelaFileRef.current?.click();
            }}
          >
            <span className="pb-btn-ico">↑</span>
            {tabelaBusy ? "Lendo..." : "Importar Tabela"}
          </button>
          {tabelaImportCount > 0 && (
            <button type="button" className="pb-btn pb-btn-secondary" onClick={onClearTabelaImport}>
              <span className="pb-btn-ico">×</span>
              Limpar dados da tabela
            </button>
          )}
        </div>

        <div className="pb-cfg-import-card">
          <span className="pb-cfg-label">Banco de Horas</span>
          <span className="pb-cfg-hint">
            Folha BH: Matrícula, Nome, Período Inicial, Período, Saldo Anterior, Crédito, Débito, Horas Pagas e Saldo Próximo (linha «Filial: …» é ignorada).
            {storedBancoHoras?.count > 0 ? (
              <strong>
                {" "}
                {storedBancoHoras.count} linha{storedBancoHoras.count !== 1 ? "s" : ""} importada
                {storedBancoHoras.count !== 1 ? "s" : ""}
                {storedBancoHoras.fileName ? ` (${storedBancoHoras.fileName})` : ""}.
              </strong>
            ) : (
              <span> Nenhum dado salvo — use o botão abaixo ou importe via Tabela com colunas BH.</span>
            )}
          </span>
          <input
            ref={cfgBancoHorasFileRef}
            type="file"
            accept=".xlsx,.xls"
            style={hiddenFileStyle}
            onChange={(e) => {
              const f = e.target.files && e.target.files[0];
              e.target.value = "";
              if (f) handleImportBancoHoras(f);
            }}
          />
          <button
            type="button"
            className="pb-btn"
            style={{ cursor: bancoHorasBusy ? "wait" : "pointer" }}
            disabled={bancoHorasBusy}
            onClick={(e) => {
              e.preventDefault();
              if (!bancoHorasBusy) cfgBancoHorasFileRef.current?.click();
            }}
          >
            <span className="pb-btn-ico">↑</span>
            {bancoHorasBusy ? "Lendo..." : "Importar Banco de Horas"}
          </button>
        </div>

        <div className="pb-cfg-import-card">
          <span className="pb-cfg-label">Abonos</span>
          <span className="pb-cfg-hint">
            Planilha com Filial, Departamento, Matrícula, Nome, Cargo, Código do Evento de Origem, Evento de
            Origem, Data e Horas. Importe pendentes e efetuados separadamente (mesmo layout).
            {(storedAbonos?.countPendentes ?? storedAbonos?.count) > 0 || storedAbonos?.countEfetuados > 0 ? (
              <strong>
                {" "}
                Pendentes: {(storedAbonos?.countPendentes ?? storedAbonos?.count) || 0}
                {storedAbonos?.fileNamePendentes || storedAbonos?.fileName
                  ? ` (${storedAbonos.fileNamePendentes || storedAbonos.fileName})`
                  : ""}
                {" · "}
                Efetuados: {storedAbonos?.countEfetuados || 0}
                {storedAbonos?.fileNameEfetuados ? ` (${storedAbonos.fileNameEfetuados})` : ""}.
              </strong>
            ) : (
              <span> Nenhum dado salvo — use os botões abaixo.</span>
            )}
          </span>
          <input
            ref={cfgAbonosFileRef}
            type="file"
            accept=".xlsx,.xls"
            style={hiddenFileStyle}
            onChange={(e) => {
              const f = e.target.files && e.target.files[0];
              e.target.value = "";
              if (f) handleImportAbonos(f);
            }}
          />
          <input
            ref={cfgAbonosEfetuadosFileRef}
            type="file"
            accept=".xlsx,.xls"
            style={hiddenFileStyle}
            onChange={(e) => {
              const f = e.target.files && e.target.files[0];
              e.target.value = "";
              if (f) handleImportAbonosEfetuados(f);
            }}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button
              type="button"
              className="pb-btn"
              style={{ cursor: abonosBusy ? "wait" : "pointer" }}
              disabled={abonosBusy}
              onClick={(e) => {
                e.preventDefault();
                if (!abonosBusy) cfgAbonosFileRef.current?.click();
              }}
            >
              <span className="pb-btn-ico">↑</span>
              {abonosBusy ? "Lendo..." : "Importar pendentes"}
            </button>
            <button
              type="button"
              className="pb-btn"
              style={{ cursor: abonosBusy ? "wait" : "pointer" }}
              disabled={abonosBusy}
              onClick={(e) => {
                e.preventDefault();
                if (!abonosBusy) cfgAbonosEfetuadosFileRef.current?.click();
              }}
            >
              <span className="pb-btn-ico">↑</span>
              {abonosBusy ? "Lendo..." : "Importar efetuados"}
            </button>
          </div>
        </div>

        <div className="pb-cfg-import-card">
          <span className="pb-cfg-label">Mensal</span>
          <span className="pb-cfg-hint">
            Importa planilha por Evento x mês, com colunas 05/2025, 06/2025... e Total.
            {storedMensal?.eventCount > 0 && (
              <strong>
                {" "}
                {storedMensal.eventCount} evento{storedMensal.eventCount !== 1 ? "s" : ""} ·{" "}
                {storedMensal.months?.length || 0} mês
                {(storedMensal.months?.length || 0) !== 1 ? "es" : ""}.
              </strong>
            )}
          </span>
          <input
            ref={cfgMensalFileRef}
            type="file"
            accept=".xlsx,.xls"
            style={hiddenFileStyle}
            onChange={(e) => {
              const f = e.target.files && e.target.files[0];
              e.target.value = "";
              if (f) handleImportMensal(f);
            }}
          />
          <button
            type="button"
            className="pb-btn"
            style={{ cursor: mensalBusy ? "wait" : "pointer" }}
            disabled={mensalBusy}
            onClick={(e) => {
              e.preventDefault();
              if (!mensalBusy) cfgMensalFileRef.current?.click();
            }}
          >
            <span className="pb-btn-ico">↑</span>
            {mensalBusy ? "Lendo..." : "Importar Mensal"}
          </button>
        </div>
      </div>

      <div className="pb-cfg-import-panel">
        <div>
          <span className="pb-cfg-label">Backup dos dados importados</span>
          <span className="pb-cfg-hint">
            Salva tabela importada e ajustes em JSON. Use antes de reiniciar o servidor ou trocar de
            porta.
          </span>
        </div>
        <div className="pb-cfg-actions">
          <button
            type="button"
            className="pb-btn pb-btn-compact"
            disabled={backupBusy || !onExportPosicaoBackup}
            onClick={async () => {
              if (!onExportPosicaoBackup) return;
              setBackupBusy(true);
              try {
                await onExportPosicaoBackup();
              } finally {
                setBackupBusy(false);
              }
            }}
          >
            <span className="pb-btn-ico">↓</span>
            {backupBusy ? "Exportando..." : "Exportar JSON"}
          </button>
          <input
            ref={cfgBackupFileRef}
            type="file"
            accept=".json,application/json"
            style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
            onChange={(e) => {
              const f = e.target.files && e.target.files[0];
              e.target.value = "";
              if (f && onImportPosicaoBackup) {
                setBackupBusy(true);
                Promise.resolve(onImportPosicaoBackup(f)).finally(() => setBackupBusy(false));
              }
            }}
          />
          <button
            type="button"
            className="pb-btn pb-btn-compact"
            disabled={backupBusy || !onImportPosicaoBackup}
            onClick={() => cfgBackupFileRef.current?.click()}
          >
            <span className="pb-btn-ico">↑</span>
            Restaurar JSON
          </button>
        </div>
      </div>

      {(() => {
        const src = importOverrides && typeof importOverrides === "object" ? importOverrides : {};
        const date = src.data_referencia || null;
        const cats = Object.entries(src).filter(
          ([k, v]) => k !== "data_referencia" && v && typeof v === "object" && Number(v.total) > 0,
        );
        if (!date && !cats.length) return null;
        return (
          <div className="pb-cfg-field">
            <span className="pb-cfg-label">Dados importados ativos</span>
            {date && (
              <span className="pb-cfg-hint">
                Referência: <strong>{date}</strong>
              </span>
            )}
            {cats.length > 0 && (
              <div className="pb-cfg-import-active-list">
                {cats.map(([k, v]) => (
                  <span key={k}>
                    <strong>{k}</strong>: {Number(v.total).toLocaleString("pt-BR")} registros
                  </span>
                ))}
              </div>
            )}
            <button
              type="button"
              className="pb-btn"
              style={{ marginTop: 4, alignSelf: "flex-start" }}
              onClick={() => onClearImport?.()}
            >
              Limpar dados importados
            </button>
          </div>
        );
      })()}

      <div className="pb-cfg-field">
        <span className="pb-cfg-label">Importar KPI · Rotatividade</span>
        <span className="pb-cfg-hint">
          Planilha CSV com admitidos e desligados por mês para o card de turnover.
        </span>
        <input
          id="pb_cfg_import_turnover_csv"
          type="file"
          accept=".csv,text/csv"
          style={hiddenFileStyle}
          onChange={(e) => {
            const f = e.target.files && e.target.files[0];
            e.target.value = "";
            if (!f) return;
            importTurnoverCsv(f);
          }}
        />
        <label className="pb-btn" htmlFor="pb_cfg_import_turnover_csv">
          <span className="pb-btn-ico">↑</span>
          Importar CSV (Rotatividade)
        </label>
      </div>
    </div>
  );
}
