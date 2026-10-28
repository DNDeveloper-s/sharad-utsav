import { describe, expect, it } from "vitest";
import type { BookingRequest } from "./booking";
import { mustParseCalendarDate } from "./calendar";
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
import { validateBooking, type BookingIssue } from "./validate-booking";

function issuesOf(request: BookingRequest, today = BOOKING_DAY): BookingIssue[] {
  const result = validateBooking(request, today);
  return result.ok ? [] : result.error;
}

function codesOf(request: BookingRequest, today = BOOKING_DAY): string[] {
  return issuesOf(request, today).map((issue) => issue.code);
}

const saurabhOn11 = attendee("a1", "Saurabh", BIRTHDAYS.saurabh, dayPass("2026-11-11"));
const pass11 = { id: "fp1", day: "2026-11-11" } as const;

describe("a normal family booking", () => {
  it("passes, and each person gets the age band from their date of birth", () => {
    const result = validateBooking(myFamilyOn11Nov(), BOOKING_DAY);
    if (!result.ok) throw new Error(JSON.stringify(result.error));

    expect(result.value.attendees.map((a) => `${a.fullName}:${a.band}`)).toEqual([
      "Saurabh:adult",
      "Ayushi:adult",
      "Harsh:child",
      "Suraj:adult",
      "Rekha:adult",
      "Ramesh:adult",
      "Samskriti:under-5",
    ]);
  });

  it("works out the days each ticket covers", () => {
    const result = validateBooking(
      bookingRequest({
        familyPasses: [{ id: "fp1", day: "2026-11-12" }],
        attendees: [
          attendee("a1", "Saurabh", BIRTHDAYS.saurabh, dayPass("2026-11-11", "2026-11-13")),
          attendee("a2", "Ayushi", BIRTHDAYS.ayushi, allDayPass),
          attendee("a3", "Rekha", BIRTHDAYS.rekha, familyPass("fp1")),
        ],
      }),
      BOOKING_DAY,
    );
    if (!result.ok) throw new Error(JSON.stringify(result.error));

    expect(result.value.attendees.map((a) => a.attendingDays.length)).toEqual([2, 5, 1]);
  });
});

describe("ages", () => {
  it("needs the person paying to be 18 on the booking day", () => {
    const teen = { fullName: "Teen", email: "t@example.com", phone: "2145550100", dateOfBirth: "2008-10-29" };
    expect(issuesOf(myFamilyOn11Nov({ booker: teen }))).toEqual([
      { code: "BOOKER_UNDER_18", field: "booker.dateOfBirth" },
    ]);
  });

  it("points a bad date of birth at the right person", () => {
    const request = myFamilyOn11Nov();
    request.attendees[2] = attendee("a3", "Harsh", "2015-02-30", familyPass("fp1"));
    expect(issuesOf(request)).toEqual([{ code: "DOB_INVALID", field: "attendees.a3.dateOfBirth" }]);
  });

  it("needs a ticket for everyone aged 5 or more", () => {
    const request = bookingRequest({ attendees: [saurabhOn11, attendee("a2", "Harsh", BIRTHDAYS.harsh, noTicket)] });
    expect(codesOf(request)).toEqual(["TICKET_REQUIRED"]);
  });

  it("sells no ticket and no extras for a child under 5", () => {
    const ticket = bookingRequest({
      attendees: [saurabhOn11, attendee("a2", "Samskriti", BIRTHDAYS.samskriti, dayPass("2026-11-11"))],
    });
    const dinner = bookingRequest({
      attendees: [saurabhOn11, attendee("a2", "Samskriti", BIRTHDAYS.samskriti, noTicket, { dinnerDays: ["2026-11-11"] })],
    });
    expect(codesOf(ticket)).toEqual(["NO_TICKET_UNDER_5"]);
    expect(codesOf(dinner)).toEqual(["NO_EXTRAS_UNDER_5"]);
  });

  it("needs someone aged 18 or more in the group", () => {
    const teensOnly = bookingRequest({
      attendees: [
        attendee("a1", "Teen", "2010-01-01", dayPass("2026-11-11")),
        attendee("a2", "Harsh", BIRTHDAYS.harsh, dayPass("2026-11-11")),
      ],
    });
    expect(codesOf(teensOnly)).toEqual(["NO_ADULT_IN_GROUP"]);
  });

  it("catches the same person added twice, but not twins with different names", () => {
    const twice = bookingRequest({ attendees: [saurabhOn11, { ...saurabhOn11, id: "a2" }] });
    expect(issuesOf(twice)).toEqual([{ code: "DUPLICATE_PERSON", field: "attendees.a2" }]);

    const twins = bookingRequest({
      attendees: [
        saurabhOn11,
        attendee("a2", "Asha", "2015-06-15", dayPass("2026-11-11")),
        attendee("a3", "Usha", "2015-06-15", dayPass("2026-11-11")),
      ],
    });
    expect(codesOf(twins)).toEqual([]);
  });
});

describe("days", () => {
  it("does not sell a day that has already started (Texas time)", () => {
    const request = bookingRequest({
      attendees: [attendee("a1", "Saurabh", BIRTHDAYS.saurabh, dayPass("2026-11-10", "2026-11-11", "2026-11-12"))],
    });
    expect(issuesOf(request, mustParseCalendarDate("2026-11-11"))).toEqual([
      { code: "DAY_ALREADY_STARTED", field: "attendees.a1.entry.days", params: { day: "2026-11-10" } },
      { code: "DAY_ALREADY_STARTED", field: "attendees.a1.entry.days", params: { day: "2026-11-11" } },
    ]);
  });

  it("stops selling the All-Day Pass once day 1 has started", () => {
    const request = bookingRequest({ attendees: [attendee("a1", "Saurabh", BIRTHDAYS.saurabh, allDayPass)] });
    expect(codesOf(request, mustParseCalendarDate("2026-11-09"))).toEqual([]);
    expect(codesOf(request, mustParseCalendarDate("2026-11-10"))).toEqual(["ALL_DAY_PASS_CLOSED"]);
  });
});

describe("Family Pass", () => {
  const onPass = (id: string, name: string, dob: string) => attendee(id, name, dob, familyPass("fp1"));

  it("covers up to 2 adults and 2 children, and a toddler takes no place", () => {
    const request = bookingRequest({
      familyPasses: [pass11],
      attendees: [
        onPass("a1", "Saurabh", BIRTHDAYS.saurabh),
        onPass("a2", "Ayushi", BIRTHDAYS.ayushi),
        onPass("a3", "Harsh", BIRTHDAYS.harsh),
        onPass("a4", "Asha", "2017-01-01"),
        attendee("a5", "Samskriti", BIRTHDAYS.samskriti, noTicket),
      ],
    });
    expect(codesOf(request)).toEqual([]);
  });

  it("allows a smaller family", () => {
    const request = bookingRequest({
      familyPasses: [pass11],
      attendees: [onPass("a1", "Saurabh", BIRTHDAYS.saurabh), onPass("a2", "Harsh", BIRTHDAYS.harsh)],
    });
    expect(codesOf(request)).toEqual([]);
  });

  it("refuses a 3rd adult or a 3rd child", () => {
    const threeAdults = bookingRequest({
      familyPasses: [pass11],
      attendees: [
        onPass("a1", "Saurabh", BIRTHDAYS.saurabh),
        onPass("a2", "Ayushi", BIRTHDAYS.ayushi),
        onPass("a3", "Suraj", BIRTHDAYS.suraj),
      ],
    });
    const threeKids = bookingRequest({
      familyPasses: [pass11],
      attendees: [
        onPass("a1", "Saurabh", BIRTHDAYS.saurabh),
        onPass("a2", "Harsh", BIRTHDAYS.harsh),
        onPass("a3", "Asha", "2017-01-01"),
        onPass("a4", "Usha", "2018-01-01"),
      ],
    });
    expect(issuesOf(threeAdults)).toEqual([
      { code: "FAMILY_PASS_TOO_MANY_ADULTS", field: "familyPasses.fp1", params: { max: 2 } },
    ]);
    expect(codesOf(threeKids)).toEqual(["FAMILY_PASS_TOO_MANY_CHILDREN"]);
  });

  it("needs an adult on the pass", () => {
    const request = bookingRequest({
      familyPasses: [pass11],
      attendees: [saurabhOn11, onPass("a2", "Harsh", BIRTHDAYS.harsh)],
    });
    expect(codesOf(request)).toEqual(["FAMILY_PASS_NEEDS_ADULT"]);
  });

  it("does not sell a pass nobody is on, or one for a missing id", () => {
    expect(codesOf(bookingRequest({ familyPasses: [pass11], attendees: [saurabhOn11] }))).toEqual([
      "FAMILY_PASS_UNUSED",
    ]);
    expect(codesOf(bookingRequest({ attendees: [onPass("a1", "Saurabh", BIRTHDAYS.saurabh)] }))).toEqual([
      "FAMILY_PASS_NOT_FOUND",
    ]);
  });

  it("does not sell a pass for a day that has started", () => {
    const request = bookingRequest({ familyPasses: [pass11], attendees: [onPass("a1", "Saurabh", BIRTHDAYS.saurabh)] });
    expect(codesOf(request, mustParseCalendarDate("2026-11-11"))).toEqual(["DAY_ALREADY_STARTED"]);
  });
});

describe("extras", () => {
  it("allows dinner and Garba on days the person is there", () => {
    const request = bookingRequest({
      attendees: [
        attendee("a1", "Saurabh", BIRTHDAYS.saurabh, dayPass("2026-11-11", "2026-11-12"), {
          dinnerDays: ["2026-11-11", "2026-11-12"],
          garbaDays: ["2026-11-11"],
        }),
      ],
    });
    expect(codesOf(request)).toEqual([]);
  });

  it("refuses dinner on a day the person isn't coming", () => {
    const request = bookingRequest({
      attendees: [attendee("a1", "Saurabh", BIRTHDAYS.saurabh, dayPass("2026-11-11"), { dinnerDays: ["2026-11-12"] })],
    });
    expect(issuesOf(request)).toEqual([
      {
        code: "EXTRA_NOT_ON_ATTENDING_DAY",
        field: "attendees.a1.dinnerDays",
        params: { day: "2026-11-12", productId: "dinner-plate" },
      },
    ]);
  });

  it("refuses Garba on a day it doesn't run, even with an All-Day Pass", () => {
    const request = bookingRequest({
      attendees: [attendee("a1", "Saurabh", BIRTHDAYS.saurabh, allDayPass, { garbaDays: ["2026-11-12"] })],
    });
    expect(codesOf(request)).toEqual(["EXTRA_NOT_OFFERED_THAT_DAY"]);
  });

  it("keeps an adult's phone but not a child's", () => {
    const result = validateBooking(
      bookingRequest({
        attendees: [
          attendee("a1", "Saurabh", BIRTHDAYS.saurabh, dayPass("2026-11-11"), { phone: "2145550100" }),
          attendee("a2", "Harsh", BIRTHDAYS.harsh, dayPass("2026-11-11"), { phone: "2145550101" }),
        ],
      }),
      BOOKING_DAY,
    );
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    expect(result.value.attendees.map((a) => a.phone)).toEqual(["2145550100", null]);
  });
});

it("lists every problem at once, so they can all be fixed in one go", () => {
  const request = bookingRequest({
    booker: { fullName: "Teen", email: "t@example.com", phone: "2145550100", dateOfBirth: "2010-01-01" },
    attendees: [
      attendee("a1", "Saurabh", BIRTHDAYS.saurabh, dayPass("2026-11-11"), { garbaDays: ["2026-11-12"] }),
      attendee("a2", "Samskriti", BIRTHDAYS.samskriti, dayPass("2026-11-11")),
    ],
  });
  expect(codesOf(request)).toEqual(["BOOKER_UNDER_18", "EXTRA_NOT_OFFERED_THAT_DAY", "NO_TICKET_UNDER_5"]);
});
