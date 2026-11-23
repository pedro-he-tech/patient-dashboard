import { describe, expect, it } from "vitest";
import { ageInYears, parseCalendarDate } from "../src/lib/patients/dates";

const day = (iso: string) => {
  const date = parseCalendarDate(iso);
  if (!date) {
    throw new Error(`bad fixture date ${iso}`);
  }
  return date;
};

describe("ageInYears", () => {
  const today = day("2026-11-23");

  it("counts a birthday today as completed", () => {
    expect(ageInYears(day("1896-11-23"), today)).toBe(130);
  });

  it("does not add a year the day before the birthday", () => {
    expect(ageInYears(day("1895-11-24"), today)).toBe(130);
    expect(ageInYears(day("1895-11-23"), today)).toBe(131);
  });

  it("treats a February 29 birthday as March 1 in a non-leap year", () => {
    expect(ageInYears(day("2024-02-29"), day("2025-02-28"))).toBe(0);
    expect(ageInYears(day("2024-02-29"), day("2025-03-01"))).toBe(1);
  });

  it("rejects calendar dates that do not exist", () => {
    expect(parseCalendarDate("2026-02-31")).toBeNull();
    expect(parseCalendarDate("2024-02-29")).not.toBeNull();
  });
});
