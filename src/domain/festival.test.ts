import { describe, expect, it } from "vitest";
import { FESTIVAL_DAYS, FESTIVAL_START, isFestivalDay } from "./festival";

describe("festival days", () => {
  it("are the five days from Tue 10 Nov to Sat 14 Nov 2026", () => {
    expect(FESTIVAL_DAYS).toEqual([
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
      "2026-11-13",
      "2026-11-14",
    ]);
  });

  it("start on 10 Nov, which is the day we measure age on", () => {
    expect(FESTIVAL_START).toBe("2026-11-10");
  });
});

describe("isFestivalDay", () => {
  it("accepts each festival day", () => {
    for (const day of FESTIVAL_DAYS) {
      expect(isFestivalDay(day)).toBe(true);
    }
  });

  it("rejects days just outside the festival", () => {
    expect(isFestivalDay("2026-11-09")).toBe(false);
    expect(isFestivalDay("2026-11-15")).toBe(false);
  });

  it("rejects nonsense", () => {
    expect(isFestivalDay("")).toBe(false);
    expect(isFestivalDay("tomorrow")).toBe(false);
    expect(isFestivalDay("10/11/2026")).toBe(false);
  });
});
