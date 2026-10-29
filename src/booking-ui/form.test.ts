import { describe, expect, it } from "vitest";
import { parseBookingRequest } from "@/server/booking-schema";
import {
  bookerAgeIssue,
  buildRequest,
  formReducer,
  initialForm,
  isBlocked,
  stepOfField,
  toggleDay,
  type FormAction,
  type FormState,
} from "./form";

function run(actions: FormAction[], start: FormState = initialForm): FormState {
  return actions.reduce(formReducer, start);
}

const filledBooker = [
  { type: "setBooker", field: "fullName", value: "Saurabh Shah" },
  { type: "setBooker", field: "email", value: "saurabh@example.com" },
  { type: "setBooker", field: "phone", value: "214 555 0100" },
  { type: "setBooker", field: "dateOfBirth", value: "1990-05-01" },
] satisfies FormAction[];

describe("formReducer", () => {
  it("gives every person their own id, even after a removal", () => {
    const state = run([{ type: "addPerson" }, { type: "removePerson", id: "a1" }, { type: "addPerson" }]);
    expect(state.attendees.map((p) => p.id)).toEqual(["a2"]);
  });

  it("stays on the step and shows errors when Next is blocked", () => {
    const state = run([{ type: "next", blocked: true }]);
    expect(state).toMatchObject({ step: 0, showErrors: true });
  });

  it("moves on, hides errors, and stops at the last step", () => {
    const state = run([
      { type: "next", blocked: true },
      { type: "next", blocked: false },
      { type: "next", blocked: false },
      { type: "next", blocked: false },
      { type: "next", blocked: false },
    ]);
    expect(state).toMatchObject({ step: 3, showErrors: false });
  });

  it("does not go back past the first step", () => {
    expect(run([{ type: "back" }]).step).toBe(0);
  });
});

describe("toggleDay", () => {
  it("adds a day, then removes it", () => {
    const once = toggleDay([], "2026-11-12");
    expect(once).toEqual(["2026-11-12"]);
    expect(toggleDay(once, "2026-11-12")).toEqual([]);
  });
});

describe("buildRequest", () => {
  const family = run([
    ...filledBooker,
    { type: "addPerson", prefill: { fullName: "Saurabh Shah", dateOfBirth: "1990-05-01", days: ["2026-11-10"] } },
    { type: "addPerson", prefill: { fullName: "Ayushi", dateOfBirth: "1992-08-10", entryKind: "family-pass", familyDay: "2026-11-11" } },
    { type: "addPerson", prefill: { fullName: "Harsh", dateOfBirth: "2015-03-02", entryKind: "family-pass", familyDay: "2026-11-11" } },
    { type: "setDandiyaPairs", value: 2 },
    { type: "setPromoCode", value: "  seva10 " },
  ]);

  it("makes a request the server's own shape check accepts", () => {
    expect(parseBookingRequest(buildRequest(family)).ok).toBe(true);
  });

  it("puts everyone on a Family Pass for the same day on one pass", () => {
    const request = buildRequest(family);
    expect(request.familyPasses).toEqual([{ id: "family-2026-11-11", day: "2026-11-11" }]);
    expect(request.attendees.slice(1).map((p) => p.entry)).toEqual([
      { type: "family-pass", familyPassId: "family-2026-11-11" },
      { type: "family-pass", familyPassId: "family-2026-11-11" },
    ]);
  });

  it("sends no Family Pass when nobody picked one", () => {
    expect(buildRequest(run([{ type: "addPerson" }])).familyPasses).toEqual([]);
  });

  it("trims the promo code and leaves it out when empty", () => {
    expect(buildRequest(family).promoCode).toBe("seva10");
    expect(buildRequest(run([{ type: "setPromoCode", value: "  " }])).promoCode).toBeUndefined();
  });

  it("leaves an empty phone out, because the server rejects an empty one", () => {
    const [adult] = buildRequest(family).attendees;
    expect(adult).not.toHaveProperty("phone");
  });

  it("asks for 'no ticket' when a Day Pass has no day ticked", () => {
    const state = run([{ type: "addPerson", prefill: { fullName: "Samskriti", days: [] } }]);
    expect(buildRequest(state).attendees[0]?.entry).toEqual({ type: "none" });
  });

  it("sends no prices and no adult or child flag", () => {
    const body = JSON.stringify(buildRequest(family));
    expect(body).not.toMatch(/price|cents|adult|child|total/i);
  });
});

describe("bookerAgeIssue", () => {
  const now = new Date("2026-10-29T15:00:00Z");

  it("says so on step 1 when the person paying is under 18", () => {
    expect(bookerAgeIssue("2010-01-01", now)).toEqual({ code: "BOOKER_UNDER_18", field: "booker.dateOfBirth" });
  });

  it("asks for a date when none is typed", () => {
    expect(bookerAgeIssue("", now)?.code).toBe("DOB_INVALID");
  });

  it("is happy with an adult", () => {
    expect(bookerAgeIssue("1990-05-01", now)).toBeNull();
  });
});

describe("which step a problem belongs to", () => {
  it("maps fields to steps", () => {
    expect(stepOfField("booker.email")).toBe(0);
    expect(stepOfField("attendees.a2.dateOfBirth")).toBe(1);
    expect(stepOfField("familyPasses.family-2026-11-11")).toBe(1);
    expect(stepOfField("products.garba-workshop")).toBe(1);
    expect(stepOfField("dandiyaPairs")).toBe(2);
    expect(stepOfField("promoCode")).toBe(3);
  });

  it("blocks Next only for problems on this step or an earlier one", () => {
    const issues = [{ field: "attendees.a1.fullName" }];
    expect(isBlocked(0, issues)).toBe(false);
    expect(isBlocked(1, issues)).toBe(true);
    expect(isBlocked(2, issues)).toBe(true);
  });
});
