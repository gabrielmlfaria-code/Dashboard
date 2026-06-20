import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildHdmColFilter,
  isHdmColFilterActive,
  matchHdmFilterCondition,
  normalizeHdmColFilter,
  rowPassesHdmColFilter,
} from "./hdmColFilterUtils.js";

const display = (val, col) => {
  if (val === "" || val == null) return "(vazio)";
  if (col === "plan") {
    const n = Number(val);
    const v = Math.round(n);
    return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
  }
  return String(val);
};

describe("normalizeHdmColFilter", () => {
  it("aceita Set legado", () => {
    const set = new Set(["a"]);
    assert.deepEqual(normalizeHdmColFilter(set), { values: set, cond: null });
  });

  it("aceita objeto com condicao", () => {
    const f = { values: null, cond: { op: "gt", value: "10" } };
    assert.equal(normalizeHdmColFilter(f).cond.op, "gt");
  });
});

describe("matchHdmFilterCondition", () => {
  it("contem busca no texto exibido", () => {
    assert.equal(matchHdmFilterCondition("ferias", "evento", "contains", "fer", display), true);
    assert.equal(matchHdmFilterCondition("ferias", "evento", "contains", "xyz", display), false);
  });

  it("compara numeros em colunas de horas", () => {
    assert.equal(matchHdmFilterCondition("480", "plan", "gte", "8:00", display), true);
    assert.equal(matchHdmFilterCondition("420", "plan", "gt", "8:00", display), false);
    assert.equal(matchHdmFilterCondition("420", "plan", "eq", "7:00", display), true);
  });

  it("compara texto com operadores", () => {
    assert.equal(matchHdmFilterCondition("b", "depto", "gt", "a", display), true);
    assert.equal(matchHdmFilterCondition("a", "depto", "lt", "b", display), true);
  });
});

describe("rowPassesHdmColFilter", () => {
  it("aplica whitelist e condicao juntos", () => {
    const filter = buildHdmColFilter(new Set(["480", "420"]), { op: "gte", value: "420" });
    assert.equal(isHdmColFilterActive(filter), true);
    assert.equal(rowPassesHdmColFilter("480", filter, "plan", display), true);
    assert.equal(rowPassesHdmColFilter("300", filter, "plan", display), false);
  });
});
