import { describe, expect, it } from "vitest";
import type { BookingRequest } from "./booking";
import { entryProductFor, priceBooking, type PricedBooking } from "./pricing";
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
} from "./test-builders";
import { validateBooking } from "./validate-booking";

function price(request: BookingRequest): PricedBooking {
  const checked = validateBooking(request, BOOKING_DAY);
  if (!checked.ok) throw new Error(`Test booking is not valid: ${JSON.stringify(checked.error)}`);
  return priceBooking(checked.value);
}

function lineFor(priced: PricedBooking, attendeeId: string) {
  const line = priced.lines.find((l) => l.attendeeId === attendeeId);
  if (!line) throw new Error(`no line for ${attendeeId}`);
  return line;
}

const saurabhOn11 = attendee("a1", "Saurabh", BIRTHDAYS.saurabh, dayPass("2026-11-11"));

describe("tickets", () => {
  it("charges a Day Pass per day, but uses one unit of stock", () => {
    const priced = price(
      bookingRequest({
        attendees: [attendee("a1", "Saurabh", BIRTHDAYS.saurabh, dayPass("2026-11-10", "2026-11-11", "2026-11-12"))],
      }),
    );
    expect(lineFor(priced, "a1")).toMatchObject({ productId: "day-pass-adult", quantity: 3, total: 4500, stockUnits: 1 });
  });

  it("charges an All-Day Pass once", () => {
    const priced = price(
      bookingRequest({
        attendees: [
          attendee("a1", "Saurabh", BIRTHDAYS.saurabh, allDayPass),
          attendee("a2", "Harsh", BIRTHDAYS.harsh, allDayPass),
        ],
      }),
    );
    expect(priced.subtotal).toBe(6000 + 3000);
  });

  it("charges a Family Pass once for the group, with no ticket lines for its members", () => {
    const priced = price(
      bookingRequest({
        familyPasses: [{ id: "fp1", day: "2026-11-12" }],
        attendees: [
          attendee("a1", "Saurabh", BIRTHDAYS.saurabh, familyPass("fp1")),
          attendee("a2", "Harsh", BIRTHDAYS.harsh, familyPass("fp1")),
        ],
      }),
    );
    expect(priced.lines).toEqual([
      {
        productId: "family-pass",
        attendeeId: null,
        familyPassId: "fp1",
        day: "2026-11-12",
        quantity: 1,
        unitPrice: 4000,
        total: 4000,
        stockUnits: 1,
      },
    ]);
  });

  it("charges nothing for a child under 5", () => {
    const priced = price(bookingRequest({ attendees: [saurabhOn11, attendee("a2", "Samskriti", BIRTHDAYS.samskriti, noTicket)] }));
    expect(priced.subtotal).toBe(1500);
  });
});

describe("adult or child price comes from the date of birth, not the browser", () => {
  it.each([
    ["a 7-year-old", "2019-03-01", "day-pass-child"],
    ["a 12-year-old", "2014-11-10", "day-pass-adult"],
    ["a child who turns 12 during the festival", "2014-11-12", "day-pass-child"],
  ])("%s pays the right price", (_who, dateOfBirth, productId) => {
    const priced = price(bookingRequest({ attendees: [saurabhOn11, attendee("a2", "Kid", dateOfBirth, dayPass("2026-11-13"))] }));
    expect(lineFor(priced, "a2").productId).toBe(productId);
  });
});

describe("extras", () => {
  it("charges dinner and Garba per person per day, and Dandiya per pair", () => {
    const priced = price(
      bookingRequest({
        attendees: [
          attendee("a1", "Saurabh", BIRTHDAYS.saurabh, dayPass("2026-11-11", "2026-11-13"), {
            dinnerDays: ["2026-11-11", "2026-11-13"],
            garbaDays: ["2026-11-13"],
          }),
        ],
        dandiyaPairs: 3,
      }),
    );
    expect(priced.lines.map((l) => [l.productId, l.day, l.total, l.stockUnits])).toEqual([
      ["day-pass-adult", null, 3000, 1],
      ["dinner-plate", "2026-11-11", 1200, 1],
      ["dinner-plate", "2026-11-13", 1200, 1],
      ["garba-workshop", "2026-11-13", 2000, 1],
      ["dandiya-sticks", null, 1500, 3],
    ]);
  });
});

describe("the family from DESIGN.md, on 11 Nov", () => {
  it("comes to $187.00", () => {
    // Family Pass $40 + 3 adult Day Passes $45 + 6 dinners $72 + 1 Garba $20 + 2 Dandiya $10. Samskriti is free.
    expect(price(myFamilyOn11Nov()).subtotal).toBe(18700);
  });
});

it("finds tickets by what they are, not by their name", () => {
  expect(entryProductFor("chosen-days", "child").id).toBe("day-pass-child");
  expect(() => entryProductFor("one-day", "child")).toThrow();
});
