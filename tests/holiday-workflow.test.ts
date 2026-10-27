import assert from "node:assert/strict";
import test from "node:test";
import { addCalendarDays, formatHolidayDate, getKampalaDate } from "../src/lib/holiday-dates";

test("holiday reminder window uses Kampala dates and includes the 14-day boundary", () => {
  const date = new Date("2026-10-27T21:30:00.000Z");
  const today = getKampalaDate(date);
  assert.equal(today, "2026-10-28");
  assert.equal(addCalendarDays(today, 14), "2026-11-11");
});

test("holiday dates display as Uganda local calendar dates", () => {
  assert.match(formatHolidayDate("2026-10-27"), /27/);
  assert.match(formatHolidayDate("2026-10-27"), /October/);
  assert.match(formatHolidayDate("2026-10-27"), /2026/);
});
