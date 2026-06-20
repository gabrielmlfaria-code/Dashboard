import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateAbsenteeism,
  calculateBankHours,
  calculateMonthlyVariation,
  calculateTurnoverPct,
} from "./indicatorCalculations.js";

describe("indicatorCalculations", () => {
  it("calcula absenteismo por horas ausentes sobre planejadas", () => {
    const result = calculateAbsenteeism({
      plannedMinutes: 1606 * 60,
      unjustifiedAbsentMinutes: 267 * 60 + 45,
      metaPct: 5,
    });

    assert.equal(result.pct, 16.7);
    assert.equal(result.deviationPp, 11.7);
    assert.equal(result.baseMinutes, 16065);
  });

  it("nao usa deficit de trabalhadas x planejadas como base do absenteismo", () => {
    const plannedMinutes = 1606 * 60;
    const workedMinutes = 701 * 60 + 7;
    const workedDeficit = plannedMinutes - workedMinutes;
    const absentMinutes = 267 * 60 + 45;

    assert.notEqual(workedDeficit, absentMinutes);
    assert.equal(
      calculateAbsenteeism({
        plannedMinutes,
        unjustifiedAbsentMinutes: absentMinutes,
      }).baseMinutes,
      absentMinutes,
    );
  });

  it("calcula banco de horas com saldo anterior importado", () => {
    const result = calculateBankHours({
      previousBalanceMinutes: 37 * 60 + 3,
      creditMinutes: 28 * 60,
      debitMinutes: -(4 * 60 + 4),
    });

    assert.equal(result.previousBalanceMinutes, 2223);
    assert.equal(result.movementMinutes, 1436);
    assert.equal(result.nextBalanceMinutes, 3659);
  });

  it("respeita saldo proximo informado quando existe", () => {
    const result = calculateBankHours({
      previousBalanceMinutes: 100,
      creditMinutes: 50,
      debitMinutes: -20,
      nextBalanceMinutes: 999,
    });

    assert.equal(result.nextBalanceMinutes, 999);
  });

  it("calcula variacao mensal e base baixa", () => {
    assert.equal(calculateMonthlyVariation(120, 100), 20);
    assert.equal(calculateMonthlyVariation(10, 0), "base baixa");
    assert.equal(calculateMonthlyVariation(0, 0), null);
  });

  it("calcula turnover pelo modelo medio de entradas e saidas", () => {
    assert.equal(
      Number(
        calculateTurnoverPct({
          desligados: 9,
          admitidos: 5,
          totalColaboradores: 978,
        }).toFixed(3),
      ),
      0.716,
    );
  });
});
