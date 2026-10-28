import { describe, expect, it } from "vitest";
import { classifyAttendee, checkBookerAge, ageBandFor } from "./age";
import { mustParseCalendarDate } from "./calendar";

// Age is measured on the first festival day, 10 Nov 2026.
// For most tests "today" is 28 Oct 2026, a bit before the festival.
const today = mustParseCalendarDate("2026-10-28");

describe("ageBandFor", () => {
  it("puts ages into the three bands from the brief", () => {
    expect(ageBandFor(0)).toBe("under-5");
    expect(ageBandFor(4)).toBe("under-5");
    expect(ageBandFor(5)).toBe("child");
    expect(ageBandFor(11)).toBe("child");
    expect(ageBandFor(12)).toBe("adult");
    expect(ageBandFor(80)).toBe("adult");
  });
});

describe("classifyAttendee: the age bands, measured on 10 Nov 2026", () => {
  // [date of birth, expected age on 10 Nov, expected band, why this case matters]
  const cases = [
    ["2021-11-11", 4, "under-5", "turns 5 the day after the festival starts, so still free"],
    ["2021-11-10", 5, "child", "turns 5 on the first day, the lowest child age"],
    ["2021-11-09", 5, "child", "turned 5 the day before the festival"],
    ["2014-11-11", 11, "child", "turns 12 the day after the festival starts, so still a child"],
    ["2014-11-10", 12, "adult", "turns 12 on the first day, the lowest adult age"],
    ["1990-05-05", 36, "adult", "an ordinary adult"],
    ["2020-02-29", 6, "child", "born on 29 Feb, already had the birthday before November"],
    ["2026-10-28", 0, "under-5", "a baby born today"],
  ] as const;

  it.each(cases)("%s is %i years old, band %s (%s)", (dateOfBirth, age, band) => {
    expect(classifyAttendee(dateOfBirth, today)).toEqual({ ok: true, value: { age, band } });
  });

  it("treats a baby born during the festival as 0 years old, not minus 1", () => {
    const duringFestival = mustParseCalendarDate("2026-11-12");
    expect(classifyAttendee("2026-11-11", duringFestival)).toEqual({
      ok: true,
      value: { age: 0, band: "under-5" },
    });
  });
});

describe("classifyAttendee: nonsense in the date of birth field", () => {
  it.each(["", "abc", "10/05/2019", "2019-02-30", "2019-13-01", "2019-5-10", "-3", "200", "null"])(
    "refuses %j as not a date",
    (input) => {
      expect(classifyAttendee(input, today)).toEqual({ ok: false, error: "DOB_INVALID" });
    },
  );

  it("refuses a date of birth that is still in the future", () => {
    expect(classifyAttendee("2026-10-29", today)).toEqual({ ok: false, error: "DOB_IN_FUTURE" });
    expect(classifyAttendee("2027-01-01", today)).toEqual({ ok: false, error: "DOB_IN_FUTURE" });
  });

  it("allows someone exactly 120 years old, but not 121", () => {
    expect(classifyAttendee("1905-10-29", today).ok).toBe(true); // 120 until tomorrow
    expect(classifyAttendee("1905-10-28", today)).toEqual({ ok: false, error: "DOB_IMPLAUSIBLE" }); // 121 today
    expect(classifyAttendee("1890-01-01", today)).toEqual({ ok: false, error: "DOB_IMPLAUSIBLE" });
  });
});

describe("checkBookerAge: the person paying must be 18 or more", () => {
  it("lets someone in on their 18th birthday", () => {
    expect(checkBookerAge("2008-10-28", today)).toEqual({ ok: true, value: 18 });
  });

  it("lets in someone who turned 18 yesterday", () => {
    expect(checkBookerAge("2008-10-27", today)).toEqual({ ok: true, value: 18 });
  });

  it("stops someone who turns 18 tomorrow", () => {
    expect(checkBookerAge("2008-10-29", today)).toEqual({ ok: false, error: "BOOKER_UNDER_18" });
  });

  it("measures on the booking day, not on the festival start", () => {
    // Turns 18 on 5 Nov. That is before the festival (10 Nov) but after today (28 Oct).
    expect(checkBookerAge("2008-11-05", today)).toEqual({ ok: false, error: "BOOKER_UNDER_18" });
  });

  it("lets a person who turns 18 later book once that day has come", () => {
    const fifthNov = mustParseCalendarDate("2026-11-05");
    expect(checkBookerAge("2008-11-05", fifthNov)).toEqual({ ok: true, value: 18 });
  });

  it("passes on the same date of birth errors as everyone else", () => {
    expect(checkBookerAge("abc", today)).toEqual({ ok: false, error: "DOB_INVALID" });
    expect(checkBookerAge("2026-10-29", today)).toEqual({ ok: false, error: "DOB_IN_FUTURE" });
    expect(checkBookerAge("1890-01-01", today)).toEqual({ ok: false, error: "DOB_IMPLAUSIBLE" });
  });
});
