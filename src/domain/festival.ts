import { compareDates, mustParseCalendarDate, type DateParts } from "./calendar";

// The five festival days, written as plain dates.
// "as const" makes TypeScript remember the exact values, not just "some strings".
export const FESTIVAL_DAYS = [
  "2026-11-10",
  "2026-11-11",
  "2026-11-12",
  "2026-11-13",
  "2026-11-14",
] as const;

// A type that can only be one of those five dates.
// Writing "2026-11-15" anywhere in the code is now a compile error.
export type FestivalDay = (typeof FESTIVAL_DAYS)[number];

// Taken from the list above, so the two can never disagree.
// This is also the day we measure everyone's age on.
export const FESTIVAL_START = FESTIVAL_DAYS[0];

// The temple's time zone. "Has this day already started?" is answered here.
export const FESTIVAL_TIME_ZONE = "America/Chicago";

export const FESTIVAL_INFO = {
  name: "Sharad Utsav 2026",
  location: "Radha Krishna Temple, Allen, Texas",
} as const;

// Checks a string that came from outside (like a request) and tells TypeScript
// it is really a festival day. We never trust that the browser sent a valid day.
export function isFestivalDay(value: string): value is FestivalDay {
  return FESTIVAL_DAYS.some((day) => day === value);
}

// A day can be booked until it starts, so on the day itself it's too late.
export function isDayOpen(day: FestivalDay, today: DateParts): boolean {
  return compareDates(mustParseCalendarDate(day), today) > 0;
}
