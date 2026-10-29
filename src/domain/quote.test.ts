import { describe, expect, it } from "vitest";
import type { BookingRequest } from "./booking";
import { quoteBooking, type QuoteContext } from "./quote";
import {
  allDayPass,
  attendee,
  BIRTHDAYS,
  BOOKING_DAY,
  bookingRequest,
  dayPass,
  familyPass,
  myFamilyOn11Nov,
  noTicket,
  startingStock,
} from "./test-builders";

function quote(request: BookingRequest, overrides: Partial<QuoteContext> = {}) {
  return quoteBooking(request, { today: BOOKING_DAY, remainingStock: startingStock(), promoUsedCounts: {}, ...overrides });
}

const withGarba = (id: string, name: string, dob: string, day: "2026-11-11" | "2026-11-13") =>
  attendee(id, name, dob, dayPass(day), { garbaDays: [day] });

describe("prices", () => {
  it("prices the family from DESIGN.md with SEVA10: $187.00 - $18.70 = $168.30", () => {
    expect(quote(myFamilyOn11Nov({ promoCode: "SEVA10" }))).toMatchObject({
      bookable: true,
      subtotal: 18700,
      discount: 1870,
      total: 16830,
    });
  });

  it("lets FLAT20 take a small booking to $0, and it's still bookable", () => {
    const small = bookingRequest({ attendees: [attendee("a1", "Saurabh", BIRTHDAYS.saurabh, dayPass("2026-11-11"))], promoCode: "FLAT20" });
    expect(quote(small)).toMatchObject({ bookable: true, total: 0 });
  });
});

describe("what blocks a booking", () => {
  it("a broken rule: no prices, and the problems are listed", () => {
    const toddlerWithTicket = bookingRequest({
      attendees: [
        attendee("a1", "Saurabh", BIRTHDAYS.saurabh, dayPass("2026-11-11")),
        attendee("a2", "Samskriti", BIRTHDAYS.samskriti, dayPass("2026-11-11")),
      ],
    });
    const result = quote(toddlerWithTicket);
    expect(result).toMatchObject({ bookable: false, booking: null, lines: [], total: 0 });
    expect(result.issues.map((issue) => issue.code)).toEqual(["NO_TICKET_UNDER_5"]);
  });

  it("a code that doesn't work: full price shown, no discount, fix or remove it", () => {
    expect(quote(myFamilyOn11Nov({ promoCode: "EXPIRED5" }))).toMatchObject({
      bookable: false,
      issues: [],
      discount: 0,
      total: 18700,
    });
  });

  it("but KIDSFREE with nothing to discount does not block", () => {
    const adultsOnly = bookingRequest({
      attendees: [attendee("a1", "Saurabh", BIRTHDAYS.saurabh, dayPass("2026-11-11"))],
      promoCode: "KIDSFREE",
    });
    expect(quote(adultsOnly)).toMatchObject({ bookable: true, promo: { status: "no-effect" } });
  });
});

describe("stock", () => {
  it("shows the adult All-Day Pass as sold out", () => {
    const result = quote(bookingRequest({ attendees: [attendee("a1", "Saurabh", BIRTHDAYS.saurabh, allDayPass)] }));
    expect(result.bookable).toBe(false);
    expect(result.issues).toEqual([
      {
        code: "STOCK_INSUFFICIENT",
        field: "products.all-day-pass-adult",
        params: { productId: "all-day-pass-adult", requested: 1, remaining: 0 },
      },
    ]);
  });

  it("sells the last 2 Garba places, but not a 3rd", () => {
    const two = [withGarba("a1", "Saurabh", BIRTHDAYS.saurabh, "2026-11-11"), withGarba("a2", "Ayushi", BIRTHDAYS.ayushi, "2026-11-13")];
    const three = [...two, withGarba("a3", "Suraj", BIRTHDAYS.suraj, "2026-11-13")];

    expect(quote(bookingRequest({ attendees: two })).bookable).toBe(true);
    expect(quote(bookingRequest({ attendees: three })).issues).toMatchObject([
      { code: "STOCK_INSUFFICIENT", params: { productId: "garba-workshop", requested: 3, remaining: 2 } },
    ]);
  });

  it("counts a Day Pass as one per person, not per day", () => {
    const fiveDays = bookingRequest({
      attendees: [
        attendee("a1", "Saurabh", BIRTHDAYS.saurabh, dayPass("2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14")),
      ],
    });
    const lastPass = { remainingStock: { ...startingStock(), "day-pass-adult": 1 } };
    expect(quote(fiveDays, lastPass).bookable).toBe(true);
  });
});

describe("Family Pass hint", () => {
  it("says when Day Passes would be cheaper ($38 vs $40), without blocking", () => {
    const result = quote(myFamilyOn11Nov());
    expect(result.hints).toEqual([
      { code: "FAMILY_PASS_COSTS_MORE", familyPassId: "fp1", familyPassPrice: 4000, dayPassesPrice: 3800 },
    ]);
    expect(result.bookable).toBe(true);
  });

  it("says nothing when the pass is the better deal (2 + 2 would be $46)", () => {
    const request = bookingRequest({
      familyPasses: [{ id: "fp1", day: "2026-11-11" }],
      attendees: [
        attendee("a1", "Saurabh", BIRTHDAYS.saurabh, familyPass("fp1")),
        attendee("a2", "Ayushi", BIRTHDAYS.ayushi, familyPass("fp1")),
        attendee("a3", "Harsh", BIRTHDAYS.harsh, familyPass("fp1")),
        attendee("a4", "Asha", "2017-01-01", familyPass("fp1")),
        attendee("a5", "Samskriti", BIRTHDAYS.samskriti, noTicket),
      ],
    });
    expect(quote(request).hints).toEqual([]);
  });
});
