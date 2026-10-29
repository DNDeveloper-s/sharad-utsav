import { beforeEach, describe, expect, it } from "vitest";
import { quoteBooking } from "@/domain/quote";
import {
  attendee,
  BIRTHDAYS,
  BOOKING_DAY,
  bookingRequest,
  dayPass,
  myFamilyOn11Nov,
  startingStock,
} from "@/domain/test-builders";
import { createBooking, saveBooking } from "./bookings";
import type { Db } from "./db";
import { createTestDb } from "./test-db";

// 10:00 in Texas on 28 Oct 2026, so "today" matches BOOKING_DAY in the domain tests.
const NOW = new Date("2026-10-28T15:00:00Z");

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

async function stockOf(productId: string): Promise<unknown> {
  const { rows } = await db.query("SELECT remaining FROM product_stock WHERE product_id = $1", [productId]);
  return rows[0]?.remaining;
}

async function usesOf(code: string): Promise<unknown> {
  const { rows } = await db.query("SELECT used_count FROM promo_usage WHERE code = $1", [code]);
  return rows[0]?.used_count;
}

async function bookingCount(): Promise<unknown> {
  const { rows } = await db.query("SELECT count(*)::int AS n FROM bookings");
  return rows[0]?.n;
}

const garbaFor = (id: string, name: string, dob: string) =>
  attendee(id, name, dob, dayPass("2026-11-11"), { garbaDays: ["2026-11-11"] });

describe("creating a booking", () => {
  it("saves it as waiting for payment for 15 minutes, and takes its stock", async () => {
    const result = await createBooking(db, myFamilyOn11Nov({ promoCode: "SEVA10" }), "key-1", NOW);

    expect(result).toMatchObject({
      kind: "created",
      repeated: false,
      booking: { status: "pending_payment", total: 16830, expiresAt: "2026-10-28T15:15:00.000Z" },
    });
    expect(await stockOf("family-pass")).toBe(94);
    expect(await stockOf("day-pass-adult")).toBe(377);
    expect(await stockOf("dinner-plate")).toBe(1694);
    expect(await stockOf("garba-workshop")).toBe(1);
    expect(await usesOf("SEVA10")).toBe(1);
  });

  it("saves the people and the price of every line", async () => {
    await createBooking(db, myFamilyOn11Nov(), "key-1", NOW);
    const people = await db.query("SELECT full_name, age_band FROM attendees ORDER BY attendee_id");
    const lines = await db.query("SELECT sum(line_total_cents)::int AS total FROM booking_lines");

    expect(people.rows.map((row) => `${String(row.full_name)}:${String(row.age_band)}`)).toEqual([
      "Saurabh:adult",
      "Ayushi:adult",
      "Harsh:child",
      "Suraj:adult",
      "Rekha:adult",
      "Ramesh:adult",
      "Samskriti:under-5",
    ]);
    expect(lines.rows[0]?.total).toBe(18700);
  });

  it("confirms a $0 booking straight away, with no hold", async () => {
    const small = bookingRequest({
      attendees: [attendee("a1", "Saurabh", BIRTHDAYS.saurabh, dayPass("2026-11-11"))],
      promoCode: "FLAT20",
    });
    expect(await createBooking(db, small, "key-1", NOW)).toMatchObject({
      kind: "created",
      booking: { status: "confirmed", total: 0, expiresAt: null },
    });
  });
});

describe("a second click on Pay", () => {
  it("gets the same booking back and takes nothing twice", async () => {
    const first = await createBooking(db, myFamilyOn11Nov(), "same-key", NOW);
    const second = await createBooking(db, myFamilyOn11Nov(), "same-key", NOW);

    expect(second).toMatchObject({ kind: "created", repeated: true });
    expect(first.kind === "created" && second.kind === "created" && first.booking.bookingId === second.booking.bookingId).toBe(true);
    expect(await bookingCount()).toBe(1);
    expect(await stockOf("family-pass")).toBe(94);
  });
});

describe("nothing is saved when the booking can't go ahead", () => {
  it("a badly formed request", async () => {
    expect(await createBooking(db, { attendees: "everyone" }, "key-1", NOW)).toMatchObject({ kind: "invalid" });
    expect(await bookingCount()).toBe(0);
  });

  it("a broken rule, like a ticket for a toddler", async () => {
    const request = bookingRequest({
      attendees: [
        attendee("a1", "Saurabh", BIRTHDAYS.saurabh, dayPass("2026-11-11")),
        attendee("a2", "Samskriti", BIRTHDAYS.samskriti, dayPass("2026-11-11")),
      ],
    });
    expect(await createBooking(db, request, "key-1", NOW)).toMatchObject({ kind: "not-bookable" });
    expect(await bookingCount()).toBe(0);
  });
});

describe("the last places", () => {
  it("sells the last 2 Garba places, then says no to the next family", async () => {
    const two = bookingRequest({
      attendees: [garbaFor("a1", "Saurabh", BIRTHDAYS.saurabh), garbaFor("a2", "Ayushi", BIRTHDAYS.ayushi)],
    });
    const one = bookingRequest({ attendees: [garbaFor("a1", "Suraj", BIRTHDAYS.suraj)] });

    expect(await createBooking(db, two, "family-a", NOW)).toMatchObject({ kind: "created" });
    expect(await createBooking(db, one, "family-b", NOW)).toMatchObject({ kind: "not-bookable" });
    expect(await stockOf("garba-workshop")).toBe(0);
  });

  it("still says no if two people were both shown the last place, and undoes everything", async () => {
    // Both families got a quote while 1 place was left. The first one books it.
    const request = bookingRequest({ attendees: [garbaFor("a1", "Suraj", BIRTHDAYS.suraj)] });
    const staleQuote = quoteBooking(request, {
      today: BOOKING_DAY,
      remainingStock: { ...startingStock(), "garba-workshop": 1 },
      promoUsedCounts: {},
    });
    if (!staleQuote.booking) throw new Error("expected a bookable quote");
    await db.query("UPDATE product_stock SET remaining = 0 WHERE product_id = 'garba-workshop'");

    const booking = staleQuote.booking;
    await expect(db.transaction((tx) => saveBooking(tx, staleQuote, booking, "family-b", NOW))).rejects.toThrow(
      "sold-out",
    );
    expect(await bookingCount()).toBe(0);
    expect(await stockOf("day-pass-adult")).toBe(380); // the Day Pass taken earlier in the transaction is back
  });

  it("does not hold a promo use past its limit, even with an out-of-date quote", async () => {
    await db.query("UPDATE promo_usage SET used_count = 100 WHERE code = 'MAXEDOUT'");
    const request = bookingRequest({
      attendees: [attendee("a1", "Saurabh", BIRTHDAYS.saurabh, dayPass("2026-11-11"))],
      promoCode: "MAXEDOUT",
    });
    const staleQuote = quoteBooking(request, {
      today: BOOKING_DAY,
      remainingStock: startingStock(),
      promoUsedCounts: { MAXEDOUT: 99 },
    });
    if (!staleQuote.booking) throw new Error("expected a bookable quote");

    const booking = staleQuote.booking;
    await expect(db.transaction((tx) => saveBooking(tx, staleQuote, booking, "key-1", NOW))).rejects.toThrow(
      "promo-used-up",
    );
    expect(await usesOf("MAXEDOUT")).toBe(100);
  });
});
