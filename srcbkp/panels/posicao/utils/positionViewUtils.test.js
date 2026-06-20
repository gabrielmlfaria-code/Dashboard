import assert from "node:assert/strict";
import test from "node:test";

import { filterHistRowsByPeriod } from "./positionViewUtils.js";

test("filterHistRowsByPeriod preenche dias corridos ausentes no modo 7d", () => {
  const rows = [
    { date: "2026-05-26", total: 10 },
    { date: "2026-05-27", total: 11 },
    { date: "2026-05-28", total: 12 },
    { date: "2026-05-29", total: 13 },
    { date: "2026-05-30", total: 14 },
    { date: "2026-05-31", total: 15 },
    { date: "2026-06-03", total: 16 },
  ];

  const result = filterHistRowsByPeriod(rows, { faltDays: 7 });

  assert.deepEqual(
    result.map((r) => r.date),
    [
      "2026-05-28",
      "2026-05-29",
      "2026-05-30",
      "2026-05-31",
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
    ],
  );
  assert.equal(result[4]._missingPeriodDay, true);
  assert.equal(result[5]._missingPeriodDay, true);
});
