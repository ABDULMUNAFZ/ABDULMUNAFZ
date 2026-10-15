import assert from "node:assert/strict";
import test from "node:test";
import { computeStats } from "./calendar-stats.mjs";

const stats = entries => computeStats([entries.map(([date, count]) => ({date, count}))], "2026-10-15");

test("an archived calendar retains best streak but has no current streak", () => {
  const value = stats([["2026-10-09", 1], ["2026-10-10", 2]]);
  assert.equal(value.current, 0);
  assert.equal(value.best, 2);
  assert.equal(value.total, 3);
});
test("today can still receive a contribution", () => {
  assert.equal(stats([["2026-10-14", 1], ["2026-10-15", 0]]).current, 1);
});
test("a completed empty yesterday breaks the streak", () => {
  assert.equal(stats([["2026-10-13", 1], ["2026-10-14", 0]]).current, 0);
});
test("an active yesterday remains current and an empty calendar stays empty", () => {
  assert.equal(stats([["2026-10-14", 1]]).current, 1);
  assert.equal(stats([]).current, 0);
});
