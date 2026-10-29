import type { FestivalDay } from "./festival";
import type { NonEmptyArray } from "./types";

// What the browser is allowed to ask for. This is the "request" side only.
//
// Two things are missing on purpose:
//  - No prices. The server works out every price itself.
//  - No "adult" or "child". The server decides that from the date of birth,
//    so "an adult ticket for a 7-year-old" is not something a request can say.

// What kind of entry one person wants.
export type EntryChoice =
  | { type: "day-pass"; days: NonEmptyArray<FestivalDay> } // at least one day
  | { type: "all-day-pass" }
  | { type: "family-pass"; familyPassId: string } // points to one of the booking's family passes
  | { type: "none" }; // only allowed for children under 5

export type Attendee = {
  id: string; // made by the browser, so rows can be matched up
  fullName: string;
  dateOfBirth: string; // exactly what was typed. The age rules check it.
  entry: EntryChoice;
  dinnerDays: FestivalDay[];
  garbaDays: FestivalDay[];
  phone?: string; // adults only, optional
};

// The person paying. If they are coming too, the screen also adds them
// to the attendees list, so they do not type their details twice.
export type Booker = {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string; // exactly what was typed. The age rules check it.
};

// One Family Pass for one day. Several attendees can point to it.
export type FamilyPassRequest = {
  id: string;
  day: FestivalDay;
};

export type BookingRequest = {
  booker: Booker;
  attendees: Attendee[];
  familyPasses: FamilyPassRequest[];
  dandiyaPairs: number;
  promoCode?: string; // exactly what the person typed, still to be checked
};
