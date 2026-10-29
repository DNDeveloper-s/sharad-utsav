import { describe, expect, it } from "vitest";
import { attendee, BIRTHDAYS, dayPass, myFamilyOn11Nov } from "@/domain/test-builders";
import { parseBookingRequest } from "./booking-schema";

// What a browser would send: plain JSON, nothing typed.
function asJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

function codesFor(body: unknown) {
  const result = parseBookingRequest(body);
  return result.ok ? [] : result.error;
}

const good = () => asJson(myFamilyOn11Nov({ promoCode: "  seva10 " }));

function withChange(change: (body: ReturnType<typeof myFamilyOn11Nov>) => void): unknown {
  const body = myFamilyOn11Nov();
  change(body);
  return asJson(body);
}

describe("a well formed booking", () => {
  it("passes, with spaces trimmed", () => {
    const result = parseBookingRequest(good());
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.promoCode).toBe("seva10");
  });
});

describe("the person paying", () => {
  it("needs a name, a real-looking email and a phone number", () => {
    const body = withChange((b) => {
      b.booker = { fullName: "   ", email: "saurabh.example.com", phone: "call me", dateOfBirth: BIRTHDAYS.saurabh };
    });
    expect(codesFor(body)).toEqual([
      { code: "NAME_INVALID", field: "booker.fullName" },
      { code: "EMAIL_INVALID", field: "booker.email" },
      { code: "PHONE_INVALID", field: "booker.phone" },
    ]);
  });

  it("accepts common phone formats", () => {
    for (const phone of ["+1 (214) 555-0100", "2145550100", "+91 98765 43210"]) {
      const body = withChange((b) => {
        b.booker.phone = phone;
      });
      expect(codesFor(body), phone).toEqual([]);
    }
  });
});

describe("the people coming", () => {
  it("allows 1 to 20 people", () => {
    expect(codesFor(withChange((b) => (b.attendees = [])))).toEqual([
      { code: "ATTENDEE_COUNT_INVALID", field: "attendees" },
    ]);

    const crowd = Array.from({ length: 21 }, (_, i) =>
      attendee(`p${i}`, `Guest ${i}`, BIRTHDAYS.suraj, dayPass("2026-11-11")),
    );
    expect(codesFor(withChange((b) => (b.attendees = crowd)))).toEqual([
      { code: "ATTENDEE_COUNT_INVALID", field: "attendees" },
    ]);
  });

  it("refuses two people with the same id", () => {
    const body = withChange((b) => {
      b.attendees.push(attendee("a1", "Copy", BIRTHDAYS.suraj, dayPass("2026-11-11")));
    });
    expect(codesFor(body)).toEqual([{ code: "DUPLICATE_ATTENDEE_ID", field: "attendees" }]);
  });

  it("points a missing name at the person by their id", () => {
    const body = withChange((b) => {
      b.attendees[2] = attendee("a3", "", BIRTHDAYS.harsh, dayPass("2026-11-11"));
    });
    expect(codesFor(body)).toEqual([{ code: "NAME_INVALID", field: "attendees.a3.fullName" }]);
  });
});

describe("days", () => {
  it("refuses the same day twice, so nothing is charged twice", () => {
    const body = withChange((b) => {
      b.attendees[3] = attendee("a4", "Suraj", BIRTHDAYS.suraj, dayPass("2026-11-11", "2026-11-11"), {
        dinnerDays: ["2026-11-11", "2026-11-11"],
      });
    });
    expect(codesFor(body)).toEqual([
      { code: "DUPLICATE_DAY", field: "attendees.a4.entry.days" },
      { code: "DUPLICATE_DAY", field: "attendees.a4.dinnerDays" },
    ]);
  });

  it("refuses a day that isn't a festival day", () => {
    const body = asJson(myFamilyOn11Nov());
    const changed = JSON.parse(JSON.stringify(body).replaceAll("2026-11-11", "2026-11-15"));
    expect(codesFor(changed).length).toBeGreaterThan(0);
  });

  it("refuses an empty Day Pass", () => {
    const family = myFamilyOn11Nov();
    const attendees = family.attendees.map((person) =>
      person.id === "a4" ? { ...person, entry: { type: "day-pass", days: [] } } : person,
    );

    const issues = codesFor(asJson({ ...family, attendees }));
    expect(issues).toHaveLength(1);
    expect(issues[0]?.field).toMatch(/^attendees\.a4\.entry\.days/);
  });
});

describe("other fields", () => {
  it("refuses the same Family Pass id twice", () => {
    const body = withChange((b) => b.familyPasses.push({ id: "fp1", day: "2026-11-12" }));
    expect(codesFor(body)).toEqual([{ code: "DUPLICATE_FAMILY_PASS_ID", field: "familyPasses" }]);
  });

  it.each([-1, 1.5, 21, "2"])("refuses %j pairs of Dandiya sticks", (pairs) => {
    const body = asJson({ ...myFamilyOn11Nov(), dandiyaPairs: pairs });
    expect(codesFor(body)).toEqual([{ code: "DANDIYA_QUANTITY_INVALID", field: "dandiyaPairs" }]);
  });

  it("refuses things that are not a booking at all", () => {
    expect(parseBookingRequest(null).ok).toBe(false);
    expect(parseBookingRequest("hello").ok).toBe(false);
    expect(parseBookingRequest({ attendees: "everyone" }).ok).toBe(false);
  });

  it("ignores fields it doesn't know, like a price sent from dev tools", () => {
    const sneaky = asJson({ ...myFamilyOn11Nov(), total: 1, discount: 99999 });
    const result = parseBookingRequest(sneaky);
    expect(result.ok && "total" in result.value).toBe(false);
  });
});
