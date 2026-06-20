const mensalEventKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function buildMensalEventColabs(histRows, eventName) {
  const target = mensalEventKey(eventName);
  if (!target) return [];
  const map = new Map();

  (Array.isArray(histRows) ? histRows : []).forEach((row) => {
    const date = row?.date || row?.data || row?.data_referencia || "";
    const events = Array.isArray(row?._events) ? row._events : [];
    events.forEach((ev) => {
      const label = ev?.evento || ev?.descricao || ev?.event || "";
      if (mensalEventKey(label) !== target) return;
      const mat = String(ev?.mat ?? ev?.matricula ?? "").trim();
      const nome = String(ev?.nome || ev?.colaborador || mat || "").trim();
      if (!nome && !mat) return;
      const key = `${mat}|${nome}`;
      const current = map.get(key) || {
        mat,
        nome,
        depto: ev?.depto || ev?.depto_desc || ev?.departamento || "",
        cargo: ev?.cargo || ev?.cargo_desc || "",
        filial: ev?.filial || "",
        ocorrencias: 0,
        minutos: 0,
        dias: new Set(),
      };
      current.ocorrencias += 1;
      current.minutos += Math.round((Number(ev?.horas) || 0) * 60);
      if (date) current.dias.add(date);
      map.set(key, current);
    });
  });

  return Array.from(map.values())
    .map((row) => ({ ...row, dias: Array.from(row.dias).sort() }))
    .sort((a, b) => b.ocorrencias - a.ocorrencias || a.nome.localeCompare(b.nome, "pt-BR"));
}
