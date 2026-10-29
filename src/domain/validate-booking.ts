import { checkBookerAge, type BookerAgeError } from "./age";
import { checkAttendee, type ValidAttendee } from "./attendee-rules";
import type { Booker, BookingRequest, FamilyPassRequest } from "./booking";
import type { DateParts } from "./calendar";
import { PRODUCTS } from "./catalog";
import { isDayOpen } from "./festival";
import { fail, ok, type Result } from "./result";

// Festival rules only. Whether the request is well formed (names filled in,
// a real-looking email, sensible quantities, no repeated ids) is checked at
// the API edge before it gets here.

export const RESPONSIBLE_ADULT_AGE = 18;

export type BookingIssueCode =
  | BookerAgeError
  | "DUPLICATE_PERSON"
  | "TICKET_REQUIRED"
  | "NO_TICKET_UNDER_5"
  | "NO_EXTRAS_UNDER_5"
  | "DAY_ALREADY_STARTED"
  | "ALL_DAY_PASS_CLOSED"
  | "FAMILY_PASS_NOT_FOUND"
  | "FAMILY_PASS_UNUSED"
  | "FAMILY_PASS_NEEDS_ADULT"
  | "FAMILY_PASS_TOO_MANY_ADULTS"
  | "FAMILY_PASS_TOO_MANY_CHILDREN"
  | "EXTRA_NOT_OFFERED_THAT_DAY"
  | "EXTRA_NOT_ON_ATTENDING_DAY"
  | "NO_ADULT_IN_GROUP";

type IssueParams = Record<string, string | number>;

// `field` uses the attendee's id, not their position in the list,
// so it still points at the right person after someone is removed.
export type BookingIssue = { code: BookingIssueCode; field: string; params?: IssueParams };

export type Report = (code: BookingIssueCode, field: string, params?: IssueParams) => void;

export type ValidBooking = {
  booker: Booker & { age: number };
  attendees: ValidAttendee[];
  familyPasses: FamilyPassRequest[];
  dandiyaPairs: number;
  promoCode: string | null;
};

// Collects every problem instead of stopping at the first,
// so the family can fix everything in one go.
export function validateBooking(
  request: BookingRequest,
  today: DateParts,
): Result<ValidBooking, BookingIssue[]> {
  const issues: BookingIssue[] = [];
  const report: Report = (code, field, params) => {
    issues.push(params ? { code, field, params } : { code, field });
  };

  const bookerAge = checkBookerAge(request.booker.dateOfBirth, today);
  if (!bookerAge.ok) report(bookerAge.error, "booker.dateOfBirth");

  for (const pass of request.familyPasses) {
    if (!isDayOpen(pass.day, today)) {
      report("DAY_ALREADY_STARTED", `familyPasses.${pass.id}.day`, { day: pass.day });
    }
  }

  const passDays = new Map(request.familyPasses.map((pass) => [pass.id, pass.day] as const));
  const attendees = request.attendees.flatMap((attendee) => {
    const valid = checkAttendee(attendee, today, passDays, report);
    return valid ? [valid] : [];
  });

  reportSamePersonTwice(request, report);

  // We can't count adults and children while someone's date of birth is
  // wrong, so these wait until it's fixed instead of adding confusing errors.
  if (attendees.length === request.attendees.length) {
    checkFamilyPasses(request.familyPasses, attendees, report);
    if (!attendees.some((attendee) => attendee.age >= RESPONSIBLE_ADULT_AGE)) {
      report("NO_ADULT_IN_GROUP", "attendees", { minAge: RESPONSIBLE_ADULT_AGE });
    }
  }

  if (!bookerAge.ok || issues.length > 0) return fail(issues);

  return ok({
    booker: { ...request.booker, age: bookerAge.value },
    attendees,
    familyPasses: request.familyPasses,
    dandiyaPairs: request.dandiyaPairs,
    promoCode: request.promoCode?.trim() || null,
  });
}

// Up to 2 adults and 2 children (from the catalog), at least one adult,
// and no selling a pass nobody is on. Toddlers hold no ticket, so they never take a place.
function checkFamilyPasses(passes: FamilyPassRequest[], attendees: ValidAttendee[], report: Report): void {
  const { covers } = PRODUCTS["family-pass"];

  for (const pass of passes) {
    const members = attendees.filter(
      (attendee) => attendee.entry.type === "family-pass" && attendee.entry.familyPassId === pass.id,
    );
    const adults = members.filter((member) => member.band === "adult").length;
    const children = members.filter((member) => member.band === "child").length;
    const field = `familyPasses.${pass.id}`;

    if (members.length === 0) {
      report("FAMILY_PASS_UNUSED", field);
      continue;
    }
    if (adults === 0) report("FAMILY_PASS_NEEDS_ADULT", field);
    if (adults > covers.maxAdults) report("FAMILY_PASS_TOO_MANY_ADULTS", field, { max: covers.maxAdults });
    if (children > covers.maxChildren) report("FAMILY_PASS_TOO_MANY_CHILDREN", field, { max: covers.maxChildren });
  }
}

// Same name and birthday twice is almost surely one person added twice.
// Twins have different names, so they're fine.
function reportSamePersonTwice(request: BookingRequest, report: Report): void {
  const seen = new Set<string>();
  for (const attendee of request.attendees) {
    const key = `${attendee.fullName.trim().toLowerCase()}|${attendee.dateOfBirth}`;
    if (seen.has(key)) report("DUPLICATE_PERSON", `attendees.${attendee.id}`);
    seen.add(key);
  }
}
