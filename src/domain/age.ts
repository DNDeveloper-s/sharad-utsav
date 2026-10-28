import { ageOn, compareDates, mustParseCalendarDate, parseCalendarDate, type DateParts } from "./calendar";
import { FESTIVAL_START } from "./festival";
import { fail, ok, type Result } from "./result";

// ---------- The numbers the committee can change ----------
// If the rules change ("seniors 65+ pay less"), this is where we start.

export const CHILD_FROM_AGE = 5; // 5 to 11 is a child
export const ADULT_FROM_AGE = 12; // 12 and above is an adult
export const BOOKER_MIN_AGE = 18; // the person paying must be at least this old
export const MAX_PLAUSIBLE_AGE = 120; // older than this is surely a typing mistake

// "under-5" means younger than CHILD_FROM_AGE. Free, no ticket needed.
export type AgeBand = "under-5" | "child" | "adult";

// What can be wrong with a date of birth. These are codes, not sentences.
// The screen turns them into friendly words, so the rule and the wording
// can change separately.
export type DateOfBirthError = "DOB_INVALID" | "DOB_IN_FUTURE" | "DOB_IMPLAUSIBLE";
export type BookerAgeError = DateOfBirthError | "BOOKER_UNDER_18";

export type AttendeeAge = { age: number; band: AgeBand };

const festivalStart = mustParseCalendarDate(FESTIVAL_START);

export function ageBandFor(age: number): AgeBand {
  if (age >= ADULT_FROM_AGE) return "adult";
  if (age >= CHILD_FROM_AGE) return "child";
  return "under-5";
}

// Checks a date of birth that came from outside (so we trust nothing).
// "today" is passed in, so the rule does not secretly depend on the clock.
function checkDateOfBirth(input: string, today: DateParts): Result<DateParts, DateOfBirthError> {
  const dateOfBirth = parseCalendarDate(input);
  if (!dateOfBirth) return fail("DOB_INVALID");

  if (compareDates(dateOfBirth, today) > 0) return fail("DOB_IN_FUTURE");
  if (ageOn(dateOfBirth, today) > MAX_PLAUSIBLE_AGE) return fail("DOB_IMPLAUSIBLE");

  return ok(dateOfBirth);
}

// Which age band is this person in for the festival?
// Everyone is measured on the first festival day, so one person gets
// one ticket type for the whole week, even if a birthday falls inside it.
export function classifyAttendee(
  dateOfBirth: string,
  today: DateParts,
): Result<AttendeeAge, DateOfBirthError> {
  const checked = checkDateOfBirth(dateOfBirth, today);
  if (!checked.ok) return checked;

  // A baby born after the festival started (booking mid-festival) is 0, not minus 1.
  const age = Math.max(0, ageOn(checked.value, festivalStart));
  return ok({ age, band: ageBandFor(age) });
}

// The person paying must be 18 or more on the day they book.
// This is "today", not the festival start: they pay now.
export function checkBookerAge(
  dateOfBirth: string,
  today: DateParts,
): Result<number, BookerAgeError> {
  const checked = checkDateOfBirth(dateOfBirth, today);
  if (!checked.ok) return checked;

  const age = ageOn(checked.value, today);
  if (age < BOOKER_MIN_AGE) return fail("BOOKER_UNDER_18");
  return ok(age);
}
