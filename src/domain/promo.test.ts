import { describe, expect, it } from "vitest";
import type { BookingRequest } from "./booking";
import { mustParseCalendarDate } from "./calendar";
import { priceBooking } from "./pricing";
import { applyPromo, findUsablePromo, type PromoContext } from "./promo";
import {
  allDayPass,
  attendee,
  BIRTHDAYS,
  BOOKING_DAY,
  bookingRequest,
  dayPass,
  familyPass,
  myFamilyOn11Nov,
} from "./test-builders";
import { validateBooking } from "./validate-booking";

const context: PromoContext = { today: BOOKING_DAY, usedCounts: {} };

function promoFor(code: string, request: BookingRequest) {
  const checked = validateBooking(request, BOOKING_DAY);
  if (!checked.ok) throw new Error(`Test booking is not valid: ${JSON.stringify(checked.error)}`);
  const { lines, subtotal } = priceBooking(checked.value);
  return applyPromo(code, lines, subtotal, context);
}

const justSaurabh = bookingRequest({ attendees: [attendee("a1", "Saurabh", BIRTHDAYS.saurabh, dayPass("2026-11-11"))] });

describe("typing a code", () => {
  it("ignores case and spaces", () => {
    expect(promoFor("  seva10 ", myFamilyOn11Nov())).toEqual({ status: "applied", code: "SEVA10", discount: 1870 });
  });

  it("treats an empty box as no code", () => {
    expect(promoFor("   ", myFamilyOn11Nov())).toEqual({ status: "none" });
  });

  it("rejects a code that doesn't exist", () => {
    expect(promoFor("FREE100", myFamilyOn11Nov())).toMatchObject({ status: "rejected", reason: "PROMO_NOT_FOUND" });
  });
});

describe("FLAT20", () => {
  it("takes $20 off, but never more than the booking costs", () => {
    expect(promoFor("FLAT20", myFamilyOn11Nov())).toMatchObject({ discount: 2000 });
    expect(promoFor("FLAT20", justSaurabh)).toMatchObject({ discount: 1500 }); // a $15 booking becomes $0
  });
});

describe("KIDSFREE", () => {
  it("frees a child's own Day Pass and All-Day Pass", () => {
    const request = bookingRequest({
      attendees: [
        attendee("a1", "Saurabh", BIRTHDAYS.saurabh, dayPass("2026-11-11")),
        attendee("a2", "Harsh", BIRTHDAYS.harsh, dayPass("2026-11-11", "2026-11-12")),
        attendee("a3", "Asha", "2017-01-01", allDayPass),
      ],
    });
    expect(promoFor("KIDSFREE", request)).toMatchObject({ discount: 1600 + 3000 });
  });

  it("does not touch the Family Pass or a child's dinner", () => {
    const request = bookingRequest({
      familyPasses: [{ id: "fp1", day: "2026-11-11" }],
      attendees: [
        attendee("a1", "Saurabh", BIRTHDAYS.saurabh, familyPass("fp1")),
        attendee("a2", "Harsh", BIRTHDAYS.harsh, familyPass("fp1")),
        attendee("a3", "Asha", "2017-01-01", dayPass("2026-11-11"), { dinnerDays: ["2026-11-11"] }),
      ],
    });
    // Only Asha's own $8 Day Pass is free.
    expect(promoFor("KIDSFREE", request)).toMatchObject({ discount: 800 });
  });

  it("is accepted but says it did nothing when there are no child tickets", () => {
    expect(promoFor("KIDSFREE", justSaurabh)).toEqual({ status: "no-effect", code: "KIDSFREE", reason: "NO_CHILD_TICKETS" });
  });
});

describe("codes that can't be used", () => {
  it("rejects EXPIRED5 after its last day, but not on it", () => {
    expect(promoFor("EXPIRED5", myFamilyOn11Nov())).toMatchObject({ status: "rejected", reason: "PROMO_EXPIRED" });
    expect(findUsablePromo("EXPIRED5", { ...context, today: mustParseCalendarDate("2026-09-30") }).ok).toBe(true);
  });

  it("rejects MAXEDOUT, going by the live count from the database", () => {
    expect(promoFor("MAXEDOUT", myFamilyOn11Nov())).toMatchObject({ status: "rejected", reason: "PROMO_USED_UP" });
    expect(findUsablePromo("MAXEDOUT", { ...context, usedCounts: { MAXEDOUT: 99 } }).ok).toBe(true);
  });
});
