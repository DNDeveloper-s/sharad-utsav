import { checkBookerAge, type BookerAgeError } from "@/domain/age";
import type { BookingRequest, EntryChoice } from "@/domain/booking";
import { todayIn } from "@/domain/calendar";
import { FESTIVAL_DAYS, FESTIVAL_TIME_ZONE, type FestivalDay } from "@/domain/festival";

// What the family has typed so far. Text stays text (dates of birth too),
// because the server decides what is allowed. The page only collects.

export type EntryKind = EntryChoice["type"];

export type PersonForm = {
  id: string;
  fullName: string;
  dateOfBirth: string;
  entryKind: EntryKind;
  days: FestivalDay[]; // used by the Day Pass
  familyDay: FestivalDay; // used by the Family Pass
  dinnerDays: FestivalDay[];
  garbaDays: FestivalDay[];
  phone: string;
};

export type BookerForm = { fullName: string; email: string; phone: string; dateOfBirth: string };

export type FormState = {
  step: number;
  showErrors: boolean; // only after "Next" was pressed on a step with problems
  booker: BookerForm;
  attendees: PersonForm[];
  dandiyaPairs: number;
  promoCode: string;
  nextId: number; // the reducer stays pure, so ids come from a counter
};

export const LAST_STEP = 3;

export const initialForm: FormState = {
  step: 0,
  showErrors: false,
  booker: { fullName: "", email: "", phone: "", dateOfBirth: "" },
  attendees: [],
  dandiyaPairs: 0,
  promoCode: "",
  nextId: 1,
};

export type FormAction =
  | { type: "back" }
  | { type: "next"; blocked: boolean }
  | { type: "setBooker"; field: keyof BookerForm; value: string }
  | { type: "addPerson"; prefill?: Partial<Omit<PersonForm, "id">> }
  | { type: "updatePerson"; id: string; patch: Partial<Omit<PersonForm, "id">> }
  | { type: "removePerson"; id: string }
  | { type: "setDandiyaPairs"; value: number }
  | { type: "setPromoCode"; value: string };

function newPerson(id: string, prefill: Partial<Omit<PersonForm, "id">> = {}): PersonForm {
  return {
    id,
    fullName: "",
    dateOfBirth: "",
    entryKind: "day-pass",
    days: [],
    familyDay: FESTIVAL_DAYS[0],
    dinnerDays: [],
    garbaDays: [],
    phone: "",
    ...prefill,
  };
}

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "back":
      return { ...state, step: Math.max(0, state.step - 1), showErrors: false };
    case "next":
      if (action.blocked) return { ...state, showErrors: true };
      return { ...state, step: Math.min(LAST_STEP, state.step + 1), showErrors: false };
    case "setBooker":
      return { ...state, booker: { ...state.booker, [action.field]: action.value } };
    case "addPerson":
      return {
        ...state,
        attendees: [...state.attendees, newPerson(`a${state.nextId}`, action.prefill)],
        nextId: state.nextId + 1,
      };
    case "updatePerson":
      return {
        ...state,
        attendees: state.attendees.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)),
      };
    case "removePerson":
      return { ...state, attendees: state.attendees.filter((p) => p.id !== action.id) };
    case "setDandiyaPairs":
      return { ...state, dandiyaPairs: action.value };
    case "setPromoCode":
      return { ...state, promoCode: action.value };
  }
}

export function toggleDay(days: FestivalDay[], day: FestivalDay): FestivalDay[] {
  return days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
}

// shortcut: everyone on a Family Pass for the same day shares one pass, so two families
// can't each have their own pass on one day in one booking. Upgrade: let people pick "pass A / pass B".
export const familyPassIdFor = (day: FestivalDay) => `family-${day}`;

function entryFor(person: PersonForm): EntryChoice {
  switch (person.entryKind) {
    case "day-pass": {
      const [first, ...rest] = person.days;
      // No day ticked: say "no ticket", so the server answers "needs a ticket".
      return first ? { type: "day-pass", days: [first, ...rest] } : { type: "none" };
    }
    case "family-pass":
      return { type: "family-pass", familyPassId: familyPassIdFor(person.familyDay) };
    case "all-day-pass":
      return { type: "all-day-pass" };
    case "none":
      return { type: "none" };
  }
}

// What goes to the server. No prices and no adult/child: the server works those out.
export function buildRequest(state: FormState): BookingRequest {
  const phone = (person: PersonForm) => (person.phone.trim() === "" ? {} : { phone: person.phone });
  const promo = state.promoCode.trim();
  const familyDays = new Set(state.attendees.filter((p) => p.entryKind === "family-pass").map((p) => p.familyDay));

  return {
    booker: state.booker,
    attendees: state.attendees.map((person) => ({
      id: person.id,
      fullName: person.fullName,
      dateOfBirth: person.dateOfBirth,
      entry: entryFor(person),
      dinnerDays: person.dinnerDays,
      garbaDays: person.garbaDays,
      ...phone(person),
    })),
    familyPasses: [...familyDays].map((day) => ({ id: familyPassIdFor(day), day })),
    dandiyaPairs: state.dandiyaPairs,
    ...(promo === "" ? {} : { promoCode: promo }),
  };
}

// The server only checks the booker's age once the whole request is well formed,
// which is after people are added. Same domain rule, run early so step 1 can say it.
export function bookerAgeIssue(dateOfBirth: string, now: Date): { code: BookerAgeError; field: string } | null {
  const checked = checkBookerAge(dateOfBirth, todayIn(FESTIVAL_TIME_ZONE, now));
  return checked.ok ? null : { code: checked.error, field: "booker.dateOfBirth" };
}

// Which step a problem belongs to, so "Next" only waits for problems
// the family can fix on this step or an earlier one.
export function stepOfField(field: string): number {
  const area = field.split(".")[0];
  if (area === "booker") return 0;
  if (area === "attendees" || area === "familyPasses" || area === "products") return 1;
  if (area === "dandiyaPairs") return 2;
  return LAST_STEP;
}

export function isBlocked(step: number, issues: readonly { field: string }[]): boolean {
  return issues.some((issue) => stepOfField(issue.field) <= step);
}
