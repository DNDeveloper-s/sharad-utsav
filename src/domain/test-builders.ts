// Only used by tests.
import type { Attendee, BookingRequest, EntryChoice } from "./booking";
import { mustParseCalendarDate } from "./calendar";
import { PRODUCTS, type ProductId } from "./catalog";
import type { FestivalDay } from "./festival";

// Most tests book on 28 Oct 2026, just before the festival.
export const BOOKING_DAY = mustParseCalendarDate("2026-10-28");

// The family used across the tests. Dates of birth are made up.
// On 10 Nov 2026 Harsh is 11 (child) and Samskriti is 3 (under 5).
export const BIRTHDAYS = {
  saurabh: "1994-03-12",
  ayushi: "1996-07-21",
  suraj: "1998-01-05",
  rekha: "1968-09-14",
  ramesh: "1965-02-02",
  harsh: "2015-06-15",
  samskriti: "2023-04-20",
} as const;

export function dayPass(first: FestivalDay, ...more: FestivalDay[]): EntryChoice {
  return { type: "day-pass", days: [first, ...more] };
}
export const allDayPass: EntryChoice = { type: "all-day-pass" };
export function familyPass(familyPassId: string): EntryChoice {
  return { type: "family-pass", familyPassId };
}
export const noTicket: EntryChoice = { type: "none" };

export function attendee(
  id: string,
  fullName: string,
  dateOfBirth: string,
  entry: EntryChoice,
  more: Partial<Pick<Attendee, "dinnerDays" | "garbaDays" | "phone">> = {},
): Attendee {
  return { id, fullName, dateOfBirth, entry, dinnerDays: [], garbaDays: [], ...more };
}

export function bookingRequest(overrides: Partial<BookingRequest> = {}): BookingRequest {
  return {
    booker: {
      fullName: "Saurabh",
      email: "saurabh@example.com",
      phone: "+1 214 555 0100",
      dateOfBirth: BIRTHDAYS.saurabh,
    },
    attendees: [],
    familyPasses: [],
    dandiyaPairs: 0,
    ...overrides,
  };
}

// The family from DESIGN.md, all coming on Wed 11 Nov:
// Saurabh, Ayushi and Harsh share a Family Pass, the other three adults take
// Day Passes, Samskriti is free. Dinner for everyone aged 5+, Garba for Ayushi,
// and 2 pairs of Dandiya sticks.
export function myFamilyOn11Nov(overrides: Partial<BookingRequest> = {}): BookingRequest {
  const day: FestivalDay = "2026-11-11";
  const dinner = { dinnerDays: [day] };
  return bookingRequest({
    familyPasses: [{ id: "fp1", day }],
    attendees: [
      attendee("a1", "Saurabh", BIRTHDAYS.saurabh, familyPass("fp1"), dinner),
      attendee("a2", "Ayushi", BIRTHDAYS.ayushi, familyPass("fp1"), { ...dinner, garbaDays: [day] }),
      attendee("a3", "Harsh", BIRTHDAYS.harsh, familyPass("fp1"), dinner),
      attendee("a4", "Suraj", BIRTHDAYS.suraj, dayPass(day), dinner),
      attendee("a5", "Rekha", BIRTHDAYS.rekha, dayPass(day), dinner),
      attendee("a6", "Ramesh", BIRTHDAYS.ramesh, dayPass(day), dinner),
      attendee("a7", "Samskriti", BIRTHDAYS.samskriti, noTicket),
    ],
    dandiyaPairs: 2,
    ...overrides,
  });
}

// Stock as the database starts out.
export function startingStock(): Record<ProductId, number> {
  return {
    "day-pass-adult": PRODUCTS["day-pass-adult"].startingStock,
    "day-pass-child": PRODUCTS["day-pass-child"].startingStock,
    "all-day-pass-adult": PRODUCTS["all-day-pass-adult"].startingStock,
    "all-day-pass-child": PRODUCTS["all-day-pass-child"].startingStock,
    "family-pass": PRODUCTS["family-pass"].startingStock,
    "dandiya-sticks": PRODUCTS["dandiya-sticks"].startingStock,
    "dinner-plate": PRODUCTS["dinner-plate"].startingStock,
    "garba-workshop": PRODUCTS["garba-workshop"].startingStock,
  };
}
