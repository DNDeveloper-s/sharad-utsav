import { describe, expect, it } from "vitest";
import {
  ageOn,
  compareDates,
  mustParseCalendarDate,
  parseCalendarDate,
  todayIn,
} from "./calendar";

describe("parseCalendarDate", () => {
  it("reads a normal date", () => {
    expect(parseCalendarDate("2026-11-10")).toEqual({ year: 2026, month: 11, day: 10 });
  });

  it("accepts 29 Feb in a leap year", () => {
    expect(parseCalendarDate("2020-02-29")).not.toBeNull();
    expect(parseCalendarDate("2000-02-29")).not.toBeNull(); // divisible by 400
  });

  it("refuses 29 Feb when the year is not a leap year", () => {
    expect(parseCalendarDate("2019-02-29")).toBeNull();
    expect(parseCalendarDate("1900-02-29")).toBeNull(); // divisible by 100 but not 400
  });

  it("refuses days that do not exist", () => {
    expect(parseCalendarDate("2019-02-30")).toBeNull();
    expect(parseCalendarDate("2019-04-31")).toBeNull();
    expect(parseCalendarDate("2019-05-00")).toBeNull();
  });

  it("refuses months that do not exist", () => {
    expect(parseCalendarDate("2019-13-01")).toBeNull();
    expect(parseCalendarDate("2019-00-10")).toBeNull();
  });

  it("refuses anything that is not exactly YYYY-MM-DD", () => {
    for (const nonsense of [
      "",
      "abc",
      "10/05/2019",
      "2019-5-10",
      "19-05-10",
      " 2019-05-10",
      "2019-05-10 ",
      "2019-05-10T00:00:00Z",
      "2019-05-10; DROP TABLE bookings",
    ]) {
      expect(parseCalendarDate(nonsense), nonsense).toBeNull();
    }
  });
});

describe("mustParseCalendarDate", () => {
  it("throws on a bad date, because that would be a bug in our own code", () => {
    expect(() => mustParseCalendarDate("2026-02-30")).toThrow();
  });
});

describe("compareDates", () => {
  const a = mustParseCalendarDate("2026-11-10");

  it("says same day, earlier and later", () => {
    expect(compareDates(a, mustParseCalendarDate("2026-11-10"))).toBe(0);
    expect(compareDates(a, mustParseCalendarDate("2026-11-11"))).toBeLessThan(0);
    expect(compareDates(a, mustParseCalendarDate("2026-10-31"))).toBeGreaterThan(0);
    expect(compareDates(a, mustParseCalendarDate("2025-12-31"))).toBeGreaterThan(0);
  });
});

describe("ageOn", () => {
  const born = mustParseCalendarDate("2015-06-15");

  it("is one less the day before the birthday", () => {
    expect(ageOn(born, mustParseCalendarDate("2026-06-14"))).toBe(10);
  });

  it("goes up on the birthday itself", () => {
    expect(ageOn(born, mustParseCalendarDate("2026-06-15"))).toBe(11);
  });

  it("stays the same the day after", () => {
    expect(ageOn(born, mustParseCalendarDate("2026-06-16"))).toBe(11);
  });

  it("is zero on the day someone is born", () => {
    expect(ageOn(born, born)).toBe(0);
  });

  describe("for someone born on 29 Feb", () => {
    const leapBaby = mustParseCalendarDate("2020-02-29");

    it("is still the younger age on 28 Feb of a normal year", () => {
      expect(ageOn(leapBaby, mustParseCalendarDate("2027-02-28"))).toBe(6);
    });

    it("gets older on 1 Mar of a normal year", () => {
      expect(ageOn(leapBaby, mustParseCalendarDate("2027-03-01"))).toBe(7);
    });

    it("gets older on 29 Feb of a leap year", () => {
      expect(ageOn(leapBaby, mustParseCalendarDate("2028-02-29"))).toBe(8);
    });
  });
});

describe("todayIn the temple's time zone", () => {
  const texas = "America/Chicago";

  it("is still the day before when it is just after midnight in UTC", () => {
    // 03:00 UTC on 10 Nov is 21:00 on 9 Nov in Texas.
    expect(todayIn(texas, new Date("2026-11-10T03:00:00Z"))).toEqual({
      year: 2026,
      month: 11,
      day: 9,
    });
  });

  it("changes to the new day at midnight in Texas, not at midnight in UTC", () => {
    // 06:00 UTC on 10 Nov is exactly 00:00 on 10 Nov in Texas (winter time, UTC-6).
    expect(todayIn(texas, new Date("2026-11-10T06:00:00Z"))).toEqual({
      year: 2026,
      month: 11,
      day: 10,
    });
  });

  it("uses summer time (UTC-5) in October", () => {
    expect(todayIn(texas, new Date("2026-10-28T04:59:00Z"))).toEqual({ year: 2026, month: 10, day: 27 });
    expect(todayIn(texas, new Date("2026-10-28T05:00:00Z"))).toEqual({ year: 2026, month: 10, day: 28 });
  });
});
