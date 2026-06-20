import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DEFAULT_AUDITORIA_PONTO_EVENTOS_IGNORADOS,
  DEFAULT_AUDITORIA_PONTO_EVENTOS_JORNADA_PRINCIPAL,
  DEFAULT_AUDITORIA_PONTO_EVENTOS_SEM_MARCACAO_OK,
  DEFAULT_AUDITORIA_PONTO_PARAMS,
  REGRAS_AUDITORIA_PONTO_META,
} from "./auditoriaPonto/pontoAnomalias.js";
import "./posicao-bento.css";

const AUDITORIA_PARAM_FIELDS = [
  { key: "toleranciaMinutos", label: "Tolerancia geral de desvio", suffix: "min", desc: "Margem aceita entre horario planejado e marcacao antes de abrir anomalia de desvio." },
  { key: "toleranciaDuplicidadeMinutos", label: "Janela para batida duplicada", suffix: "min", desc: "Marcacoes muito proximas dentro desta janela podem ser tratadas como batida repetida." },
  { key: "janelaPareamentoMaxMinutos", label: "Janela maxima de pareamento", suffix: "min", desc: "Distancia maxima para relacionar uma marcacao a um horario previsto." },
  { key: "intervaloIntrajornadaMinutos", label: "Intervalo intrajornada minimo", suffix: "min", desc: "Pausa minima esperada dentro da jornada quando a carga diaria exige intervalo." },
  { key: "jornadaIntrajornadaMinutos", label: "Jornada que exige intervalo", suffix: "min", desc: "A partir desta jornada planejada, a auditoria exige intervalo intrajornada." },
  { key: "intervaloInterjornadaMinutos", label: "Intervalo interjornada minimo", suffix: "min", desc: "Descanso minimo entre a saida de um dia e a primeira entrada do proximo dia." },
  { key: "pontoBritanicoDias", label: "Dias para ponto britanico", suffix: "dias", desc: "Quantidade de dias com marcacoes iguais para sinalizar possivel ponto britanico." },
  { key: "minutosResiduaisMinutos", label: "Minutos residuais tolerados", suffix: "min", desc: "Limite de diferencas pequenas acumuladas antes de sugerir ajuste financeiro." },
  { key: "limiteHoraExtraDiariaMinutos", label: "Limite diario de hora extra", suffix: "min", desc: "Total diario de hora extra acima do qual a regra passa a destacar risco." },
  { key: "intervaloIntrajornadaMaxMinutos", label: "Intervalo intrajornada maximo", suffix: "min", desc: "Intervalos maiores que este limite aparecem como atipicos para revisao." },
  { key: "diasConsecutivosLimite", label: "Dias consecutivos sem folga", suffix: "dias", desc: "Sequencia maxima de dias trabalhados antes de apontar risco de descanso semanal." },
  { key: "limiteBancoHorasPositivoMinutos", label: "Limite banco positivo", suffix: "min", desc: "Saldo positivo acima deste limite sinaliza risco de banco de horas." },
  { key: "limiteBancoHorasNegativoMinutos", label: "Limite banco negativo", suffix: "min", desc: "Saldo negativo abaixo deste limite sinaliza risco de banco de horas." },
  { key: "recorrenciaRiscoLimite", label: "Recorrencia para risco", suffix: "vezes", desc: "Quantidade de repeticoes para marcar risco recorrente no mesmo contexto." },
];

const AUDITORIA_CUSTOM_RULE_FIELDS = [
  { value: "evento", label: "Evento" },
  { value: "horas", label: "Horas" },
  { value: "marcacao", label: "Marcacao" },
  { value: "horario", label: "Horario planejado" },
  { value: "departamento", label: "Departamento" },
  { value: "cargo", label: "Cargo" },
  { value: "categoria", label: "Categoria" },
];

const AUDITORIA_CUSTOM_RULE_OPERATORS = [
  { value: "contem", label: "Contem" },
  { value: "nao_contem", label: "Nao contem" },
  { value: "igual", label: "Igual" },
  { value: "diferente", label: "Diferente" },
  { value: "maior_que", label: "Maior que" },
  { value: "maior_igual", label: "Maior ou igual" },
  { value: "menor_que", label: "Menor que" },
  { value: "menor_igual", label: "Menor ou igual" },
];

const AUDITORIA_RULE_HELP = {
  legal: "Regras que protegem descanso, intervalo, classificacao de ausencia, feriado e fechamento.",
  financeiro: "Regras que comparam evento, horas, marcacoes e banco de horas para evitar pagamento errado ou desconto indevido.",
  fraude: "Regras de padrao suspeito ou recorrencia, como ponto britanico e tratamentos manuais repetidos.",
  configuracao: "Regras que indicam escala, cadastro ou parametro insuficiente para auditar com seguranca.",
  operacional: "Regras de consistencia tecnica entre horario planejado, marcacoes e eventos do dia.",
};

const AUDIT_RULE_TREATMENTS = [
  { id: "acao", label: "Exige acao" },
  { id: "informativa", label: "Informativa" },
  { id: "nao_aplicavel", label: "Nao aplicavel" },
  { id: "revisao_manual", label: "Revisao manual" },
];

export const normalizeAuditoriaParamsConfig = (value = {}) => {
  const source = value && typeof value === "object" ? value : {};
  const regrasDesativadas = Array.isArray(source.regrasDesativadas)
    ? source.regrasDesativadas.map(String).filter(Boolean)
    : [];
  const regrasCustomizadas = Array.isArray(source.regrasCustomizadas)
    ? source.regrasCustomizadas
        .filter((rule) => rule && typeof rule === "object")
        .map((rule, index) => ({
          id: String(rule.id || `CUSTOM_${Date.now()}_${index}`),
          titulo: String(rule.titulo || rule.nome || "Regra especifica da empresa"),
          campo: String(rule.campo || "evento"),
          operador: String(rule.operador || "contem"),
          valor: String(rule.valor || ""),
          severidade: ["critica", "alta", "media", "baixa"].includes(rule.severidade) ? rule.severidade : "media",
          mensagem: String(rule.mensagem || ""),
          ativo: rule.ativo !== false,
        }))
    : [];
  return {
    ...DEFAULT_AUDITORIA_PONTO_PARAMS,
    ...source,
    regrasDesativadas,
    regrasCustomizadas,
    tratamentoRegras: source.tratamentoRegras || {},
    limiarsRegras: (source.limiarsRegras && typeof source.limiarsRegras === "object") ? source.limiarsRegras : {},
    eventosIgnoradosAuditoria: Array.isArray(source.eventosIgnoradosAuditoria)
      ? source.eventosIgnoradosAuditoria
      : DEFAULT_AUDITORIA_PONTO_EVENTOS_IGNORADOS,
    eventosSemMarcacaoOk: Array.isArray(source.eventosSemMarcacaoOk)
      ? source.eventosSemMarcacaoOk
      : DEFAULT_AUDITORIA_PONTO_EVENTOS_SEM_MARCACAO_OK,
    eventosJornadaPrincipal: Array.isArray(source.eventosJornadaPrincipal)
      ? source.eventosJornadaPrincipal
      : DEFAULT_AUDITORIA_PONTO_EVENTOS_JORNADA_PRINCIPAL,
  };
};

export function AuditoriaPontoParamsPanel({ open, value, onChange, onClose, onSave, onReset }) {
  const config = normalizeAuditoriaParamsConfig(value);
  const disabledSet = new Set(config.regrasDesativadas || []);
  const totalRules = REGRAS_AUDITORIA_PONTO_META.length;
  const customRules = Array.isArray(config.regrasCustomizadas) ? config.regrasCustomizadas : [];
  const activeRules = totalRules - disabledSet.size + customRules.filter((rule) => rule.ativo !== false).length;
  const [rect, setRect] = useState(() => ({
    width: Math.min(1240, Math.max(860, (typeof window !== "undefined" ? window.innerWidth : 1280) - 96)),
    height: Math.min(820, Math.max(620, (typeof window !== "undefined" ? window.innerHeight : 900) - 96)),
    left: 32,
    top: 72,
  }));
  const [newTextTerm, setNewTextTerm] = useState({
    eventosJornadaPrincipal: "",
    eventosSemMarcacaoOk: "",
  });
  const dragRef = useRef(null);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    setRect((current) => {
      const width = Math.min(current.width, window.innerWidth - 32);
      const height = Math.min(current.height, window.innerHeight - 32);
      return {
        width,
        height,
        left: Math.max(16, Math.min(current.left, window.innerWidth - width - 16)),
        top: Math.max(24, Math.min(current.top, window.innerHeight - height - 16)),
      };
    });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onMove = (ev) => {
      const action = dragRef.current;
      if (!action || typeof window === "undefined") return;
      ev.preventDefault();
      const dx = ev.clientX - action.x;
      const dy = ev.clientY - action.y;
      if (action.type === "drag") {
        setRect((current) => ({
          ...current,
          left: Math.max(8, Math.min(window.innerWidth - current.width - 8, action.left + dx)),
          top: Math.max(16, Math.min(window.innerHeight - current.height - 8, action.top + dy)),
        }));
      } else {
        setRect((current) => ({
          ...current,
          width: Math.max(760, Math.min(window.innerWidth - current.left - 8, action.width + dx)),
          height: Math.max(520, Math.min(window.innerHeight - current.top - 8, action.height + dy)),
        }));
      }
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [open]);

  const emitChange = (patch) => onChange?.(normalizeAuditoriaParamsConfig({ ...config, ...patch }));
  const updateNumber = (key, rawValue) => {
    emitChange({ [key]: Math.max(0, Math.round(Number(rawValue) || 0)) });
  };
  const updateTextList = (key, rawValue) => {
    emitChange({
      [key]: String(rawValue || "")
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean),
    });
  };
  const addTextListTerm = (key) => {
    const term = String(newTextTerm[key] || "").trim();
    if (!term) return;
    const current = Array.isArray(config[key]) ? config[key] : [];
    const exists = current.some((item) => String(item || "").trim().toLowerCase() === term.toLowerCase());
    emitChange({ [key]: exists ? current : [...current, term] });
    setNewTextTerm((prev) => ({ ...prev, [key]: "" }));
  };
  const toggleRule = (ruleId) => {
    const next = new Set(disabledSet);
    if (next.has(ruleId)) next.delete(ruleId);
    else next.add(ruleId);
    emitChange({ regrasDesativadas: [...next] });
  };
  const activateAll = () => emitChange({ regrasDesativadas: [] });
  const deactivateAll = () => emitChange({ regrasDesativadas: REGRAS_AUDITORIA_PONTO_META.map((rule) => rule.id) });
  const setAllRuleTreatments = (treatment) => {
    emitChange({
      tratamentoRegras: REGRAS_AUDITORIA_PONTO_META.reduce((acc, rule) => {
        acc[rule.id] = treatment;
        return acc;
      }, {}),
    });
  };
  const updateCustomRule = (ruleId, patch) => {
    emitChange({ regrasCustomizadas: customRules.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule)) });
  };
  const addCustomRule = () => {
    emitChange({
      regrasCustomizadas: [
        ...customRules,
        {
          id: `CUSTOM_${Date.now()}`,
          titulo: "Nova regra da empresa",
          campo: "evento",
          operador: "contem",
          valor: "",
          severidade: "media",
          mensagem: "",
          ativo: true,
        },
      ],
    });
  };
  const removeCustomRule = (ruleId) => {
    emitChange({ regrasCustomizadas: customRules.filter((rule) => rule.id !== ruleId) });
  };
  const updateIgnoredEvent = (index, patch) => {
    const list = [...(Array.isArray(config.eventosIgnoradosAuditoria) ? config.eventosIgnoradosAuditoria : [])];
    list[index] = { ...list[index], ...patch };
    emitChange({ eventosIgnoradosAuditoria: list });
  };
  const addIgnoredEvent = () => {
    emitChange({
      eventosIgnoradosAuditoria: [
        ...(Array.isArray(config.eventosIgnoradosAuditoria) ? config.eventosIgnoradosAuditoria : []),
        {
          id: `IGNORAR_EVENTO_${Date.now()}`,
          ativo: true,
          campo: "evento",
          operador: "contem",
          valor: "",
          regras: ["todas"],
          motivo: "Evento nao deve gerar pendencia de auditoria.",
        },
      ],
    });
  };
  const startDrag = (ev) => {
    if (ev.button !== 0) return;
    dragRef.current = { type: "drag", x: ev.clientX, y: ev.clientY, left: rect.left, top: rect.top };
  };
  const startResize = (ev) => {
    if (ev.button !== 0) return;
    ev.preventDefault();
    dragRef.current = { type: "resize", x: ev.clientX, y: ev.clientY, width: rect.width, height: rect.height };
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="pb-audit-params-backdrop" role="dialog" aria-modal="true" aria-label="Parametros de auditoria">
      <section
        className="pb-audit-params-modal"
        style={{ width: `${rect.width}px`, height: `${rect.height}px`, left: `${rect.left}px`, top: `${rect.top}px` }}
      >
        <header className="pb-audit-params-head" onMouseDown={startDrag}>
          <div>
            <h3>Parametros da auditoria de ponto</h3>
            <p>
              {activeRules.toLocaleString("pt-BR")} regra(s) ativa(s): {totalRules.toLocaleString("pt-BR")} nativas e{" "}
              {customRules.length.toLocaleString("pt-BR")} da empresa.
            </p>
          </div>
          <button type="button" className="pb-icon-btn" onClick={onClose} onMouseDown={(ev) => ev.stopPropagation()} aria-label="Fechar parametros">
            X
          </button>
        </header>

        <div className="pb-audit-params-body">
          <section className="pb-audit-params-help">
            <strong>Como a auditoria e feita</strong>
            <p>
              Para cada evento, o motor normaliza horario planejado e marcacoes, pareia os horarios, aplica os
              parametros abaixo e executa somente as regras ativas. Cada anomalia guarda regra, parametros vigentes,
              evidencias e memoria de calculo para justificar a conclusao.
            </p>
          </section>

          <section className="pb-audit-params-section">
            <div className="pb-audit-params-section-head">
              <strong>Parametros numericos</strong>
              <span>Usados no calculo das anomalias.</span>
            </div>
            <div className="pb-audit-params-grid">
              {AUDITORIA_PARAM_FIELDS.map((field) => (
                <label key={field.key} className="pb-audit-param-field">
                  <span>{field.label}</span>
                  <div>
                    <input
                      type="number"
                      min="0"
                      value={Number(config[field.key] || 0)}
                      onChange={(ev) => updateNumber(field.key, ev.target.value)}
                    />
                    <em>{field.suffix}</em>
                  </div>
                  <small>{field.desc}</small>
                </label>
              ))}
            </div>
          </section>

          <section className="pb-audit-params-section">
            <div className="pb-audit-params-section-head">
              <strong>Eventos de jornada principal</strong>
              <span>As regras de jornada e marcacao rodam somente quando o evento contiver esses termos.</span>
            </div>
            <label className="pb-audit-custom-rule">
              <span>Um termo por linha</span>
              <div className="pb-audit-term-add-row">
                <input
                  value={newTextTerm.eventosJornadaPrincipal}
                  onChange={(ev) =>
                    setNewTextTerm((prev) => ({ ...prev, eventosJornadaPrincipal: ev.target.value }))
                  }
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter") {
                      ev.preventDefault();
                      addTextListTerm("eventosJornadaPrincipal");
                    }
                  }}
                  placeholder="Adicionar termo de jornada principal"
                />
                <button
                  type="button"
                  className="pb-audit-action-btn"
                  onClick={() => addTextListTerm("eventosJornadaPrincipal")}
                >
                  Adicionar
                </button>
              </div>
              <textarea
                value={(config.eventosJornadaPrincipal || []).join("\n")}
                onChange={(ev) => updateTextList("eventosJornadaPrincipal", ev.target.value)}
                placeholder={"HORAS NORMAIS\nJORNADA NORMAL\nPRESENCA"}
              />
            </label>
          </section>

          <section className="pb-audit-params-section">
            <div className="pb-audit-params-section-head">
              <strong>Eventos aceitos sem marcacao</strong>
              <span>Quando o evento contiver um desses termos, a auditoria nao acusa jornada sem marcacoes.</span>
            </div>
            <label className="pb-audit-custom-rule">
              <span>Um termo por linha</span>
              <div className="pb-audit-term-add-row">
                <input
                  value={newTextTerm.eventosSemMarcacaoOk}
                  onChange={(ev) =>
                    setNewTextTerm((prev) => ({ ...prev, eventosSemMarcacaoOk: ev.target.value }))
                  }
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter") {
                      ev.preventDefault();
                      addTextListTerm("eventosSemMarcacaoOk");
                    }
                  }}
                  placeholder="Adicionar termo aceito sem marcacao"
                />
                <button
                  type="button"
                  className="pb-audit-action-btn"
                  onClick={() => addTextListTerm("eventosSemMarcacaoOk")}
                >
                  Adicionar
                </button>
              </div>
              <textarea
                value={(config.eventosSemMarcacaoOk || []).join("\n")}
                onChange={(ev) => updateTextList("eventosSemMarcacaoOk", ev.target.value)}
                placeholder={"FERIAS\nFALTA NAO JUSTIFICADA\nAFASTAMENTO"}
              />
            </label>
          </section>

          <section className="pb-audit-params-section">
            <div className="pb-audit-params-section-head pb-audit-params-section-head--rules">
              <div>
                <strong>Regras da auditoria</strong>
                <span>Desative apenas regras que nao se aplicam ao acordo, CCT ou politica interna.</span>
              </div>
              <div className="pb-audit-rule-actions">
                <button type="button" className="pb-audit-action-btn" onClick={activateAll}>
                  Ativar todas
                </button>
                <button type="button" className="pb-audit-action-btn pb-audit-action-btn--danger" onClick={deactivateAll}>
                  Desativar todas
                </button>
                <label className="pb-audit-rule-bulk-treatment">
                  <span>Alterar todas para</span>
                  <select
                    defaultValue=""
                    onChange={(ev) => {
                      if (!ev.target.value) return;
                      setAllRuleTreatments(ev.target.value);
                      ev.target.value = "";
                    }}
                  >
                    <option value="" disabled>
                      Selecione
                    </option>
                    {AUDIT_RULE_TREATMENTS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="pb-audit-rules-list">
              {REGRAS_AUDITORIA_PONTO_META.map((rule) => {
                const disabled = disabledSet.has(rule.id);
                return (
                  <article
                    key={rule.id}
                    className={`pb-audit-rule-row pb-audit-rule-row--${rule.severidadePadrao}${disabled ? " is-disabled" : ""}`}
                  >
                    <label className="pb-audit-rule-switch">
                      <input
                        type="checkbox"
                        checked={!disabled}
                        onChange={() => toggleRule(rule.id)}
                        aria-label={`Ativar regra ${rule.titulo}`}
                      />
                    </label>
                    <span>
                      <strong>{rule.titulo}</strong>
                      <small>{AUDITORIA_RULE_HELP[rule.categoria] || AUDITORIA_RULE_HELP.operacional}</small>
                      <em>
                        {rule.categoria} - {rule.severidadePadrao} - {rule.id}
                      </em>
                    </span>
                    {rule.limiar ? (
                      <label className="pb-audit-rule-limiar">
                        <span>{rule.limiar.label}</span>
                        <div>
                          <input
                            type="number"
                            min="0"
                            value={Number(config.limiarsRegras?.[rule.id] ?? rule.limiar.defaultValue)}
                            onChange={(ev) =>
                              emitChange({
                                limiarsRegras: {
                                  ...(config.limiarsRegras || {}),
                                  [rule.id]: Math.max(0, Math.round(Number(ev.target.value) || 0)),
                                },
                              })
                            }
                          />
                          <em>{rule.limiar.suffix}</em>
                        </div>
                      </label>
                    ) : <span />}
                    <select
                      value={config.tratamentoRegras?.[rule.id] || "acao"}
                      onChange={(ev) =>
                        emitChange({
                          tratamentoRegras: {
                            ...(config.tratamentoRegras || {}),
                            [rule.id]: ev.target.value,
                          },
                        })
                      }
                    >
                      {AUDIT_RULE_TREATMENTS.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    <b>{disabled ? "Inativa" : "Ativa"}</b>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="pb-audit-params-section">
            <div className="pb-audit-params-section-head pb-audit-params-section-head--rules">
              <div>
                <strong>Eventos ignorados na auditoria</strong>
                <span>Use para eventos que nao devem gerar pendencia de auditoria.</span>
              </div>
              <button type="button" className="pb-audit-action-btn pb-audit-action-btn--primary" onClick={addIgnoredEvent}>
                Adicionar evento
              </button>
            </div>
            <div className="pb-audit-custom-rules">
              {(config.eventosIgnoradosAuditoria || []).map((item, index) => (
                <article key={item.id || index} className="pb-audit-custom-rule">
                  <div className="pb-audit-custom-rule-head">
                    <label>
                      <input
                        type="checkbox"
                        checked={item.ativo !== false}
                        onChange={(ev) => updateIgnoredEvent(index, { ativo: ev.target.checked })}
                      />
                      Ativo
                    </label>
                    <button
                      type="button"
                      className="pb-audit-action-btn pb-audit-action-btn--danger"
                      onClick={() =>
                        emitChange({
                          eventosIgnoradosAuditoria: (config.eventosIgnoradosAuditoria || []).filter((_, itemIndex) => itemIndex !== index),
                        })
                      }
                    >
                      Remover
                    </button>
                  </div>
                  <label>
                    <span>Evento contem</span>
                    <input value={item.valor || ""} onChange={(ev) => updateIgnoredEvent(index, { valor: ev.target.value })} />
                  </label>
                  <label>
                    <span>Motivo</span>
                    <input value={item.motivo || ""} onChange={(ev) => updateIgnoredEvent(index, { motivo: ev.target.value })} />
                  </label>
                </article>
              ))}
            </div>
          </section>

          <section className="pb-audit-params-section">
            <div className="pb-audit-params-section-head pb-audit-params-section-head--rules">
              <div>
                <strong>Regras especificas da empresa</strong>
                <span>Crie regras simples para sua realidade, CCT ou politica interna. Elas entram na mesma auditoria.</span>
              </div>
              <button type="button" className="pb-audit-action-btn pb-audit-action-btn--primary" onClick={addCustomRule}>
                Nova regra
              </button>
            </div>
            <div className="pb-audit-custom-rules">
              {customRules.length ? (
                customRules.map((rule) => (
                  <article key={rule.id} className="pb-audit-custom-rule">
                    <div className="pb-audit-custom-rule-head">
                      <label>
                        <input
                          type="checkbox"
                          checked={rule.ativo !== false}
                          onChange={(ev) => updateCustomRule(rule.id, { ativo: ev.target.checked })}
                        />
                        Ativa
                      </label>
                      <select value={rule.severidade} onChange={(ev) => updateCustomRule(rule.id, { severidade: ev.target.value })}>
                        <option value="critica">Critica</option>
                        <option value="alta">Alta</option>
                        <option value="media">Media</option>
                        <option value="baixa">Baixa</option>
                      </select>
                      <button type="button" className="pb-audit-action-btn pb-audit-action-btn--danger" onClick={() => removeCustomRule(rule.id)}>
                        Remover
                      </button>
                    </div>
                    <label>
                      <span>Nome da regra</span>
                      <input value={rule.titulo} onChange={(ev) => updateCustomRule(rule.id, { titulo: ev.target.value })} />
                    </label>
                    <div className="pb-audit-custom-rule-grid">
                      <label>
                        <span>Campo avaliado</span>
                        <select value={rule.campo} onChange={(ev) => updateCustomRule(rule.id, { campo: ev.target.value })}>
                          {AUDITORIA_CUSTOM_RULE_FIELDS.map((field) => (
                            <option key={field.value} value={field.value}>
                              {field.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Operador</span>
                        <select value={rule.operador} onChange={(ev) => updateCustomRule(rule.id, { operador: ev.target.value })}>
                          {AUDITORIA_CUSTOM_RULE_OPERATORS.map((operator) => (
                            <option key={operator.value} value={operator.value}>
                              {operator.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Valor de comparacao</span>
                        <input value={rule.valor} onChange={(ev) => updateCustomRule(rule.id, { valor: ev.target.value })} />
                      </label>
                    </div>
                    <label>
                      <span>Mensagem exibida quando acionar</span>
                      <input value={rule.mensagem} onChange={(ev) => updateCustomRule(rule.id, { mensagem: ev.target.value })} />
                    </label>
                  </article>
                ))
              ) : (
                <p className="pb-audit-custom-empty">Nenhuma regra especifica criada.</p>
              )}
            </div>
          </section>
        </div>

        <footer className="pb-audit-params-foot">
          <button type="button" className="pb-audit-action-btn pb-audit-action-btn--ghost" onClick={onReset}>
            Restaurar padrao
          </button>
          <span>{disabledSet.size ? `${disabledSet.size} regra(s) nativa(s) desativada(s)` : "Todas as regras nativas ativas"}</span>
          <button type="button" className="pb-audit-action-btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="pb-audit-action-btn pb-audit-action-btn--save" onClick={onSave}>
            Salvar parametros
          </button>
        </footer>
        <span className="pb-audit-params-resize" onMouseDown={startResize} aria-hidden="true" />
      </section>
    </div>,
    document.body,
  );
}
