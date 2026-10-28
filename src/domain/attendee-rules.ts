import { classifyAttendee } from "./age";
import type { Attendee, EntryChoice } from "./booking";
import type { DateParts } from "./calendar";
import { PRODUCTS, type PersonDayExtra } from "./catalog";
import { FESTIVAL_DAYS, FESTIVAL_START, isDayOpen, type FestivalDay } from "./festival";
import type { Report } from "./validate-booking";

type TicketedEntry = Exclude<EntryChoice, { type: "none" }>;

// A toddler gets its own shape with no ticket, days or extras,
// so pricing has nowhere to put a charge for one.
export type ValidAttendee =
  | {
      id: string;
      fullName: string;
      age: number;
      band: "under-5";
      entry: { type: "none" };
      attendingDays: [];
      dinnerDays: [];
      garbaDays: [];
      phone: null;
    }
  | {
      id: string;
      fullName: string;
      age: number;
      band: "child" | "adult";
      entry: TicketedEntry;
      attendingDays: FestivalDay[];
      dinnerDays: FestivalDay[];
      garbaDays: FestivalDay[];
      phone: string | null;
    };

export function checkAttendee(
  attendee: Attendee,
  today: DateParts,
  passDays: Map<string, FestivalDay>,
  report: Report,
): ValidAttendee | null {
  let problems = 0;
  const flag: Report = (code, field, params) => {
    problems += 1;
    report(code, `attendees.${attendee.id}.${field}`, params);
  };

  const classified = classifyAttendee(attendee.dateOfBirth, today);
  if (!classified.ok) {
    flag(classified.error, "dateOfBirth");
    return null;
  }
  const { age, band } = classified.value;
  const { id, fullName, entry } = attendee;

  if (band === "under-5") {
    // Refused rather than quietly dropped: the server shouldn't change an order without saying so.
    if (entry.type !== "none") flag("NO_TICKET_UNDER_5", "entry");
    // Little ones share a parent's plate (see DESIGN.md).
    if (attendee.dinnerDays.length > 0 || attendee.garbaDays.length > 0) flag("NO_EXTRAS_UNDER_5", "extras");
    if (problems > 0) return null;
    return { id, fullName, age, band, entry: { type: "none" }, attendingDays: [], dinnerDays: [], garbaDays: [], phone: null };
  }

  if (entry.type === "none") {
    flag("TICKET_REQUIRED", "entry");
    return null;
  }

  const attendingDays = daysCoveredBy(entry, today, passDays, flag);
  checkExtraDays(attendee.dinnerDays, PRODUCTS["dinner-plate"], attendingDays, "dinnerDays", flag);
  checkExtraDays(attendee.garbaDays, PRODUCTS["garba-workshop"], attendingDays, "garbaDays", flag);
  if (problems > 0) return null;

  return {
    id,
    fullName,
    age,
    band,
    entry,
    attendingDays,
    dinnerDays: attendee.dinnerDays,
    garbaDays: attendee.garbaDays,
    // Kids have no contact details of their own; the booker is their contact.
    phone: band === "adult" ? (attendee.phone ?? null) : null,
  };
}

function daysCoveredBy(
  entry: TicketedEntry,
  today: DateParts,
  passDays: Map<string, FestivalDay>,
  flag: Report,
): FestivalDay[] {
  switch (entry.type) {
    case "day-pass":
      for (const day of entry.days) {
        if (!isDayOpen(day, today)) flag("DAY_ALREADY_STARTED", "entry.days", { day });
      }
      return entry.days;
    case "all-day-pass":
      // "All 5 days" stops being true once day 1 has started, and we don't
      // charge for days that are gone. Day Passes are still on sale.
      if (!isDayOpen(FESTIVAL_START, today)) flag("ALL_DAY_PASS_CLOSED", "entry");
      return [...FESTIVAL_DAYS];
    case "family-pass": {
      const day = passDays.get(entry.familyPassId);
      if (!day) {
        flag("FAMILY_PASS_NOT_FOUND", "entry.familyPassId");
        return [];
      }
      return [day];
    }
  }
}

function checkExtraDays(
  days: FestivalDay[],
  product: PersonDayExtra,
  attendingDays: FestivalDay[],
  field: string,
  flag: Report,
): void {
  for (const day of days) {
    if (!product.availableDays.includes(day)) {
      flag("EXTRA_NOT_OFFERED_THAT_DAY", field, { day, productId: product.id });
    } else if (!attendingDays.includes(day)) {
      flag("EXTRA_NOT_ON_ATTENDING_DAY", field, { day, productId: product.id });
    }
  }
}
